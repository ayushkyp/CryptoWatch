import { useEffect, useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getPriceHistory } from '../../services/api';

const formatINR = (price) => {
  if (!Number.isFinite(price)) return '₹0';
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)}Cr`;
  if (price >= 100000) return `₹${(price / 100000).toFixed(2)}L`;
  if (price >= 1000) return `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return `₹${price.toFixed(4)}`;
};

const withMA = (rows, period = 7) => {
  return rows.map((row, idx) => {
    if (idx < period - 1) {
      return { ...row, ma: null };
    }

    const window = rows.slice(idx - period + 1, idx + 1);
    const avg = window.reduce((acc, item) => acc + item.close, 0) / period;
    return { ...row, ma: avg };
  });
};

const MovingAverageChart = ({ symbol }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const history = await getPriceHistory(symbol, 30);
        const normalized = (Array.isArray(history) ? history : []).map((item) => ({
          label: new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          close: Number(item.close || 0),
        }));
        if (!cancelled) setRows(withMA(normalized, 7));
      } catch {
        if (!cancelled) setError('Unable to load moving average data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (symbol) load();

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const tickInterval = useMemo(() => {
    if (rows.length <= 10) return 0;
    return Math.floor(rows.length / 8);
  }, [rows.length]);

  return (
    <div className="rounded-2xl border border-[#2a2a4a] bg-[#1a1a2e] p-6">
      <h3 className="mb-4 text-lg font-semibold text-white">Moving Average (7-Day)</h3>

      {loading && <div className="h-64 animate-pulse rounded-xl bg-[#2a2a4a]" />}

      {!loading && error && (
        <div className="flex h-64 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/5 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="flex h-64 items-center justify-center rounded-xl border border-[#2a2a4a] text-sm text-slate-500">
          No data available.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={rows} margin={{ top: 5, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
            <XAxis
              dataKey="label"
              interval={tickInterval}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v) => formatINR(v)}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={85}
            />
            <Tooltip
              contentStyle={{
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '12px',
                color: '#e2e8f0',
              }}
              formatter={(value, name) => [formatINR(Number(value)), name]}
            />
            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="close"
              name="Close"
              stroke="#22d3ee"
              strokeWidth={2}
              dot={false}
              animationDuration={500}
            />
            <Line
              type="monotone"
              dataKey="ma"
              name="MA(7)"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              strokeDasharray="4 4"
              connectNulls={false}
              animationDuration={700}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default MovingAverageChart;
