import { SimulationResult } from './types';

export function responseAt(simulation: SimulationResult, time: number): number | null {
  const { t, y } = simulation;
  if (!t.length || time < t[0] || time > t[t.length - 1]) return null;
  let low = 0;
  let high = t.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (t[mid] < time) low = mid + 1;
    else high = mid;
  }
  if (t[low] === time) return Number.isFinite(y[low]) ? y[low] : null;
  const i = low - 1;
  if (i < 0 || !Number.isFinite(y[i]) || !Number.isFinite(y[low])) return null;
  return y[i] + (time - t[i]) / (t[low] - t[i]) * (y[low] - y[i]);
}

export function niceStep(span: number, intervals: number): number {
  if (!Number.isFinite(span) || span <= 0) return 1;
  const raw = span / Math.max(1, intervals);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 2.5, 5, 10].find(value => value * magnitude >= raw) ?? 10) * magnitude;
}

export function axisTicks(min: number, max: number, intervals: number): number[] {
  const step = niceStep(max - min, intervals);
  const first = Math.ceil(min / step - 1e-10);
  const last = Math.floor(max / step + 1e-10);
  return Array.from({ length: Math.max(0, Math.min(50, last - first + 1)) }, (_, i) => Number(((first + i) * step).toPrecision(12)));
}

export function plotBounds(simulations: SimulationResult[], start: number, end: number, references: number[] = []): [number, number] {
  let min = 0;
  let max = 0;
  const include = (value: number | null) => {
    if (value !== null && Number.isFinite(value)) { min = Math.min(min, value); max = Math.max(max, value); }
  };
  references.forEach(include);
  for (const simulation of simulations) {
    include(responseAt(simulation, start));
    include(responseAt(simulation, end));
    simulation.y.forEach((value, i) => { if (simulation.t[i] >= start && simulation.t[i] <= end) include(value); });
  }
  const span = max - min || Math.max(Math.abs(max) * 0.2, 1);
  if (min === 0 && max === 0) return [-0.2, 0.2];
  const step = niceStep(span * 1.2, 8);
  return [min === 0 ? 0 : Math.floor((min - span * 0.06) / step) * step, Math.ceil((max + span * 0.1) / step) * step];
}

export function responseDetails(simulation: SimulationResult, finalValue: number) {
  const initial = simulation.y[0];
  const direction = Math.sign(finalValue - initial);
  let peakIndex = 0;
  let lastOutside = -1;
  const band = Math.abs(finalValue) * 0.02;
  simulation.y.forEach((value, i) => {
    if (!Number.isFinite(value)) { lastOutside = i; return; }
    if ((value - initial) * direction > (simulation.y[peakIndex] - initial) * direction) peakIndex = i;
    if (Math.abs(value - finalValue) > band) lastOutside = i;
  });
  const peakValue = simulation.y[peakIndex];
  const overshoot = finalValue !== 0 ? Math.max(0, (peakValue - finalValue) * direction / Math.abs(finalValue) * 100) : null;
  return {
    peakValue,
    peakTime: overshoot !== null && overshoot > 0.01 ? simulation.t[peakIndex] : null,
    overshoot,
    settlingTime: band === 0 || lastOutside >= simulation.t.length - 1 ? null : simulation.t[Math.max(0, lastOutside + 1)],
  };
}
