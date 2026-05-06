const express = require('express');
const axios = require('axios');
const router = express.Router();
const { setCache, getCache } = require('../utils/cache');

let coinListCache = [];
let lastFetched = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// GET /api/coins — top 250 coins by market cap
router.get('/', async (req, res) => {
  try {
    const now = Date.now();
    // Check module-level cache first (fastest), then shared cache
    if (coinListCache.length > 0 && lastFetched && (now - lastFetched) < CACHE_DURATION) {
      return res.json(coinListCache);
    }

    // Check shared cache (written by a previous request, survives module reload)
    const sharedCache = getCache('coinList');
    if (sharedCache && sharedCache.length > 0 && lastFetched && (now - lastFetched) < CACHE_DURATION) {
      coinListCache = sharedCache;
      return res.json(coinListCache);
    }

    const response = await axios.get(
      'https://api.coingecko.com/api/v3/coins/markets',
      {
        params: {
          vs_currency: 'inr',
          order: 'market_cap_desc',
          per_page: 250,
          page: 1,
          sparkline: false,
          price_change_percentage: '24h',
        },
        timeout: 15000,
      }
    );

    coinListCache = response.data.map(coin => ({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      price: coin.current_price,
      change24h: coin.price_change_percentage_24h,
      marketCap: coin.market_cap,
      volume24h: coin.total_volume,
      image: coin.image,
      rank: coin.market_cap_rank,
    }));
    lastFetched = now;

    // Store in shared cache so priceService can enrich market cap
    setCache('coinList', coinListCache);

    res.json(coinListCache);
  } catch (error) {
    console.error('Coin list fetch error:', error.message);
    if (coinListCache.length > 0) return res.json(coinListCache);
    res.status(500).json({ error: 'Failed to fetch coin list' });
  }
});

module.exports = router;
