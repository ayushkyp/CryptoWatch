const express = require('express');
const axios = require('axios');
const { TRACKED_BY_SYMBOL } = require('../config/trackedCoins');

const router = express.Router();

const historyCache = {};
const inFlight = {};

const CACHE_TTL = {
  7: 5 * 60 * 1000,
  30: 15 * 60 * 1000,
  90: 30 * 60 * 1000,
};

let usdInrRate = 83.5;
let usdInrFetchedAt = 0;

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
  } catch {
    // Use last known rate.
  }

  return usdInrRate;
};

const resolveParams = (period) => {
  if (period === 90) return { interval: '1d', limit: 90 };
  if (period === 30) return { interval: '4h', limit: 180 };
  return { interval: '1h', limit: 168 };
};

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

  const cacheKey = `${symbol}:${days}`;
  const cached = historyCache[cacheKey];
  const ttl = CACHE_TTL[days];

  if (cached && Date.now() - cached.fetchedAt < ttl) {
    return res.json(cached.data);
  }

  if (inFlight[cacheKey]) {
    try {
      const data = await inFlight[cacheKey];
      return res.json(data);
    } catch {
      // Continue to direct request path.
    }
  }

  const fetchPromise = (async () => {
    const { interval, limit } = resolveParams(days);
    console.log(`[history] Fetching ${symbol} ${days}d with interval=${interval}, limit=${limit}`);
    
    try {
      const [klineRes, fxRate] = await Promise.all([
        axios.get('https://api.binance.com/api/v3/klines', {
          params: { symbol, interval, limit },
          timeout: 10000,
        }),
        getUsdInrRate(),
      ]);

      if (!klineRes.data || klineRes.data.length === 0) {
        console.warn(`[history] No kline data for ${symbol}`);
        return [];
      }

      const data = (klineRes.data || []).map((row) => {
        const openPrice = Number.parseFloat(row[1]) * fxRate;
        const highPrice = Number.parseFloat(row[2]) * fxRate;
        const lowPrice = Number.parseFloat(row[3]) * fxRate;
        const closePrice = Number.parseFloat(row[4]) * fxRate;
        const volumePrice = Number.parseFloat(row[7]) * fxRate;

        // Validate prices
        if (!Number.isFinite(closePrice) || closePrice <= 0) {
          return null;
        }

        return {
          date: new Date(row[0]).toISOString(),
          open: openPrice,
          high: highPrice,
          low: lowPrice,
          close: closePrice,
          volume: volumePrice,
        };
      }).filter(Boolean);

      console.log(`[history] Got ${data.length} candles for ${symbol}`);

      historyCache[cacheKey] = {
        data,
        fetchedAt: Date.now(),
      };

      return data;
    } catch (error) {
      console.error(`[history] Binance API error for ${symbol}:`, error.message);
      throw error;
    }
  })();

  inFlight[cacheKey] = fetchPromise;

  try {
    const data = await fetchPromise;
    return res.json(data);
  } catch (error) {
    const statusCode = error.response?.status || 500;
    console.error(`[history] Error fetching ${symbol}:`, error.message);
    return res.status(statusCode).json({
      error: 'Failed to fetch historical data',
      details: error.message,
      data: [],
    });
  } finally {
    delete inFlight[cacheKey];
  }
});

module.exports = router;