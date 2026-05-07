const express = require('express');
const { getCurrentPrices } = require('../services/marketDataService');

const router = express.Router();

// Returns the shared market snapshot regardless of which upstream provider won.
router.get('/current', async (req, res) => {
  try {
    const prices = await getCurrentPrices();

    if (!Array.isArray(prices) || prices.length === 0) {
      return res.status(503).json({
        error: 'Live prices are warming up. Please retry in a few seconds.',
        prices: [],
      });
    }

    return res.json(prices);
  } catch (error) {
    const statusCode = error.response?.status || 503;
    return res.status(statusCode).json({
      error: 'Failed to fetch current prices',
      details: error.message,
      prices: [],
    });
  }
});

module.exports = router;
