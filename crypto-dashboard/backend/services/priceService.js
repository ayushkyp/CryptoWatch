const axios = require('axios');
const { setCache, getCache } = require('../utils/cache');
const PriceHistory = require('../models/PriceHistory');

const TRACKED_COINS = [
  { id: 'bitcoin',   symbol: 'BTC',  name: 'Bitcoin',   binance: 'BTCUSDT'  },
  { id: 'ethereum',  symbol: 'ETH',  name: 'Ethereum',  binance: 'ETHUSDT'  },
  { id: 'solana',    symbol: 'SOL',  name: 'Solana',    binance: 'SOLUSDT'  },
  { id: 'dogecoin',  symbol: 'DOGE', name: 'Dogecoin',  binance: 'DOGEUSDT' },
  { id: 'ripple',    symbol: 'XRP',  name: 'XRP',       binance: 'XRPUSDT'  },
  { id: 'cardano',   symbol: 'ADA',  name: 'Cardano',   binance: 'ADAUSDT'  },
  { id: 'polkadot',  symbol: 'DOT',  name: 'Polkadot',  binance: 'DOTUSDT'  },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', binance: 'LINKUSDT' },
];

// ─── USD/INR exchange rate (shared with priceRoutes) ─────────────────────────
let usdInrRate = 83.5;
let usdInrFetchedAt = 0;
const getUsdInrRate = async () => {
  if (Date.now() - usdInrFetchedAt < 6 * 60 * 60 * 1000) return usdInrRate;
  try {
    const res = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 5000 });
    const rate = res.data?.rates?.INR;
    if (rate) { usdInrRate = rate; usdInrFetchedAt = Date.now(); }
  } catch {}
  return usdInrRate;
};

// ─── Binance 24hr ticker → live prices ───────────────────────────────────────
const fetchFromBinance = async () => {
  const symbols = JSON.stringify(TRACKED_COINS.map((c) => c.binance));
  const res = await axios.get('https://api.binance.com/api/v3/ticker/24hr', {
    params: { symbols },
    timeout: 8000,
  });

  const rate = await getUsdInrRate();
  const tickerMap = {};
  res.data.forEach((t) => { tickerMap[t.symbol] = t; });

  return TRACKED_COINS.map((coin) => {
    const t = tickerMap[coin.binance] || {};
    const price = parseFloat(t.lastPrice || 0) * rate;
    const change24h = parseFloat(t.priceChangePercent || 0);
    // quoteVolume is in USDT; convert to INR
    const volume24h = parseFloat(t.quoteVolume || 0) * rate;

    return { id: coin.id, name: coin.name, symbol: coin.symbol, price, change24h, volume24h, marketCap: 0 };
  });
};

// ─── CoinGecko simple/price → live prices (fallback) ─────────────────────────
const fetchFromCoinGecko = async () => {
  const ids = TRACKED_COINS.map((c) => c.id).join(',');
  const headers = { Accept: 'application/json' };
  const apiKey = process.env.COINGECKO_API_KEY;
  if (apiKey) headers['x-cg-demo-api-key'] = apiKey;

  const res = await axios.get(`${process.env.COINGECKO_BASE_URL}/simple/price`, {
    params: { ids, vs_currencies: 'inr', include_24hr_change: true, include_market_cap: true },
    headers,
    timeout: 10000,
  });

  const data = res.data;
  return TRACKED_COINS.map((coin) => {
    const d = data[coin.id] || {};
    return {
      id: coin.id, name: coin.name, symbol: coin.symbol,
      price: d.inr || 0, change24h: d.inr_24h_change || 0,
      marketCap: d.inr_market_cap || 0, volume24h: 0,
    };
  });
};

// ─── Enrich market cap from the coin list cache (populated by coinListRoutes) ─
const enrichMarketCap = (prices) => {
  const coinList = getCache('coinList');
  if (!coinList || coinList.length === 0) return prices;
  const mcMap = {};
  coinList.forEach((c) => { mcMap[c.id] = c.marketCap; });
  return prices.map((p) => ({ ...p, marketCap: mcMap[p.id] || p.marketCap }));
};

// ─── Main function called by socket broadcaster ───────────────────────────────
const fetchAndCachePrices = async () => {
  let prices = null;
  let source = 'unknown';

  // Try Binance first — no auth, 1200 req/min, no rate limit issues
  try {
    prices = await fetchFromBinance();
    source = 'binance';
  } catch (e) {
    console.warn(`Binance ticker failed (${e.message}), falling back to CoinGecko`);
  }

  // Fall back to CoinGecko
  if (!prices) {
    try {
      prices = await fetchFromCoinGecko();
      source = 'coingecko';
    } catch (error) {
      console.error('Error fetching live prices from CoinGecko:', error.message);

      // Use cached prices rather than mock data if available
      const existing = getCache('prices');
      if (existing && existing.length > 0) {
        console.log('Using previously cached prices (stale but real)');
        return existing;
      }

      console.log('No cache available — using mock data as last resort');
      prices = TRACKED_COINS.map((coin) => ({
        id: coin.id, name: coin.name, symbol: coin.symbol,
        price: Math.random() * 100000 + 10000,
        change24h: (Math.random() - 0.5) * 10,
        marketCap: Math.random() * 1e13, volume24h: 0,
      }));
      source = 'mock';
    }
  }

  // Enrich market cap from the cached coin list
  prices = enrichMarketCap(prices);
  if (source !== 'mock') console.log(`Live prices fetched from ${source}`);

  setCache('prices', prices);

  // Persist to MongoDB for historical analysis
  try {
    const historyDocs = prices
      .filter((p) => p.price > 0)
      .map((p) => ({ coin: p.id, price: p.price, change24h: p.change24h, timestamp: new Date() }));
    if (historyDocs.length) await PriceHistory.insertMany(historyDocs);
  } catch {}

  return prices;
};

module.exports = { fetchAndCachePrices, TRACKED_COINS };

