import React, { useState, useEffect, useMemo } from 'react';
import usePrices from '../hooks/usePrices';
import { getWatchlist, addToWatchlist, removeFromWatchlist, getCoinList } from '../services/api';
import AssetCard from '../components/ui/AssetCard';
import EmptyState from '../components/ui/EmptyState';
import SkeletonCard from '../components/ui/SkeletonCard';
import toast from 'react-hot-toast';

const extractArrayPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const candidateKeys = ['coins', 'data', 'prices', 'result', 'list'];
  for (const key of candidateKeys) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  return [];
};

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
        const list = Array.isArray(res?.data?.watchlist) ? res.data.watchlist : [];
        setWatchlist([...new Set(list)]);
      } catch (err) {
        // Suppress toast on auth/missing-user errors — interceptor/AuthContext handles redirect
        const status = err?.response?.status;
        if (status && (status === 401 || status === 403 || status === 404)) {
          // silently handled upstream
        } else if (!status) {
          // network error — backend may be down, don't spam toast in StrictMode double-invoke
        } else {
          toast.error('Failed to load watchlist');
        }
      } finally {
        setFetchingWatchlist(false);
      }
    };
    fetchWatchlist();
  }, []);

  // Load coin list as fallback for watchlist items not in live prices
  useEffect(() => {
    getCoinList()
      .then((list) => setCoinList(extractArrayPayload(list)))
      .catch(() => {})
      .finally(() => setCoinListLoading(false));
  }, []);

  const handleRemove = async (coinId) => {
    try {
      await removeFromWatchlist(coinId);
      setWatchlist((prev) => prev.filter((c) => c !== coinId));
      toast.success('Removed from watchlist');
    } catch (err) {
      const status = err?.response?.status;
      if (!status || (status !== 401 && status !== 403)) {
        toast.error('Failed to remove from watchlist');
      }
    }
  };

  const handleAdd = async (coinId) => {
    try {
      await addToWatchlist(coinId);
      setWatchlist((prev) => [...new Set([...prev, coinId])]);
      toast.success('Added to watchlist');
    } catch (err) {
      const status = err?.response?.status;
      if (!status || (status !== 401 && status !== 403)) {
        toast.error('Failed to add to watchlist');
      }
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
    const safeWatchlist = Array.isArray(watchlist) ? watchlist : [];
    const safePrices = Array.isArray(prices) ? prices : [];
    const safeCoinList = Array.isArray(coinList) ? coinList : [];

    return safeWatchlist
      .map((symbol) => {
        const live = safePrices.find((p) => p.symbol === symbol || p.id === symbol);
        if (live) return live;
        return safeCoinList.find((c) => c.symbol === symbol || c.id === symbol) || null;
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {watchedCoins.map((coin) => (
            <div key={coin.symbol} className="rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/5 via-transparent to-emerald-400/5 p-1 shadow-xl shadow-black/30">
              <AssetCard coin={coin} onAddToWatchlist={handleToggle} isInWatchlist={true} />
              <button
                onClick={(e) => { e.stopPropagation(); handleRemove(coin.symbol); }}
                className="mt-2 w-full bg-[#2a2a4a] text-slate-300 border border-[#3a3a5a] px-3 py-2 rounded-xl text-sm font-medium hover:bg-[#3a3a5a] transition-all"
              >
                Remove from Watchlist
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Watchlist;
