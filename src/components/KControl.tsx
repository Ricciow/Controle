import React, { useEffect, useState } from 'react';

export const KControl: React.FC<{ value: number; onChange: (value: number) => void }> = ({ value, onChange }) => {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-200 dark:border-cyan-800/60 bg-cyan-50 dark:bg-cyan-950/30 p-2.5">
      <label className="flex items-center gap-2 text-xs font-semibold text-cyan-800 dark:text-cyan-200">
        Valor de K
        <input type="number" step="any" value={draft} aria-label="Valor de K"
          onChange={event => {
            setDraft(event.target.value);
            if (event.target.value !== '' && Number.isFinite(event.target.valueAsNumber)) onChange(event.target.valueAsNumber);
          }}
          onBlur={() => setDraft(String(value))}
          className="w-24 rounded border border-cyan-300 dark:border-cyan-800 bg-white dark:bg-slate-950 px-2 py-1 font-mono text-slate-900 dark:text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
      </label>
      <button type="button" onClick={() => { setDraft('0'); onChange(0); }}
        className="rounded px-2 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/40">Zerar K</button>
      <p className="w-full text-[11px] text-cyan-700 dark:text-cyan-400">Aceita valores positivos, negativos e zero. A análise atualiza automaticamente.</p>
    </div>
  );
};
