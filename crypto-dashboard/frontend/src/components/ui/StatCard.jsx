import React from 'react';

const StatCard = ({ title, value, change, icon, color }) => {
  const isPositive = change >= 0;

  return (
    <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl p-5 shadow-lg shadow-black/50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-400 text-sm font-medium">{title}</span>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      {change !== undefined && (
        <div className={`text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
        </div>
      )}
    </div>
  );
};

export default StatCard;
