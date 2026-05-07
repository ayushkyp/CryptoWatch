import { useState, useEffect, useRef } from 'react';
import { getCurrentPrices } from '../services/api';
import { useSocketContext } from '../context/SocketContext';

const toObject = (value) => (value && typeof value === 'object' ? value : null);

const extractArrayPayload = (payload) => {
  if (Array.isArray(payload)) return payload;

  const objectPayload = toObject(payload);
  if (!objectPayload) return [];

  const candidateKeys = ['prices', 'data', 'coins', 'result', 'list'];
  for (const key of candidateKeys) {
    if (Array.isArray(objectPayload[key])) {
      return objectPayload[key];
    }
  }

  const values = Object.values(objectPayload);
  return values.every((item) => item && typeof item === 'object') ? values : [];
};

const toNumberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeSymbol = (value) => String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase();

const normalizePriceCoin = (coin) => {
  if (!coin || typeof coin !== 'object') return null;

  const symbol = normalizeSymbol(coin.symbol);
  const binanceSymbol = normalizeSymbol(coin.binanceSymbol || (symbol ? `${symbol}USDT` : ''));
  const resolvedSymbol = symbol || (binanceSymbol.endsWith('USDT') ? binanceSymbol.slice(0, -4) : '');

  if (!resolvedSymbol) return null;

  return {
    ...coin,
    symbol: resolvedSymbol,
    binanceSymbol: binanceSymbol || `${resolvedSymbol}USDT`,
    name: coin.name || resolvedSymbol,
    price: toNumberOrZero(coin.price),
    change24h: toNumberOrZero(coin.change24h ?? coin.changePercent),
    changePercent: toNumberOrZero(coin.changePercent ?? coin.change24h),
    high: toNumberOrZero(coin.high),
    low: toNumberOrZero(coin.low),
    volume24h: toNumberOrZero(coin.volume24h ?? coin.volume),
    volume: toNumberOrZero(coin.volume ?? coin.volume24h),
    marketCap: toNumberOrZero(coin.marketCap),
  };
};

const normalizePricePayload = (payload) => {
  return extractArrayPayload(payload)
    .map((coin) => normalizePriceCoin(coin))
    .filter(Boolean);
};

const buildPriceMap = (items) => {
  return (Array.isArray(items) ? items : []).reduce((acc, coin) => {
    const key = coin.binanceSymbol || `${coin.symbol}USDT`;
    if (key) {
      acc[key] = coin;
    }
    return acc;
  }, {});
};

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
          const data = normalizePricePayload(res?.data);
          const normalizedMap = buildPriceMap(data);
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

      const liveItems = normalizePricePayload(updatedPricesMap);
      const mapPayload = buildPriceMap(liveItems);

      setPriceMap(mapPayload);
      setPrices(liveItems);
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
