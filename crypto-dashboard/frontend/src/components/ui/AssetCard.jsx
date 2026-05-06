import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const formatINR = (price) => {
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)}Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(2)}L`;
  if (price >= 1000) return `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return `₹${price.toFixed(4)}`;
};

const AssetCard = ({ coin, onAddToWatchlist, isInWatchlist }) => {
  const navigate = useNavigate();
  const prevPriceRef = useRef(coin.price);
  const [flashClass, setFlashClass] = useState('');

  useEffect(() => {
    if (prevPriceRef.current !== coin.price) {
      const direction = coin.price > prevPriceRef.current ? 'flash-green' : 'flash-red';
      setFlashClass(direction);
      prevPriceRef.current = coin.price;
      const timer = setTimeout(() => setFlashClass(''), 800);
      return () => clearTimeout(timer);
    }
  }, [coin.price]);

  const change24h = coin.change24h ?? coin.changePercent ?? 0;
  const isPositive = change24h >= 0;

  const handleWatchlistClick = (e) => {
    e.stopPropagation();
    onAddToWatchlist(coin.symbol);
  };

  return (
    <div
      className={`live-price-tile ${isPositive ? 'live-price-tile-up' : 'live-price-tile-down'} bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl p-5 shadow-lg shadow-black/50 cursor-pointer hover:bg-[#16213e] hover:scale-[1.02] transition-all duration-200 ${flashClass}`}
      onClick={() => navigate(`/coin/${coin.symbol}`)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {coin.image ? (
            <img src={coin.image} alt={coin.symbol} className="w-9 h-9 rounded-full flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#2a2a4a] flex items-center justify-center flex-shrink-0">
              <span className="text-sm text-white font-bold">{coin.symbol?.charAt(0)}</span>
            </div>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-white truncate">{coin.name}</div>
            <div className="text-slate-400 text-sm">{coin.symbol}</div>
          </div>
        </div>
        <button
          onClick={handleWatchlistClick}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
            isInWatchlist
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : 'bg-[#2a2a4a] text-slate-400 hover:text-white hover:bg-[#3a3a5a]'
          }`}
        >
          {isInWatchlist ? 'Watching' : 'Watch'}
        </button>
      </div>

      <div className="text-xl font-bold text-white mb-1">{formatINR(coin.price)}</div>

      <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        <span>{isPositive ? '▲' : '▼'}</span>
        <span>{Math.abs(change24h).toFixed(2)}%</span>
        <span className="text-slate-500 text-xs ml-1">24h</span>
      </div>
    </div>
  );
};

export default AssetCard;
