import { Complex, SimulationResult, TransferFunction } from './types';
import { Polynomial } from './polynomial';
import { Simulation } from './simulation';
import { analyzeRouth } from './routh';
import { rootLocusPoles } from './rootLocus';
import { analyzeSymbolicRouth, proportionalPlantCoefficients } from './symbolicRouth';
import { numericTransferText } from './transferText';
import { responseDetails } from './timePlot';

export interface DesignRequirements { overshoot: number; settlingTime: number }
export const DEFAULT_REQUIREMENTS: DesignRequirements = { overshoot: 20, settlingTime: 3 };
export const ASSIGNMENT_PLANT: TransferFunction = {
  id: 'proportional-assignment', name: 'Planta do enunciado', color: '#06b6d4', visible: true,
  inputMode: 'expression', rawExpression: 'K/(s*(s+2)*(s+5))', kValue: 10, unityFeedback: true,
  numStr: '1', denStr: '1,7,10,0', numerator: [1], denominator: [1,7,10,0], latex: '', factoredLatex: '',
};
export interface ProportionalModel {
  system: TransferFunction;
  numerator: number[];
  denominator: number[];
  stability: ReturnType<typeof analyzeSymbolicRouth>;
  assignment: boolean;
}
export interface DesignCase {
  gain: number;
  poles: Complex[];
  stability: 'STABLE' | 'BOUNDARY' | 'UNSTABLE' | 'INCONCLUSIVE';
  overshoot: number | null;
  settlingTime: number | null;
  predictedOvershoot: number | null;
  predictedSettlingTime: number | null;
  damping: number | null;
  stable: boolean;
  passesOvershoot: boolean;
  passesSettling: boolean;
  meets: boolean;
  complete: boolean;
  horizon: number;
  timeStep: number;
  response?: SimulationResult;
  error?: string;
}
export interface DesignSearchOptions { min: number; max: number; samples: number }
export interface DesignSearch {
  options: DesignSearchOptions;
  requirements: DesignRequirements;
  cases: DesignCase[];
  feasible: DesignCase[];
  best: DesignCase | null;
  fastest: DesignCase | null;
}
export function validateRequirements(requirements: DesignRequirements) {
  if (!Number.isFinite(requirements.overshoot) || requirements.overshoot < 0 || requirements.overshoot > 1000 ||
      !Number.isFinite(requirements.settlingTime) || requirements.settlingTime <= 0 || requirements.settlingTime > 120) {
    throw new Error('Use sobressinal entre 0 e 1000% e acomodação maior que 0 e até 120 s.');
  }
}
export function createProportionalModel(source: TransferFunction): ProportionalModel {
  const plant = proportionalPlantCoefficients(source);
  const system = { ...source, ...plant, inputMode: 'expression' as const, rawExpression: `K*${numericTransferText({ ...source, ...plant })}`, unityFeedback: true,
    numStr: plant.numerator.join(','), denStr: plant.denominator.join(',') };
  const lead = plant.denominator[0];
  return { ...plant, system, stability: analyzeSymbolicRouth(system),
    assignment: plant.numerator.length === 1 && Math.abs(plant.numerator[0] / lead - 1) < 1e-12 &&
      plant.denominator.length === 4 && plant.denominator.every((value, i) => Math.abs(value / lead - [1,7,10,0][i]) < 1e-12) };
}
export function evaluateDesign(model: ProportionalModel, gain: number, requirements = DEFAULT_REQUIREMENTS, includeResponse = true): DesignCase {
  validateRequirements(requirements);
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
  const horizon = stable ? Math.min(120, Math.max(12, requirements.settlingTime * 2, 8 / decay)) : 12;
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
  const passesOvershoot = stable && complete && overshoot !== null && overshoot <= requirements.overshoot;
  const passesSettling = stable && settlingTime !== null && settlingTime < requirements.settlingTime;
  return { gain, poles, stability: routh.status, stable, overshoot, settlingTime, predictedOvershoot, predictedSettlingTime,
    damping, passesOvershoot, passesSettling, meets: gain > 0 && stable && passesOvershoot && passesSettling,
    complete, horizon, timeStep, ...(response ? { response } : {}) };
}
export async function searchProportionalGain(model: ProportionalModel, requirements: DesignRequirements, options: DesignSearchOptions,
  onProgress?: (progress: number) => void, signal?: AbortSignal): Promise<DesignSearch> {
  validateRequirements(requirements);
  if (![options.min, options.max].every(Number.isFinite) || options.min < 0 || options.max <= options.min || options.max > 1e6 ||
      !Number.isInteger(options.samples) || options.samples < 101 || options.samples > 5001) {
    throw new Error('Use 0 ≤ K mínimo < K máximo ≤ 1.000.000 e entre 101 e 5001 amostras.');
  }
  const cases: DesignCase[] = [];
  const visit = (gain: number) => {
    if (signal?.aborted) throw new Error('Busca cancelada.');
    try {
      cases.push(evaluateDesign(model, gain, requirements, false));
    } catch (error) {
      // A singular gain or a failed numeric solve must not abort the whole sweep
      // or be mistaken for a stable case with zero transient metrics.
      cases.push({ gain, poles: [], stability: 'INCONCLUSIVE', stable: false, overshoot: null, settlingTime: null,
        predictedOvershoot: null, predictedSettlingTime: null, damping: null, passesOvershoot: false,
        passesSettling: false, meets: false, complete: false, horizon: 0, timeStep: 0,
        error: error instanceof Error ? error.message : 'Cálculo inconclusivo.' });
    }
  };
  const step = (options.max - options.min) / (options.samples - 1);
  for (let i = 0; i < options.samples; i++) {
    visit(i === options.samples - 1 ? options.max : options.min + step * i);
    if (i % 16 === 0) { onProgress?.(i / (options.samples + 101)); await new Promise(resolve => setTimeout(resolve, 0)); }
  }
  const rank = (items: DesignCase[]) => items.filter(item => item.stable && item.gain > 0 && item.passesOvershoot && item.settlingTime !== null)
    .sort((a, b) => a.settlingTime! - b.settlingTime!)[0];
  const best = rank(cases);
  if (best) {
    const min = Math.max(options.min, best.gain - step);
    const max = Math.min(options.max, best.gain + step);
    for (let i = 0; i <= 100; i++) {
      visit(min + (max - min) * i / 100);
      if (i % 16 === 0) { onProgress?.((options.samples + i) / (options.samples + 101)); await new Promise(resolve => setTimeout(resolve, 0)); }
    }
  }
  cases.sort((a, b) => a.gain - b.gain);
  const unique = cases.filter((item, i) => i === 0 || Math.abs(item.gain - cases[i - 1].gain) > 1e-12);
  const feasible = unique.filter(item => item.meets);
  const fastest = unique.filter(item => item.stable && item.settlingTime !== null).sort((a, b) => a.settlingTime! - b.settlingTime!)[0] ?? null;
  onProgress?.(1);
  return { options: { ...options }, requirements: { ...requirements }, cases: unique, feasible, best: rank(unique) ?? null, fastest };
}
export function designSearchCsv(search: DesignSearch): string {
  const header = 'K,estabilidade,sobressinal_percentual,acomodacao_2pct_s,previsao_acomodacao_s,previsao_sobressinal_percentual,requisitos_atendidos';
  return [header, ...search.cases.map(item => [item.gain, item.stability, item.overshoot ?? '', item.settlingTime ?? '',
    item.predictedSettlingTime ?? '', item.predictedOvershoot ?? '', item.meets].join(','))].join('\n');
}
