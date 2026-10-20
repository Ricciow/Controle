import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Target, Info } from 'lucide-react';
import { TransferFunction, Complex } from '../core/types';
import { ComplexMath } from '../core/complex';
import { RootLocusData } from '../core/rootLocus';
import { axisTicks } from '../core/timePlot';
import { usePlotDrag } from './usePlotDrag';
import { PlotControls } from './PlotControls';

interface PoleZeroPlotProps {
  systems: TransferFunction[];
  locus?: { id: string; name: string; color: string; data: RootLocusData; gain: number }[];
  controls?: React.ReactNode;
  onLocusViewChange?: (radius: number) => void;
}

interface HoveredRoot {
  systemName: string;
  color: string;
  type: 'pole' | 'zero';
  root: Complex;
  screenX: number;
  screenY: number;
}

export const PoleZeroPlot: React.FC<PoleZeroPlotProps> = ({ systems, locus, controls, onLocusViewChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredRoot, setHoveredRoot] = useState<HoveredRoot | null>(null);
  
  // Damping lines and Wn circles disabled by default
  const [showDampingLines, setShowDampingLines] = useState(false);
  const [showWnCircles, setShowWnCircles] = useState(false);

  // Active systems
  const activeSystems = useMemo(() => systems.filter(s => s.visible && s.analysis), [systems]);

  // Compute bounding box of all roots
  const bounds = useMemo(() => {
    let maxAbs = 5;
    activeSystems.forEach(sys => {
      if (!sys.analysis) return;
      [...sys.analysis.poles, ...sys.analysis.zeros].forEach(r => {
        const absRe = Math.abs(r.re);
        const absIm = Math.abs(r.im);
        if (absRe > maxAbs) maxAbs = absRe;
        if (absIm > maxAbs) maxAbs = absIm;
      });
    });
    locus?.forEach(({ data }) => {
      data.selectedPoles.forEach(root => {
        maxAbs = Math.max(maxAbs, Math.abs(root.re), Math.abs(root.im));
      });
    });
    return Math.max(4, Math.ceil(maxAbs * 1.3));
  }, [activeSystems, locus]);

  const viewRange = bounds / zoom;

  const width = 600;
  const height = 500;
  const cx = width / 2 + pan.x;
  const cy = height / 2 + pan.y;
  const scale = (Math.min(width, height) * 0.42) / viewRange;
  useEffect(() => {
    const radius = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy)) / scale;
    if (Number.isFinite(radius) && radius > 0) onLocusViewChange?.(radius);
  }, [cx, cy, scale, onLocusViewChange]);

  const sToSvg = (s: Complex) => {
    return {
      x: cx + s.re * scale,
      y: cy - s.im * scale
    };
  };

  // Generate tick marks
  const ticks = useMemo(() => ({ list: axisTicks(0, viewRange, 6).filter(value => value > 0) }), [viewRange]);

  // Damping lines
  const zetaLines = [
    { zeta: 0.2, angle: Math.acos(0.2) },
    { zeta: 0.4, angle: Math.acos(0.4) },
    { zeta: 0.6, angle: Math.acos(0.6) },
    { zeta: 0.707, angle: Math.acos(0.707) },
    { zeta: 0.8, angle: Math.acos(0.8) },
    { zeta: 0.9, angle: Math.acos(0.9) },
  ];

  const changeZoom = (factor: number) => {
    const next = zoom / factor;
    if (!Number.isFinite(next) || next <= 0 || !Number.isFinite(bounds / next) || bounds / next === 0) return;
    setZoom(next);
    setPan(current => ({ x: current.x / factor, y: current.y / factor }));
  };
  const move = (dx: number, dy: number) => {
    setPan(current => ({ x: current.x + dx, y: current.y + dy }));
    setHoveredRoot(null);
  };
  const drag = usePlotDrag(svgRef, move, changeZoom);

  const resetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  const handleRootEnter = (
    clientX: number,
    clientY: number,
    sysName: string,
    sysColor: string,
    type: 'pole' | 'zero',
    root: Complex
  ) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setHoveredRoot({
      systemName: sysName,
      color: sysColor,
      type,
      root,
      screenX: clientX - rect.left,
      screenY: clientY - rect.top
    });
  };

  return (
    <div className={`flex flex-col min-w-0 ${locus ? '' : 'h-full'} bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors`}>
      {/* Top Header */}
      <div className="flex flex-wrap gap-2 items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-100">
            {locus ? 'Root Locus — Lugar das Raízes' : 'Plano Complexo (s) — Polos e Zeros'}
          </h3>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setShowDampingLines(!showDampingLines)}
            className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
              showDampingLines 
                ? 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-300 dark:border-cyan-700/60 text-cyan-700 dark:text-cyan-300 font-semibold' 
                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Linhas de Razão de Amortecimento (ζ)"
          >
            Linhas ζ
          </button>

          <button
            onClick={() => setShowWnCircles(!showWnCircles)}
            className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
              showWnCircles 
                ? 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-300 dark:border-cyan-700/60 text-cyan-700 dark:text-cyan-300 font-semibold' 
                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Círculos de Frequência Natural (ωn)"
          >
            Círculos ωn
          </button>

          <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-800 mx-0.5" />

          <PlotControls onZoom={changeZoom} onPan={(dx, dy) => move(dx * width, dy * height)} onReset={resetView} />
        </div>
      </div>

      {controls}

      {/* SVG Canvas Area */}
      <div 
        ref={containerRef}
        className={`relative ${locus ? 'h-[360px] sm:h-[420px] shrink-0' : 'flex-1 min-h-0'} bg-slate-50/50 dark:bg-slate-950 cursor-grab active:cursor-grabbing select-none overflow-hidden`}
      >
        <svg 
          ref={svgRef}
          {...drag}
          role="img" aria-label={locus ? 'Lugar das raízes' : 'Polos e zeros'}
          className="w-full h-full touch-none"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines & Ticks */}
          {axisTicks(-cx / scale, (width - cx) / scale, 7).map(value => <g key={`x${value}`}>
            <line x1={cx + value * scale} x2={cx + value * scale} y1="0" y2={height} className="stroke-slate-200 dark:stroke-slate-800" strokeDasharray="3 3" />
            <text x={cx + value * scale} y={Math.max(14, Math.min(height - 5, cy + 14))} fill="#64748b" fontSize="10" textAnchor="middle">{Number(value.toPrecision(5))}</text>
          </g>)}
          {axisTicks((cy - height) / scale, cy / scale, 6).map(value => <g key={`y${value}`}>
            <line x1="0" x2={width} y1={cy - value * scale} y2={cy - value * scale} className="stroke-slate-200 dark:stroke-slate-800" strokeDasharray="3 3" />
            <text x={Math.max(6, Math.min(width - 55, cx + 6))} y={cy - value * scale - 3} fill="#64748b" fontSize="10">{Number(value.toPrecision(5))}j</text>
          </g>)}
          {/* Concentric wn circles */}
          {showWnCircles && ticks.list.map(v => {
            const r = v * scale;
            if (r > Math.max(width, height)) return null;
            return (
              <circle
                key={`wn-${v}`}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="0.7"
                strokeDasharray="4 4"
                opacity="0.4"
              />
            );
          })}

          {/* Damping zeta radial lines */}
          {showDampingLines && zetaLines.map(({ zeta, angle }) => {
            const len = viewRange * 1.6 * scale;
            const x1 = cx - len * Math.cos(angle);
            const y1 = cy - len * Math.sin(angle);
            const y2 = cy + len * Math.sin(angle);

            return (
              <g key={`zeta-${zeta}`} stroke="#a855f7" strokeWidth="0.7" strokeDasharray="3 3" opacity="0.45">
                <line x1={cx} y1={cy} x2={x1} y2={y1} />
                <line x1={cx} y1={cy} x2={x1} y2={y2} />
                <text x={x1 + 4} y={y1 - 2} fill="#9333ea" className="dark:fill-purple-300 font-mono" fontSize="10" textAnchor="start">
                  ζ={zeta}
                </text>
              </g>
            );
          })}

          {/* Real and Imaginary Main Axes */}
          <line x1={0} y1={cy} x2={width} y2={cy} stroke="#64748b" strokeWidth="1.3" />
          <line x1={cx} y1={0} x2={cx} y2={height} stroke="#64748b" strokeWidth="1.3" />

          {/* Axis Labels */}
          <text x={width - 24} y={cy - 8} fill="#475569" className="dark:fill-slate-300 font-semibold" fontSize="11" textAnchor="end">
            Real (σ)
          </text>
          <text x={cx + 10} y={16} fill="#475569" className="dark:fill-slate-300 font-semibold" fontSize="11" textAnchor="start">
            Imag (jω)
          </text>
          <text x={cx - 6} y={cy + 14} fill="#64748b" fontSize="10" textAnchor="end" className="font-mono">
            0
          </text>

          {locus?.map(({ id, name, color, data, gain }) => (
            <g key={`locus-${id}`}>
              {data.branches.map((branch, index) => (
                <polyline key={index} fill="none" stroke={color} strokeWidth="1.8" opacity="0.75"
                  points={branch.map(root => { const point = sToSvg(root); return `${point.x},${point.y}`; }).join(' ')}>
                  <title>{name}: trajetória dos polos</title>
                </polyline>
              ))}
              {data.selectedPoles.map((root, index) => {
                const point = sToSvg(root);
                return <circle key={`selected-${index}`} cx={point.x} cy={point.y} r="5" fill={color} stroke="white" strokeWidth="1.5">
                  <title>{name}: K = {gain}, s = {ComplexMath.format(root, 4)}</title>
                </circle>;
              })}
            </g>
          ))}

          {/* Draw Poles and Zeros for Each System */}
          {activeSystems.map(sys => {
            if (!sys.analysis) return null;
            const { poles, zeros } = sys.analysis;

            return (
              <g key={sys.id}>
                {/* Zeros (Circles: o) */}
                {zeros.map((z, idx) => {
                  const pt = sToSvg(z);
                  return (
                    <g
                      key={`zero-${sys.id}-${idx}`}
                      className="cursor-pointer"
                      onMouseEnter={(e) => handleRootEnter(e.clientX, e.clientY, sys.name, sys.color, 'zero', z)}
                      onMouseLeave={() => setHoveredRoot(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRootEnter(e.clientX, e.clientY, sys.name, sys.color, 'zero', z);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        if (e.touches.length > 0) {
                          handleRootEnter(e.touches[0].clientX, e.touches[0].clientY, sys.name, sys.color, 'zero', z);
                        }
                      }}
                    >
                      {/* Invisible larger hit target */}
                      <circle cx={pt.x} cy={pt.y} r={18} fill="transparent" />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={6.5}
                        fill="#ffffff"
                        className="dark:fill-slate-900"
                        stroke={sys.color}
                        strokeWidth="2.5"
                      />
                    </g>
                  );
                })}

                {/* Poles (Crosses: x) */}
                {poles.map((p, idx) => {
                  const pt = sToSvg(p);
                  const s = 6;
                  return (
                    <g
                      key={`pole-${sys.id}-${idx}`}
                      className="cursor-pointer"
                      onMouseEnter={(e) => handleRootEnter(e.clientX, e.clientY, sys.name, sys.color, 'pole', p)}
                      onMouseLeave={() => setHoveredRoot(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRootEnter(e.clientX, e.clientY, sys.name, sys.color, 'pole', p);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        if (e.touches.length > 0) {
                          handleRootEnter(e.touches[0].clientX, e.touches[0].clientY, sys.name, sys.color, 'pole', p);
                        }
                      }}
                    >
                      {/* Invisible larger hit target */}
                      <circle cx={pt.x} cy={pt.y} r={18} fill="transparent" />
                      {/* Glow background */}
                      <circle cx={pt.x} cy={pt.y} r={9} fill={sys.color} opacity="0.2" />
                      <line
                        x1={pt.x - s}
                        y1={pt.y - s}
                        x2={pt.x + s}
                        y2={pt.y + s}
                        stroke={sys.color}
                        strokeWidth="2.8"
                        strokeLinecap="round"
                      />
                      <line
                        x1={pt.x - s}
                        y1={pt.y + s}
                        x2={pt.x + s}
                        y2={pt.y - s}
                        stroke={sys.color}
                        strokeWidth="2.8"
                        strokeLinecap="round"
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Card */}
        {hoveredRoot && (
          <div
            className="absolute z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full -mt-3 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl text-xs space-y-1.5 w-56 text-slate-800 dark:text-slate-100"
            style={{
              left: `${Math.max(120, Math.min(hoveredRoot.screenX, (containerRef.current?.clientWidth || 360) - 120))}px`,
              top: `${Math.max(130, Math.min(hoveredRoot.screenY, (containerRef.current?.clientHeight || 280) - 10))}px`
            }}
          >
            <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: hoveredRoot.color }}
                />
                <span className="font-bold">{hoveredRoot.systemName}</span>
              </div>
              <span className="font-semibold text-cyan-600 dark:text-cyan-400 capitalize">
                {hoveredRoot.type === 'pole' ? 'Polo (×)' : 'Zero (○)'}
              </span>
            </div>

            <div className="font-mono text-cyan-700 dark:text-cyan-300 font-semibold">
              s = {ComplexMath.format(hoveredRoot.root, 4)}
            </div>

            {/* Calculations for this root */}
            {(() => {
              const r = hoveredRoot.root;
              const wn = Math.hypot(r.re, r.im);
              const zeta = wn > 1e-6 ? -r.re / wn : 0;
              const tau = Math.abs(r.re) > 1e-6 ? 1 / Math.abs(r.re) : null;

              return (
                <div className="text-[11px] space-y-0.5 text-slate-600 dark:text-slate-300 pt-0.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Freq. Natural (ωn):</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{wn.toFixed(3)} rad/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Amortecimento (ζ):</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{zeta.toFixed(3)}</span>
                  </div>
                  {tau && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Constante Tempo (τ):</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">{tau.toFixed(3)} s</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Footer Legend */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-slate-50/80 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 gap-2 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-800 dark:text-slate-200 font-bold">×</span>
            <span>{locus ? 'Polos em K = 0' : 'Polos'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-800 dark:text-slate-200 font-bold">○</span>
            <span>{locus ? 'Zeros (K = 1)' : 'Zeros'}</span>
          </div>
        </div>

        {locus && <span>● Polos no K selecionado • K → ∞</span>}
        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>Arraste para mover · Ctrl + rolagem para zoom</span>
        </div>
      </div>
    </div>
  );
};
