const WebSocket = require('ws');
const axios = require('axios');
const { setCache, getCache } = require('../utils/cache');
const { checkAlerts } = require('./alertService');
const { TRACKED_BY_BINANCE } = require('../config/trackedCoins');

const BINANCE_STREAM_URL = 'wss://stream.binance.com:9443/ws/!ticker@arr';
const BINANCE_REST_TICKER_URL = 'https://api.binance.com/api/v3/ticker/24hr';

let wsClient = null;
let ioInstance = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let streamStarted = false;
let streamHealthTimer = null;
let restFallbackTimer = null;
let restFallbackActive = false;
let lastWsMessageAt = 0;

let latestPrices = {};
let usdInrRate = 83.5;
let usdInrFetchedAt = 0;
let hasLoggedFirstPayload = false;

const makeDefaultCoinMeta = (binanceSymbol) => {
  const symbol = String(binanceSymbol || '').toUpperCase();
  const baseSymbol = symbol.endsWith('USDT') ? symbol.slice(0, -4) : symbol;
  const normalizedBase = baseSymbol || symbol;

  return {
    id: normalizedBase.toLowerCase(),
    symbol: normalizedBase,
    name: normalizedBase,
    binanceSymbol: symbol,
    image: `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${normalizedBase.toLowerCase()}.png`,
  };
};

const resolveCoinMeta = (binanceSymbol) => {
  const known = TRACKED_BY_BINANCE[binanceSymbol];
  if (known) return known;
  return makeDefaultCoinMeta(binanceSymbol);
};

const getUsdInrRate = async () => {
  const sixHours = 6 * 60 * 60 * 1000;
  if (Date.now() - usdInrFetchedAt < sixHours) return usdInrRate;

  try {
    const res = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 6000 });
    const nextRate = res.data?.rates?.INR;
    if (nextRate && Number.isFinite(nextRate)) {
      usdInrRate = nextRate;
      usdInrFetchedAt = Date.now();
    }
  } catch (error) {
    console.warn(`[binance-stream] USD/INR refresh failed: ${error.message}`);
  }

  return usdInrRate;
};

const normalizeTickers = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload?.s && (payload?.c || payload?.h || payload?.l)) return [payload];
  return [];
};

const broadcastLatestPrices = async () => {
  if (!ioInstance) return;
  try {
    ioInstance.emit('livePrices', latestPrices);
    await checkAlerts(latestPrices, ioInstance);
  } catch (error) {
    console.error('[binance-stream] broadcast error:', error.message);
  }
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
  let hasUpdate = false;

  for (const ticker of tickers) {
    const symbol = ticker?.s;
    if (!symbol || !symbol.endsWith('USDT')) continue;

    const coin = resolveCoinMeta(symbol);

    const priceUsd = Number.parseFloat(ticker.c || '0');
    const highUsd = Number.parseFloat(ticker.h || '0');
    const lowUsd = Number.parseFloat(ticker.l || '0');
    const quoteVolumeUsd = Number.parseFloat(ticker.q || '0');
    const change24hPercent = Number.parseFloat(ticker.P || '0');

    const priceInr = priceUsd * rate;
    const highInr = highUsd * rate;
    const lowInr = lowUsd * rate;
    const volumeInr = quoteVolumeUsd * rate;

    if (!Number.isFinite(priceInr) || priceInr <= 0) continue;

    latestPrices[symbol] = {
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      binanceSymbol: coin.binanceSymbol,
      image: coin.image,
      price: priceInr,
      change24h: change24hPercent,
      changePercent: change24hPercent,
      volume: volumeInr,
      high: highInr,
      low: lowInr,
      updatedAt: Date.now(),
    };

    hasUpdate = true;
  }

  if (!hasUpdate) return;

  setCache('latestPrices', latestPrices);
  setCache('prices', Object.values(latestPrices));
  await broadcastLatestPrices();
};

const fetchViaRestFallback = async () => {
  try {
    const res = await axios.get(BINANCE_REST_TICKER_URL, {
      timeout: 7000,
    });

    if (!Array.isArray(res.data)) return;

    const payload = res.data.map((ticker) => ({
      s: ticker?.symbol,
      c: ticker?.lastPrice,
      h: ticker?.highPrice,
      l: ticker?.lowPrice,
      q: ticker?.quoteVolume,
      P: ticker?.priceChangePercent,
    }));

    await handleTickerPayload(payload);
  } catch (error) {
    console.warn(`[binance-stream] REST fallback fetch failed: ${error.message}`);
  }
};

const stopRestFallback = () => {
  if (restFallbackTimer) {
    clearInterval(restFallbackTimer);
    restFallbackTimer = null;
  }
  restFallbackActive = false;
};

const startRestFallback = () => {
  if (restFallbackTimer) return;

  restFallbackActive = true;
  console.warn('[binance-stream] websocket stalled, enabling REST fallback updates');

  fetchViaRestFallback();
  restFallbackTimer = setInterval(fetchViaRestFallback, 5000);
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
  });

  wsClient.on('message', async (raw) => {
    try {
      lastWsMessageAt = Date.now();
      if (restFallbackActive) {
        console.log('[binance-stream] websocket data resumed, disabling REST fallback');
        stopRestFallback();
      }

      const payload = JSON.parse(raw.toString());
      await handleTickerPayload(payload);
    } catch (error) {
      console.error(`[binance-stream] parse/process error: ${error.message}`);
    }
  });

  wsClient.on('error', (error) => {
    console.error(`[binance-stream] websocket error: ${error.message}`);
  });

  wsClient.on('close', (code, reason) => {
    const reasonText = reason ? reason.toString() : 'no reason';
    console.warn(`[binance-stream] disconnected (code=${code}, reason=${reasonText})`);
    startRestFallback();
    scheduleReconnect();
  });
};

const startStreamHealthMonitor = () => {
  if (streamHealthTimer) return;

  streamHealthTimer = setInterval(() => {
    if (!streamStarted) return;
    if (lastWsMessageAt === 0 || Date.now() - lastWsMessageAt > 15000) {
      startRestFallback();
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
  stopRestFallback();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (wsClient) {
    wsClient.terminate();
    wsClient = null;
  }
};

const getLatestPrices = () => latestPrices;

module.exports = {
  startBinanceStream,
  stopBinanceStream,
  getLatestPrices,
};
