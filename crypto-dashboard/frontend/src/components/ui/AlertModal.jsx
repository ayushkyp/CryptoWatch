import React, { useMemo, useState } from 'react';

const formatINR = (price) => {
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)}Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(2)}L`;
  if (price >= 1000) return `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return `₹${price.toFixed(4)}`;
};

const AlertModal = ({
  coin,
  currentPrice,
  isOpen,
  onClose,
  onSubmit,
  coinOptions = [],
  onCoinChange,
}) => {
  const [condition, setCondition] = useState('above');
  const [targetPrice, setTargetPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const canSelectCoin = coinOptions.length > 0 && typeof onCoinChange === 'function';

  const filteredCoinOptions = useMemo(() => {
    if (!canSelectCoin) return [];
    const q = search.trim().toLowerCase();
    if (!q) return coinOptions.slice(0, 20);
    return coinOptions
      .filter((c) =>
        c.name?.toLowerCase().includes(q) ||
        c.symbol?.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [coinOptions, search, canSelectCoin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetPrice || isNaN(Number(targetPrice))) return;
    setLoading(true);
    try {
      await onSubmit({
        coin: coin.id,
        coinName: coin.name,
        condition,
        targetPrice: Number(targetPrice),
      });
      setTargetPrice('');
      onClose();
    } catch (err) {
      console.error('Alert creation failed:', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl p-6 w-full max-w-md shadow-xl shadow-black/60">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Set Price Alert</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {canSelectCoin && (
          <div className="mb-5 space-y-2">
            <label className="text-sm text-slate-400 block">Choose Coin</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or symbol..."
              className="w-full bg-[#0f0f1a] border border-[#2a2a4a] rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
            <div className="bg-[#0f0f1a] border border-[#2a2a4a] rounded-xl max-h-40 overflow-y-auto">
              {filteredCoinOptions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-500">No matching coins</div>
              ) : (
                filteredCoinOptions.map((c) => {
                  const selected = c.id === coin.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onCoinChange(c)}
                      className={`w-full px-4 py-2.5 flex items-center justify-between text-left transition ${
                        selected
                          ? 'bg-blue-500/15 text-blue-300'
                          : 'text-slate-300 hover:bg-[#1a1a2e]'
                      }`}
                    >
                      <span className="truncate mr-2">{c.name}</span>
                      <span className="text-xs text-slate-400 uppercase">{c.symbol}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        <div className="bg-[#0f0f1a] rounded-xl p-4 mb-5 border border-[#2a2a4a]">
          <div className="text-slate-400 text-sm mb-1">{coin.name} ({coin.symbol})</div>
          <div className="text-white font-bold text-xl">
            Current: {formatINR(currentPrice)}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Alert when price goes</label>
            <div className="flex gap-2">
              {['above', 'below'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setCondition(opt)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize transition ${
                    condition === opt
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                      : 'bg-[#2a2a4a] text-slate-300 hover:bg-[#3a3a5a]'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-2 block">Target Price (₹)</label>
            <input
              type="number"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="Enter target price"
              required
              className="w-full bg-[#0f0f1a] border border-[#2a2a4a] rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-[#2a2a4a] text-slate-300 px-4 py-2.5 rounded-xl hover:bg-[#3a3a5a] transition text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2.5 rounded-xl font-medium hover:opacity-90 transition text-sm disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Alert'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AlertModal;
