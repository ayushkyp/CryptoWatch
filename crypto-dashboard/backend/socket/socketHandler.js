const { Server } = require('socket.io');
const { fetchAndCachePrices } = require('../services/priceService');
const { checkAlerts } = require('../services/alertService');
const { getCache } = require('../utils/cache');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,      // wait 60s for pong before declaring connection dead
    pingInterval: 25000,     // send ping every 25s
    transports: ['websocket', 'polling'],
    upgradeTimeout: 10000,
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Send current cached prices immediately on connection
    const cachedPrices = getCache('prices');
    if (cachedPrices) {
      socket.emit('priceUpdate', cachedPrices);
    }

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

/**
 * SCALABILITY NOTE: Prices are fetched ONCE per interval, stored in the
 * in-memory cache, then broadcast to ALL connected clients in a single
 * io.emit() call. This means the system makes 1 CoinGecko API request
 * per interval regardless of whether 1 or 10,000 users are connected.
 */
const startPriceBroadcast = async (ioInstance) => {
  const interval = parseInt(process.env.PRICE_FETCH_INTERVAL) || 60000;

  // Fetch immediately on startup so first broadcast happens right away
  const initialPrices = await fetchAndCachePrices();
  if (initialPrices) {
    ioInstance.emit('priceUpdate', initialPrices);
    await checkAlerts(initialPrices, ioInstance);
  }

  setInterval(async () => {
    try {
      const prices = await fetchAndCachePrices();
      if (prices) {
        ioInstance.emit('priceUpdate', prices);
        await checkAlerts(prices, ioInstance);
      }
    } catch (err) {
      // Never let a price fetch error crash the whole server
      console.error('Price broadcast error (non-fatal):', err.message);
    }
  }, interval);
};

const getIO = () => io;

module.exports = { initSocket, startPriceBroadcast, getIO };
