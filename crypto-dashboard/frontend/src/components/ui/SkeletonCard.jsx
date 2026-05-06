import React from 'react';

const SkeletonCard = () => {
  return (
    <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl p-5 shadow-lg shadow-black/50 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="h-4 w-24 bg-[#2a2a4a] rounded mb-2" />
          <div className="h-3 w-12 bg-[#2a2a4a] rounded" />
        </div>
        <div className="h-7 w-16 bg-[#2a2a4a] rounded-lg" />
      </div>
      <div className="h-6 w-32 bg-[#2a2a4a] rounded mb-2" />
      <div className="h-4 w-20 bg-[#2a2a4a] rounded" />
    </div>
  );
};

export default SkeletonCard;
