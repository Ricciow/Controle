import React, { useEffect, useRef, useState } from 'react';
import { TransferFunction } from '../core/types';
import { calculateGain, GainResult, withCalculatedGain } from '../core/gainCalculator';

const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-200';
const format = (value: number) => value.toLocaleString('pt-BR', { maximumSignificantDigits: 6 });
const metric = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const readNumber = (value: string) => value.trim() ? Number(value.replace(',', '.')) : NaN;

export const GainCalculatorCard: React.FC<{ systems: TransferFunction[]; onApply: (system: TransferFunction) => void }> = ({ systems, onApply }) => {
  const [selectedId, setSelectedId] = useState('');
  const [overshoot, setOvershoot] = useState('');
  const [settling, setSettling] = useState('');
  const [minGain, setMinGain] = useState('0.001');
  const [maxGain, setMaxGain] = useState('1000');
  const [result, setResult] = useState<GainResult | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const running = useRef<AbortController | null>(null);
  const system = systems.find(item => item.id === selectedId) ?? systems.find(item => item.visible) ?? systems[0];
  let familyKey = '';
  try { familyKey = system ? withCalculatedGain(system, 1).rawExpression : ''; } catch { familyKey = JSON.stringify(system); }
  const isApplied = Boolean(applied && result && system?.kValue === result.gain && system?.unityFeedback);
  const requestKey = JSON.stringify([system?.id, familyKey, overshoot, settling, minGain, maxGain]);
  // Changes to inputs invalidate the result and cancel any pending calculation.
  useEffect(() => {
    running.current?.abort();
    setBusy(false); setResult(null); setMessage(''); setApplied(false);
    return () => running.current?.abort();
  }, [requestKey]);

  const calculate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!system) return;
    running.current?.abort();
    const controller = new AbortController();
    running.current = controller;
    setBusy(true); setResult(null); setMessage(''); setApplied(false);
    try {
      const found = await calculateGain(system, {
        maxOvershoot: overshoot.trim() ? readNumber(overshoot) : undefined,
        maxSettlingTime: settling.trim() ? readNumber(settling) : undefined,
        minGain: readNumber(minGain), maxGain: readNumber(maxGain),
      }, controller.signal);
      if (controller.signal.aborted) return;
      setResult(found);
      if (!found) setMessage('Nenhum K encontrado nesta faixa para os requisitos informados. Tente ampliar a faixa ou ajustar os limites.');
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Não foi possível calcular K.');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  };

  return <section aria-label="Calcular K pelos requisitos" className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 space-y-3">
    <div>
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Calcular K pelos requisitos</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Realimentação unitária negativa. Informe um ou ambos os limites.</p>
    </div>
    {!system ? <p className="text-xs text-slate-500">Adicione uma função para calcular K.</p> : <form onSubmit={calculate} className="space-y-3">
      <label className="block text-xs text-slate-500 dark:text-slate-400">Função
        <select value={system.id} onChange={event => setSelectedId(event.target.value)} className={fieldClass}>
          {systems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-slate-500 dark:text-slate-400">Sobressinal máximo (%)
          <input inputMode="decimal" placeholder="Ex.: 20" value={overshoot} onChange={event => setOvershoot(event.target.value)} className={fieldClass} />
        </label>
        <label className="text-xs text-slate-500 dark:text-slate-400">Acomodação máxima (s, 2%)
          <input inputMode="decimal" placeholder="Ex.: 3" value={settling} onChange={event => setSettling(event.target.value)} className={fieldClass} />
        </label>
      </div>
      <details className="text-xs text-slate-500 dark:text-slate-400">
        <summary className="cursor-pointer">Faixa de K: {minGain} a {maxGain}</summary>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <label>K mínimo<input inputMode="decimal" value={minGain} onChange={event => setMinGain(event.target.value)} className={fieldClass} /></label>
          <label>K máximo<input inputMode="decimal" value={maxGain} onChange={event => setMaxGain(event.target.value)} className={fieldClass} /></label>
        </div>
      </details>
      <button disabled={busy} className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60">{busy ? 'Calculando…' : 'Calcular K'}</button>
      {busy && <button type="button" onClick={() => { running.current?.abort(); setBusy(false); setMessage('Cálculo cancelado.'); }} className="ml-3 text-sm text-slate-500">Cancelar</button>}
    </form>}
    <div role="status" aria-live="polite">
      {result && <>
        <p className="text-2xl font-semibold tabular-nums text-cyan-700 dark:text-cyan-300">K ≈ {format(result.gain)}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mp ≈ {metric(result.overshoot)}% · Ts (2%) ≈ {metric(result.settlingTime)} s</p>
        <button type="button" disabled={isApplied} onClick={() => { if (system) { onApply(withCalculatedGain(system, result.gain)); setApplied(true); } }} className="mt-2 rounded-lg border border-cyan-500 px-3 py-1.5 text-sm text-cyan-700 dark:text-cyan-300 disabled:opacity-60">{isApplied ? 'K aplicado' : 'Aplicar K à função'}</button>
      </>}
      {message && <p className="text-xs text-slate-600 dark:text-slate-300">{message}</p>}
    </div>
    <p className="text-[11px] text-slate-500 dark:text-slate-400">Busca numérica na resposta ao degrau. Pode haver outros valores de K.</p>
  </section>;
};
