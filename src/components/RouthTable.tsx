import React, { Suspense, useMemo, useState } from 'react';
import { Table } from 'lucide-react';
import { TransferFunction } from '../core/types';
import { analyzeRouth } from '../core/routh';
import { Polynomial } from '../core/polynomial';
import { MathView } from './MathView';

const SymbolicRouthTable = React.lazy(() => import('./SymbolicRouthTable').then(module => ({ default: module.SymbolicRouthTable })));

const formatValue = (value: number) => {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  return Math.abs(value) >= 1e6 || Math.abs(value) < 1e-4
    ? value.toExponential(4) : Number(value.toPrecision(7)).toString();
};

const labels = {
  STABLE: 'Assintoticamente estável',
  UNSTABLE: 'Instável',
  BOUNDARY: 'Polos no eixo imaginário',
  INCONCLUSIVE: 'Análise inconclusiva',
};

export const RouthTable: React.FC<{ systems: TransferFunction[] }> = ({ systems }) => {
  const [symbolic, setSymbolic] = useState(false);
  const results = useMemo(() => systems.map(system => {
    try {
      if (system.error || !system.analysis) return { system, result: null, error: system.error || 'Função inválida.' };
      return { system, result: analyzeRouth(system.denominator), error: null };
    } catch (error) {
      return { system, result: null, error: error instanceof Error ? error.message : 'Erro na análise.' };
    }
  }), [systems]);

  return (
    <section aria-label="Tabela de Routh-Hurwitz" className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60">
        <h3 className="flex items-center gap-2 font-semibold text-sm text-slate-800 dark:text-slate-100">
          <Table className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />Tabela de Routh-Hurwitz
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Cada mudança de sinal na primeira coluna indica um polo no semiplano direito.
          A análise usa o polinômio característico da malha escolhida, sem cancelamento de polos e zeros.
        </p>
        <div className="flex flex-wrap gap-2 mt-3 text-xs">
          <button type="button" aria-pressed={!symbolic} onClick={() => setSymbolic(false)} className={`px-3 py-1.5 rounded-lg ${!symbolic ? 'bg-cyan-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>Numérica (K escolhido)</button>
          <button type="button" aria-pressed={symbolic} onClick={() => setSymbolic(true)} className={`px-3 py-1.5 rounded-lg ${symbolic ? 'bg-cyan-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>Em função de K</button>
        </div>
      </div>
      <div className="p-4 space-y-5">
        {results.length === 0 && <p className="text-sm text-slate-500">Adicione uma função válida para montar a tabela.</p>}
        {results.map(({ system, result, error }) => (
          <article key={system.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: system.color }} />{system.name}
              </h4>
              {result && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                result.status === 'STABLE' ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : result.status === 'UNSTABLE' ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400'
                    : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'
              }`}>{labels[result.status]}{symbolic ? ` (K = ${system.kValue ?? 1})` : ''}</span>}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{system.unityFeedback ? 'Malha fechada · realimentação negativa unitária · P(s) = D(s) + N(s)' : 'Malha aberta · P(s) = D(s)'}</p>
            {symbolic ? <Suspense fallback={<p className="text-xs text-slate-500">Montando tabela em função de K…</p>}><SymbolicRouthTable system={system} /></Suspense> : <>
            {result && <div className="overflow-x-auto text-sm"><MathView math={`P(s) = ${Polynomial.toLaTeX(system.denominator)}`} /></div>}
            {system.inputMode === 'expression' && /[kK]/.test(system.rawExpression) && <p className="text-xs font-mono text-cyan-700 dark:text-cyan-300">K = {system.kValue ?? 1}</p>}
            {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
            {result && <>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-right border-collapse">
                  <caption className="sr-only">Tabela de Routh para {system.name}</caption>
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
                    <tr><th scope="col" className="px-3 py-2 text-left">Potência</th>
                      {result.rows[0].values.map((_, j) => <th scope="col" key={j} className="px-3 py-2 whitespace-nowrap">{j === 0 ? '1ª coluna (sinais)' : `${j + 1}ª coluna`}</th>)}
                      <th scope="col" className="px-3 py-2 text-left">Observação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {result.rows.map(row => <tr key={row.power}>
                      <th scope="row" className="px-3 py-2 text-left font-mono">s<sup>{row.power}</sup></th>
                      {row.values.map((value, j) => <td key={j} className={`px-3 py-2 font-mono whitespace-nowrap ${j === 0 ? row.signChange ? 'font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400' : 'font-bold bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' : ''}`}>
                        {row.specialCase === 'epsilon' && j === 0 ? 'ε' : formatValue(value)}
                      </td>)}
                      <td className="px-3 py-2 text-left text-slate-500 dark:text-slate-400">
                        {[row.signChange ? 'Mudança de sinal' : '', row.specialCase === 'auxiliary' ? 'Derivada auxiliar' : row.specialCase === 'epsilon' ? 'ε → 0⁺' : ''].filter(Boolean).join(' · ') || '—'}
                      </td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {result.signChanges === null ? 'Contagem de polos inconclusiva.' : `${result.signChanges} ${result.signChanges === 1 ? 'mudança de sinal / polo' : 'mudanças de sinal / polos'} no semiplano direito.`}
              </p>
              {result.notes.map(note => <p key={note} className="text-xs text-amber-700 dark:text-amber-400">{note}</p>)}
            </>}
            </>}
          </article>
        ))}
      </div>
    </section>
  );
};
