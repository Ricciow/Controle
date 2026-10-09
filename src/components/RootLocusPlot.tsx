import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { PoleZeroPlot } from './PoleZeroPlot';
import { TransferFunction } from '../core/types';
import { calculateRootLocus, rootLocusGain, rootLocusPoles } from '../core/rootLocus';

export const RootLocusPlot: React.FC<{ systems: TransferFunction[] }> = ({ systems }) => {
  const [maxGain, setMaxGain] = useState(100);
  const [gain, setGain] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const gainRef = useRef(gain);
  useEffect(() => { gainRef.current = gain; }, [gain]);
  const curves = useMemo(() => systems.filter(system => system.visible && system.analysis).map(system => {
    try {
      return { system, data: calculateRootLocus(system, maxGain), error: null };
    } catch (error) {
      return { system, data: null, error: error instanceof Error ? error.message : 'Erro ao calcular LGR.' };
    }
  }), [systems, maxGain]);
  const canAnimate = curves.some(({ data }) => data?.branches.some(branch => branch.length > 1));
  useEffect(() => {
    if (!canAnimate) { setIsPlaying(false); return; }
    if (!isPlaying) return;
    let progress = Math.log1p(1000 * gainRef.current / maxGain) / Math.log(1001);
    let lastTime = performance.now();
    let frame: number;
    const advance = (time: number) => {
      // Cap the elapsed time so returning from a background tab cannot skip the locus.
      progress = Math.min(1, progress + Math.min(time - lastTime, 100) * speed / 30000);
      lastTime = time;
      setGain(Number(rootLocusGain(progress, maxGain).toPrecision(6)));
      if (progress >= 1) { setIsPlaying(false); return; }
      frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [canAnimate, isPlaying, maxGain, speed]);
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
                setIsPlaying(false);
                setMaxGain(value);
                setGain(current => Math.min(current, value));
              }
            }} className="w-24 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 font-mono" />
        </label>
        <label className="flex items-center gap-2">K selecionado
          <input type="number" aria-label="K selecionado do root locus" min="0" max={maxGain} step="any" value={gain}
            onChange={event => {
              const value = event.target.valueAsNumber;
              if (Number.isFinite(value) && value >= 0 && value <= maxGain) {
                setIsPlaying(false);
                setGain(value);
              }
            }} className="w-24 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 font-mono" />
        </label>
        <input type="range" aria-label="Variar K no root locus" min="0" max={maxGain} step={maxGain / 1000} value={gain}
          onChange={event => { setIsPlaying(false); setGain(event.target.valueAsNumber); }} className="min-w-24 flex-1 accent-cyan-600" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!canAnimate} aria-pressed={isPlaying}
          aria-label={isPlaying ? 'Pausar animação do root locus' : 'Animar root locus'}
          onClick={() => {
            if (!isPlaying && gain >= maxGain) setGain(0);
            setIsPlaying(current => !current);
          }} className="flex items-center gap-1.5 rounded-md bg-cyan-600 px-2.5 py-1.5 font-semibold text-white hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed">
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isPlaying ? 'Pausar' : 'Animar'}
        </button>
        <button type="button" aria-label="Reiniciar animação do root locus"
          onClick={() => { setIsPlaying(false); setGain(0); }}
          className="flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
          <RotateCcw className="w-3.5 h-3.5" /> Reiniciar
        </button>
        <label className="flex items-center gap-1.5">Velocidade
          <select aria-label="Velocidade da animação do root locus" value={speed} onChange={event => setSpeed(Number(event.target.value))}
            className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-1 py-1">
            <option value="0.5">Lenta (0,5×)</option>
            <option value="1">Normal (1×)</option>
            <option value="2">Rápida (2×)</option>
          </select>
        </label>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">Avanço suave, mais lento perto de K = 0.</span>
      </div>
      {entries.filter(entry => entry.error).map(({ system, error }) =>
        <p key={system.id} role="status" className="text-rose-600 dark:text-rose-400">{system.name}: {error}</p>)}
      {entries.length === 0 && <p>Adicione ou exiba um sistema válido para visualizar o LGR.</p>}
    </div>
  } />;
};
