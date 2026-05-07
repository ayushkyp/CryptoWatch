const axios = require('axios');
const {
  buildHistoricalPoint,
  buildMarketSnapshot,
  getHistoryWindow,
  getUsdInrRate,
  normalizePairSymbol,
} = require('./providerUtils');

const BINANCE_TICKER_URL = 'https://api.binance.com/api/v3/ticker/24hr';
const BINANCE_KLINES_URL = 'https://api.binance.com/api/v3/klines';

const getCurrentPrices = async () => {
  const [response, rate] = await Promise.all([
    axios.get(BINANCE_TICKER_URL, { timeout: 8000 }),
    getUsdInrRate(),
  ]);

  const tickers = Array.isArray(response.data) ? response.data : [];

  return tickers
    .filter((ticker) => String(ticker?.symbol || '').endsWith('USDT'))
    .map((ticker) => buildMarketSnapshot({
      pairSymbol: ticker.symbol,
      priceUsd: ticker.lastPrice,
      change24h: ticker.priceChangePercent,
      highUsd: ticker.highPrice,
      lowUsd: ticker.lowPrice,
      volumeUsd: ticker.quoteVolume,
      timestamp: ticker.closeTime || Date.now(),
      rate,
    }))
    .filter(Boolean);
};

const getHistoricalPrices = async (symbol, days = 7) => {
  const pairSymbol = normalizePairSymbol(symbol);
  if (!pairSymbol) {
    throw new Error('Invalid symbol');
  }

  const { interval, limit } = getHistoryWindow(days).binance;
  const [response, rate] = await Promise.all([
    axios.get(BINANCE_KLINES_URL, {
      params: { symbol: pairSymbol, interval, limit },
      timeout: 10000,
    }),
    getUsdInrRate(),
  ]);

  const rows = Array.isArray(response.data) ? response.data : [];

  return rows
    .map((row) => buildHistoricalPoint({
      openTime: row[0],
      open: row[1],
      high: row[2],
      low: row[3],
      close: row[4],
      volume: row[7],
      rate,
    }))
    .filter(Boolean);
};

module.exports = {
  getCurrentPrices,
  getHistoricalPrices,
  name: 'Binance',
};