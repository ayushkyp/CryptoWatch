import React from 'react';

const EmptyState = ({ message, icon }) => {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-5xl mb-4">{icon || '📭'}</div>
      <p className="text-slate-400 text-lg">{message || 'Nothing here yet.'}</p>
    </div>
  );
};

export default EmptyState;
