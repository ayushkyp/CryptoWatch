const axios = require('axios');
const {
  buildHistoricalPoint,
  buildMarketSnapshot,
  getHistoryWindow,
  getUsdInrRate,
  normalizePairSymbol,
  toKucoinSymbol,
} = require('./providerUtils');

const KUCOIN_TICKERS_URL = 'https://api.kucoin.com/api/v1/market/allTickers';
const KUCOIN_CANDLES_URL = 'https://api.kucoin.com/api/v1/market/candles';

const getCurrentPrices = async () => {
  const [response, rate] = await Promise.all([
    axios.get(KUCOIN_TICKERS_URL, { timeout: 8000 }),
    getUsdInrRate(),
  ]);

  const tickers = response.data?.data?.ticker;
  const tickerList = Array.isArray(tickers) ? tickers : [];

  return tickerList
    .filter((ticker) => String(ticker?.symbol || '').endsWith('-USDT'))
    .map((ticker) => buildMarketSnapshot({
      pairSymbol: String(ticker.symbol).replace('-', ''),
      priceUsd: ticker.last,
      change24h: ticker.changeRate ? Number.parseFloat(ticker.changeRate) * 100 : 0,
      highUsd: ticker.high,
      lowUsd: ticker.low,
      volumeUsd: ticker.volValue,
      timestamp: Date.now(),
      rate,
    }))
    .filter(Boolean);
};

const getHistoricalPrices = async (symbol, days = 7) => {
  const pairSymbol = normalizePairSymbol(symbol);
  const kucoinSymbol = toKucoinSymbol(pairSymbol);
  if (!kucoinSymbol) {
    throw new Error('Invalid symbol');
  }

  const { type, limit } = getHistoryWindow(days).kucoin;
  const [response, rate] = await Promise.all([
    axios.get(KUCOIN_CANDLES_URL, {
      params: { symbol: kucoinSymbol, type },
      timeout: 10000,
    }),
    getUsdInrRate(),
  ]);

  const rows = Array.isArray(response.data?.data) ? response.data.data : [];

  return rows
    .slice(0, limit)
    .reverse()
    .map((row) => buildHistoricalPoint({
      openTime: Number(row[0]) * 1000,
      open: row[1],
      close: row[2],
      high: row[3],
      low: row[4],
      volume: row[6] || row[5],
      rate,
    }))
    .filter(Boolean);
};

module.exports = {
  getCurrentPrices,
  getHistoricalPrices,
  name: 'KuCoin',
};