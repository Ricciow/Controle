import React, { useMemo, useState } from 'react';
import { PoleZeroPlot } from './PoleZeroPlot';
import { TransferFunction } from '../core/types';
import { calculateRootLocus, rootLocusPoles } from '../core/rootLocus';

export const RootLocusPlot: React.FC<{ systems: TransferFunction[] }> = ({ systems }) => {
  const [maxGain, setMaxGain] = useState(100);
  const [gain, setGain] = useState(1);
  const curves = useMemo(() => systems.filter(system => system.visible && system.analysis).map(system => {
    try {
      return { system, data: calculateRootLocus(system, maxGain), error: null };
    } catch (error) {
      return { system, data: null, error: error instanceof Error ? error.message : 'Erro ao calcular LGR.' };
    }
  }), [systems, maxGain]);
  const entries = useMemo(() => curves.map(entry => {
    if (!entry.data) return entry;
    try {
      return { ...entry, data: { ...entry.data, selectedPoles: rootLocusPoles(entry.system, gain) } };
    } catch (error) {
      return { ...entry, data: { ...entry.data, selectedPoles: [] },
        error: error instanceof Error ? error.message : 'K indefinido.' };
    }
  }), [curves, gain]);
  const displaySystems = entries.flatMap(({ system, data }) => data && system.analysis ? [{
    ...system, analysis: { ...system.analysis, poles: data.poles, zeros: data.zeros },
  }] : []);
  const locus = entries.flatMap(({ system, data }) => data ? [{
    id: system.id, name: system.name, color: system.color, data, gain,
  }] : []);

  return <PoleZeroPlot systems={displaySystems} locus={locus} controls={
    <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-300">
      <p>Realimentação unitária negativa: D(s) + K N(s) = 0. Se a expressão contém K, varia-se esse parâmetro em D(s, K) + N(s, K) = 0.</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">K máximo
          <input type="number" aria-label="K máximo do root locus" min="0.001" max="1000000" step="any" value={maxGain}
            onChange={event => {
              const value = event.target.valueAsNumber;
              if (Number.isFinite(value) && value > 0 && value <= 1e6) {
                setMaxGain(value);
                setGain(current => Math.min(current, value));
              }
            }} className="w-24 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 font-mono" />
        </label>
        <label className="flex items-center gap-2">K selecionado
          <input type="number" aria-label="K selecionado do root locus" min="0" max={maxGain} step="any" value={gain}
            onChange={event => {
              const value = event.target.valueAsNumber;
              if (Number.isFinite(value) && value >= 0 && value <= maxGain) setGain(value);
            }} className="w-24 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 font-mono" />
        </label>
        <input type="range" aria-label="Variar K no root locus" min="0" max={maxGain} step={maxGain / 1000} value={gain}
          onChange={event => setGain(event.target.valueAsNumber)} className="min-w-24 flex-1 accent-cyan-600" />
      </div>
      {entries.filter(entry => entry.error).map(({ system, error }) =>
        <p key={system.id} role="status" className="text-rose-600 dark:text-rose-400">{system.name}: {error}</p>)}
      {entries.length === 0 && <p>Adicione ou exiba um sistema válido para visualizar o LGR.</p>}
    </div>
  } />;
};
