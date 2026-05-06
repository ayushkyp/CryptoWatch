const { Server } = require('socket.io');
const { getCache } = require('../utils/cache');

let io;

const initSocket = (server) => {
  const defaultOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const envOrigins = String(process.env.FRONTEND_URL || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  io = new Server(server, {
    cors: {
      origin: [...new Set([...defaultOrigins, ...envOrigins])],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,      // wait 60s for pong before declaring connection dead
    pingInterval: 25000,     // send ping every 25s
    transports: ['websocket', 'polling'],
    upgradeTimeout: 10000,
  });

  io.on('connection', (socket) => {
    console.log(`[socket] client connected: ${socket.id}`);
    
    const cachedPrices = getCache('latestPrices');
    if (cachedPrices && Object.keys(cachedPrices).length > 0) {
      socket.emit('livePrices', cachedPrices);
    }

    // Listen for user authentication to join their specific room
    socket.on('authenticate', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`[socket] user ${userId} joined their alert room via socket ${socket.id}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[socket] client disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => io;

module.exports = { initSocket, getIO };
