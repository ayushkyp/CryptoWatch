import { useState, useEffect, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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

const formatLabel = (isoString, days) => {
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

const PriceChart = ({ symbol }) => {
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await getPriceHistory(symbol, days);
        const data = (Array.isArray(response) ? response : (response.data ? response.data : [])).map((row) => {
          const close = Number(row.close || row.c || 0);
          const high = Number(row.high || row.h || 0);
          const low = Number(row.low || row.l || 0);
          
          if (!Number.isFinite(close) || close <= 0) {
            console.warn('[PriceChart] Invalid price data:', row);
            return null;
          }
          
          return {
            label: formatLabel(row.date, days),
            close,
            high: Number.isFinite(high) ? high : close,
            low: Number.isFinite(low) ? low : close,
            date: row.date,
          };
        }).filter(Boolean);

        if (data.length === 0) {
          if (!cancelled) setError('No historical data available for this period.');
        } else {
          if (!cancelled) setRows(data);
        }
      } catch (error) {
        console.error('[PriceChart] History fetch error:', error);
        if (!cancelled) setError(`Failed to load historical chart data. ${error.message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (symbol) load();
    return () => {
      cancelled = true;
    };
  }, [symbol, days]);

  const tickInterval = useMemo(() => {
    if (rows.length <= 10) return 0;
    return Math.floor(rows.length / 8);
  }, [rows.length]);

  return (
    <div className="rounded-2xl border border-[#2a2a4a] bg-[#1a1a2e] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Historical Price</h3>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1 text-sm font-medium transition ${
                d === days
                  ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950'
                  : 'bg-[#2a2a4a] text-slate-300 hover:bg-[#3a3a5a]'
              }`}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="h-72 animate-pulse rounded-xl bg-[#2a2a4a]" />}

      {!loading && error && (
        <div className="flex h-72 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/5 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="flex h-72 items-center justify-center rounded-xl border border-[#2a2a4a] text-sm text-slate-500">
          No historical records available.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={rows} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
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
                border: '1px solid #155e75',
                borderRadius: '12px',
                color: '#e2e8f0',
              }}
              formatter={(value) => formatINR(Number(value))}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ''}
            />
            <Area
              type="monotone"
              dataKey="close"
              stroke="#22d3ee"
              strokeWidth={2.5}
              fill="url(#priceGradient)"
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default PriceChart;
