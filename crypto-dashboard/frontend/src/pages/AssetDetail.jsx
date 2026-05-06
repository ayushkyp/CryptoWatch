import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import usePrices from '../hooks/usePrices';
import useAlerts from '../hooks/useAlerts';
import { addToWatchlist, removeFromWatchlist, getWatchlist, getCoinList } from '../services/api';
import PriceChart from '../components/charts/PriceChart';
import MovingAverageChart from '../components/charts/MovingAverageChart';
import AlertModal from '../components/ui/AlertModal';
import toast from 'react-hot-toast';

const formatINR = (price) => {
  if (price == null) return '₹\u2014';
  if (price >= 10000000) return `\u20b9${(price / 10000000).toFixed(2)}Cr`;
  if (price >= 100000) return `\u20b9${(price / 100000).toFixed(2)}L`;
  if (price >= 1000) return `\u20b9${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return `\u20b9${price.toFixed(4)}`;
};

const SkeletonDetail = () => (
  <div className="p-6 space-y-6 max-w-5xl mx-auto animate-pulse">
    <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl p-6 shadow-lg shadow-black/50">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#2a2a4a]" />
          <div className="space-y-2">
            <div className="h-6 w-36 bg-[#2a2a4a] rounded" />
            <div className="h-4 w-16 bg-[#2a2a4a] rounded" />
          </div>
        </div>
        <div className="space-y-2 sm:text-right">
          <div className="h-9 w-40 bg-[#2a2a4a] rounded sm:ml-auto" />
          <div className="h-4 w-24 bg-[#2a2a4a] rounded sm:ml-auto" />
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <div className="h-10 w-44 bg-[#2a2a4a] rounded-xl" />
        <div className="h-10 w-32 bg-[#2a2a4a] rounded-xl" />
      </div>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl p-4">
          <div className="h-3 w-20 bg-[#2a2a4a] rounded mb-3" />
          <div className="h-6 w-28 bg-[#2a2a4a] rounded" />
        </div>
      ))}
    </div>
    <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl p-6 h-80" />
    <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl p-6 h-56" />
  </div>
);

const TRACKED_IDS = new Set([
  'bitcoin',
  'ethereum',
  'solana',
  'dogecoin',
  'ripple',
  'cardano',
  'polkadot',
  'chainlink',
]);

const AssetDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { prices, loading: liveLoading } = usePrices();
  const { createAlert } = useAlerts();
  const [watchlist, setWatchlist] = useState([]);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [coinList, setCoinList] = useState([]);
  const [coinListLoading, setCoinListLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadCoinList = async () => {
      setCoinListLoading(true);
      try {
        const list = await getCoinList();
        if (!cancelled) setCoinList(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setCoinList([]);
      } finally {
        if (!cancelled) setCoinListLoading(false);
      }
    };

    loadCoinList();
    return () => { cancelled = true; };
  }, []);

  // Fetch user watchlist
  useEffect(() => {
    getWatchlist()
      .then((res) => setWatchlist(res.data.watchlist || []))
      .catch(() => {});
  }, []);

  const isTrackedCoin = TRACKED_IDS.has(id);

  const liveCoin = useMemo(
    () => prices.find((p) => p.id === id) || null,
    [prices, id]
  );

  const staticCoin = useMemo(
    () => coinList.find((c) => c.id === id) || null,
    [coinList, id]
  );

  const coin = useMemo(() => {
    // For tracked coins, wait for true live price to avoid static-first flicker.
    if (isTrackedCoin) {
      if (!liveCoin) return null;
      return {
        ...(staticCoin || {}),
        ...liveCoin,
        image: staticCoin?.image || liveCoin.image,
        rank: staticCoin?.rank ?? liveCoin.rank,
        marketCap:
          liveCoin.marketCap && liveCoin.marketCap > 0
            ? liveCoin.marketCap
            : (staticCoin?.marketCap || 0),
        volume24h:
          liveCoin.volume24h && liveCoin.volume24h > 0
            ? liveCoin.volume24h
            : (staticCoin?.volume24h || 0),
      };
    }

    // Non-tracked coins are served from the full coin list endpoint.
    if (staticCoin) return staticCoin;
    return liveCoin;
  }, [isTrackedCoin, liveCoin, staticCoin]);

  const dataLoading = isTrackedCoin ? (liveLoading && !coin) : (coinListLoading && !coin);

  const isInWatchlist = watchlist.includes(id);

  const handleWatchlistToggle = async () => {
    try {
      if (isInWatchlist) {
        await removeFromWatchlist(id);
        setWatchlist((prev) => prev.filter((c) => c !== id));
        toast.success('Removed from watchlist');
      } else {
        await addToWatchlist(id);
        setWatchlist((prev) => [...prev, id]);
        toast.success('Added to watchlist');
      }
    } catch {
      toast.error('Failed to update watchlist');
    }
  };

  const handleAlertSubmit = async (data) => {
    try {
      await createAlert(data);
      toast.success('Alert created!');
      setAlertModalOpen(false);
    } catch {
      toast.error('Failed to create alert');
    }
  };

  if (dataLoading) return <SkeletonDetail />;

  if (!coin) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-5">🔍</div>
        <h2 className="text-white text-2xl font-bold mb-2">Coin Not Found</h2>
        <p className="text-slate-400 mb-6">
          No data available for <span className="text-blue-400 font-mono">{id}</span>
        </p>
        <button
          onClick={() => navigate('/')}
          className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:opacity-90 transition"
        >
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const isPositive = (coin.change24h ?? 0) >= 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Back navigation */}
      <button
        onClick={() => navigate(-1)}
        className="text-slate-400 hover:text-white text-sm flex items-center gap-1.5 transition"
      >
        ← Back
      </button>

      {/* Header card */}
      <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl p-6 shadow-lg shadow-black/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            {coin.image ? (
              <img
                src={coin.image}
                alt={coin.symbol}
                className="w-14 h-14 rounded-full shadow-lg flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-bold text-white">
                  {coin.symbol?.charAt(0)?.toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-white">{coin.name}</h1>
                {coin.rank && (
                  <span className="text-xs bg-[#2a2a4a] text-slate-400 px-2 py-0.5 rounded-full">
                    Rank #{coin.rank}
                  </span>
                )}
              </div>
              <span className="text-slate-400 text-sm uppercase tracking-wider">{coin.symbol}</span>
            </div>
          </div>

          <div className="sm:text-right">
            <div className="text-3xl font-bold text-white">{formatINR(coin.price)}</div>
            <div
              className={`text-sm font-semibold mt-1 flex sm:justify-end items-center gap-1 ${
                isPositive ? 'text-green-400' : 'text-red-400'
              }`}
            >
              <span>{isPositive ? '▲' : '▼'}</span>
              <span>{Math.abs(coin.change24h ?? 0).toFixed(2)}%</span>
              <span className="text-slate-500 font-normal text-xs">(24h)</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mt-5">
          <button
            onClick={handleWatchlistToggle}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              isInWatchlist
                ? 'bg-[#2a2a4a] text-slate-300 hover:bg-[#3a3a5a] border border-[#3a3a5a]'
                : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:opacity-90 shadow-lg shadow-blue-500/25'
            }`}
          >
            {isInWatchlist ? '★ Watching' : '☆ Add to Watchlist'}
          </button>
          <button
            onClick={() => setAlertModalOpen(true)}
            className="bg-[#2a2a4a] text-slate-300 px-5 py-2.5 rounded-xl hover:bg-[#3a3a5a] transition-all duration-200 text-sm font-semibold border border-[#3a3a5a] hover:border-orange-500/30"
          >
            🔔 Set Alert
          </button>
        </div>
      </div>

      {/* Market stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl p-4 shadow-lg shadow-black/50">
          <div className="text-slate-400 text-xs mb-1.5 uppercase tracking-wide font-medium">
            Current Price
          </div>
          <div className="text-white font-bold text-lg">{formatINR(coin.price)}</div>
        </div>
        <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl p-4 shadow-lg shadow-black/50">
          <div className="text-slate-400 text-xs mb-1.5 uppercase tracking-wide font-medium">
            24h Change
          </div>
          <div className={`font-bold text-lg ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}
            {(coin.change24h ?? 0).toFixed(2)}%
          </div>
        </div>
        <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl p-4 shadow-lg shadow-black/50">
          <div className="text-slate-400 text-xs mb-1.5 uppercase tracking-wide font-medium">
            Market Cap
          </div>
          <div className="text-white font-bold">{formatINR(coin.marketCap)}</div>
        </div>
        <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl p-4 shadow-lg shadow-black/50">
          <div className="text-slate-400 text-xs mb-1.5 uppercase tracking-wide font-medium">
            Volume 24h
          </div>
          <div className="text-white font-bold">
            {coin.volume24h ? formatINR(coin.volume24h) : '—'}
          </div>
        </div>
      </div>

      {/* Charts */}
      <PriceChart coinId={id} />
      <MovingAverageChart coinId={id} />

      {/* Alert Modal */}
      {alertModalOpen && (
        <AlertModal
          coin={coin}
          currentPrice={coin.price}
          isOpen={alertModalOpen}
          onClose={() => setAlertModalOpen(false)}
          onSubmit={handleAlertSubmit}
        />
      )}
    </div>
  );
};

export default AssetDetail;
