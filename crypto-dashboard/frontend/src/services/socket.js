import { io } from 'socket.io-client';

const isAbsoluteHttpUrl = (value) => /^https?:\/\//i.test(String(value || ''));

const normalizeBaseUrl = (value) => String(value || '').replace(/\/api\/?$/, '').replace(/\/$/, '');

const explicitSocketUrl = process.env.REACT_APP_SOCKET_URL;
const backendBaseUrl = process.env.REACT_APP_BACKEND_URL;
const apiBaseUrl = process.env.REACT_APP_API_URL;

let resolvedSocketUrl = 'http://localhost:5000';

if (isAbsoluteHttpUrl(explicitSocketUrl)) {
  resolvedSocketUrl = normalizeBaseUrl(explicitSocketUrl);
} else if (isAbsoluteHttpUrl(backendBaseUrl)) {
  resolvedSocketUrl = normalizeBaseUrl(backendBaseUrl);
} else if (isAbsoluteHttpUrl(apiBaseUrl)) {
  resolvedSocketUrl = normalizeBaseUrl(apiBaseUrl);
} else if (process.env.NODE_ENV === 'production') {
  resolvedSocketUrl = normalizeBaseUrl(window.location.origin);
  // eslint-disable-next-line no-console
  console.warn('Socket URL env missing in production. Set REACT_APP_SOCKET_URL (Railway backend domain).');
}

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
