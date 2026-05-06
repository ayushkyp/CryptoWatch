import { useSocketContext } from '../context/SocketContext';
import { useState, useEffect } from 'react';

const useSocket = () => {
  const socket = useSocketContext();
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  return { socket, connected };
};

export default useSocket;
