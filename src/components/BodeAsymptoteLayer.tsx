import { uniqueFrequencies } from '../core/bodeAsymptotes';

export const termColors = ['#d97706', '#7c3aed', '#059669', '#e11d48', '#0284c7', '#c026d3', '#4f46e5', '#64748b'];
export const termColor = (index: number) => termColors[index % termColors.length];
const format = (value: number) => Number(value.toPrecision(3)).toString();

export function BodeAsymptoteLayer({ name, color, terms, breaks, samples = [], range, toX, toY, plot, clipId, unit }: {
  name: string;
  color: string;
  terms: { label: string; value: (w: number) => number }[];
  breaks: number[];
  samples?: number[];
  range: [number, number];
  toX: (w: number) => number;
  toY: (value: number) => number;
  plot: { left: number; right: number; top: number; bottom: number };
  clipId: string;
  unit: 'dB' | '°';
}) {
  if (!terms.length) return null;
  const frequencies = uniqueFrequencies([range[0], range[1], ...breaks, ...samples])
    .filter(w => w >= range[0] && w <= range[1]);
  const total = (w: number) => terms.reduce((sum, term) => sum + term.value(w), 0);
  const path = (evaluate: (w: number) => number) => {
    let started = false;
    return frequencies.map(w => {
      const x = toX(w), y = toY(evaluate(w));
      if (!Number.isFinite(x) || !Number.isFinite(y)) { started = false; return ''; }
      const command = started ? 'L' : 'M';
      started = true;
      return `${command} ${x} ${y}`;
    }).join(' ');
  };
  return <g clipPath={`url(#${clipId})`} data-asymptote-layer={unit}>
    {terms.map((term, index) => <path key={index} d={path(term.value)} fill="none"
      stroke={termColor(index)} strokeWidth="1.4" strokeDasharray="3 3" opacity="0.8">
      <title>{`${name}: ${term.label}`}</title>
    </path>)}
    <path d={path(total)} fill="none" stroke={color} strokeWidth="2" strokeDasharray="9 4">
      <title>{`${name}: soma assintótica (${unit})`}</title>
    </path>
    {uniqueFrequencies(breaks).filter(w => w >= range[0] && w <= range[1]).map((w, index) => {
      const x = toX(w), value = total(w), y = toY(value);
      if (!Number.isFinite(y) || y < plot.top || y > plot.bottom) return null;
      const alignRight = x > plot.right - 115;
      const labelX = Math.max(plot.left + 4, Math.min(plot.right - 4, x + (alignRight ? -6 : 6)));
      const labelY = Math.max(plot.top + 12, Math.min(plot.bottom - 18, y - 12 - (index % 2) * 18));
      return <g key={w} data-break-frequency={w}>
        <title>{`${name}: ω = ${format(w)} rad/s; soma = ${format(value)} ${unit}`}</title>
        <line x1={x} x2={x} y1={plot.top} y2={plot.bottom} stroke={color} strokeDasharray="2 4" opacity="0.35" />
        <circle cx={x} cy={y} r="3.5" fill="white" stroke={color} strokeWidth="1.8" />
        <text x={labelX} y={labelY} textAnchor={alignRight ? 'end' : 'start'} fill={color}
          fontSize="9" fontWeight="600" paintOrder="stroke" strokeWidth="3"
          className="stroke-slate-50 dark:stroke-slate-950">
          <tspan x={labelX}>ω={format(w)} rad/s</tspan>
          <tspan x={labelX} dy="11">{format(value)} {unit}</tspan>
        </text>
      </g>;
    })}
  </g>;
}
