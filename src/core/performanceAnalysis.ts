import { Complex, SimulationResult, TransferFunction } from './types';
import { Polynomial } from './polynomial';
import { Simulation } from './simulation';
import { analyzeRouth } from './routh';
import { rootLocusPoles } from './rootLocus';
import { analyzeSymbolicRouth, proportionalPlantCoefficients } from './symbolicRouth';
import { numericTransferText } from './transferText';
import { responseDetails } from './timePlot';

export interface PerformanceLimits { overshoot?: number; settlingTime?: number }
export interface PerformanceModel {
  system: TransferFunction;
  numerator: number[];
  denominator: number[];
  stability: ReturnType<typeof analyzeSymbolicRouth>;
}
export interface PerformanceCase {
  gain: number;
  poles: Complex[];
  stability: 'STABLE' | 'BOUNDARY' | 'UNSTABLE' | 'INCONCLUSIVE';
  overshoot: number | null;
  settlingTime: number | null;
  predictedOvershoot: number | null;
  predictedSettlingTime: number | null;
  damping: number | null;
  naturalFrequency: number | null;
  stable: boolean;
  passesOvershoot: boolean | null;
  passesSettling: boolean | null;
  meets: boolean | null;
  complete: boolean;
  horizon: number;
  timeStep: number;
  response?: SimulationResult;
  error?: string;
}
export interface GainSweepOptions { min: number; max: number; samples: number }
export interface GainSweep {
  options: GainSweepOptions;
  limits: PerformanceLimits;
  cases: PerformanceCase[];
}
export function validateLimits(limits: PerformanceLimits) {
  if ((limits.overshoot !== undefined && (!Number.isFinite(limits.overshoot) || limits.overshoot < 0 || limits.overshoot > 1000)) ||
      (limits.settlingTime !== undefined && (!Number.isFinite(limits.settlingTime) || limits.settlingTime <= 0 || limits.settlingTime > 120))) {
    throw new Error('Informe limites válidos ou deixe os campos vazios. Mp: 0 a 1000%; Ts: maior que 0 e até 120 s.');
  }
}
export function createPerformanceModel(source: TransferFunction): PerformanceModel {
  const plant = proportionalPlantCoefficients(source);
  const system = { ...source, ...plant, inputMode: 'expression' as const, rawExpression: `K*${numericTransferText({ ...source, ...plant })}`, unityFeedback: true,
    numStr: plant.numerator.join(','), denStr: plant.denominator.join(',') };
  return { ...plant, system, stability: analyzeSymbolicRouth(system) };
}
export function evaluatePerformance(model: PerformanceModel, gain: number, requirements: PerformanceLimits = {}, includeResponse = true, minimumHorizon = 12): PerformanceCase {
  validateLimits(requirements);
  if (!Number.isFinite(minimumHorizon) || minimumHorizon <= 0 || minimumHorizon > 120) throw new Error('Use janela temporal entre 0 e 120 s.');
  if (!Number.isFinite(gain) || gain < 0 || gain > 1e6) throw new Error('Use K finito entre 0 e 1.000.000.');
  const numerator = Polynomial.scale(model.numerator, gain);
  const denominator = Polynomial.add(model.denominator, numerator);
  const routh = analyzeRouth(denominator);
  const poles = rootLocusPoles(model.system, gain);
  const stable = routh.status === 'STABLE';
  const dominant = [...poles].sort((a, b) => b.re - a.re)[0];
  const decay = dominant ? -dominant.re : Infinity;
  const damping = stable && dominant ? decay / Math.hypot(dominant.re, dominant.im) : null;
  const predictedSettlingTime = stable ? dominant ? -Math.log(0.02) / decay : 0 : null;
  const predictedOvershoot = stable && dominant && Math.abs(dominant.im) > 1e-6
    ? 100 * Math.exp(-Math.PI * decay / Math.abs(dominant.im)) : stable ? 0 : null;
  const horizon = stable ? Math.min(120, Math.max(minimumHorizon, (requirements.settlingTime ?? 0) * 2, 8 / decay)) : minimumHorizon;
  const complete = stable && (dominant === undefined || horizon >= 8 / decay * (1 - 1e-12));
  const sampleCount = Math.min(12001, Math.max(2001, Math.ceil(horizon / 0.01) + 1));
  const timeStep = horizon / (sampleCount - 1);
  let response: SimulationResult | undefined;
  let overshoot: number | null = null;
  let settlingTime: number | null = null;
  if (stable || includeResponse) {
    const simulation = Simulation.simulateTimeDomain(numerator, denominator, poles, horizon, 0, sampleCount);
    if (includeResponse) response = simulation.stepResponse;
    const final = denominator[denominator.length - 1] !== 0 ? numerator[numerator.length - 1] / denominator[denominator.length - 1] : null;
    if (stable && final !== null && final !== 0 && simulation.stepResponse.y.every(Number.isFinite)) {
      const details = responseDetails(simulation.stepResponse, final);
      overshoot = details.overshoot;
      settlingTime = complete ? details.settlingTime : null;
    }
  }
  // Compare unrounded values; Ts is strictly below its target.
  const passesOvershoot = requirements.overshoot === undefined ? null : stable && complete && overshoot !== null && overshoot <= requirements.overshoot;
  const passesSettling = requirements.settlingTime === undefined ? null : stable && settlingTime !== null && settlingTime < requirements.settlingTime;
  return { gain, poles, stability: routh.status, stable, overshoot, settlingTime, predictedOvershoot, predictedSettlingTime,
    damping, naturalFrequency: dominant ? Math.hypot(dominant.re, dominant.im) : null, passesOvershoot, passesSettling,
    meets: passesOvershoot === null && passesSettling === null ? null : gain > 0 && stable && passesOvershoot !== false && passesSettling !== false,
    complete, horizon, timeStep, ...(response ? { response } : {}) };
}
export async function sweepGain(model: PerformanceModel, limits: PerformanceLimits, options: GainSweepOptions,
  onProgress?: (progress: number) => void, signal?: AbortSignal): Promise<GainSweep> {
  validateLimits(limits);
  if (![options.min, options.max].every(Number.isFinite) || options.min < 0 || options.max <= options.min || options.max > 1e6 ||
      !Number.isInteger(options.samples) || options.samples < 2 || options.samples > 5001) {
    throw new Error('Use 0 ≤ K mínimo < K máximo ≤ 1.000.000 e entre 2 e 5001 amostras.');
  }
  const cases: PerformanceCase[] = [];
  const step = (options.max - options.min) / (options.samples - 1);
  for (let i = 0; i < options.samples; i++) {
    if (signal?.aborted) throw new Error('Varredura cancelada.');
    const gain = i === options.samples - 1 ? options.max : options.min + step * i;
    try { cases.push(evaluatePerformance(model, gain, limits, false)); }
    catch (error) {
      cases.push({ gain, poles: [], stability: 'INCONCLUSIVE', stable: false, overshoot: null, settlingTime: null,
        predictedOvershoot: null, predictedSettlingTime: null, damping: null, naturalFrequency: null,
        passesOvershoot: limits.overshoot === undefined ? null : false, passesSettling: limits.settlingTime === undefined ? null : false,
        meets: Object.keys(limits).length ? false : null, complete: false, horizon: 0, timeStep: 0,
        error: error instanceof Error ? error.message : 'Cálculo inconclusivo.' });
    }
    if (i % 16 === 0) { onProgress?.((i + 1) / options.samples); await new Promise(resolve => setTimeout(resolve, 0)); }
  }
  onProgress?.(1);
  return { options: { ...options }, limits: { ...limits }, cases };
}
export function performanceCsv(cases: PerformanceCase[]): string {
  const header = 'K,estabilidade,sobressinal_percentual,acomodacao_2pct_s,zeta,omega_n_rad_s,previsao_acomodacao_s,previsao_sobressinal_percentual,limites_atendidos';
  return [header, ...cases.map(item => [item.gain, item.stability, item.overshoot ?? '', item.settlingTime ?? '', item.damping ?? '',
    item.naturalFrequency ?? '', item.predictedSettlingTime ?? '', item.predictedOvershoot ?? '', item.meets ?? ''].join(','))].join('\n');
}
