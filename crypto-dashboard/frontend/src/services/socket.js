import { io } from 'socket.io-client';

// Single socket instance — all components share this one connection.
const socket = io(process.env.REACT_APP_SOCKET_URL, {
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
