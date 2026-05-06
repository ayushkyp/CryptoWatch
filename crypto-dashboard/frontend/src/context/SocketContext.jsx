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

    const handleConnect = () => {
      console.log('Socket connected, authenticating...');
      // Authenticate user if logged in
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user.id || user._id) {
            const userId = user.id || user._id;
            socket.emit('authenticate', userId);
            console.log(`Socket authenticated for user ${userId}`);
          }
        }
      } catch (err) {
        console.warn('Error authenticating socket:', err.message);
      }
    };

    socket.on('connect_error', handleConnectError);
    socket.on('connect', handleConnect);

    const handleUnload = () => socket.disconnect();
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      // Remove listeners added in this effect to avoid stacking on Strict Mode re-run
      socket.off('connect_error', handleConnectError);
      socket.off('connect', handleConnect);
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
