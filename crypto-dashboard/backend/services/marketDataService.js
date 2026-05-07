const { getCache, setCache } = require('../utils/cache');
const binanceService = require('./binanceService');
const kucoinService = require('./kucoinService');
const bybitService = require('./bybitService');

const CURRENT_PRICES_TTL_MS = 15 * 1000;
const HISTORICAL_PRICES_TTL_MS = 60 * 1000;

const providerEntries = [
  ['Binance', binanceService],
  ['KuCoin', kucoinService],
  ['Bybit', bybitService],
];

const providerMap = providerEntries.reduce((acc, [name, service]) => {
  acc[name] = service;
  return acc;
}, {});

const providerStatus = providerEntries.reduce((acc, [name]) => {
  acc[name] = {
    lastError: null,
    lastFailureAt: 0,
    lastSuccessAt: 0,
    online: false,
  };
  return acc;
}, {});

const currentPricesCache = {
  data: null,
  fetchedAt: 0,
  providerName: null,
};

const historicalPricesCache = new Map();

const liveStatus = {
  activeProvider: null,
  anyProviderOnline: false,
  lastSuccessAt: 0,
  liveMode: 'warming-up',
};

const getProviderNames = (providerNames) => {
  if (!Array.isArray(providerNames) || providerNames.length === 0) {
    return providerEntries.map(([name]) => name);
  }

  return providerNames.filter((name) => providerMap[name]);
};

const hasFreshCurrentPrices = () => (
  Array.isArray(currentPricesCache.data)
  && currentPricesCache.data.length > 0
  && Date.now() - currentPricesCache.fetchedAt < CURRENT_PRICES_TTL_MS
);

const updateSharedPriceCache = (prices) => {
  const priceMap = (Array.isArray(prices) ? prices : []).reduce((acc, coin) => {
    if (coin?.binanceSymbol) {
      acc[coin.binanceSymbol] = coin;
    }
    return acc;
  }, {});

  setCache('latestPrices', priceMap);
  setCache('prices', Object.values(priceMap));
  return priceMap;
};

const setCurrentCache = (prices, providerName) => {
  currentPricesCache.data = prices;
  currentPricesCache.fetchedAt = Date.now();
  currentPricesCache.providerName = providerName;
  updateSharedPriceCache(prices);
};

const markProviderSuccess = (providerName) => {
  if (!providerStatus[providerName]) return;

  providerStatus[providerName].online = true;
  providerStatus[providerName].lastError = null;
  providerStatus[providerName].lastSuccessAt = Date.now();
};

const markProviderFailure = (providerName, error) => {
  if (!providerStatus[providerName]) return;

  providerStatus[providerName].online = false;
  providerStatus[providerName].lastError = error?.message || 'Unknown provider error';
  providerStatus[providerName].lastFailureAt = Date.now();

  if (liveStatus.activeProvider === providerName) {
    liveStatus.activeProvider = null;
    liveStatus.anyProviderOnline = false;
    liveStatus.liveMode = 'degraded';
  }
};

const isFailoverError = (error, context = 'rest') => {
  if (!error) return false;

  const status = error.response?.status;
  if ([403, 429, 451].includes(status)) {
    return true;
  }

  const code = String(error.code || '').toUpperCase();
  if (['ECONNABORTED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT'].includes(code)) {
    return true;
  }

  const message = String(error.message || '');
  if (/timeout|network|socket|websocket/i.test(message)) {
    return true;
  }

  if (context === 'websocket') {
    return true;
  }

  return !status;
};

const runProviderMethod = async (providerName, methodName, args) => {
  const provider = providerMap[providerName];
  if (!provider?.[methodName]) {
    throw new Error(`Provider ${providerName} does not implement ${methodName}`);
  }

  let lastError;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const data = await provider[methodName](...args);
      markProviderSuccess(providerName);
      return { data, providerName };
    } catch (error) {
      lastError = error;
      if (attempt === 1) {
        console.warn(`[Provider] ${providerName} request failed (${error.message}). Retrying once before failover.`);
      }
    }
  }

  markProviderFailure(providerName, lastError);
  throw lastError;
};

const executeWithFallback = async (methodName, args = [], options = {}) => {
  const providerNames = getProviderNames(options.providerNames);
  let lastError;

  // Fallback flow is centralized here so routes and sockets keep a stable API
  // while provider order and failover rules remain isolated to one module.
  for (let index = 0; index < providerNames.length; index += 1) {
    const providerName = providerNames[index];

    try {
      return await runProviderMethod(providerName, methodName, args);
    } catch (error) {
      lastError = error;
      const nextProviderName = providerNames[index + 1];

      if (nextProviderName) {
        console.warn(`[Provider] ${providerName} failed, switching to ${nextProviderName}`);
        continue;
      }
    }
  }

  throw lastError || new Error(`No provider could satisfy ${methodName}`);
};

const getCurrentPrices = async (options = {}) => {
  const { bypassCache = false, providerNames } = options;

  if (!bypassCache && !providerNames && hasFreshCurrentPrices()) {
    return currentPricesCache.data;
  }

  try {
    const result = await executeWithFallback('getCurrentPrices', [], { providerNames });
    setCurrentCache(result.data, result.providerName);
    return result.data;
  } catch (error) {
    if (Array.isArray(currentPricesCache.data) && currentPricesCache.data.length > 0) {
      console.warn(`[Provider] Returning cached current prices after upstream failure: ${error.message}`);
      return currentPricesCache.data;
    }

    const cachedPriceMap = getCache('latestPrices') || {};
    const cachedPrices = Object.values(cachedPriceMap);
    if (cachedPrices.length > 0) {
      console.warn(`[Provider] Returning shared price cache after upstream failure: ${error.message}`);
      return cachedPrices;
    }

    throw error;
  }
};

const getHistoricalPrices = async (symbol, days = 7, options = {}) => {
  const normalizedDays = [7, 30, 90].includes(Number(days)) ? Number(days) : 7;
  const cacheKey = `${String(symbol || '').toUpperCase()}:${normalizedDays}`;
  const cached = historicalPricesCache.get(cacheKey);
  const providerNames = options.providerNames;

  if (!providerNames && cached && Date.now() - cached.fetchedAt < HISTORICAL_PRICES_TTL_MS) {
    return cached.data;
  }

  try {
    const result = await executeWithFallback('getHistoricalPrices', [symbol, normalizedDays], { providerNames });
    historicalPricesCache.set(cacheKey, {
      data: result.data,
      fetchedAt: Date.now(),
      providerName: result.providerName,
    });
    return result.data;
  } catch (error) {
    if (cached?.data?.length) {
      console.warn(`[Provider] Returning cached historical prices for ${cacheKey}: ${error.message}`);
      return cached.data;
    }

    throw error;
  }
};

const publishLivePrices = ({ prices, providerName, mode }) => {
  setCurrentCache(prices, providerName);
  liveStatus.activeProvider = providerName;
  liveStatus.anyProviderOnline = Array.isArray(prices) && prices.length > 0;
  liveStatus.lastSuccessAt = Date.now();
  liveStatus.liveMode = mode;
  markProviderSuccess(providerName);
  return getCache('latestPrices') || {};
};

const setLiveProviderOffline = (providerName, error, mode = 'degraded') => {
  markProviderFailure(providerName, error);
  liveStatus.liveMode = mode;
  liveStatus.anyProviderOnline = Array.isArray(currentPricesCache.data) && currentPricesCache.data.length > 0;
};

const getLatestPricesMap = () => getCache('latestPrices') || {};

const getMarketStatus = () => {
  const freshCurrentProvider = hasFreshCurrentPrices() ? currentPricesCache.providerName : null;
  const anyProviderOnline = liveStatus.anyProviderOnline || Boolean(freshCurrentProvider);

  return {
    online: anyProviderOnline,
    activeProvider: liveStatus.activeProvider || freshCurrentProvider,
    currentProvider: currentPricesCache.providerName,
    liveMode: liveStatus.liveMode,
    lastSuccessAt: liveStatus.lastSuccessAt || currentPricesCache.fetchedAt || 0,
    providers: providerEntries.reduce((acc, [name]) => {
      acc[name] = { ...providerStatus[name] };
      return acc;
    }, {}),
  };
};

module.exports = {
  CURRENT_PRICES_TTL_MS,
  HISTORICAL_PRICES_TTL_MS,
  executeWithFallback,
  getCurrentPrices,
  getHistoricalPrices,
  getLatestPricesMap,
  getMarketStatus,
  isFailoverError,
  publishLivePrices,
  setLiveProviderOffline,
};