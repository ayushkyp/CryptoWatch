const axios = require('axios');
const { TRACKED_BY_BINANCE, TRACKED_BY_SYMBOL } = require('../config/trackedCoins');

const USD_INR_URL = 'https://open.er-api.com/v6/latest/USD';
const DEFAULT_USD_INR_RATE = 83.5;

let usdInrRate = DEFAULT_USD_INR_RATE;
let usdInrFetchedAt = 0;

const makeDefaultCoinMeta = (pairSymbol) => {
  const normalizedPair = String(pairSymbol || '').toUpperCase();
  const baseSymbol = normalizedPair.endsWith('USDT') ? normalizedPair.slice(0, -4) : normalizedPair;

  return {
    id: baseSymbol.toLowerCase(),
    symbol: baseSymbol,
    name: baseSymbol,
    binanceSymbol: normalizedPair,
    image: `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${baseSymbol.toLowerCase()}.png`,
  };
};

const resolveCoinMeta = (pairSymbol) => {
  const normalizedPair = String(pairSymbol || '').toUpperCase();
  return TRACKED_BY_BINANCE[normalizedPair] || makeDefaultCoinMeta(normalizedPair);
};

const normalizePairSymbol = (rawSymbol) => {
  const clean = String(rawSymbol || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (!clean) return null;
  if (clean.endsWith('USDT')) return clean;

  const trackedCoin = TRACKED_BY_SYMBOL[clean];
  if (trackedCoin?.binanceSymbol) return trackedCoin.binanceSymbol;

  return `${clean}USDT`;
};

const toKucoinSymbol = (pairSymbol) => {
  const normalizedPair = normalizePairSymbol(pairSymbol);
  if (!normalizedPair) return null;

  if (normalizedPair.endsWith('USDT')) {
    return `${normalizedPair.slice(0, -4)}-USDT`;
  }

  return normalizedPair;
};

const getUsdInrRate = async () => {
  const sixHours = 6 * 60 * 60 * 1000;
  if (Date.now() - usdInrFetchedAt < sixHours) {
    return usdInrRate;
  }

  try {
    const response = await axios.get(USD_INR_URL, { timeout: 6000 });
    const nextRate = response.data?.rates?.INR;
    if (Number.isFinite(nextRate) && nextRate > 0) {
      usdInrRate = nextRate;
      usdInrFetchedAt = Date.now();
    }
  } catch {
    // Keep using the last known exchange rate.
  }

  return usdInrRate;
};

const toFiniteNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildMarketSnapshot = ({
  pairSymbol,
  priceUsd,
  change24h,
  highUsd,
  lowUsd,
  volumeUsd,
  marketCap = 0,
  timestamp = Date.now(),
  rate,
}) => {
  const normalizedPair = normalizePairSymbol(pairSymbol);
  if (!normalizedPair) return null;

  const coin = resolveCoinMeta(normalizedPair);
  const effectiveRate = Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_USD_INR_RATE;
  const price = toFiniteNumber(priceUsd) * effectiveRate;

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  const high = toFiniteNumber(highUsd) * effectiveRate;
  const low = toFiniteNumber(lowUsd) * effectiveRate;
  const volume24h = toFiniteNumber(volumeUsd) * effectiveRate;
  const normalizedChange = toFiniteNumber(change24h);
  const normalizedTimestamp = Number.isFinite(Number(timestamp)) ? Number(timestamp) : Date.now();

  return {
    id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    binanceSymbol: normalizedPair,
    image: coin.image,
    price,
    change24h: normalizedChange,
    changePercent: normalizedChange,
    high,
    low,
    volume: volume24h,
    volume24h,
    marketCap: toFiniteNumber(marketCap),
    timestamp: normalizedTimestamp,
    updatedAt: normalizedTimestamp,
  };
};

const buildHistoricalPoint = ({
  openTime,
  open,
  high,
  low,
  close,
  volume,
  rate,
}) => {
  const effectiveRate = Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_USD_INR_RATE;
  const closeValue = toFiniteNumber(close) * effectiveRate;

  if (!Number.isFinite(closeValue) || closeValue <= 0) {
    return null;
  }

  return {
    date: new Date(Number(openTime)).toISOString(),
    open: toFiniteNumber(open) * effectiveRate,
    high: toFiniteNumber(high) * effectiveRate,
    low: toFiniteNumber(low) * effectiveRate,
    close: closeValue,
    volume: toFiniteNumber(volume) * effectiveRate,
  };
};

const getHistoryWindow = (days) => {
  if (days === 90) {
    return {
      binance: { interval: '1d', limit: 90 },
      kucoin: { type: '1day', limit: 90 },
      bybit: { interval: 'D', limit: 90 },
    };
  }

  if (days === 30) {
    return {
      binance: { interval: '4h', limit: 180 },
      kucoin: { type: '4hour', limit: 180 },
      bybit: { interval: '240', limit: 180 },
    };
  }

  return {
    binance: { interval: '1h', limit: 168 },
    kucoin: { type: '1hour', limit: 168 },
    bybit: { interval: '60', limit: 168 },
  };
};

module.exports = {
  buildHistoricalPoint,
  buildMarketSnapshot,
  getHistoryWindow,
  getUsdInrRate,
  normalizePairSymbol,
  resolveCoinMeta,
  toFiniteNumber,
  toKucoinSymbol,
};