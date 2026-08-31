import React, { useState, useRef, useMemo } from 'react';
import { Activity, Clock } from 'lucide-react';
import { TransferFunction } from '../core/types';

interface StepResponsePlotProps {
  systems: TransferFunction[];
}

export const StepResponsePlot: React.FC<StepResponsePlotProps> = ({ systems }) => {
  const [responseType, setResponseType] = useState<'step' | 'impulse'>('step');
  const [hoverSvgX, setHoverSvgX] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const activeSystems = useMemo(
    () => systems.filter(s => s.visible && s.analysis && s.analysis.isProper),
    [systems]
  );

  // Global bounds for time and output y
  const { maxT, minY, maxY } = useMemo(() => {
    let maxTime = 1;
    let minVal = 0;
    let maxVal = responseType === 'step' ? 1.2 : 1.0;

    activeSystems.forEach(sys => {
      if (!sys.analysis) return;
      const sim = responseType === 'step' ? sys.analysis.stepResponse : sys.analysis.impulseResponse;
      if (sim.t.length > 0) {
        const lastT = sim.t[sim.t.length - 1];
        if (lastT > maxTime) maxTime = lastT;
      }
      sim.y.forEach(val => {
        if (isFinite(val)) {
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
        }
      });
    });

    const spanY = Math.max(0.2, maxVal - minVal);
    return {
      maxT: maxTime,
      minY: minVal - 0.08 * spanY,
      maxY: maxVal + 0.12 * spanY
    };
  }, [activeSystems, responseType]);

  // Layout dimensions inside SVG
  const width = 600;
  const height = 400;
  const padding = { top: 30, right: 30, bottom: 45, left: 55 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const tToX = (t: number) => padding.left + (t / maxT) * plotWidth;
  const yToY = (y: number) => padding.top + plotHeight - ((y - minY) / (maxY - minY)) * plotHeight;
  const xToT = (x: number) => Math.max(0, Math.min(maxT, ((x - padding.left) / plotWidth) * maxT));

  // Precise interpolation of response curve at time t
  const getYAtT = (sim: { t: number[]; y: number[] }, t: number, isStable: boolean) => {
    if (sim.t.length === 0) return 0;
    const lastT = sim.t[sim.t.length - 1];
    const lastY = sim.y[sim.y.length - 1];
    if (t >= lastT) {
      return isStable ? lastY : lastY;
    }
    if (t <= sim.t[0]) return sim.y[0];

    // Binary search
    let low = 0;
    let high = sim.t.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (sim.t[mid] <= t) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    const i = Math.max(0, Math.min(sim.t.length - 2, high));
    const t0 = sim.t[i];
    const t1 = sim.t[i + 1];
    const y0 = sim.y[i];
    const y1 = sim.y[i + 1];
    if (t1 === t0) return y0;
    return y0 + ((t - t0) / (t1 - t0)) * (y1 - y0);
  };

  // Grid Ticks
  const xTicks = useMemo(() => {
    const count = 6;
    const ticks: number[] = [];
    for (let i = 0; i <= count; i++) {
      ticks.push(Number(((i * maxT) / count).toFixed(2)));
    }
    return ticks;
  }, [maxT]);

  const yTicks = useMemo(() => {
    const count = 5;
    const ticks: number[] = [];
    for (let i = 0; i <= count; i++) {
      const val = minY + (i * (maxY - minY)) / count;
      ticks.push(Number(val.toFixed(2)));
    }
    return ticks;
  }, [minY, maxY]);

  // Pixel-perfect SVG coordinate calculation using getScreenCTM() for Mouse and Touch
  const updatePointerPosition = (clientX: number, clientY: number) => {
    if (!svgRef.current || !containerRef.current) return;
    const svg = svgRef.current;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;

    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgPoint = pt.matrixTransform(ctm.inverse());

    if (svgPoint.x >= padding.left && svgPoint.x <= width - padding.right &&
        svgPoint.y >= padding.top && svgPoint.y <= height - padding.bottom) {
      setHoverSvgX(svgPoint.x);

      const contRect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: clientX - contRect.left,
        y: clientY - contRect.top
      });
    } else {
      setHoverSvgX(null);
      setMousePos(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    updatePointerPosition(e.clientX, e.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length > 0) {
      updatePointerPosition(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleMouseLeave = () => {
    setHoverSvgX(null);
    setMousePos(null);
  };

  const currentT = hoverSvgX !== null ? xToT(hoverSvgX) : null;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-100">
            {responseType === 'step' ? 'Resposta Temporal ao Degrau y(t)' : 'Resposta ao Impulso h(t)'}
          </h3>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px]">
            <button
              onClick={() => setResponseType('step')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                responseType === 'step'
                  ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Degrau
            </button>
            <button
              onClick={() => setResponseType('impulse')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                responseType === 'impulse'
                  ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Impulso
            </button>
          </div>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div 
        ref={containerRef}
        className="relative flex-1 bg-slate-50/50 dark:bg-slate-950 select-none overflow-hidden min-h-0 touch-none"
      >
        <svg
          ref={svgRef}
          className="w-full h-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchMove}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseLeave}
        >
          {/* Grid Background Lines */}
          {xTicks.map(t => {
            const x = tToX(t);
            return (
              <g key={`xtick-${t}`}>
                <line x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="3 3" className="dark:stroke-slate-800" />
                <text x={x} y={height - padding.bottom + 16} fill="#64748b" fontSize="10" textAnchor="middle" className="font-mono select-none">
                  {t}s
                </text>
              </g>
            );
          })}

          {yTicks.map(y => {
            const yPos = yToY(y);
            return (
              <g key={`ytick-${y}`}>
                <line x1={padding.left} y1={yPos} x2={width - padding.right} y2={yPos} stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="3 3" className="dark:stroke-slate-800" />
                <text x={padding.left - 8} y={yPos + 3} fill="#64748b" fontSize="10" textAnchor="end" className="font-mono select-none">
                  {y}
                </text>
              </g>
            );
          })}

          {/* Zero Axis */}
          {minY <= 0 && maxY >= 0 && (
            <line
              x1={padding.left}
              y1={yToY(0)}
              x2={width - padding.right}
              y2={yToY(0)}
              stroke="#64748b"
              strokeWidth="1.2"
            />
          )}

          {/* Reference Step Input Line (y = 1.0) */}
          {responseType === 'step' && minY <= 1.0 && maxY >= 1.0 && (
            <g>
              <line
                x1={padding.left}
                y1={yToY(1.0)}
                x2={width - padding.right}
                y2={yToY(1.0)}
                stroke="#64748b"
                strokeWidth="1.2"
                strokeDasharray="5 5"
              />
              <text x={width - padding.right} y={yToY(1.0) - 6} fill="#64748b" fontSize="10" textAnchor="end" className="font-mono select-none">
                Entrada u(t) = 1.0
              </text>
            </g>
          )}

          {/* Plots for Each System */}
          {activeSystems.map(sys => {
            if (!sys.analysis) return null;
            const sim = responseType === 'step' ? sys.analysis.stepResponse : sys.analysis.impulseResponse;
            if (sim.t.length === 0) return null;

            // Build SVG path
            let d = '';
            for (let i = 0; i < sim.t.length; i++) {
              const x = tToX(sim.t[i]);
              const y = yToY(sim.y[i]);
              if (i === 0) d += `M ${x} ${y}`;
              else d += ` L ${x} ${y}`;
            }

            // Line continuation to maxT for stable systems
            const lastT = sim.t[sim.t.length - 1];
            const lastY = sim.y[sim.y.length - 1];
            if (lastT < maxT && sys.analysis.stability !== 'UNSTABLE') {
              const endX = tToX(maxT);
              const endY = yToY(lastY);
              d += ` L ${endX} ${endY}`;
            }

            return (
              <g key={sys.id}>
                {/* Glow Filter */}
                <path d={d} fill="none" stroke={sys.color} strokeWidth="4" opacity="0.15" strokeLinecap="round" />
                {/* Main Path */}
                <path d={d} fill="none" stroke={sys.color} strokeWidth="2.5" strokeLinecap="round" />

                {/* Crosshair target dot directly on the curve */}
                {currentT !== null && hoverSvgX !== null && (
                  <circle
                    cx={hoverSvgX}
                    cy={yToY(getYAtT(sim, currentT, sys.analysis.stability !== 'UNSTABLE'))}
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

          {/* Hover Crosshair Vertical Line exactly at hoverSvgX */}
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

          {/* Transparent Overlay to capture mouse events accurately across the full plot */}
          <rect
            x={padding.left}
            y={padding.top}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
            className="cursor-crosshair"
          />

          {/* Axis Labels */}
          <text x={width / 2} y={height - 8} fill="#64748b" fontSize="11" fontWeight="600" textAnchor="middle" className="select-none">
            Tempo (segundos)
          </text>
          <text
            x={-height / 2}
            y={16}
            fill="#64748b"
            fontSize="11"
            fontWeight="600"
            textAnchor="middle"
            transform="rotate(-90)"
            className="select-none"
          >
            Amplitude y(t)
          </text>
        </svg>

        {/* Hover Crosshair Tooltip positioned dynamically relative to mouse cursor */}
        {currentT !== null && mousePos !== null && (
          <div 
            className="absolute z-50 pointer-events-none p-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl text-xs space-y-1 text-slate-800 dark:text-slate-200 min-w-44 transition-transform"
            style={{
              left: `${Math.max(8, Math.min(mousePos.x + 12, (containerRef.current?.clientWidth || 360) - 190))}px`,
              top: `${Math.max(8, Math.min(mousePos.y - 20, (containerRef.current?.clientHeight || 280) - 120))}px`
            }}
          >
            <div className="font-semibold text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5 pb-1 border-b border-slate-200 dark:border-slate-800">
              <Clock className="w-3.5 h-3.5" />
              <span>t = {currentT.toFixed(3)} s</span>
            </div>
            {activeSystems.map(sys => {
              if (!sys.analysis) return null;
              const sim = responseType === 'step' ? sys.analysis.stepResponse : sys.analysis.impulseResponse;
              const yVal = getYAtT(sim, currentT, sys.analysis.stability !== 'UNSTABLE');

              return (
                <div key={sys.id} className="flex items-center justify-between gap-3 text-[11px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sys.color }} />
                    <span className="font-medium truncate text-slate-700 dark:text-slate-300">{sys.name}:</span>
                  </div>
                  <span className="font-mono text-cyan-700 dark:text-cyan-300 font-semibold">{yVal.toFixed(3)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Legend */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-slate-50/80 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 gap-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          {activeSystems.map(sys => (
            <div key={sys.id} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sys.color }} />
              <span className="text-slate-800 dark:text-slate-200 font-medium">{sys.name}</span>
            </div>
          ))}
        </div>

        <div className="text-[11px] text-slate-500">
          <span>Passe o mouse sobre o gráfico para leitura contínua</span>
        </div>
      </div>
    </div>
  );
};
