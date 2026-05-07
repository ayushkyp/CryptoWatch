const express = require('express');
const { TRACKED_BY_SYMBOL } = require('../config/trackedCoins');
const { getHistoricalPrices } = require('../services/marketDataService');

const router = express.Router();

const normalizeSymbol = (rawSymbol) => {
  const clean = String(rawSymbol || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (!clean) return null;
  if (clean.endsWith('USDT')) return clean;

  const tracked = TRACKED_BY_SYMBOL[clean];
  if (tracked) return tracked.binanceSymbol;

  return `${clean}USDT`;
};

router.get('/:symbol', async (req, res) => {
  const symbol = normalizeSymbol(req.params.symbol);
  const period = Number.parseInt(req.query.period || req.query.days || '7', 10);
  const days = [7, 30, 90].includes(period) ? period : 7;

  if (!symbol) {
    return res.status(400).json({ error: 'Invalid symbol' });
  }

  try {
    const data = await getHistoricalPrices(symbol, days);
    return res.json(data);
  } catch (error) {
    const statusCode = error.response?.status || 500;
    console.error(`[history] Error fetching ${symbol}:`, error.message);
    return res.status(statusCode).json({
      error: 'Failed to fetch historical data',
      details: error.message,
      data: [],
    });
  }
});

module.exports = router;