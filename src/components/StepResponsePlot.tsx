import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { TransferFunction } from '../core/types';
import { Simulation } from '../core/simulation';
import { axisTicks, plotBounds, responseAt, responseDetails } from '../core/timePlot';

const MAX_TIME_SCALE = 32;

const format = (value: number | null, digits = 3) => {
  if (value === null || !Number.isFinite(value)) return '—';
  if (value !== 0 && (Math.abs(value) >= 1e4 || Math.abs(value) < 1e-3)) return value.toExponential(2);
  return Number(value.toFixed(digits)).toString();
};

export const StepResponsePlot: React.FC<{ systems: TransferFunction[] }> = ({ systems }) => {
  const [responseType, setResponseType] = useState<'step' | 'impulse'>('step');
  const [guides, setGuides] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [window, setWindow] = useState<[number, number]>([0, 1]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 300 });
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const clipId = useId();

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setDimensions({ width: Math.max(280, entry.contentRect.width), height: Math.max(140, entry.contentRect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const active = useMemo(() => systems.filter(system => system.visible && !system.error && system.analysis?.isProper), [systems]);
  const selected = active.find(system => system.id === selectedId) ?? active[0];
  const maxTime = Math.max(1e-6, ...active.map(system => system.analysis!.stepResponse.t.at(-1) ?? 1));
  const start = window[0] * maxTime;
  const end = window[1] * maxTime;
  const responses = useMemo(() => active.map(system => {
    const analysis = system.analysis!;
    const result = end > (analysis.stepResponse.t.at(-1) ?? 0)
      ? Simulation.simulateTimeDomain(system.numerator, system.denominator, analysis.poles, end)
      : analysis;
    return { system, result };
  }), [active, end]);
  const curves = useMemo(() => responses.map(({ system, result }) => ({ system, simulation: responseType === 'step' ? result.stepResponse : result.impulseResponse })), [responses, responseType]);
  const isStable = selected?.analysis?.stability === 'STABLE';
  const finalValue = isStable && selected && selected.denominator[selected.denominator.length - 1] !== 0
    ? selected.numerator[selected.numerator.length - 1] / selected.denominator[selected.denominator.length - 1] : null;
  const selectedStep = responses.find(({ system }) => system.id === selected?.id)?.result.stepResponse;
  const details = useMemo(() => finalValue !== null && selectedStep ? responseDetails(selectedStep, finalValue) : null, [selectedStep, finalValue]);
  const showGuides = guides && responseType === 'step' && finalValue !== null && Number.isFinite(finalValue);
  const band = Math.abs(finalValue ?? 0) * 0.02;
  const references = responseType === 'step' ? [1, ...(showGuides ? [finalValue! - band, finalValue! + band] : [])] : [];
  const [minY, maxY] = plotBounds(curves.map(curve => curve.simulation), start, end, references);
  const { width, height } = dimensions;
  const padding = { left: width < 420 ? 54 : 64, right: 18, top: 24, bottom: 44 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const x = (time: number) => padding.left + (time - start) / (end - start) * plotWidth;
  const y = (value: number) => padding.top + (maxY - value) / (maxY - minY) * plotHeight;
  const xTicks = axisTicks(start, end, Math.max(2, Math.floor(plotWidth / 90)));
  const yTicks = axisTicks(minY, maxY, Math.max(4, Math.floor(plotHeight / 50)));
  const time = cursor === null ? null : start + cursor * (end - start);

  const zoom = (factor: number) => {
    const span = Math.min(MAX_TIME_SCALE, Math.max(1 / 64, (window[1] - window[0]) * factor));
    const center = time !== null ? time / maxTime : (window[0] + window[1]) / 2;
    const left = Math.max(0, Math.min(MAX_TIME_SCALE - span, center - span / 2));
    setWindow([left, left + span]);
    setCursor(null);
  };
  const pan = (direction: number) => {
    const span = window[1] - window[0];
    const left = Math.max(0, Math.min(MAX_TIME_SCALE - span, window[0] + direction * span * 0.5));
    setWindow([left, left + span]);
    setCursor(null);
  };
  const reset = () => { setWindow([0, 1]); setCursor(null); };
  const trackPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    if (point.x < padding.left || point.x > width - padding.right || point.y < padding.top || point.y > height - padding.bottom) { setCursor(null); return; }
    setCursor((point.x - padding.left) / plotWidth);
  };

  const paths = useMemo(() => curves.map(({ system, simulation }) => {
    // Keep real samples and break at invalid values, without extrapolating
    // a short simulation when another system has a longer time horizon.
    let path = '';
    let connected = false;
    simulation.t.forEach((time, i) => {
      const value = simulation.y[i];
      if (!Number.isFinite(time) || !Number.isFinite(value)) { connected = false; return; }
      const px = padding.left + (time - start) / (end - start) * plotWidth;
      const py = padding.top + (maxY - value) / (maxY - minY) * plotHeight;
      path += `${connected ? 'L' : 'M'}${px.toFixed(2)},${py.toFixed(2)} `;
      connected = true;
    });
    return { system, path };
  }), [curves, start, end, minY, maxY, padding.left, padding.top, plotWidth, plotHeight]);

  const controlClass = 'p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed';
  return (
    <section aria-label="Resposta temporal" className="flex flex-col h-full bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h3 className="font-semibold text-sm">{responseType === 'step' ? 'Resposta ao degrau' : 'Resposta ao impulso'}</h3>
        </div>
        <div className="flex gap-0.5 bg-slate-100 dark:bg-slate-950 rounded-lg p-0.5 text-xs">
          {(['step', 'impulse'] as const).map(type => <button key={type} type="button" aria-pressed={responseType === type} onClick={() => { setResponseType(type); reset(); }} className={`px-3 py-1 rounded-md font-medium ${responseType === type ? 'bg-cyan-600 text-white' : 'text-slate-500 dark:text-slate-400'}`}>{type === 'step' ? 'Degrau' : 'Impulso'}</button>)}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-1 text-xs">
          <button type="button" title="Aumentar zoom" aria-label="Aumentar zoom" className={controlClass} onClick={() => zoom(0.5)} disabled={window[1] - window[0] <= 1 / 64}><ZoomIn className="w-4 h-4" /></button>
          <button type="button" title="Reduzir zoom" aria-label="Reduzir zoom" className={controlClass} onClick={() => zoom(2)} disabled={window[1] - window[0] >= MAX_TIME_SCALE}><ZoomOut className="w-4 h-4" /></button>
          <button type="button" title="Ver trecho anterior" aria-label="Ver trecho anterior" className={controlClass} onClick={() => pan(-1)} disabled={window[0] <= 0}><ChevronLeft className="w-4 h-4" /></button>
          <button type="button" title="Ver trecho seguinte" aria-label="Ver trecho seguinte" className={controlClass} onClick={() => pan(1)} disabled={window[1] >= MAX_TIME_SCALE}><ChevronRight className="w-4 h-4" /></button>
          <button type="button" title="Restaurar escala" aria-label="Restaurar escala" className={controlClass} onClick={reset}><RotateCcw className="w-3.5 h-3.5" /></button>
          <span className="ml-1 font-mono text-[10px] text-slate-500 dark:text-slate-400">{format(start)}–{format(end)} s</span>
        </div>
        {responseType === 'step' && <button type="button" aria-pressed={guides} onClick={() => setGuides(!guides)} className={`rounded-md px-2 py-1 text-[11px] font-medium ${guides ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300' : 'text-slate-500 dark:text-slate-400'}`}>Indicadores ±2%</button>}
      </div>

      <div ref={containerRef} className="relative flex-1 min-h-0 bg-slate-50/40 dark:bg-slate-950/70">
        {active.length === 0 ? <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-500">Adicione ou exiba uma função válida e própria para ver a resposta.</div> : <svg ref={svgRef} className="w-full h-full touch-pan-y" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${responseType === 'step' ? 'Resposta ao degrau' : 'Resposta ao impulso'} de ${active.map(system => system.name).join(', ')}, entre ${format(start)} e ${format(end)} segundos`}
          tabIndex={0} onPointerMove={trackPointer} onPointerDown={trackPointer} onPointerLeave={() => setCursor(null)} onBlur={() => setCursor(null)}
          onKeyDown={event => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setCursor(Math.max(0, Math.min(1, (cursor ?? 0.5) + (event.key === 'ArrowRight' ? 0.02 : -0.02)))); }
            if (event.key === 'Escape') setCursor(null);
          }}>
          <title>Resposta temporal dos sistemas visíveis</title>
          <defs><clipPath id={clipId}><rect x={padding.left} y={padding.top} width={plotWidth} height={plotHeight} /></clipPath></defs>
          {xTicks.map(value => <g key={`x${value}`}>
            <line x1={x(value)} x2={x(value)} y1={padding.top} y2={height - padding.bottom} className="stroke-slate-200 dark:stroke-slate-800" strokeDasharray="2 5" />
            <text x={x(value)} y={height - padding.bottom + 17} textAnchor="middle" className="fill-slate-500 dark:fill-slate-400 font-mono" fontSize={11}>{format(value)}</text>
          </g>)}
          {yTicks.map(value => <g key={`y${value}`}>
            <line x1={padding.left} x2={width - padding.right} y1={y(value)} y2={y(value)} className={value === 0 ? 'stroke-slate-400 dark:stroke-slate-600' : 'stroke-slate-200 dark:stroke-slate-800'} strokeDasharray={value === 0 ? undefined : '2 5'} />
            <text x={padding.left - 10} y={y(value) + 4} textAnchor="end" className="fill-slate-500 dark:fill-slate-400 font-mono" fontSize={11}>{format(value)}</text>
          </g>)}
          <g clipPath={`url(#${clipId})`}>
            {responseType === 'step' && <line x1={padding.left} x2={width - padding.right} y1={y(1)} y2={y(1)} className="stroke-slate-400 dark:stroke-slate-500" strokeDasharray="6 5" opacity={0.7} />}
            {showGuides && <g>
              {band > 0 && <rect x={padding.left} y={y(finalValue! + band)} width={plotWidth} height={Math.max(1, y(finalValue! - band) - y(finalValue! + band))} fill={selected.color} opacity={0.1} />}
              <line x1={padding.left} x2={width - padding.right} y1={y(finalValue!)} y2={y(finalValue!)} stroke={selected.color} opacity={0.5} strokeDasharray="4 4" />
              {details?.settlingTime !== null && details?.settlingTime !== undefined && <line x1={x(details.settlingTime)} x2={x(details.settlingTime)} y1={padding.top} y2={height - padding.bottom} stroke={selected.color} opacity={0.4} strokeDasharray="3 4" />}
            </g>}
            {paths.map(({ system, path }) => <g key={system.id}>
              <path d={path} fill="none" stroke={system.color} strokeWidth={7} opacity={0.08} strokeLinejoin="round" />
              <path d={path} fill="none" stroke={system.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </g>)}
            {showGuides && details?.peakTime !== null && details?.peakTime !== undefined && <circle cx={x(details.peakTime)} cy={y(details.peakValue)} r={4.5} fill={selected.color} className="stroke-white dark:stroke-slate-950" strokeWidth={2} />}
            {time !== null && <g>
              <line x1={x(time)} x2={x(time)} y1={padding.top} y2={height - padding.bottom} className="stroke-cyan-600 dark:stroke-cyan-400" strokeDasharray="3 4" />
              {curves.map(({ system, simulation }) => {
                const value = responseAt(simulation, time);
                return value === null ? null : <circle key={system.id} cx={x(time)} cy={y(value)} r={4} fill={system.color} className="stroke-white dark:stroke-slate-950" strokeWidth={2} />;
              })}
            </g>}
          </g>
          {showGuides && <text x={width - padding.right - 5} y={Math.max(padding.top + 12, y(finalValue! + band) - 8)} textAnchor="end" fill={selected.color} fontSize={10}>y∞ = {format(finalValue)} · ±2%</text>}
          {showGuides && details?.settlingTime !== null && details?.settlingTime !== undefined && details.settlingTime >= start && details.settlingTime <= end && <text x={Math.min(width - padding.right - 38, x(details.settlingTime) + 5)} y={padding.top + 12} fill={selected.color} fontSize={10}>ts = {format(details.settlingTime)} s</text>}
          <text x={padding.left + plotWidth / 2} y={height - 10} textAnchor="middle" className="fill-slate-500 dark:fill-slate-400" fontSize={11}>Tempo (s)</text>
          <text x={padding.left} y={14} className="fill-slate-500 dark:fill-slate-400" fontSize={10}>Amplitude {responseType === 'step' ? 'y(t)' : 'h(t)'}</text>
          <rect x={padding.left} y={padding.top} width={plotWidth} height={plotHeight} fill="transparent" className="cursor-crosshair" />
        </svg>}
        {time !== null && <div role="status" className="absolute top-2 right-3 pointer-events-none rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-3 py-2 shadow-lg text-[11px] max-w-[70%]">
          <div className="font-mono font-semibold text-cyan-700 dark:text-cyan-300 mb-1">t = {format(time)} s</div>
          {curves.map(({ system, simulation }) => <div key={system.id} className="flex items-center justify-between gap-4"><span style={{ color: system.color }}>{system.name}</span><span className="font-mono">{format(responseAt(simulation, time))}</span></div>)}
        </div>}
      </div>

      {guides && responseType === 'step' && selected && <div className="grid grid-cols-4 gap-2 px-4 py-2 border-t border-slate-200 dark:border-slate-800 text-[10px] bg-slate-50/70 dark:bg-slate-950/40">
        {[['Valor final', format(finalValue)], ['Sobressinal', details?.overshoot === null || !details ? '—' : `${format(details.overshoot, 1)}%`], ['Tempo de pico', details?.peakTime === null || !details ? '—' : `${format(details.peakTime)} s`], ['Acomodação (2%)', details?.settlingTime === null || !details ? '—' : `${format(details.settlingTime)} s`]].map(([label, value]) => <div key={label}><div className="text-slate-500 dark:text-slate-400 truncate">{label}</div><div className="mt-0.5 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{value}</div></div>)}
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800 px-4 py-2 text-[11px] flex-shrink-0">
        <div className="flex flex-wrap gap-x-3 gap-y-1">{active.map(system => <button key={system.id} type="button" aria-pressed={system.id === selected?.id} onClick={() => setSelectedId(system.id)} className={`flex items-center gap-1.5 ${system.id === selected?.id ? 'font-semibold text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`} title={`Mostrar indicadores de ${system.name}`}><span className="w-2 h-2 rounded-full" style={{ backgroundColor: system.color }} />{system.name}</button>)}</div>
        <span className="text-slate-500 dark:text-slate-400">{selected && !isStable ? 'Sem convergência para um valor final.' : 'Toque ou passe o mouse para ler a curva.'}</span>
      </div>
    </section>
  );
};
