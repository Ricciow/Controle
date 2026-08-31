import React, { useMemo } from 'react';
import { Target, Compass } from 'lucide-react';
import { TransferFunction } from '../core/types';

interface NyquistPlotProps {
  systems: TransferFunction[];
}

export const NyquistPlot: React.FC<NyquistPlotProps> = ({ systems }) => {
  const activeSystems = useMemo(
    () => systems.filter(s => s.visible && s.analysis?.nyquist && s.analysis.nyquist.length > 0),
    [systems]
  );

  // Compute bounding box around (-1, 0) and curves
  const bounds = useMemo(() => {
    let maxVal = 2.0;
    activeSystems.forEach(sys => {
      if (!sys.analysis) return;
      sys.analysis.nyquist.forEach(pt => {
        if (isFinite(pt.re) && isFinite(pt.im)) {
          const absRe = Math.abs(pt.re);
          const absIm = Math.abs(pt.im);
          if (absRe < 100 && absRe > maxVal) maxVal = absRe;
          if (absIm < 100 && absIm > maxVal) maxVal = absIm;
        }
      });
    });
    return Math.min(25, Math.max(2.5, Math.ceil(maxVal * 1.25)));
  }, [activeSystems]);

  const width = 600;
  const height = 450;
  const cx = width / 2;
  const cy = height / 2;
  const scale = (Math.min(width, height) * 0.42) / bounds;

  const toSvg = (re: number, im: number) => ({
    x: cx + re * scale,
    y: cy - im * scale
  });

  const critPoint = toSvg(-1, 0);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-100">
            Diagrama de Nyquist (Plano Polar Re x Im)
          </h3>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-md text-rose-600 dark:text-rose-400 font-medium text-[11px]">
            <Target className="w-3 h-3" />
            <span>Ponto Crítico: (-1, 0j)</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative flex-1 bg-slate-50/50 dark:bg-slate-950 select-none overflow-hidden min-h-0">
        <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
          {/* Unit Circle */}
          <circle
            cx={cx}
            cy={cy}
            r={1.0 * scale}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="0.8"
            strokeDasharray="3 3"
          />

          {/* Coordinate Axes */}
          <line x1={0} y1={cy} x2={width} y2={cy} stroke="#64748b" strokeWidth="1.2" />
          <line x1={cx} y1={0} x2={cx} y2={height} stroke="#64748b" strokeWidth="1.2" />

          {/* Axis Labels */}
          <text x={width - 16} y={cy - 8} fill="#64748b" fontSize="11" fontWeight="600" textAnchor="end">
            Real (Re)
          </text>
          <text x={cx + 10} y={16} fill="#64748b" fontSize="11" fontWeight="600" textAnchor="start">
            Imag (Im)
          </text>

          {/* Critical Point (-1, 0j) */}
          <g>
            <circle cx={critPoint.x} cy={critPoint.y} r={8} fill="#f43f5e" opacity="0.2" />
            <circle cx={critPoint.x} cy={critPoint.y} r={4.5} fill="#f43f5e" stroke="#ffffff" className="dark:stroke-slate-900" strokeWidth="1.5" />
            <text x={critPoint.x} y={critPoint.y + 16} fill="#e11d48" className="dark:fill-rose-400" fontSize="10" fontWeight="bold" textAnchor="middle">
              -1 + 0j
            </text>
          </g>

          {/* Nyquist Paths for Each System */}
          {activeSystems.map(sys => {
            if (!sys.analysis?.nyquist) return null;
            const pts = sys.analysis.nyquist;
            if (pts.length === 0) return null;

            // Direct Path (w >= 0)
            let dPos = '';
            // Mirrored Path (w < 0)
            let dNeg = '';

            for (let i = 0; i < pts.length; i++) {
              const p = pts[i];
              if (!isFinite(p.re) || !isFinite(p.im)) continue;
              const posPt = toSvg(p.re, p.im);
              const negPt = toSvg(p.re, -p.im);

              if (dPos === '') {
                dPos += `M ${posPt.x} ${posPt.y}`;
                dNeg += `M ${negPt.x} ${negPt.y}`;
              } else {
                dPos += ` L ${posPt.x} ${posPt.y}`;
                dNeg += ` L ${negPt.x} ${negPt.y}`;
              }
            }

            return (
              <g key={`nyquist-${sys.id}`}>
                {/* Positive Freq Curve */}
                <path d={dPos} fill="none" stroke={sys.color} strokeWidth="2.5" strokeLinecap="round" />
                {/* Negative Freq Curve (Conjugate Mirror) */}
                <path d={dNeg} fill="none" stroke={sys.color} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" strokeLinecap="round" />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50/80 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-cyan-600 dark:bg-cyan-400" />
            <span>Trajetória ω &gt; 0</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 border-b-2 border-dashed border-cyan-600 dark:border-cyan-400" />
            <span>Espelho Conjugado ω &lt; 0</span>
          </div>
        </div>
        <div className="text-[11px] text-slate-500">
          <span>Critério de Estabilidade de Nyquist</span>
        </div>
      </div>
    </div>
  );
};
