import { useState, useEffect } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { getPriceHistory } from '../../services/api';

const formatINR = (price) => {
  if (!price) return '₹0';
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)}Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(2)}L`;
  if (price >= 1000) return `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return `₹${price.toFixed(4)}`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl px-4 py-3 shadow-xl text-sm space-y-1">
        <p className="text-slate-400">{label}</p>
        {payload.map((entry) => (
          <p key={entry.name} style={{ color: entry.color }} className="font-medium">
            {entry.name}: {entry.value ? formatINR(entry.value) : 'N/A'}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const calculateMA = (data, period) =>
  data.map((item, index) => {
    if (index < period - 1) return { ...item, ma: null };
    const slice = data.slice(index - period + 1, index + 1);
    const avg = slice.reduce((sum, d) => sum + d.price, 0) / period;
    return { ...item, ma: avg };
  });

const MovingAverageChart = ({ coinId }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAndProcess = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getPriceHistory(coinId, 30);
        const raw = response.map(item => ({
          date: new Date(item.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          price: item.price,
        }));
        setData(calculateMA(raw, 7));
      } catch (err) {
        const status = err.response?.status;
        setError(status === 429
          ? 'Rate limited — try again shortly'
          : 'Failed to load moving average data'
        );
      } finally {
        setLoading(false);
      }
    };
    if (coinId) fetchAndProcess();
  }, [coinId]);

  return (
    <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl p-5 shadow-lg shadow-black/50">
      <h3 className="text-white font-semibold mb-5">Moving Average (7-day)</h3>

      {loading && (
        <div className="h-56 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && error && (
        <div className="h-56 flex items-center justify-center">
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={Math.floor(data.length / 8)}
            />
            <YAxis
              tickFormatter={(v) => formatINR(v)}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
            <Line type="monotone" dataKey="price" name="Price" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="ma" name="7-Day MA" stroke="#f97316" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {!loading && data.length === 0 && (
        <div className="h-56 flex items-center justify-center text-slate-500 text-sm">
          No data available.
        </div>
      )}
    </div>
  );
};

export default MovingAverageChart;
