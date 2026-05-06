import { useState, useEffect, useRef } from 'react';
import { getCurrentPrices } from '../services/api';
import { useSocketContext } from '../context/SocketContext';

const usePrices = () => {
  const socket = useSocketContext();
  const [prices, setPrices] = useState([]);
  const [priceMap, setPriceMap] = useState({});
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
          const normalizedMap = data.reduce((acc, coin) => {
            const key = coin.binanceSymbol || `${coin.symbol}USDT`;
            acc[key] = coin;
            return acc;
          }, {});
          setPriceMap(normalizedMap);
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
    const handleLivePrices = (updatedPricesMap) => {
      if (!mountedRef.current) return;

      const mapPayload =
        updatedPricesMap && typeof updatedPricesMap === 'object' && !Array.isArray(updatedPricesMap)
          ? updatedPricesMap
          : {};
      const data = Object.values(mapPayload);

      setPriceMap(mapPayload);
      setPrices(data);
      setLoading(false);
      setLastUpdated(new Date());
    };

    socket.on('livePrices', handleLivePrices);
    return () => {
      socket.off('livePrices', handleLivePrices);
    };
  }, [socket]);

  return { prices, priceMap, loading, lastUpdated };
};

export default usePrices;
