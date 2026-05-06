/**
 * In-memory cache utility.
 * ARCHITECTURE NOTE: The Binance websocket stream writes latest market
 * snapshots here once, then all Socket.IO clients consume the same in-memory
 * object. This avoids duplicate upstream calls per connected user.
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
