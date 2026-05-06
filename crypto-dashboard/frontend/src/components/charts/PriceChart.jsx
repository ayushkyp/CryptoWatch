import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getPriceHistory } from '../../services/api';

const formatINR = (price) => {
  if (!price && price !== 0) return '₹0';
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)}Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(2)}L`;
  if (price >= 1000) return `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return `₹${price.toFixed(4)}`;
};

const formatDate = (isoString, days) => {
  const date = new Date(isoString);
  if (days <= 7) {
    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl p-3 shadow-lg">
        <p className="text-slate-400 text-xs mb-1">{label}</p>
        <p className="text-blue-400 font-bold">{formatINR(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

export default function PriceChart({ coinId }) {
  const [data, setData] = useState([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getPriceHistory(coinId, days);
      const formatted = (response || []).map((item) => ({
        date: formatDate(item.timestamp, days),
        price: item.price,
      }));
      setData(formatted);
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        setError('Rate limit reached — data will load shortly. Click Retry in a moment.');
      } else {
        setError('Failed to load price history. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (coinId) fetchHistory();
  }, [coinId, days]); // eslint-disable-line

  return (
    <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white font-semibold text-lg">Price History</h3>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                days === d ? 'bg-blue-600 text-white' : 'bg-[#2a2a4a] text-slate-400 hover:text-white'
              }`}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="h-64 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading chart data...</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="h-64 flex flex-col items-center justify-center gap-3">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={fetchHistory}
            className="text-xs bg-[#2a2a4a] text-slate-300 px-3 py-1.5 rounded-lg hover:bg-[#3a3a5a] transition"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={Math.floor(data.length / 8)}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatINR(v)}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#3b82f6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {!loading && !error && data.length === 0 && (
        <div className="h-64 flex items-center justify-center">
          <p className="text-slate-500 text-sm">No historical data available</p>
        </div>
      )}
    </div>
  );
}
