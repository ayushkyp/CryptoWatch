/**
 * In-memory cache utility.
 * ARCHITECTURE NOTE: This cache reduces CoinGecko API calls from
 * (users × interval) down to just 1 per interval, regardless of how
 * many users are connected. All socket broadcasts read from this object,
 * not from repeated external HTTP requests.
 */

const cache = {};

const setCache = (key, value) => {
  cache[key] = value;
};

const getCache = (key) => {
  return cache[key];
};

const getAllCache = () => {
  return cache;
};

module.exports = { setCache, getCache, getAllCache };
