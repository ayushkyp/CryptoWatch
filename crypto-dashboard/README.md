# CryptoWatch — Real-Time Market Intelligence Dashboard

A production-grade crypto tracking platform with live WebSocket price streaming, user alerts, personal watchlists, and historical price charts.

**Stack:** MERN (MongoDB, Express, React, Node.js) + Socket.io  
**Style:** Dark UI inspired by Binance/TradingView

---

## Features

- 🔴 **Live price streaming** via WebSocket (Socket.io) for 8 coins
- 📊 **Interactive price charts** with 7D/30D/90D toggle (Recharts)
- 📈 **7-day moving average** chart
- 🔔 **Price alerts** — set above/below conditions, triggered server-side in real time
- 📌 **Personal watchlist** persisted in MongoDB per user
- 🔐 **JWT authentication** (register/login)
- 💰 Prices in **Indian Rupees (INR)**

---

## Folder Structure

```
crypto-dashboard/
├── backend/          # Express + Socket.io + MongoDB
└── frontend/         # React + Tailwind CSS
```

---

## How to Run

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Setup environment variables

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env — set MONGO_URI and JWT_SECRET

# Frontend (defaults work for local dev)
cp frontend/.env.example frontend/.env
```

### 3. Start MongoDB locally

```bash
mongod
```

### 4. Start the backend

```bash
cd backend
node server.js
```

### 5. Start the frontend (new terminal)

```bash
cd frontend
npm start
```

### 6. Open http://localhost:3000

Register → Login → Dashboard shows live prices streaming via WebSocket.

---

## Environment Variables

### backend/.env

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `5000` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/cryptowatch` |
| `JWT_SECRET` | Secret for signing JWTs | *(set a long random string)* |
| `COINGECKO_BASE_URL` | CoinGecko API base URL | `https://api.coingecko.com/api/v3` |
| `PRICE_FETCH_INTERVAL` | Price refresh interval (ms) | `15000` |

### frontend/.env

| Variable | Description | Default |
|---|---|---|
| `REACT_APP_API_URL` | Backend API URL | `http://localhost:5000/api` |
| `REACT_APP_SOCKET_URL` | WebSocket server URL | `http://localhost:5000` |

---

## Architecture Highlights

### Scalable price broadcasting
Prices are fetched **once per interval** from CoinGecko, stored in an in-memory cache, then broadcast to **all connected clients** via a single `io.emit()`. This means 1 API request per interval regardless of 1 or 10,000 connected users.

### Event-driven alert system
Alert checks run **server-side on every price update** — not on a polling schedule. Zero latency between price crossing a threshold and the user being notified.

### Socket + REST hybrid data loading
REST API is called once on page mount for immediate data display. WebSocket takes over for all subsequent live updates — best of both worlds.

### Efficient MongoDB queries
`PriceHistory` has a compound index on `{ coin, timestamp }` making history queries O(log n) rather than O(n) full collection scans.

---

## Tracked Coins

| Coin | Symbol | CoinGecko ID |
|---|---|---|
| Bitcoin | BTC | `bitcoin` |
| Ethereum | ETH | `ethereum` |
| Solana | SOL | `solana` |
| Dogecoin | DOGE | `dogecoin` |
| XRP | XRP | `ripple` |
| Cardano | ADA | `cardano` |
| Polkadot | DOT | `polkadot` |
| Chainlink | LINK | `chainlink` |
