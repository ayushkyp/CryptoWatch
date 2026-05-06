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
  if (price == null) return '₹—';
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)}Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(2)}L`;
  if (price >= 1000) return `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return `₹${price.toFixed(4)}`;
};

const AssetDetail = () => {
  const { symbol } = useParams();
  const normalizedSymbol = String(symbol || '').toUpperCase();
  const navigate = useNavigate();
  const { prices, loading: liveLoading } = usePrices();
  const { createAlert } = useAlerts();
  const [watchlist, setWatchlist] = useState([]);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [coinList, setCoinList] = useState([]);

  useEffect(() => {
    let cancelled = false;

    getCoinList()
      .then((list) => {
        if (!cancelled) setCoinList(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setCoinList([]);
      });

    getWatchlist()
      .then((res) => {
        if (!cancelled) setWatchlist(res.data.watchlist || []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const liveCoin = useMemo(
    () => prices.find((p) => p.symbol === normalizedSymbol) || null,
    [prices, normalizedSymbol]
  );

  const staticCoin = useMemo(
    () => coinList.find((c) => c.symbol === normalizedSymbol) || null,
    [coinList, normalizedSymbol]
  );

  const coin = useMemo(() => {
    if (!liveCoin && !staticCoin) return null;

    // Merge live and static data, preferring live data
    const merged = {
      ...(staticCoin || {}),
      symbol: normalizedSymbol,
      name: staticCoin?.name || normalizedSymbol,
      image: staticCoin?.image,
    };

    // Override with live data if available
    if (liveCoin) {
      merged.name = liveCoin.name || merged.name;
      merged.image = liveCoin.image || merged.image;
      merged.price = Number.isFinite(liveCoin.price) ? liveCoin.price : 0;
      merged.changePercent = Number.isFinite(liveCoin.changePercent) ? liveCoin.changePercent : (Number.isFinite(liveCoin.change24h) ? liveCoin.change24h : 0);
      merged.volume = Number.isFinite(liveCoin.volume) ? liveCoin.volume : 0;
      merged.high = Number.isFinite(liveCoin.high) ? liveCoin.high : 0;
      merged.low = Number.isFinite(liveCoin.low) ? liveCoin.low : 0;
    } else {
      merged.price = Number.isFinite(staticCoin?.price) ? staticCoin.price : 0;
      merged.changePercent = Number.isFinite(staticCoin?.change24h) ? staticCoin.change24h : 0;
      merged.volume = Number.isFinite(staticCoin?.volume24h) ? staticCoin.volume24h : 0;
      merged.high = Number.isFinite(staticCoin?.high) ? staticCoin.high : 0;
      merged.low = Number.isFinite(staticCoin?.low) ? staticCoin.low : 0;
    }

    return merged;
  }, [liveCoin, staticCoin, normalizedSymbol]);

  const isInWatchlist = watchlist.includes(normalizedSymbol);

  const handleWatchlistToggle = async () => {
    try {
      if (isInWatchlist) {
        await removeFromWatchlist(normalizedSymbol);
        setWatchlist((prev) => prev.filter((c) => c !== normalizedSymbol));
        toast.success('Removed from watchlist');
      } else {
        await addToWatchlist(normalizedSymbol);
        setWatchlist((prev) => [...prev, normalizedSymbol]);
        toast.success('Added to watchlist');
      }
    } catch {
      toast.error('Failed to update watchlist');
    }
  };

  const handleAlertSubmit = async (data) => {
    try {
      await createAlert(data);
      toast.success('Alert created');
      setAlertModalOpen(false);
    } catch {
      toast.error('Failed to create alert');
    }
  };

  if (liveLoading && !coin) {
    return <div className="p-6 text-slate-400">Loading live coin data...</div>;
  }

  if (!coin) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate('/')}
          className="mb-4 text-slate-400 hover:text-white transition"
        >
          ← Back to Dashboard
        </button>
        <div className="rounded-2xl border border-[#2a2a4a] bg-[#1a1a2e] p-10 text-center">
          <h2 className="text-2xl font-bold text-white">Coin not found</h2>
          <p className="mt-2 text-slate-400">No data available for {normalizedSymbol}</p>
        </div>
      </div>
    );
  }

  const isPositive = (coin.changePercent ?? 0) >= 0;

  return (
    <div className="p-6 space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="text-slate-400 hover:text-white text-sm transition"
      >
        ← Back
      </button>

      <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-[#1a1a2e] to-emerald-500/10 p-6 shadow-xl shadow-black/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {coin.image ? (
              <img src={coin.image} alt={coin.symbol} className="h-12 w-12 rounded-full" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2a2a4a] text-white font-bold">
                {coin.symbol?.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">{coin.name}</h1>
              <p className="text-slate-400">{coin.symbol}</p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-3xl font-bold text-white">{formatINR(coin.price)}</p>
            <p className={`text-sm font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{Number(coin.changePercent || 0).toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={handleWatchlistToggle}
            className="rounded-xl border border-[#3a3a5a] bg-[#2a2a4a] px-4 py-2 text-sm font-medium text-slate-200 hover:bg-[#3a3a5a]"
          >
            {isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
          </button>
          <button
            onClick={() => setAlertModalOpen(true)}
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:opacity-90"
          >
            Set Alert
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat title="24h High" value={formatINR(coin.high)} />
        <Stat title="24h Low" value={formatINR(coin.low)} />
        <Stat title="24h Volume" value={formatINR(coin.volume)} />
        <Stat title="Last Price" value={formatINR(coin.price)} />
      </div>

      <PriceChart symbol={coin.symbol} />
      <MovingAverageChart symbol={coin.symbol} />

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

const Stat = ({ title, value }) => (
  <div className="rounded-2xl border border-[#2a2a4a] bg-[#1a1a2e] p-4">
    <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
    <p className="mt-1 text-lg font-bold text-white">{value}</p>
  </div>
);

export default AssetDetail;
