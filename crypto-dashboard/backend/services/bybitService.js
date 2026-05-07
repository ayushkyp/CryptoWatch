const axios = require('axios');
const {
  buildHistoricalPoint,
  buildMarketSnapshot,
  getHistoryWindow,
  getUsdInrRate,
  normalizePairSymbol,
} = require('./providerUtils');

const BYBIT_TICKERS_URL = 'https://api.bybit.com/v5/market/tickers';
const BYBIT_KLINES_URL = 'https://api.bybit.com/v5/market/kline';

const getCurrentPrices = async () => {
  const [response, rate] = await Promise.all([
    axios.get(BYBIT_TICKERS_URL, {
      params: { category: 'spot' },
      timeout: 8000,
    }),
    getUsdInrRate(),
  ]);

  const tickers = response.data?.result?.list;
  const tickerList = Array.isArray(tickers) ? tickers : [];

  return tickerList
    .filter((ticker) => String(ticker?.symbol || '').endsWith('USDT'))
    .map((ticker) => buildMarketSnapshot({
      pairSymbol: ticker.symbol,
      priceUsd: ticker.lastPrice,
      change24h: ticker.price24hPcnt ? Number.parseFloat(ticker.price24hPcnt) * 100 : 0,
      highUsd: ticker.highPrice24h,
      lowUsd: ticker.lowPrice24h,
      volumeUsd: ticker.turnover24h,
      timestamp: Date.now(),
      rate,
    }))
    .filter(Boolean);
};

const getHistoricalPrices = async (symbol, days = 7) => {
  const pairSymbol = normalizePairSymbol(symbol);
  if (!pairSymbol) {
    throw new Error('Invalid symbol');
  }

  const { interval, limit } = getHistoryWindow(days).bybit;
  const [response, rate] = await Promise.all([
    axios.get(BYBIT_KLINES_URL, {
      params: {
        category: 'spot',
        symbol: pairSymbol,
        interval,
        limit,
      },
      timeout: 10000,
    }),
    getUsdInrRate(),
  ]);

  const rows = Array.isArray(response.data?.result?.list) ? response.data.result.list : [];

  return rows
    .reverse()
    .map((row) => buildHistoricalPoint({
      openTime: row[0],
      open: row[1],
      high: row[2],
      low: row[3],
      close: row[4],
      volume: row[6] || row[5],
      rate,
    }))
    .filter(Boolean);
};

module.exports = {
  getCurrentPrices,
  getHistoricalPrices,
  name: 'Bybit',
};