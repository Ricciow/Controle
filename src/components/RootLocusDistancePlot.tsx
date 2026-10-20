import React from 'react';
import { Complex } from '../core/types';
import { ComplexMath } from '../core/complex';
import { rootLocusDistances } from '../core/rootLocusCheck';
import { MathView } from './MathView';

const format = (value: number) => String(Number(value.toPrecision(5)));
const degrees = (radians: number) => radians * 180 / Math.PI;

export const RootLocusDistancePlot: React.FC<{
  point: Complex;
  geometry: NonNullable<ReturnType<typeof rootLocusDistances>>;
  onPointChange: (point: Complex) => void;
}> = ({ point, geometry, onPointChange }) => {
  const vectors = [
    ...geometry.poles.vectors.map((vector, i) => ({ ...vector, label: `p${i + 1}`, pole: true })),
    ...geometry.zeros.vectors.map((vector, i) => ({ ...vector, label: `z${i + 1}`, pole: false })),
  ];
  const coordinates = [{ re: 0, im: 0 }, point, ...vectors.map(vector => vector.origin)];
  const minRe = Math.min(...coordinates.map(value => value.re));
  const maxRe = Math.max(...coordinates.map(value => value.re));
  const minIm = Math.min(...coordinates.map(value => value.im));
  const maxIm = Math.max(...coordinates.map(value => value.im));
  const center = { re: minRe / 2 + maxRe / 2, im: minIm / 2 + maxIm / 2 };
  const scale = Math.min(440 / Math.max(2, maxRe - minRe), 210 / Math.max(2, maxIm - minIm));
  const x = (re: number) => 280 + (re - center.re) * scale;
  const y = (im: number) => 160 - (im - center.im) * scale;
  const tickMagnitude = 10 ** Math.floor(Math.log10(100 / scale));
  const step = Math.ceil(100 / scale / tickMagnitude) * tickMagnitude;
  const ticks = (middle: number, extent: number) => {
    const first = Math.ceil((middle - extent / scale) / step) * step;
    return Array.from({ length: Math.ceil(2 * extent / scale / step) + 1 }, (_, i) => first + i * step);
  };
  const product = (items: typeof geometry.poles.vectors) => items.length
    ? items.map(vector => format(vector.distance)).join(' \\cdot ') : '1';
  const gainFormula = `K = ${format(geometry.coefficientRatio)} \\cdot \\frac{${product(geometry.poles.vectors)}}{${product(geometry.zeros.vectors)}}`;
  const magnitudeFormula = `M = \\left|\\frac{B(s)}{A(s)}\\right| = ${format(1 / geometry.coefficientRatio)} \\cdot \\frac{${product(geometry.zeros.vectors)}}{${product(geometry.poles.vectors)}}`;
  const magnitudeValue = geometry.magnitude === null ? '\\quad\\text{indefinido}'
    : Number.isFinite(geometry.magnitude) ? ` \\approx ${format(geometry.magnitude)}` : ' \\to \\infty';

  return <div className="mt-3 space-y-3 text-slate-700 dark:text-slate-300">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="font-semibold">Construção pelo método das distâncias</p>
      <span className="text-[11px] text-slate-500 dark:text-slate-400">Clique no plano para mover s; ou use as coordenadas acima.</span>
    </div>
    <svg viewBox="0 0 560 320" role="img" aria-label={`Distâncias dos polos e zeros até s = ${ComplexMath.format(point, 5)}`}
      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 cursor-crosshair"
      onClick={event => {
        const svg = event.currentTarget;
        const matrix = svg.getScreenCTM();
        if (!matrix) return;
        const cursor = svg.createSVGPoint();
        cursor.x = event.clientX;
        cursor.y = event.clientY;
        const local = cursor.matrixTransform(matrix.inverse());
        const re = Number((center.re + (local.x - 280) / scale).toPrecision(5));
        const im = Number((center.im - (local.y - 160) / scale).toPrecision(5));
        if ([re, im].every(Number.isFinite)) onPointChange({ re, im });
      }}>
      <title>Vetores dos polos (×) e zeros (○) até o ponto s (●)</title>
      <desc>Os comprimentos fornecem o ganho K. Os ângulos são medidos a partir do eixo real positivo em cada origem. Os valores também aparecem na tabela abaixo.</desc>
      <g className="text-slate-200 dark:text-slate-800" stroke="currentColor" strokeWidth="1">
        {ticks(center.re, 240).map((tick, i) => <line key={`x${i}`} x1={x(tick)} y1="24" x2={x(tick)} y2="288" />)}
        {ticks(center.im, 125).map((tick, i) => <line key={`y${i}`} x1="32" y1={y(tick)} x2="528" y2={y(tick)} />)}
      </g>
      <g className="text-slate-400 dark:text-slate-500" stroke="currentColor" strokeWidth="1.5">
        <line x1="32" y1={y(0)} x2="528" y2={y(0)} />
        <line x1={x(0)} y1="24" x2={x(0)} y2="288" />
      </g>
      <g fill="currentColor" fontSize="10" className="text-slate-500 dark:text-slate-400">
        {ticks(center.re, 240).map((tick, i) => <text key={`x${i}`} x={x(tick)} y="307" textAnchor="middle">{format(tick)}</text>)}
        {ticks(center.im, 125).map((tick, i) => <text key={`y${i}`} x="27" y={y(tick) + 3} textAnchor="end">{format(tick)}</text>)}
        <text x="530" y={Math.max(18, y(0) - 7)}>Re</text>
        <text x={Math.min(524, x(0) + 7)} y="18">Im</text>
      </g>
      {vectors.map((vector, i) => {
        const ox = x(vector.origin.re);
        const oy = y(vector.origin.im);
        const angle = vector.angle;
        const radius = 18;
        const endX = ox + radius * Math.cos(angle);
        const endY = oy - radius * Math.sin(angle);
        return <g key={vector.label} className={vector.pole ? 'text-cyan-600 dark:text-cyan-400' : 'text-amber-600 dark:text-amber-400'}>
          <title>{vector.label}: distância {format(vector.distance)}, ângulo {format(degrees(angle))}°</title>
          <line x1={ox} y1={oy} x2={x(point.re)} y2={y(point.im)} stroke="currentColor" strokeWidth="2" strokeDasharray={vector.pole ? undefined : '6 4'} />
          {vector.distance > 0 && <>
            <line x1={ox} y1={oy} x2={ox + 26} y2={oy} stroke="currentColor" strokeWidth="1" opacity="0.5" />
            <path d={`M ${ox + radius} ${oy} A ${radius} ${radius} 0 0 ${angle < 0 ? 1 : 0} ${endX} ${endY}`}
              fill="none" stroke="currentColor" strokeWidth="1.5" />
          </>}
          {vector.pole ? <path d={`M ${ox - 5} ${oy - 5} l 10 10 M ${ox - 5} ${oy + 5} l 10 -10`} stroke="currentColor" strokeWidth="2.5" />
            : <circle cx={ox} cy={oy} r="6" fill="none" stroke="currentColor" strokeWidth="2.5" />}
          <text x={ox - 10} y={oy - 12 - (i % 2) * 13} textAnchor="end" fill="currentColor" fontSize="12">{vector.label}</text>
        </g>;
      })}
      <circle cx={x(point.re)} cy={y(point.im)} r="6" fill="currentColor" className="text-fuchsia-600 dark:text-fuchsia-400" />
      <text x={x(point.re) + 10} y={y(point.im) - 10} fill="currentColor" fontSize="12" className="text-fuchsia-700 dark:text-fuchsia-300">s</text>
    </svg>
    <div className="flex flex-wrap gap-4 text-[11px]">
      <span className="text-cyan-700 dark:text-cyan-300">× Polos de A(s) · linha contínua</span>
      <span className="text-amber-700 dark:text-amber-300">○ Zeros de B(s) · linha tracejada</span>
      <span className="text-fuchsia-700 dark:text-fuchsia-300">● Ponto s</span>
    </div>
    <p className="text-[11px] text-slate-500 dark:text-slate-400">Para A(s) + K B(s) = 0, usam-se os polos e zeros de B(s)/A(s). Ângulos medidos em relação ao eixo real positivo.</p>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">Distâncias e ângulos dos vetores até o ponto escolhido</caption>
        <thead className="text-slate-500 dark:text-slate-400"><tr><th scope="col" className="py-1 pr-3">Origem</th><th scope="col" className="pr-3">Coordenada</th><th scope="col" className="pr-3">Distância até s</th><th scope="col">Ângulo</th></tr></thead>
        <tbody>{vectors.map(vector => <tr key={vector.label} className="border-t border-slate-200 dark:border-slate-800 font-mono">
          <th scope="row" className="py-1 pr-3 font-normal">{vector.label} ({vector.pole ? 'polo' : 'zero'})</th>
          <td className="pr-3 whitespace-nowrap">{ComplexMath.format(vector.origin, 5)}</td>
          <td className="pr-3">{format(vector.distance)}</td>
          <td>{vector.distance === 0 ? 'Indefinido' : `${format(degrees(vector.angle))}°`}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="space-y-2 rounded-lg bg-slate-100 dark:bg-slate-900 p-3">
      <div className="overflow-x-auto py-1"><MathView math={`${magnitudeFormula}${magnitudeValue}`} /></div>
      <div className="overflow-x-auto py-1"><MathView math={`${gainFormula}${geometry.gain === null ? '\\quad\\text{indefinido}' : ` \\approx ${format(geometry.gain)}`}`} /></div>
      <p>M é o módulo da malha aberta sem K. Para M finito e positivo, K = 1/M.</p>
      <p>Produtos sem fatores valem 1. O fator inicial corrige os coeficientes líderes.</p>
      {geometry.phase === null ? <p>Ângulo indefinido: s coincide com um polo ou zero. Use o resultado da verificação para esse caso.</p>
        : <p className={geometry.angleSatisfied ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
          Σ ângulos dos polos − Σ ângulos dos zeros + {geometry.phaseOffset}° = {format(geometry.phase)}° (módulo 360°).
          {' '}{geometry.angleSatisfied ? 'Condição angular satisfeita' : 'Condição angular não satisfeita'}: deve ser ±180°.
        </p>}
      <p className="text-[11px] text-slate-500 dark:text-slate-400">A razão das distâncias fornece o módulo de K; o ponto pertence ao LGR somente quando a condição angular e a equação característica também são satisfeitas.</p>
    </div>
  </div>;
};
