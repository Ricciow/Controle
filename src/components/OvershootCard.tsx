import React, { useState } from 'react';
import { TransferFunction } from '../core/types';

export const OvershootCard: React.FC<{ systems: TransferFunction[] }> = ({ systems }) => {
  const [selectedId, setSelectedId] = useState('');
  const system = systems.find(item => item.id === selectedId) ?? systems.find(item => item.visible) ?? systems[0];
  const analysis = system?.analysis;
  const value = !system?.error && analysis?.isProper && analysis.stability === 'STABLE'
    ? analysis.metrics.overshootPercent : null;
  const available = value !== null && value !== undefined && Number.isFinite(value);
  const message = !system ? 'Adicione uma função para calcular o sobressinal.'
    : system.error || !analysis ? 'Confira a função informada.'
    : !analysis.isProper ? 'Não disponível para função imprópria.'
    : analysis.stability !== 'STABLE' ? 'A resposta não possui valor final estável.'
    : 'Não foi possível determinar o sobressinal desta resposta.';
  const hasK = system && system.inputMode !== 'coefficients' && /[kK]/.test(system.rawExpression);

  return <section aria-label="Sobressinal" className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-3">
    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Sobressinal (Mp)</h3>
    {!!systems.length && <label className="block text-xs text-slate-500 dark:text-slate-400">Função
      <select aria-label="Função para calcular o sobressinal" value={system?.id ?? ''} onChange={event => setSelectedId(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-200">
        {systems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>}
    <div role="status" aria-live="polite">
      <p className="text-3xl font-semibold tabular-nums text-cyan-700 dark:text-cyan-300">{available ? `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : '—'}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{available ? 'Estimado a partir da resposta ao degrau.' : message}</p>
    </div>
    {system && <p className="text-xs text-slate-500 dark:text-slate-400">{system.unityFeedback ? 'Malha fechada' : 'Malha aberta'}{hasK ? ` · K = ${system.kValue ?? 1}` : ''}</p>}
  </section>;
};
