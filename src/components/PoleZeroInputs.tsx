import React from 'react';

export const PoleZeroInputs: React.FC<{
  poles: string;
  zeros: string;
  onPolesChange: (value: string) => void;
  onZerosChange: (value: string) => void;
}> = ({ poles, zeros, onPolesChange, onZerosChange }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Polos:
      <input aria-label="Polos" value={poles} onChange={event => onPolesChange(event.target.value)}
        placeholder="1, 2, -4" className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 font-mono text-slate-900 dark:text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500" />
    </label>
    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Zeros:
      <input aria-label="Zeros" value={zeros} onChange={event => onZerosChange(event.target.value)}
        placeholder="3, 2" className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 font-mono text-slate-900 dark:text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500" />
    </label>
  </div>
);
