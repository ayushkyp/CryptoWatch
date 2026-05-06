import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import usePrices from '../hooks/usePrices';
import { getCoinList, addToWatchlist, removeFromWatchlist, getWatchlist } from '../services/api';
import AssetCard from '../components/ui/AssetCard';
import SkeletonCard from '../components/ui/SkeletonCard';
import toast from 'react-hot-toast';

const formatINR = (price) => {
  if (!price && price !== 0) return '₹—';
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)}Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(2)}L`;
  if (price >= 1000) return `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return `₹${price.toFixed(4)}`;
};

const formatVolume = (vol) => {
  if (!vol || vol <= 0) return '—';
  if (vol >= 1e13) return `₹${(vol / 1e13).toFixed(2)}T`;
  if (vol >= 1e10) return `₹${(vol / 1e10).toFixed(2)}Kh Cr`;
  if (vol >= 1e7) return `₹${(vol / 1e7).toFixed(2)}Cr`;
  if (vol >= 1e5) return `₹${(vol / 1e5).toFixed(2)}L`;
  return `₹${vol.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const SORT_OPTIONS = [
  { value: 'rank', label: 'Rank' },
  { value: 'price', label: 'Price' },
  { value: 'change24h', label: '24h Change' },
  { value: 'volume24h', label: 'Volume 24H' },
];

export default function Dashboard() {
  const { prices, loading: livePricesLoading, lastUpdated } = usePrices();
  const [coinList, setCoinList] = useState([]);
  const [coinListLoading, setCoinListLoading] = useState(true);
  const [watchlist, setWatchlist] = useState([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('rank');
  const [sortDir, setSortDir] = useState('asc');
  const [filterPositive, setFilterPositive] = useState(false);

  // Fetch full 250-coin list
  useEffect(() => {
    const fetchCoins = async () => {
      setCoinListLoading(true);
      try {
        const data = await getCoinList();
        setCoinList(data);
      } catch (err) {
        console.error('Coin list error:', err);
        toast.error('Could not load full coin list');
      } finally {
        setCoinListLoading(false);
      }
    };
    fetchCoins();
  }, []);

  // Fetch user watchlist
  useEffect(() => {
    const fetchWatchlist = async () => {
      try {
        const res = await getWatchlist();
        setWatchlist(res.data.watchlist || []);
      } catch { /* ignore */ }
    };
    fetchWatchlist();
  }, []);

  const handleWatchlistToggle = async (coinId) => {
    try {
      if (watchlist.includes(coinId)) {
        await removeFromWatchlist(coinId);
        setWatchlist((prev) => prev.filter((c) => c !== coinId));
        toast.success('Removed from watchlist');
      } else {
        await addToWatchlist(coinId);
        setWatchlist((prev) => [...prev, coinId]);
        toast.success('Added to watchlist');
      }
    } catch {
      toast.error('Failed to update watchlist');
    }
  };

  const coinMetaMap = useMemo(() => {
    const map = {};
    coinList.forEach((c) => { map[c.symbol] = c; });
    return map;
  }, [coinList]);

  // Live prices + static metadata (image/rank/name) for top cards
  const featuredCoins = useMemo(() => {
    if (prices.length === 0) return [];
    return prices.slice(0, 8).map((coin) => {
      const meta = coinMetaMap[coin.symbol] || {};
      return {
        ...meta,
        ...coin,
        change24h: coin.change24h ?? coin.changePercent ?? meta.change24h ?? 0,
        image: meta.image || coin.image,
        rank: meta.rank ?? coin.rank,
        marketCap: coin.marketCap && coin.marketCap > 0 ? coin.marketCap : (meta.marketCap || 0),
        volume24h: coin.volume24h && coin.volume24h > 0 ? coin.volume24h : (meta.volume24h || 0),
      };
    });
  }, [prices, coinMetaMap]);

  // Full market list with live values patched in where available
  const unifiedCoinList = useMemo(() => {
    const liveMap = {};
    prices.forEach((p) => { liveMap[p.symbol] = p; });

    return coinList.map((coin) => {
      const live = liveMap[coin.symbol];
      if (!live) return coin;

      return {
        ...coin,
        ...live,
        change24h: live.change24h ?? live.changePercent ?? coin.change24h ?? 0,
        image: coin.image || live.image,
        rank: coin.rank ?? live.rank,
        marketCap: live.marketCap && live.marketCap > 0 ? live.marketCap : (coin.marketCap || 0),
        volume24h: live.volume24h && live.volume24h > 0 ? live.volume24h : (coin.volume24h || 0),
      };
    });
  }, [coinList, prices]);

  // Filter + search + sort the full coin list
  const filteredCoins = useMemo(() => {
    let list = [...unifiedCoinList];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)
      );
    }

    if (filterPositive) {
      list = list.filter((c) => c.change24h > 0);
    }

    list.sort((a, b) => {
      let va = a[sortBy] ?? 0;
      let vb = b[sortBy] ?? 0;
      return sortDir === 'asc' ? va - vb : vb - va;
    });

    return list;
  }, [unifiedCoinList, search, sortBy, sortDir, filterPositive]);

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir(key === 'rank' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <span className="text-slate-600 ml-1">↕</span>;
    return <span className="text-blue-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="p-6 space-y-8">
      {/* Featured Live Prices (top 8 tracked) */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Live Prices</h2>
          {lastUpdated && (
            <span className="text-slate-500 text-xs">
              Updated {lastUpdated.toLocaleTimeString('en-IN')}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {livePricesLoading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : featuredCoins.map((coin) => (
                <AssetCard
                  key={coin.id}
                  coin={coin}
                  onAddToWatchlist={handleWatchlistToggle}
                  isInWatchlist={watchlist.includes(coin.symbol)}
                />
              ))}
        </div>
      </section>

      {/* Full Coin Market Table */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold text-white">
            All Cryptocurrencies
            {!coinListLoading && (
              <span className="ml-2 text-slate-500 text-sm font-normal">
                ({filteredCoins.length} coins)
              </span>
            )}
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search coins..."
              className="bg-[#1a1a2e] border border-[#2a2a4a] text-white placeholder-slate-500 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500 w-48"
            />
            {/* Filter */}
            <button
              onClick={() => setFilterPositive((v) => !v)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition ${
                filterPositive
                  ? 'bg-green-600 text-white'
                  : 'bg-[#1a1a2e] border border-[#2a2a4a] text-slate-400 hover:text-white'
              }`}
            >
              ▲ Gainers Only
            </button>
          </div>
        </div>

        <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-[#2a2a4a] text-slate-500 text-xs uppercase tracking-wide">
            <div className="col-span-1 cursor-pointer hover:text-white" onClick={() => toggleSort('rank')}>
              # <SortIcon field="rank" />
            </div>
            <div className="col-span-4">Coin</div>
            <div className="col-span-3 text-right cursor-pointer hover:text-white" onClick={() => toggleSort('price')}>
              Price <SortIcon field="price" />
            </div>
            <div className="col-span-2 text-right cursor-pointer hover:text-white" onClick={() => toggleSort('change24h')}>
              24h <SortIcon field="change24h" />
            </div>
            <div className="col-span-2 text-right hidden lg:block cursor-pointer hover:text-white" onClick={() => toggleSort('volume24h')}>
              Volume 24H <SortIcon field="volume24h" />
            </div>
          </div>

          {/* Loading state */}
          {coinListLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-400 text-sm">Loading market coins...</p>
              </div>
            </div>
          )}

          {/* Coin rows */}
          {!coinListLoading && filteredCoins.map((coin) => {
            const isPositive = (coin.change24h ?? 0) >= 0;
            const inWatchlist = watchlist.includes(coin.symbol);
            return (
              <div
                key={coin.symbol}
                onClick={() => window.location.href = `/coin/${coin.symbol}`}
                className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-[#2a2a4a] last:border-0 hover:bg-[#16213e] transition cursor-pointer items-center"
              >
                <div className="col-span-1 text-slate-500 text-sm">{coin.rank || '—'}</div>
                <div className="col-span-4 flex items-center gap-2 min-w-0">
                  {coin.image ? (
                    <img src={coin.image} alt={coin.symbol} className="w-7 h-7 rounded-full flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#2a2a4a] flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-white font-bold">{coin.symbol?.charAt(0)}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <Link to={`/coin/${coin.symbol}`} className="text-white text-sm font-medium hover:text-blue-400 truncate block">
                      {coin.name}
                    </Link>
                    <span className="text-slate-500 text-xs">{coin.symbol}</span>
                  </div>
                </div>
                <div className="col-span-3 text-right text-white text-sm font-medium">
                  {formatINR(coin.price)}
                </div>
                <div className={`col-span-2 text-right text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {coin.change24h != null ? `${isPositive ? '+' : ''}${coin.change24h.toFixed(2)}%` : '—'}
                </div>
                <div className="col-span-2 text-right hidden lg:flex items-center justify-end gap-2">
                  <span className="text-slate-400 text-xs">{formatVolume(coin.volume24h)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleWatchlistToggle(coin.symbol); }}
                    title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
                    className={`text-xs p-1 rounded-lg transition ${
                      inWatchlist ? 'text-yellow-400 hover:text-yellow-300' : 'text-slate-600 hover:text-yellow-400'
                    }`}
                  >
                    {inWatchlist ? '★' : '☆'}
                  </button>
                </div>
              </div>
            );
          })}

          {!coinListLoading && filteredCoins.length === 0 && (
            <div className="py-16 text-center text-slate-500">
              No coins match your search.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
