const WebSocket = require('ws');
const { getCache } = require('../utils/cache');
const { checkAlerts } = require('./alertService');
const {
  getCurrentPrices,
  getLatestPricesMap,
  getMarketStatus,
  isFailoverError,
  publishLivePrices,
  setLiveProviderOffline,
} = require('./marketDataService');
const { buildMarketSnapshot, getUsdInrRate } = require('./providerUtils');

const BINANCE_STREAM_URL = 'wss://stream.binance.com:9443/ws/!ticker@arr';
let wsClient = null;
let ioInstance = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let streamStarted = false;
let streamHealthTimer = null;
let pollingFallbackTimer = null;
let pollingFallbackActive = false;
let lastWsMessageAt = 0;
let recentDisconnects = [];

let hasLoggedFirstPayload = false;

const normalizeTickers = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload?.s && (payload?.c || payload?.h || payload?.l)) return [payload];
  return [];
};

const broadcastLatestPrices = async () => {
  if (!ioInstance) return;
  try {
    const latestPrices = getLatestPricesMap();
    ioInstance.emit('livePrices', latestPrices);
    ioInstance.emit('marketStatus', getMarketStatus());
    await checkAlerts(latestPrices, ioInstance);
  } catch (error) {
    console.error('[binance-stream] broadcast error:', error.message);
  }
};

const emitMarketStatus = () => {
  if (!ioInstance) return;
  ioInstance.emit('marketStatus', getMarketStatus());
};

const handleTickerPayload = async (payload) => {
  const tickers = normalizeTickers(payload);
  if (tickers.length === 0) return;

  if (!hasLoggedFirstPayload) {
    hasLoggedFirstPayload = true;
    const sampleSymbol = tickers[0]?.s || 'unknown';
    console.log(`[binance-stream] first payload received (${tickers.length} tickers, sample=${sampleSymbol})`);
  }

  const rate = await getUsdInrRate();
  const priceBatch = [];

  for (const ticker of tickers) {
    const symbol = ticker?.s;
    if (!symbol || !symbol.endsWith('USDT')) continue;

    const snapshot = buildMarketSnapshot({
      pairSymbol: symbol,
      priceUsd: ticker.c,
      change24h: ticker.P,
      highUsd: ticker.h,
      lowUsd: ticker.l,
      volumeUsd: ticker.q,
      timestamp: Date.now(),
      rate,
    });

    if (snapshot) {
      priceBatch.push(snapshot);
    }
  }

  if (priceBatch.length === 0) return;

  publishLivePrices({ prices: priceBatch, providerName: 'Binance', mode: 'websocket' });
  await broadcastLatestPrices();
};

const fetchViaPollingFallback = async () => {
  try {
    const prices = await getCurrentPrices({
      bypassCache: true,
      providerNames: ['KuCoin', 'Bybit'],
    });

    const providerName = getMarketStatus().currentProvider || 'KuCoin';
    publishLivePrices({ prices, providerName, mode: 'polling' });
    await broadcastLatestPrices();
  } catch (error) {
    console.warn(`[binance-stream] polling fallback fetch failed: ${error.message}`);
  }
};

const stopPollingFallback = () => {
  if (pollingFallbackTimer) {
    clearInterval(pollingFallbackTimer);
    pollingFallbackTimer = null;
  }
  pollingFallbackActive = false;
};

const startPollingFallback = () => {
  if (pollingFallbackTimer) return;

  pollingFallbackActive = true;
  console.warn('[binance-stream] websocket unhealthy, enabling provider polling fallback');
  emitMarketStatus();

  fetchViaPollingFallback();
  pollingFallbackTimer = setInterval(fetchViaPollingFallback, 5000);
};

const recordDisconnect = () => {
  const cutoff = Date.now() - 2 * 60 * 1000;
  recentDisconnects = recentDisconnects.filter((timestamp) => timestamp >= cutoff);
  recentDisconnects.push(Date.now());
};

const shouldUsePollingFallback = () => recentDisconnects.length >= 2;

const closeExistingSocket = () => {
  if (!wsClient) return;

  wsClient.removeAllListeners();
  try {
    wsClient.terminate();
  } catch {
    // Ignore socket shutdown errors.
  }
  wsClient = null;
};

const scheduleReconnect = () => {
  if (reconnectTimer) return;
  reconnectAttempts += 1;
  const delayMs = Math.min(30000, 1000 * Math.pow(2, Math.min(reconnectAttempts, 5)));

  console.warn(`[binance-stream] reconnect attempt ${reconnectAttempts} in ${delayMs}ms`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delayMs);
};

const connect = () => {
  if (wsClient && (wsClient.readyState === WebSocket.OPEN || wsClient.readyState === WebSocket.CONNECTING)) {
    return;
  }

  closeExistingSocket();
  wsClient = new WebSocket(BINANCE_STREAM_URL);

  wsClient.on('open', () => {
    reconnectAttempts = 0;
    lastWsMessageAt = Date.now();
    console.log('[binance-stream] connected to Binance ticker stream');
    console.log('[binance-stream] listening for ticker updates...');

    const cached = getCache('latestPrices');
    if (cached && Object.keys(cached).length > 0 && ioInstance) {
      console.log(`[binance-stream] broadcasting ${Object.keys(cached).length} cached prices`);
      ioInstance.emit('livePrices', cached);
    }
    emitMarketStatus();
  });

  wsClient.on('message', async (raw) => {
    try {
      lastWsMessageAt = Date.now();
      if (pollingFallbackActive) {
        console.log('[binance-stream] websocket data resumed, disabling polling fallback');
        stopPollingFallback();
      }

      const payload = JSON.parse(raw.toString());
      await handleTickerPayload(payload);
    } catch (error) {
      console.error(`[binance-stream] parse/process error: ${error.message}`);
    }
  });

  wsClient.on('error', (error) => {
    console.error(`[binance-stream] websocket error: ${error.message}`);
    if (isFailoverError(error, 'websocket')) {
      setLiveProviderOffline('Binance', error, 'degraded');
      emitMarketStatus();
      if (shouldUsePollingFallback()) {
        startPollingFallback();
      }
    }
  });

  wsClient.on('close', (code, reason) => {
    const reasonText = reason ? reason.toString() : 'no reason';
    console.warn(`[binance-stream] disconnected (code=${code}, reason=${reasonText})`);
    recordDisconnect();
    setLiveProviderOffline('Binance', new Error(`Websocket closed: ${code} ${reasonText}`), 'degraded');
    emitMarketStatus();
    if (shouldUsePollingFallback()) {
      startPollingFallback();
    }
    scheduleReconnect();
  });
};

const startStreamHealthMonitor = () => {
  if (streamHealthTimer) return;

  streamHealthTimer = setInterval(() => {
    if (!streamStarted) return;
    if (lastWsMessageAt === 0 || Date.now() - lastWsMessageAt > 15000) {
      setLiveProviderOffline('Binance', new Error('Websocket heartbeat timeout'), 'polling');
      emitMarketStatus();
      startPollingFallback();
    }
  }, 5000);
};

const startBinanceStream = (io) => {
  ioInstance = io;

  if (streamStarted) {
    console.log('[binance-stream] stream already started; reusing existing websocket');
    if (ioInstance) {
      const cached = getCache('latestPrices');
      if (cached && Object.keys(cached).length > 0) {
        ioInstance.emit('livePrices', cached);
      }
      emitMarketStatus();
    }
    return;
  }

  streamStarted = true;
  console.log('[binance-stream] starting Binance stream service...');
  startStreamHealthMonitor();
  connect();
};

const stopBinanceStream = () => {
  streamStarted = false;
  if (streamHealthTimer) {
    clearInterval(streamHealthTimer);
    streamHealthTimer = null;
  }
  stopPollingFallback();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  closeExistingSocket();
};

const getLatestPrices = () => getLatestPricesMap();

module.exports = {
  startBinanceStream,
  stopBinanceStream,
  getLatestPrices,
};
