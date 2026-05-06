import React, { useEffect, useMemo, useState } from 'react';
import useAlerts from '../hooks/useAlerts';
import usePrices from '../hooks/usePrices';
import AlertModal from '../components/ui/AlertModal';
import EmptyState from '../components/ui/EmptyState';
import toast from 'react-hot-toast';
import { getCoinList } from '../services/api';

const formatINR = (price) => {
  if (!price && price !== 0) return '₹—';
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)}Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(2)}L`;
  if (price >= 1000) return `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return `₹${price.toFixed(4)}`;
};

const Alerts = () => {
  const { alerts, createAlert, deleteAlert, triggeredAlerts } = useAlerts();
  const { prices } = usePrices();
  const [tab, setTab] = useState('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [coins, setCoins] = useState([]);
  const [selectedCoin, setSelectedCoin] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loadCoins = async () => {
      try {
        const list = await getCoinList();
        if (cancelled) return;
        const normalized = (Array.isArray(list) ? list : []).map((c) => ({
          id: c.id,
          name: c.name,
          symbol: c.symbol,
          image: c.image,
          price: c.price,
        }));
        setCoins(normalized);
        if (!selectedCoin && normalized.length > 0) {
          const btc = normalized.find((c) => c.id === 'bitcoin');
          setSelectedCoin(btc || normalized[0]);
        }
      } catch {
        if (!cancelled) {
          toast.error('Unable to load coin list for alerts');
        }
      }
    };
    loadCoins();
    return () => { cancelled = true; };
  }, []);

  const activeAlerts = alerts.filter((a) => a.status === 'active');

  const getPriceForCoin = (coinSymbol) => {
    const match = prices.find((p) => p.symbol === coinSymbol || p.id === coinSymbol);
    if (match) return match.price;
    const fallback = coins.find((c) => c.symbol === coinSymbol || c.id === coinSymbol);
    return fallback?.price || 0;
  };

  const selectedCoinWithLivePrice = useMemo(() => {
    if (!selectedCoin) return null;
    return {
      ...selectedCoin,
      price: getPriceForCoin(selectedCoin.symbol),
    };
  }, [selectedCoin, prices, coins]);

  const handleDelete = async (id) => {
    try {
      await deleteAlert(id);
      toast.success('Alert deleted');
    } catch {
      toast.error('Failed to delete alert');
    }
  };

  const handleAlertSubmit = async (data) => {
    await createAlert(data);
    toast.success('Alert created!');
  };

  const handleNewAlert = () => {
    if (!selectedCoin && coins.length > 0) {
      const btc = coins.find((c) => c.id === 'bitcoin');
      setSelectedCoin(btc || coins[0]);
    }
    setModalOpen(true);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Price Alerts</h1>
        <button
          onClick={handleNewAlert}
          className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-xl font-medium hover:opacity-90 transition text-sm"
        >
          + New Alert
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {['active', 'triggered'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition ${
              tab === t
                ? 'bg-gradient-to-r from-blue-500/20 to-purple-600/20 text-white border border-blue-500/30'
                : 'bg-[#2a2a4a] text-slate-400 hover:text-white'
            }`}
          >
            {t} {t === 'active' ? `(${activeAlerts.length})` : `(${triggeredAlerts.length})`}
          </button>
        ))}
      </div>

      {/* Active Alerts */}
      {tab === 'active' && (
        activeAlerts.length === 0 ? (
          <EmptyState icon="🔔" message="No active alerts. Create one to get notified when a coin hits your target." />
        ) : (
          <div className="space-y-3">
            {activeAlerts.map((alert) => (
              <div key={alert._id} className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl p-5 shadow-lg shadow-black/50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-semibold">{alert.coinName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      alert.condition === 'above'
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {alert.condition}
                    </span>
                  </div>
                  <div className="text-slate-400 text-sm">
                    Target: <span className="text-white font-medium">{formatINR(alert.targetPrice)}</span>
                  </div>
                  <div className="text-slate-500 text-xs mt-1">
                    Created {new Date(alert.createdAt).toLocaleDateString('en-IN')}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(alert._id)}
                  className="bg-red-500/10 text-red-400 border border-red-500/30 px-3 py-1 rounded-lg hover:bg-red-500/20 transition text-sm"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* Triggered Alerts */}
      {tab === 'triggered' && (
        triggeredAlerts.length === 0 ? (
          <EmptyState icon="✅" message="No triggered alerts yet." />
        ) : (
          <div className="space-y-3">
            {triggeredAlerts.map((alert) => (
              <div key={alert._id} className="bg-[#1a1a2e] border border-green-500/20 rounded-2xl p-5 shadow-lg shadow-black/50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-semibold">{alert.coinName}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                    triggered
                  </span>
                </div>
                <div className="text-slate-400 text-sm">
                  Was {alert.condition} <span className="text-white font-medium">{formatINR(alert.targetPrice)}</span>
                </div>
                {alert.triggeredAt && (
                  <div className="text-slate-500 text-xs mt-1">
                    Triggered at {new Date(alert.triggeredAt).toLocaleString('en-IN')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Alert Modal */}
      {selectedCoinWithLivePrice && (
        <AlertModal
          coin={selectedCoinWithLivePrice}
          currentPrice={getPriceForCoin(selectedCoinWithLivePrice.symbol)}
          coinOptions={coins}
          onCoinChange={setSelectedCoin}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmit={handleAlertSubmit}
        />
      )}
    </div>
  );
};

export default Alerts;
