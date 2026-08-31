import React from 'react';
import { Table, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { TransferFunction } from '../core/types';
import { ComplexMath } from '../core/complex';
import { MathView } from './MathView';

interface MetricsTableProps {
  systems: TransferFunction[];
}

export const MetricsTable: React.FC<MetricsTableProps> = ({ systems }) => {
  const activeSystems = systems.filter(s => s.analysis);

  return (
    <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60">
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center">
            Tabela Comparativa
            <span className="text-[10px] text-slate-400 font-normal ml-2 sm:hidden">(deslize →)</span>
          </h3>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {activeSystems.length} {activeSystems.length === 1 ? 'sistema' : 'sistemas'}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="sticky left-0 bg-slate-50 dark:bg-slate-950 z-20 px-4 py-3 border-r border-slate-200 dark:border-slate-800 shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#1e293b]">
                Sistema
              </th>
              <th className="px-4 py-3">Função H(s)</th>
              <th className="px-4 py-3 text-center">Estabilidade</th>
              <th className="px-4 py-3">Polos</th>
              <th className="px-4 py-3">Zeros</th>
              <th className="px-3 py-3 text-right">Ganho DC (K)</th>
              <th className="px-3 py-3 text-right">Amortecimento (ζ)</th>
              <th className="px-3 py-3 text-right">Freq. Natural (ωn)</th>
              <th className="px-3 py-3 text-right">Sobressinal (Mp)</th>
              <th className="px-3 py-3 text-right">T. Subida (tr)</th>
              <th className="px-3 py-3 text-right">T. Acomodação (ts)</th>
              <th className="px-3 py-3 text-right">Margem Fase (PM)</th>
              <th className="px-3 py-3 text-right">Margem Ganho (GM)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {activeSystems.map(sys => {
              if (!sys.analysis) return null;
              const { stability, metrics, poles, zeros } = sys.analysis;

              return (
                <tr key={sys.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  {/* Name & Color (Sticky on horizontal scroll) */}
                  <td className="sticky left-0 bg-white dark:bg-slate-900 z-10 px-4 py-3 whitespace-nowrap border-r border-slate-200 dark:border-slate-800 shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#1e293b]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: sys.color }} />
                      <span className="font-bold text-slate-900 dark:text-slate-100">{sys.name}</span>
                    </div>
                  </td>

                  {/* Function LaTeX */}
                  <td className="px-4 py-3 whitespace-nowrap text-slate-900 dark:text-slate-100">
                    <MathView math={sys.latex} />
                  </td>

                  {/* Stability */}
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    {stability === 'STABLE' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        Estável
                      </span>
                    ) : stability === 'MARGINALLY_STABLE' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                        <AlertTriangle className="w-3 h-3" />
                        Marginal
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                        <AlertCircle className="w-3 h-3" />
                        Instável
                      </span>
                    )}
                  </td>

                  {/* Poles */}
                  <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {poles.length > 0 ? poles.map(p => ComplexMath.format(p)).join(', ') : 'Nenhum'}
                  </td>

                  {/* Zeros */}
                  <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {zeros.length > 0 ? zeros.map(z => ComplexMath.format(z)).join(', ') : 'Nenhum'}
                  </td>

                  {/* DC Gain */}
                  <td className="px-3 py-3 text-right font-mono text-cyan-700 dark:text-cyan-300 font-semibold whitespace-nowrap">
                    {metrics.dcGain !== null ? metrics.dcGain : '∞'}
                  </td>

                  {/* Damping Ratio */}
                  <td className="px-3 py-3 text-right font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {metrics.dampingRatio !== null ? metrics.dampingRatio : '—'}
                  </td>

                  {/* Natural Freq */}
                  <td className="px-3 py-3 text-right font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {metrics.naturalFrequency !== null ? `${metrics.naturalFrequency} rad/s` : '—'}
                  </td>

                  {/* Overshoot */}
                  <td className="px-3 py-3 text-right font-mono font-medium whitespace-nowrap">
                    {metrics.overshootPercent !== null ? (
                      <span className={metrics.overshootPercent > 20 ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-800 dark:text-slate-200'}>
                        {metrics.overshootPercent.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>

                  {/* Rise Time */}
                  <td className="px-3 py-3 text-right font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {metrics.riseTime !== null ? `${metrics.riseTime} s` : '—'}
                  </td>

                  {/* Settling Time */}
                  <td className="px-3 py-3 text-right font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {metrics.settlingTime !== null ? `${metrics.settlingTime} s` : '—'}
                  </td>

                  {/* Phase Margin */}
                  <td className="px-3 py-3 text-right font-mono text-cyan-700 dark:text-cyan-300 font-semibold whitespace-nowrap">
                    {metrics.phaseMarginDeg !== null ? `${metrics.phaseMarginDeg}°` : '—'}
                  </td>

                  {/* Gain Margin */}
                  <td className="px-3 py-3 text-right font-mono text-cyan-700 dark:text-cyan-300 font-semibold whitespace-nowrap">
                    {metrics.gainMarginDb !== null ? `${metrics.gainMarginDb} dB` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
