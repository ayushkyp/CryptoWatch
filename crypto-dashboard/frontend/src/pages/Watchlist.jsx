import React, { useState, useEffect, useMemo } from 'react';
import usePrices from '../hooks/usePrices';
import { getWatchlist, addToWatchlist, removeFromWatchlist, getCoinList } from '../services/api';
import AssetCard from '../components/ui/AssetCard';
import EmptyState from '../components/ui/EmptyState';
import SkeletonCard from '../components/ui/SkeletonCard';
import toast from 'react-hot-toast';

const Watchlist = () => {
  const { prices, loading } = usePrices();
  const [watchlist, setWatchlist] = useState([]);
  const [fetchingWatchlist, setFetchingWatchlist] = useState(true);
  const [coinList, setCoinList] = useState([]);
  const [coinListLoading, setCoinListLoading] = useState(true);

  useEffect(() => {
    const fetchWatchlist = async () => {
      try {
        const res = await getWatchlist();
        setWatchlist(res.data.watchlist);
      } catch {
        toast.error('Failed to load watchlist');
      } finally {
        setFetchingWatchlist(false);
      }
    };
    fetchWatchlist();
  }, []);

  // Load coin list as fallback for watchlist items not in live prices
  useEffect(() => {
    getCoinList()
      .then((list) => setCoinList(list))
      .catch(() => {})
      .finally(() => setCoinListLoading(false));
  }, []);

  const handleRemove = async (coinId) => {
    try {
      await removeFromWatchlist(coinId);
      setWatchlist((prev) => prev.filter((c) => c !== coinId));
      toast.success('Removed from watchlist');
    } catch {
      toast.error('Failed to remove from watchlist');
    }
  };

  const handleAdd = async (coinId) => {
    try {
      await addToWatchlist(coinId);
      setWatchlist((prev) => [...prev, coinId]);
      toast.success('Added to watchlist');
    } catch {
      toast.error('Failed to add to watchlist');
    }
  };

  const handleToggle = (coinId) => {
    if (watchlist.includes(coinId)) {
      handleRemove(coinId);
    } else {
      handleAdd(coinId);
    }
  };

  // Merge live prices with coin list to find all watchlisted coins
  const watchedCoins = useMemo(() => {
    return watchlist
      .map((id) => {
        const live = prices.find((p) => p.id === id);
        if (live) return live;
        return coinList.find((c) => c.id === id) || null;
      })
      .filter(Boolean);
  }, [watchlist, prices, coinList]);

  const isLoading = loading || fetchingWatchlist || coinListLoading;

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-white">My Watchlist</h1>
        {watchlist.length > 0 && (
          <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-medium px-2.5 py-1 rounded-full">
            {watchlist.length} {watchlist.length === 1 ? 'coin' : 'coins'}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : watchedCoins.length === 0 ? (
        <EmptyState
          icon="📌"
          message="Your watchlist is empty. Add coins from the Dashboard to track them here."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {watchedCoins.map((coin) => (
            <div key={coin.id} className="group relative">
              <AssetCard
                coin={coin}
                onAddToWatchlist={handleToggle}
                isInWatchlist={true}
              />
              {/* Remove button — overlaid at bottom, visible on hover */}
              <button
                onClick={(e) => { e.stopPropagation(); handleRemove(coin.id); }}
                className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-all duration-200"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Watchlist;
