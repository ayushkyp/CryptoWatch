const express = require('express');
const { getCache } = require('../utils/cache');
const { TRACKED_COINS } = require('../config/trackedCoins');

const router = express.Router();

router.get('/', (req, res) => {
  const latestPrices = getCache('latestPrices') || {};

  let list = Object.values(latestPrices)
    .filter((coin) => Number.isFinite(coin?.price) && coin.price > 0)
    .sort((a, b) => (Number(b.volume || 0) - Number(a.volume || 0)))
    .map((coin, index) => ({
      id: coin.id || String(coin.symbol || '').toLowerCase(),
      name: coin.name || coin.symbol,
      symbol: coin.symbol,
      binanceSymbol: coin.binanceSymbol || `${coin.symbol}USDT`,
      image: coin.image || null,
      rank: index + 1,
      price: Number(coin.price || 0),
      change24h: Number(coin.change24h ?? coin.changePercent ?? 0),
      high: Number(coin.high || 0),
      low: Number(coin.low || 0),
      volume24h: Number(coin.volume || 0),
      marketCap: 0,
    }));

  // During warmup, provide a stable fallback list so UI still renders.
  if (list.length === 0) {
    list = TRACKED_COINS.map((coin, index) => ({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      binanceSymbol: coin.binanceSymbol,
      image: coin.image,
      rank: index + 1,
      price: 0,
      change24h: 0,
      high: 0,
      low: 0,
      volume24h: 0,
      marketCap: 0,
    }));
  }

  return res.json(list);
});

module.exports = router;
