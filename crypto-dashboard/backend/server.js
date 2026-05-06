require('dotenv').config();
const http = require('http');
const express = require('express');

// Prevent a single unhandled async rejection from killing the server.
// (The real fix is always to add try/catch, but this is a safety net.)
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection (non-fatal):', reason?.message ?? reason);
});
const cors = require('cors');
const connectDB = require('./config/db');
const { initSocket, startPriceBroadcast } = require('./socket/socketHandler');

const authRoutes = require('./routes/authRoutes');
const watchlistRoutes = require('./routes/watchlistRoutes');
const alertRoutes = require('./routes/alertRoutes');
const priceRoutes = require('./routes/priceRoutes');
const coinListRoutes = require('./routes/coinListRoutes');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/coins', coinListRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'OK' }));

// Create HTTP server — required for Socket.io to attach to the same port
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB();
    const io = initSocket(server);
    // server.listen instead of app.listen — Socket.io requires the raw HTTP server
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startPriceBroadcast(io);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Please close the other process or use a different port.`);
        process.exit(1);
      } else {
        throw err;
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

start();
