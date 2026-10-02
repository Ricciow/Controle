import React, { useMemo } from 'react';
import { TransferFunction } from '../core/types';
import { analyzeSymbolicRouth, symbolicLatex } from '../core/symbolicRouth';
import { MathView } from './MathView';

export const SymbolicRouthTable: React.FC<{ system: TransferFunction }> = ({ system }) => {
  const { result, error } = useMemo(() => {
    try { return { result: analyzeSymbolicRouth(system), error: null }; }
    catch (error) { return { result: null, error: error instanceof Error ? error.message : 'Não foi possível montar a tabela simbólica.' }; }
  }, [system.inputMode, system.rawExpression, system.numStr, system.denStr, system.unityFeedback]);
  if (!result) return <p className="text-xs text-amber-700 dark:text-amber-400">{error}</p>;
  return <div className="space-y-3">
    <div className="overflow-x-auto"><MathView math={`P(s,K)=${symbolicLatex(result.characteristic)}`} /></div>
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="w-full text-xs text-center border-collapse">
        <caption className="sr-only">Routh em função de K para {system.name}</caption>
        <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400"><tr>
          <th scope="col" className="px-3 py-2 text-left">Potência</th>
          {result.rows[0].values.map((_, j) => <th key={j} scope="col" className="px-3 py-2 whitespace-nowrap">{j + 1}ª coluna</th>)}
          <th scope="col" className="px-3 py-2">Caso especial</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {result.rows.map(row => <tr key={row.power}>
            <th scope="row" className="px-3 py-3 text-left font-mono">s<sup>{row.power}</sup></th>
            {row.values.map((value, j) => <td key={j} className={`px-3 py-3 whitespace-nowrap ${j === 0 ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' : ''}`}><MathView math={symbolicLatex(value)} /></td>)}
            <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{row.specialCase === 'auxiliary' ? 'Derivada auxiliar' : row.specialCase === 'epsilon' ? 'ε → 0⁺' : '—'}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
    {result.alwaysNonStable ? <p className="text-xs text-amber-700 dark:text-amber-400">A primeira coluna ou os casos especiais impedem estabilidade assintótica nesta família.</p> : <div className="space-y-2 text-xs">
      <p className="font-semibold">Condições simultâneas para estabilidade assintótica:</p>
      {result.conditions.length ? result.conditions.map(condition => <div key={condition} className="overflow-x-auto"><MathView math={condition} /></div>) : <p>Primeira coluna com sinais iguais para todos os valores admissíveis de K.</p>}
    </div>}
    {result.restrictions.length > 0 && <div className="text-xs space-y-1">
      <p className="font-medium">Esta forma da tabela exige:</p>
      {result.restrictions.map(restriction => <div key={restriction} className="overflow-x-auto"><MathView math={restriction} /></div>)}
    </div>}
    {result.notes.map(note => <p key={note} className="text-xs text-slate-500 dark:text-slate-400">{note}</p>)}
  </div>;
};
