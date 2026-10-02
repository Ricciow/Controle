import React from 'react';
import { MathView } from './MathView';

export const FeedbackControl: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void }> = ({ enabled, onChange }) => (
  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-2.5 space-y-1.5">
    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
      <input type="checkbox" checked={enabled} onChange={event => onChange(event.target.checked)} className="accent-cyan-600" />
      Realimentação negativa unitária
    </label>
    <p className="text-[11px] text-slate-500 dark:text-slate-400">
      {enabled ? 'Gráficos, métricas e Routh analisam a malha fechada.' : 'A análise usa a função G(s) informada.'}
    </p>
    {enabled && <div className="text-xs overflow-x-auto"><MathView math="T(s)=\frac{G(s)}{1+G(s)}=\frac{N(s)}{D(s)+N(s)}" /></div>}
  </div>
);
