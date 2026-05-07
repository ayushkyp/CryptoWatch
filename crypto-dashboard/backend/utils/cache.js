/**
 * In-memory cache utility.
 * ARCHITECTURE NOTE: The market data manager writes provider-normalized
 * snapshots here once, then routes and Socket.IO clients consume the same
 * shared object. This avoids duplicate upstream calls per connected user.
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
