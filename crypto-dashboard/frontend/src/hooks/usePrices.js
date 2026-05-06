import { useState, useEffect, useRef } from 'react';
import { getCurrentPrices } from '../services/api';
import { useSocketContext } from '../context/SocketContext';

const usePrices = () => {
  const socket = useSocketContext();
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Initial load via REST API for instant data
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const res = await getCurrentPrices();
        if (mountedRef.current) {
          const data = Array.isArray(res.data) ? res.data : (res.data.prices || []);
          setPrices(data);
          setLastUpdated(new Date());
        }
      } catch (error) {
        console.error('Failed to load initial prices:', error.message);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };
    loadInitial();
  }, []);

  // Live updates via WebSocket
  useEffect(() => {
    const handlePriceUpdate = (updatedPrices) => {
      if (!mountedRef.current) return;
      const data = Array.isArray(updatedPrices) ? updatedPrices : (updatedPrices.prices || []);
      setPrices(data);
      setLoading(false);
      setLastUpdated(new Date());
    };

    socket.on('priceUpdate', handlePriceUpdate);
    return () => {
      socket.off('priceUpdate', handlePriceUpdate);
    };
  }, [socket]);

  return { prices, loading, lastUpdated };
};

export default usePrices;
