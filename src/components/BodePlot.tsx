import React, { useState, useRef, useMemo } from 'react';
import { BarChart2, Compass } from 'lucide-react';
import { TransferFunction, BodeData } from '../core/types';

interface BodePlotProps {
  systems: TransferFunction[];
}

export const BodePlot: React.FC<BodePlotProps> = ({ systems }) => {
  const [hoverSvgX, setHoverSvgX] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const activeSystems = useMemo(
    () => systems.filter(s => s.visible && s.analysis && s.analysis.bode),
    [systems]
  );

  // Global frequency bounds calculated directly from active systems
  const { minW, maxW, minMag, maxMag, minPhase, maxPhase } = useMemo(() => {
    let minFreq = Infinity;
    let maxFreq = -Infinity;
    let minM = Infinity;
    let maxM = -Infinity;
    let minP = Infinity;
    let maxP = -Infinity;

    activeSystems.forEach(sys => {
      if (!sys.analysis?.bode) return;
      const { w, magDb, phaseDeg } = sys.analysis.bode;
      if (w.length > 0) {
        if (w[0] < minFreq) minFreq = w[0];
        if (w[w.length - 1] > maxFreq) maxFreq = w[w.length - 1];
      }
      magDb.forEach(m => {
        if (isFinite(m)) {
          if (m < minM) minM = m;
          if (m > maxM) maxM = m;
        }
      });
      phaseDeg.forEach(p => {
        if (isFinite(p)) {
          if (p < minP) minP = p;
          if (p > maxP) maxP = p;
        }
      });
    });

    if (!isFinite(minFreq) || minFreq <= 0) minFreq = 0.1;
    if (!isFinite(maxFreq) || maxFreq <= minFreq) maxFreq = 100;
    if (!isFinite(minM)) minM = -40;
    if (!isFinite(maxM)) maxM = 20;
    if (!isFinite(minP)) minP = -270;
    if (!isFinite(maxP)) maxP = 90;

    // Expand to clean whole decades for frequency
    const decMin = Math.floor(Math.log10(minFreq));
    const decMax = Math.ceil(Math.log10(maxFreq));

    return {
      minW: Math.pow(10, decMin),
      maxW: Math.pow(10, decMax),
      minMag: Math.floor(minM / 20) * 20 - 10,
      maxMag: Math.ceil(maxM / 20) * 20 + 10,
      minPhase: Math.floor(minP / 45) * 45 - 20,
      maxPhase: Math.ceil(maxP / 45) * 45 + 20,
    };
  }, [activeSystems]);

  // Dimensions inside SVG
  const width = 600;
  const height = 480;
  const padding = { top: 25, right: 25, bottom: 40, left: 55 };
  const gap = 35;
  const subPlotHeight = (height - padding.top - padding.bottom - gap) / 2;
  const plotWidth = width - padding.left - padding.right;

  // Log10 coordinate conversions
  const logMinW = Math.log10(minW);
  const logMaxW = Math.log10(maxW);

  const wToX = (w: number) => {
    const logW = Math.log10(Math.max(minW, Math.min(maxW, w)));
    return padding.left + ((logW - logMinW) / (logMaxW - logMinW)) * plotWidth;
  };

  const xToW = (x: number) => {
    const frac = Math.max(0, Math.min(1, (x - padding.left) / plotWidth));
    return Math.pow(10, logMinW + frac * (logMaxW - logMinW));
  };

  // Magnitude Y
  const magToY = (mag: number) => {
    const top = padding.top;
    return top + subPlotHeight - ((mag - minMag) / (maxMag - minMag)) * subPlotHeight;
  };

  // Phase Y
  const phaseToY = (phase: number) => {
    const top = padding.top + subPlotHeight + gap;
    return top + subPlotHeight - ((phase - minPhase) / (maxPhase - minPhase)) * subPlotHeight;
  };

  // Accurate log-frequency interpolation of Magnitude & Phase
  const getBodeAtW = (bode: BodeData, targetW: number) => {
    const { w, magDb, phaseDeg } = bode;
    if (w.length === 0) return { mag: 0, phase: 0 };
    if (targetW <= w[0]) return { mag: magDb[0], phase: phaseDeg[0] };
    if (targetW >= w[w.length - 1]) {
      return { mag: magDb[magDb.length - 1], phase: phaseDeg[phaseDeg.length - 1] };
    }

    const logTarget = Math.log10(targetW);
    let low = 0;
    let high = w.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (w[mid] <= targetW) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    const i = Math.max(0, Math.min(w.length - 2, high));
    const logW0 = Math.log10(w[i]);
    const logW1 = Math.log10(w[i + 1]);
    const frac = logW1 === logW0 ? 0 : (logTarget - logW0) / (logW1 - logW0);

    const mag = magDb[i] + frac * (magDb[i + 1] - magDb[i]);
    const phase = phaseDeg[i] + frac * (phaseDeg[i + 1] - phaseDeg[i]);
    return { mag, phase };
  };

  // Frequency Decade Ticks
  const freqTicks = useMemo(() => {
    const ticks: { val: number; label: string; isDecade: boolean }[] = [];
    const startDec = Math.round(logMinW);
    const endDec = Math.round(logMaxW);

    for (let dec = startDec; dec <= endDec; dec++) {
      const base = Math.pow(10, dec);
      if (base >= minW * 0.99 && base <= maxW * 1.01) {
        ticks.push({ val: base, label: dec === 0 ? '1' : `10^${dec}`, isDecade: true });
      }
      [2, 5].forEach(mul => {
        const sub = base * mul;
        if (sub >= minW && sub <= maxW) {
          ticks.push({ val: sub, label: '', isDecade: false });
        }
      });
    }
    return ticks;
  }, [logMinW, logMaxW, minW, maxW]);

  // Magnitude Ticks
  const magTicks = useMemo(() => {
    const list: number[] = [];
    for (let m = minMag; m <= maxMag; m += 20) {
      list.push(m);
    }
    return list;
  }, [minMag, maxMag]);

  // Phase Ticks
  const phaseTicks = useMemo(() => {
    const list: number[] = [];
    for (let p = minPhase; p <= maxPhase; p += 45) {
      list.push(p);
    }
    return list;
  }, [minPhase, maxPhase]);

  // Pixel-perfect SVG coordinate calculation using getScreenCTM()
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !containerRef.current) return;
    const svg = svgRef.current;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPoint = pt.matrixTransform(ctm.inverse());

    if (svgPoint.x >= padding.left && svgPoint.x <= width - padding.right &&
        svgPoint.y >= padding.top && svgPoint.y <= height - padding.bottom) {
      setHoverSvgX(svgPoint.x);

      const contRect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - contRect.left,
        y: e.clientY - contRect.top
      });
    } else {
      setHoverSvgX(null);
      setMousePos(null);
    }
  };

  const handleMouseLeave = () => {
    setHoverSvgX(null);
    setMousePos(null);
  };

  const currentW = hoverSvgX !== null ? xToW(hoverSvgX) : null;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-100">
            Diagrama de Bode (Magnitude e Fase)
          </h3>
        </div>

        {/* Stability Margins Overview */}
        <div className="flex items-center gap-2 text-xs">
          {activeSystems.map(sys => {
            if (!sys.analysis?.metrics) return null;
            const { phaseMarginDeg, gainMarginDb } = sys.analysis.metrics;
            return (
              <div key={sys.id} className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-950 rounded-md border border-slate-200 dark:border-slate-800 text-[11px]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sys.color }} />
                <span className="font-medium text-slate-700 dark:text-slate-300">{sys.name}:</span>
                <span className="text-slate-500 dark:text-slate-400">
                  PM: <strong className="text-cyan-700 dark:text-cyan-300 font-mono">{phaseMarginDeg !== null ? `${phaseMarginDeg}°` : '—'}</strong>
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  GM: <strong className="text-cyan-700 dark:text-cyan-300 font-mono">{gainMarginDb !== null ? `${gainMarginDb} dB` : '—'}</strong>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* SVG Canvas */}
      <div ref={containerRef} className="relative flex-1 bg-slate-50/50 dark:bg-slate-950 select-none overflow-hidden min-h-0">
        <svg
          ref={svgRef}
          className="w-full h-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Freq Grid Lines (Vertical) */}
          {freqTicks.map((t, idx) => {
            const x = wToX(t.val);
            return (
              <g key={`freq-grid-${idx}`}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={height - padding.bottom}
                  stroke={t.isDecade ? '#94a3b8' : '#cbd5e1'}
                  className="dark:stroke-slate-800"
                  strokeWidth={t.isDecade ? 1 : 0.6}
                  strokeDasharray={t.isDecade ? undefined : '2 3'}
                />
                {t.isDecade && (
                  <text
                    x={x}
                    y={height - padding.bottom + 16}
                    fill="#64748b"
                    fontSize="10"
                    textAnchor="middle"
                    className="font-mono select-none"
                  >
                    {t.val < 1 ? t.val : t.val >= 1000 ? `10^${Math.log10(t.val)}` : t.val}
                  </text>
                )}
              </g>
            );
          })}

          {/* Magnitude Horizontal Grid Lines */}
          {magTicks.map(m => {
            const y = magToY(m);
            if (y < padding.top || y > padding.top + subPlotHeight) return null;
            const isZero = m === 0;
            return (
              <g key={`mag-grid-${m}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke={isZero ? '#64748b' : '#cbd5e1'}
                  className={isZero ? '' : 'dark:stroke-slate-800'}
                  strokeWidth={isZero ? 1.2 : 0.7}
                  strokeDasharray={isZero ? '4 3' : '2 3'}
                />
                <text x={padding.left - 8} y={y + 3.5} fill={isZero ? '#475569' : '#64748b'} className="dark:fill-slate-400 font-mono text-[9.5px] select-none" textAnchor="end">
                  {m} dB
                </text>
              </g>
            );
          })}

          {/* Phase Horizontal Grid Lines */}
          {phaseTicks.map(p => {
            const y = phaseToY(p);
            const topPhase = padding.top + subPlotHeight + gap;
            if (y < topPhase || y > topPhase + subPlotHeight) return null;
            const isMinus180 = p === -180;
            return (
              <g key={`phase-grid-${p}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke={isMinus180 ? '#f43f5e' : '#cbd5e1'}
                  className={isMinus180 ? '' : 'dark:stroke-slate-800'}
                  strokeWidth={isMinus180 ? 1.2 : 0.7}
                  strokeDasharray={isMinus180 ? '4 3' : '2 3'}
                  opacity={isMinus180 ? 0.8 : 1}
                />
                <text x={padding.left - 8} y={y + 3.5} fill={isMinus180 ? '#e11d48' : '#64748b'} className="dark:fill-slate-400 font-mono text-[9.5px] select-none" textAnchor="end">
                  {p}°
                </text>
              </g>
            );
          })}

          {/* -180 Deg Label */}
          {minPhase <= -180 && maxPhase >= -180 && (
            <text x={width - padding.right} y={phaseToY(-180) - 4} fill="#e11d48" className="dark:fill-rose-400 font-mono text-[9px] select-none" textAnchor="end" opacity="0.9">
              Margem de Fase (-180°)
            </text>
          )}

          {/* Magnitude Plots */}
          {activeSystems.map(sys => {
            if (!sys.analysis?.bode) return null;
            const { w, magDb } = sys.analysis.bode;
            if (w.length === 0) return null;

            let dMag = '';
            for (let i = 0; i < w.length; i++) {
              const x = wToX(w[i]);
              const y = magToY(magDb[i]);
              if (i === 0) dMag += `M ${x} ${y}`;
              else dMag += ` L ${x} ${y}`;
            }

            const currentPoint = currentW !== null ? getBodeAtW(sys.analysis.bode, currentW) : null;

            return (
              <g key={`mag-${sys.id}`}>
                <path d={dMag} fill="none" stroke={sys.color} strokeWidth="3.5" opacity="0.15" />
                <path d={dMag} fill="none" stroke={sys.color} strokeWidth="2.2" strokeLinecap="round" />

                {/* Target dot on magnitude curve */}
                {hoverSvgX !== null && currentPoint !== null && (
                  <circle
                    cx={hoverSvgX}
                    cy={magToY(currentPoint.mag)}
                    r={4}
                    fill={sys.color}
                    stroke="#ffffff"
                    className="dark:stroke-slate-900"
                    strokeWidth="1.5"
                  />
                )}
              </g>
            );
          })}

          {/* Phase Plots */}
          {activeSystems.map(sys => {
            if (!sys.analysis?.bode) return null;
            const { w, phaseDeg } = sys.analysis.bode;
            if (w.length === 0) return null;

            let dPhase = '';
            for (let i = 0; i < w.length; i++) {
              const x = wToX(w[i]);
              const y = phaseToY(phaseDeg[i]);
              if (i === 0) dPhase += `M ${x} ${y}`;
              else dPhase += ` L ${x} ${y}`;
            }

            const currentPoint = currentW !== null ? getBodeAtW(sys.analysis.bode, currentW) : null;

            return (
              <g key={`phase-${sys.id}`}>
                <path d={dPhase} fill="none" stroke={sys.color} strokeWidth="3.5" opacity="0.15" />
                <path d={dPhase} fill="none" stroke={sys.color} strokeWidth="2.2" strokeLinecap="round" />

                {/* Target dot on phase curve */}
                {hoverSvgX !== null && currentPoint !== null && (
                  <circle
                    cx={hoverSvgX}
                    cy={phaseToY(currentPoint.phase)}
                    r={4}
                    fill={sys.color}
                    stroke="#ffffff"
                    className="dark:stroke-slate-900"
                    strokeWidth="1.5"
                  />
                )}
              </g>
            );
          })}

          {/* Hover Crosshair Vertical Line exactly at hoverSvgX, vertically straight */}
          {hoverSvgX !== null && (
            <line
              x1={hoverSvgX}
              y1={padding.top}
              x2={hoverSvgX}
              y2={height - padding.bottom}
              stroke="#0284c7"
              className="dark:stroke-sky-400"
              strokeWidth="1.2"
              strokeDasharray="3 3"
            />
          )}

          {/* Transparent Overlay for mouse event capture */}
          <rect
            x={padding.left}
            y={padding.top}
            width={plotWidth}
            height={height - padding.top - padding.bottom}
            fill="transparent"
            className="cursor-crosshair"
          />

          {/* Subplot Labels */}
          <text x={padding.left + 8} y={padding.top + 14} fill="#475569" className="dark:fill-slate-200 select-none" fontSize="11" fontWeight="600">
            Magnitude (dB)
          </text>
          <text x={padding.left + 8} y={padding.top + subPlotHeight + gap + 14} fill="#475569" className="dark:fill-slate-200 select-none" fontSize="11" fontWeight="600">
            Fase (graus)
          </text>

          {/* Bottom X-Axis Label */}
          <text x={width / 2} y={height - 6} fill="#64748b" fontSize="11" fontWeight="600" textAnchor="middle" className="select-none">
            Frequência Angular ω (rad/s — Escala Logarítmica)
          </text>
        </svg>

        {/* Tooltip Hover Readout positioned dynamically relative to mouse cursor */}
        {currentW !== null && mousePos !== null && (
          <div 
            className="absolute z-50 pointer-events-none p-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl text-xs space-y-1 text-slate-800 dark:text-slate-200 min-w-48 transition-transform"
            style={{
              left: `${Math.min(mousePos.x + 12, (containerRef.current?.clientWidth || 400) - 200)}px`,
              top: `${Math.max(12, Math.min(mousePos.y - 20, (containerRef.current?.clientHeight || 300) - 140))}px`
            }}
          >
            <div className="font-semibold text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5 pb-1 border-b border-slate-200 dark:border-slate-800">
              <Compass className="w-3.5 h-3.5" />
              <span>ω = {currentW < 0.1 ? currentW.toExponential(2) : currentW.toFixed(2)} rad/s</span>
            </div>

            {activeSystems.map(sys => {
              if (!sys.analysis?.bode) return null;
              const point = getBodeAtW(sys.analysis.bode, currentW);

              return (
                <div key={sys.id} className="text-[11px] space-y-0.5 border-b border-slate-200 dark:border-slate-800/50 pb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sys.color }} />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{sys.name}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-slate-400 pl-3.5">
                    <span>Mag:</span>
                    <span className="font-mono text-cyan-700 dark:text-cyan-300 font-semibold">{point.mag.toFixed(2)} dB</span>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-slate-400 pl-3.5">
                    <span>Fase:</span>
                    <span className="font-mono text-cyan-700 dark:text-cyan-300 font-semibold">{point.phase.toFixed(1)}°</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50/80 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex-shrink-0">
        <div className="flex items-center gap-3">
          {activeSystems.map(sys => (
            <div key={sys.id} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sys.color }} />
              <span className="text-slate-800 dark:text-slate-200 font-medium">{sys.name}</span>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-slate-500">
          <span>Passe o mouse para leitura contínua de Magnitude e Fase</span>
        </div>
      </div>
    </div>
  );
};
