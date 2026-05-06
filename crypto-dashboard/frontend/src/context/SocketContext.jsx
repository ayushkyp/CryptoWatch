import React, { createContext, useContext, useEffect } from 'react';
import socket from '../services/socket';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  useEffect(() => {
    // socket.active = connected OR in the process of connecting.
    // Using this (not socket.connected) prevents React 18 Strict Mode from
    // calling socket.connect() twice before the first handshake resolves.
    if (!socket.active) {
      socket.connect();
    }

    const handleConnectError = (err) => {
      console.warn('Socket connection error:', err.message);
    };

    socket.on('connect_error', handleConnectError);

    const handleUnload = () => socket.disconnect();
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      // Remove listeners added in this effect to avoid stacking on Strict Mode re-run
      socket.off('connect_error', handleConnectError);
      window.removeEventListener('beforeunload', handleUnload);
      // Do NOT call socket.disconnect() here — that would kill the connection on every
      // navigation. We only disconnect on page unload (above).
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocketContext = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocketContext must be used within SocketProvider');
  return ctx;
};

export default SocketContext;
