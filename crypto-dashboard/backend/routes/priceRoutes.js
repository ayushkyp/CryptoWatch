const express = require('express');
const axios = require('axios');
const router = express.Router();
const { getCache } = require('../utils/cache');

// ─── Cache config ─────────────────────────────────────────────────────────────
// Different TTLs per period: shorter for recent data, longer for historical
const historyCache = {};
const CACHE_TTL = { 7: 15 * 60 * 1000, 30: 30 * 60 * 1000, 90: 60 * 60 * 1000 };
const STALE_GRACE = 4 * 60 * 60 * 1000; // serve stale data up to 4 hours on failure
const inFlight = {};

// ─── USD→INR exchange rate (cached 6 hours) ───────────────────────────────────
let usdInrRate = 83.5; // safe default
let usdInrFetchedAt = 0;
const getUsdInrRate = async () => {
  if (Date.now() - usdInrFetchedAt < 6 * 60 * 60 * 1000) return usdInrRate;
  try {
    // open.er-api.com is free, no auth, 1500 req/month (plenty for daily refreshes)
    const res = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 5000 });
    const rate = res.data?.rates?.INR;
    if (rate) { usdInrRate = rate; usdInrFetchedAt = Date.now(); }
    console.log(`USD/INR rate: ${usdInrRate}`);
  } catch { /* keep previous rate */ }
  return usdInrRate;
};

// ─── CoinGecko ID → Binance symbol mapping ────────────────────────────────────
// Binance has 1200 req/min (free, no auth) vs CoinGecko's 10–30 req/min
const BINANCE_MAP = {
  'bitcoin': 'BTCUSDT', 'ethereum': 'ETHUSDT', 'tether': null,
  'binancecoin': 'BNBUSDT', 'ripple': 'XRPUSDT', 'solana': 'SOLUSDT',
  'dogecoin': 'DOGEUSDT', 'cardano': 'ADAUSDT', 'polkadot': 'DOTUSDT',
  'chainlink': 'LINKUSDT', 'shiba-inu': 'SHIBUSDT', 'avalanche-2': 'AVAXUSDT',
  'matic-network': 'MATICUSDT', 'polygon': 'MATICUSDT', 'uniswap': 'UNIUSDT',
  'litecoin': 'LTCUSDT', 'stellar': 'XLMUSDT', 'monero': 'XMRUSDT',
  'algorand': 'ALGOUSDT', 'cosmos': 'ATOMUSDT', 'internet-computer': 'ICPUSDT',
  'filecoin': 'FILUSDT', 'ethereum-classic': 'ETCUSDT', 'vechain': 'VETUSDT',
  'near': 'NEARUSDT', 'near-protocol': 'NEARUSDT',
  'the-sandbox': 'SANDUSDT', 'decentraland': 'MANAUSDT',
  'axie-infinity': 'AXSUSDT', 'aave': 'AAVEUSDT', 'maker': 'MKRUSDT',
  'fantom': 'FTMUSDT', 'tron': 'TRXUSDT', 'bitcoin-cash': 'BCHUSDT',
  'wrapped-bitcoin': 'WBTCUSDT', 'hedera-hashgraph': 'HBARUSDT', 'hedera': 'HBARUSDT',
  'the-graph': 'GRTUSDT', 'eos': 'EOSUSDT', 'dash': 'DASHUSDT',
  'zcash': 'ZECUSDT', 'neo': 'NEOUSDT', 'iota': 'IOTAUSDT',
  'aptos': 'APTUSDT', 'arbitrum': 'ARBUSDT', 'optimism': 'OPUSDT',
  'sui': 'SUIUSDT', 'injective-protocol': 'INJUSDT', 'injective': 'INJUSDT',
  'stacks': 'STXUSDT', 'immutable-x': 'IMXUSDT', 'blur': 'BLURUSDT',
  'sei-network': 'SEIUSDT', 'celestia': 'TIAUSDT', 'pyth-network': 'PYTHUSDT',
  'bonk': 'BONKUSDT', 'pepe': 'PEPEUSDT', 'floki': 'FLOKIUSDT',
  'kaspa': 'KASUSDT', 'render-token': 'RENDERUSDT', 'fetch-ai': 'FETUSDT',
  'worldcoin-wld': 'WLDUSDT', 'gala': 'GALAUSDT', 'sandbox': 'SANDUSDT',
  'ocean-protocol': 'OCEANUSDT', 'band-protocol': 'BANDUSDT',
  'chiliz': 'CHZUSDT', '1inch': '1INCHUSDT', 'curve-dao-token': 'CRVUSDT',
  'compound-governance-token': 'COMPUSDT', 'yearn-finance': 'YFIUSDT',
  'usd-coin': null, 'binance-usd': null, 'dai': null, 'true-usd': null,
  'frax': null, 'usdd': null,
};

// For unmapped coins, derive symbol from coinId (works for ~80% of cases)
const getBinanceSymbol = (coinId) => {
  if (coinId in BINANCE_MAP) return BINANCE_MAP[coinId];
  // 'bitcoin-cash' → 'BCH', 'the-graph' handled above
  // Generic: take first segment and uppercase it
  const base = coinId.split('-')[0].toUpperCase();
  if (base.length >= 2 && base.length <= 8) return `${base}USDT`;
  return null;
};

// ─── Binance klines fetch ─────────────────────────────────────────────────────
const fetchFromBinance = async (symbol, days) => {
  // Use appropriate granularity per period
  let interval, limit;
  if (days <= 7)  { interval = '1h';  limit = days * 24; }    // hourly  → 168 points
  else if (days <= 30) { interval = '4h'; limit = days * 6;  }  // 4-hourly → 180 points
  else                  { interval = '1d'; limit = days;       }  // daily    → 90 points

  const res = await axios.get('https://api.binance.com/api/v3/klines', {
    params: { symbol, interval, limit: Math.min(limit, 1000) },
    timeout: 10000,
  });

  const rate = await getUsdInrRate();
  return res.data.map((c) => ({
    timestamp: new Date(c[0]).toISOString(), // open time
    price: parseFloat(c[4]) * rate,          // close price → INR
  }));
};

// ─── CoinGecko market_chart fetch (fallback) ─────────────────────────────────
const fetchFromCoinGecko = async (coinId, days) => {
  const headers = { Accept: 'application/json' };
  const apiKey = process.env.COINGECKO_API_KEY;
  if (apiKey) headers['x-cg-demo-api-key'] = apiKey;

  const res = await axios.get(
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`,
    { params: { vs_currency: 'inr', days }, headers, timeout: 15000 }
  );
  return res.data.prices.map(([ts, price]) => ({
    timestamp: new Date(ts).toISOString(),
    price,
  }));
};

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/prices/current
router.get('/current', (req, res) => {
  const prices = getCache('prices');
  if (!prices || prices.length === 0) {
    return res.status(503).json({ error: 'Prices not loaded yet, try again in 15 seconds' });
  }
  res.json(prices);
});

// GET /api/prices/history/:coinId?days=7|30|90
router.get('/history/:coinId', async (req, res) => {
  const { coinId } = req.params;
  const days = parseInt(req.query.days, 10) || 7;
  const cacheKey = `${coinId}-${days}`;
  const ttl = CACHE_TTL[days] || CACHE_TTL[7];

  // 1. Fresh cache
  const cached = historyCache[cacheKey];
  if (cached && Date.now() - cached.fetchedAt < ttl) {
    return res.json(cached.data);
  }

  // 2. In-flight dedup
  if (inFlight[cacheKey]) {
    try { return res.json(await inFlight[cacheKey]); } catch {}
  }

// ─── In-memory set of Binance symbols that returned 400 (invalid pair) ───────
// Avoids wasting a round-trip on the same bad symbol every time
const binanceBadSymbols = new Set();

  const fetchPromise = (async () => {
    const binanceSymbol = getBinanceSymbol(coinId);

    // ── Primary: Binance (no auth, 1200 req/min) ──
    if (binanceSymbol && !binanceBadSymbols.has(binanceSymbol)) {
      try {
        const data = await fetchFromBinance(binanceSymbol, days);
        if (data.length > 5) {
          historyCache[cacheKey] = { data, fetchedAt: Date.now(), source: 'binance' };
          return data;
        }
      } catch (e) {
        // 400 = invalid trading pair — blacklist so we skip Binance next time
        if (e.response?.status === 400) {
          binanceBadSymbols.add(binanceSymbol);
          console.warn(`Binance: invalid symbol ${binanceSymbol} (blacklisted) — using CoinGecko`);
        } else {
          console.warn(`Binance [${binanceSymbol} ${days}d]: ${e.message} — trying CoinGecko`);
        }
      }
    }

    // ── Fallback: CoinGecko ──
    const data = await fetchFromCoinGecko(coinId, days);
    historyCache[cacheKey] = { data, fetchedAt: Date.now(), source: 'coingecko' };
    return data;
  })();

  inFlight[cacheKey] = fetchPromise;

  try {
    return res.json(await fetchPromise);
  } catch (error) {
    console.error(`History [${coinId} ${days}d] both sources failed: ${error.message}`);

    // Stale cache is always better than an error
    if (cached && Date.now() - cached.fetchedAt < STALE_GRACE) {
      console.log(`Serving stale cache (${Math.round((Date.now() - cached.fetchedAt) / 60000)}m old) for ${cacheKey}`);
      return res.json(cached.data);
    }

    const status = error.response?.status;
    return res.status(status === 429 ? 429 : 500).json({
      error: status === 429
        ? 'Rate limited. Charts will load shortly — please wait a moment.'
        : 'Failed to fetch price history',
      data: [],
    });
  } finally {
    delete inFlight[cacheKey];
  }
});

module.exports = router;

