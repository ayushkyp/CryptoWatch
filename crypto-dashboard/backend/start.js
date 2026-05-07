require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const { initSocket } = require('./socket/socketHandler');
const { startBinanceStream } = require('./services/binanceSocketService');
const { getCurrentPrices, getMarketStatus } = require('./services/marketDataService');

const authRoutes = require('./routes/authRoutes');
const watchlistRoutes = require('./routes/watchlistRoutes');
const alertRoutes = require('./routes/alertRoutes');
const priceRoutes = require('./routes/priceRoutes');
const coinListRoutes = require('./routes/coinListRoutes');
const historyRoutes = require('./routes/historyRoutes');

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection (non-fatal):', reason?.message || reason);
});

const app = express();

const defaultOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];
const envOrigins = String(process.env.FRONTEND_URL || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...defaultOrigins, ...envOrigins]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/coins', coinListRoutes);
app.use('/api/history', historyRoutes);

app.get('/health', (req, res) => {
  const marketStatus = getMarketStatus();
  res.json({
    status: marketStatus.online ? 'OK' : 'DEGRADED',
    websocket: marketStatus.online ? 'online' : 'offline',
    database: mongoose.connection.readyState === 1 ? 'online' : 'offline',
    marketData: marketStatus,
  });
});

const server = http.createServer(app);
const DEFAULT_PORT = 5000;
const isProduction = process.env.NODE_ENV === 'production';
const allowPortFallback = !isProduction && process.env.ALLOW_PORT_FALLBACK !== 'false';
const configuredPort = Number(process.env.PORT) || DEFAULT_PORT;
const MAX_PORT_ATTEMPTS = 10;
let currentPort = configuredPort;

const listenWithRetry = () => {
  const maxAttempts = allowPortFallback ? MAX_PORT_ATTEMPTS : 1;

  const attemptListen = (attemptNumber) => new Promise((resolve, reject) => {
    const onListening = () => {
      server.off('error', onError);
      resolve(currentPort);
    };

    const onError = (err) => {
      server.off('listening', onListening);

      if (err.code === 'EADDRINUSE' && allowPortFallback && attemptNumber < maxAttempts) {
        const nextPort = currentPort + 1;
        console.warn(`Port ${currentPort} is in use. Retrying on ${nextPort}...`);
        currentPort = nextPort;
        resolve(attemptListen(attemptNumber + 1));
        return;
      }

      reject(err);
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(currentPort);
  });

  return attemptListen(1);
};

const start = async () => {
  try {
    // Market data routes can run without MongoDB, so startup should not block
    // forever on database connectivity during local development or partial outages.
    const databaseConnected = await connectDB();
    if (!databaseConnected) {
      console.warn('[startup] Continuing without database connectivity. Auth, watchlist, and alerts may be degraded.');
    }
    try {
      await getCurrentPrices();
    } catch (error) {
      console.warn(`[startup] Initial market data warmup failed: ${error.message}`);
    }

    const io = initSocket(server);
    startBinanceStream(io);

    const activePort = await listenWithRetry();
    console.log(`Server running on port ${activePort}`);
  } catch (error) {
    if (error?.code === 'EADDRINUSE') {
      console.error(`Port ${currentPort} is already in use.`);
      if (allowPortFallback) {
        console.error(`Tried ${MAX_PORT_ATTEMPTS} ports starting from ${configuredPort}.`);
      }
    }
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

start();
