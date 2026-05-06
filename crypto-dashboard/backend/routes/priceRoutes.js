const express = require('express');
const { getCache } = require('../utils/cache');

const router = express.Router();

// Returns latest in-memory prices maintained by Binance websocket stream.
router.get('/current', (req, res) => {
  const latestPrices = getCache('latestPrices') || {};
  const prices = Object.values(latestPrices);

  if (prices.length === 0) {
    return res.status(503).json({
      error: 'Live prices are warming up. Please retry in a few seconds.',
      prices: [],
    });
  }

  return res.json(prices);
});

module.exports = router;
