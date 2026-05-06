import { io } from 'socket.io-client';

const resolvedSocketUrl =
  process.env.REACT_APP_SOCKET_URL ||
  process.env.REACT_APP_API_URL?.replace(/\/api\/?$/, '') ||
  (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:5000');

// Single socket instance — all components share this one connection.
const socket = io(resolvedSocketUrl, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 8000,
  randomizationFactor: 0.3,
  timeout: 20000,
  transports: ['websocket', 'polling'],
});

export default socket;
