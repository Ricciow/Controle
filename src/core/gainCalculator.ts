import { TransferFunction } from './types';
import { TransferFunctionParser as Parser } from './parser';
import { Polynomial } from './polynomial';
import { rootLocusPoles } from './rootLocus';
import { Simulation } from './simulation';
import { responseDetails } from './timePlot';
import { numericTransferText } from './transferText';
import { poleZeroExpression } from './poleZeroInput';
import { analyzeRouth } from './routh';

export interface GainRequirements {
  maxOvershoot?: number;
  maxSettlingTime?: number;
  minGain: number;
  maxGain: number;
}
export interface GainResult { gain: number; overshoot: number; settlingTime: number }

// Always start from the plant inputs, even when the displayed system is closed.
// An existing K is varied directly; otherwise introduce one proportional gain.
export function withCalculatedGain(system: TransferFunction, gain: number): TransferFunction {
  if (!Number.isFinite(gain) || gain <= 0) throw new Error('K deve ser positivo e finito.');
  const expression = system.inputMode === 'roots'
    ? poleZeroExpression(system.polesStr ?? '', system.zerosStr ?? '') : system.rawExpression;
  if (system.inputMode !== 'coefficients' && /[kK]/.test(expression)) {
    return { ...system, rawExpression: expression, kValue: gain, unityFeedback: true };
  }
  const plant = system.inputMode === 'coefficients'
    ? { numerator: Parser.parseCoefficientsString(system.numStr), denominator: Parser.parseCoefficientsString(system.denStr) }
    : Parser.parseTransferFunction(expression);
  return { ...system, inputMode: 'expression', rawExpression: 'K*' + numericTransferText({ ...system, ...plant }), kValue: gain, unityFeedback: true };
}

export function evaluateGain(system: TransferFunction, gain: number, precision = 1): GainResult | null {
  try {
    const family = withCalculatedGain(system, gain);
    const plant = Parser.parseTransferFunction(family.rawExpression, gain);
    const numerator = Polynomial.clean(plant.numerator);
    const denominator = Polynomial.add(plant.denominator, numerator);
    if (numerator.length > denominator.length || analyzeRouth(denominator).status !== 'STABLE') return null;
    const poles = rootLocusPoles(family, gain);
    if (poles.some(pole => pole.re >= -1e-6)) return null;
    const finalValue = numerator[numerator.length - 1] / denominator[denominator.length - 1];
    if (!Number.isFinite(finalValue) || finalValue === 0) return null;
    const decay = Math.min(...poles.map(pole => -pole.re));
    const horizon = poles.length ? (16 + 2 * poles.length) / decay : 1;
    const frequency = Math.max(0, ...poles.map(pole => Math.abs(pole.im)));
    // Resolve oscillatory peaks and leave a long tail to check the 2% band.
    const points = Math.max(2001 * precision, Math.ceil(horizon * frequency * 40 * precision / Math.PI) + 1);
    if (!Number.isFinite(horizon) || points > 24001) return null;
    const response = Simulation.simulateTimeDomain(numerator, denominator, poles, horizon, 0, points);
    if (!response.stepResponse.y.every(Number.isFinite)) return null;
    const detail = responseDetails(response.stepResponse, finalValue);
    if (detail.overshoot === null || detail.settlingTime === null) return null;
    const peak = Math.max(...response.stepResponse.y.map(value => value * Math.sign(finalValue)));
    const overshoot = Math.max(0, (peak / Math.abs(finalValue) - 1) * 100);
    return { gain, overshoot, settlingTime: detail.settlingTime };
  } catch { return null; }
}

export async function calculateGain(system: TransferFunction, requirements: GainRequirements, signal?: AbortSignal): Promise<GainResult | null> {
  const { maxOvershoot, maxSettlingTime, minGain, maxGain } = requirements;
  if (maxOvershoot === undefined && maxSettlingTime === undefined) throw new Error('Informe pelo menos um requisito.');
  if ((maxOvershoot !== undefined && (!Number.isFinite(maxOvershoot) || maxOvershoot < 0)) ||
      (maxSettlingTime !== undefined && (!Number.isFinite(maxSettlingTime) || maxSettlingTime <= 0))) throw new Error('Confira os limites de sobressinal e acomodação.');
  if (![minGain, maxGain].every(Number.isFinite) || minGain <= 0 || maxGain <= minGain) throw new Error('Use 0 < K mínimo < K máximo.');
  const family = withCalculatedGain(system, 1);
  // Fail visibly for malformed plant inputs instead of reporting no solution.
  let validPlant = false;
  let inputError: unknown;
  for (const gain of [1, minGain, maxGain, Math.sqrt(minGain) * Math.sqrt(maxGain)]) {
    try {
      const plant = Parser.parseTransferFunction(family.rawExpression, gain);
      if (plant.denominator.every(value => value === 0)) throw new Error('O denominador não pode ser zero.');
      validPlant = true; break;
    } catch (error) { inputError = error; }
  }
  if (!validPlant) throw inputError;
  const score = (result: GainResult) => Math.max(
    maxOvershoot === undefined ? 0 : Math.max(0, result.overshoot - maxOvershoot) / Math.max(1, maxOvershoot),
    maxSettlingTime === undefined ? 0 : Math.max(0, result.settlingTime - maxSettlingTime) / maxSettlingTime);
  let attempts = 0;
  const check = async (gain: number) => {
    if (++attempts % 4 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
    if (signal?.aborted) throw new DOMException('Cálculo cancelado.', 'AbortError');
    const result = evaluateGain(family, gain);
    if (result && score(result) === 0) {
      // Confirm at finer resolution, using the exact gain returned to the UI.
      const verified = evaluateGain(family, gain, 2);
      if (verified && score(verified) === 0) return { result: verified, accepted: true };
    }
    return { result, accepted: false };
  };
  const count = 240;
  const logMin = Math.log(minGain);
  const logStep = (Math.log(maxGain) - logMin) / count;
  const candidates: { logGain: number; score: number }[] = [];
  for (let index = 0; index <= count; index++) {
    const gain = index === 0 ? minGain : index === count ? maxGain : Math.exp(logMin + index * logStep);
    const checked = await check(gain);
    if (checked.accepted) return checked.result;
    if (checked.result) candidates.push({ logGain: Math.log(gain), score: score(checked.result) });
  }
  // Refine promising neighborhoods when no coarse sample satisfies both limits.
  let radius = logStep;
  for (let pass = 0; pass < 3; pass++) {
    const centers = candidates.sort((a, b) => a.score - b.score).slice(0, 8);
    candidates.length = 0;
    for (const center of centers) {
      for (let index = -5; index <= 5; index++) {
        const logGain = center.logGain + radius * index / 5;
        if (logGain < logMin || logGain > Math.log(maxGain)) continue;
        const checked = await check(Math.exp(logGain));
        if (checked.accepted) return checked.result;
        if (checked.result) candidates.push({ logGain, score: score(checked.result) });
      }
    }
    radius /= 5;
  }
  return null;
}
