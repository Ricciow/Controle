import { Complex, TransferFunction } from './types';
import { TransferFunctionParser } from './parser';
import { Polynomial } from './polynomial';
import { Roots } from './roots';

export interface RootLocusData {
  branches: Complex[][];
  poles: Complex[];
  zeros: Complex[];
  selectedPoles: Complex[];
}

// Use the original plant inputs: the stored denominator may include feedback.
// Sweep an explicit K directly, without multiplying that gain a second time.
export function rootLocusCharacteristic(system: TransferFunction, gain: number): number[] {
  if (!Number.isFinite(gain) || gain < 0) throw new Error('K deve ser finito e não negativo.');
  const explicitK = system.inputMode !== 'coefficients' && /[kK]/.test(system.rawExpression);
  const plant = system.inputMode !== 'coefficients'
    ? TransferFunctionParser.parseTransferFunction(system.rawExpression, gain)
    : {
      numerator: TransferFunctionParser.parseCoefficientsString(system.numStr),
      denominator: TransferFunctionParser.parseCoefficientsString(system.denStr),
    };
  if (plant.denominator.every(value => value === 0)) throw new Error('O denominador não pode ser zero.');
  const characteristic = Polynomial.add(plant.denominator,
    explicitK ? plant.numerator : Polynomial.scale(plant.numerator, gain));
  if (characteristic.every(value => value === 0)) throw new Error('Polinômio característico indefinido neste K.');
  if (!characteristic.every(Number.isFinite)) throw new Error('Coeficientes fora da faixa numérica.');
  return characteristic;
}

// Rescale the variable to keep the existing root solver near the unit circle.
export function rootLocusPoles(system: TransferFunction, gain: number): Complex[] {
  return findPoles(rootLocusCharacteristic(system, gain));
}

function findPoles(coefficients: number[]): Complex[] {
  const normalized = coefficients.map(value => value / coefficients[0]);
  const scale = Math.max(1, ...normalized.slice(1).map((value, i) => Math.abs(value) ** (1 / (i + 1))));
  const roots = Roots.findRoots(normalized.map((value, i) => value / scale ** i))
    .map(root => ({ re: root.re * scale, im: root.im * scale }));
  if (!roots.every(root => Number.isFinite(root.re) && Number.isFinite(root.im))) throw new Error('Raízes fora da faixa numérica.');
  return roots;
}

// Share the sampling scale with playback so low-gain departures remain visible.
export function rootLocusGain(progress: number, maxGain: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return maxGain;
  const scale = Math.min(1, maxGain / 1000) || maxGain;
  return scale * Math.expm1(progress * Math.log1p(maxGain / scale));
}

export function advanceRootLocusGain(gain: number, elapsedMs: number, speed: number): number {
  const next = Math.expm1(Math.log1p(gain) + Math.max(0, Math.min(elapsedMs, 100)) * speed * Math.log(101) / 30000);
  return Number.isFinite(next) ? next : Number.MAX_VALUE;
}

// Bound gains on a circle outside the visible plane and the leading K term's
// zeros. For nonlinear K, use the Cauchy bound for the characteristic in K.
export function rootLocusGainForRadius(polynomials: number[][], radius: number): number | null {
  if (!Number.isFinite(radius) || radius <= 0) throw new Error('Raio inválido.');
  if (polynomials.length < 2) return null;
  const leading = polynomials[polynomials.length - 1];
  if (leading.every(value => value === 0)) return null;
  const zeros = findPoles(leading);
  const outer = Math.max(radius * 1.1, ...zeros.map(zero => Math.hypot(zero.re, zero.im) * 1.1 + 1));
  const denominator = Math.log(Math.abs(leading[0])) + zeros.reduce((sum, zero) => sum + Math.log(outer - Math.hypot(zero.re, zero.im)), 0);
  const logarithm = Math.max(...polynomials.slice(0, -1).filter(polynomial => polynomial.some(value => value !== 0)).map(polynomial =>
    Math.log(Math.abs(polynomial[0])) + findPoles(polynomial).reduce((sum, pole) => sum + Math.log(outer + Math.hypot(pole.re, pole.im)), 0) - denominator));
  const bound = Math.exp(logarithm) + (polynomials.length > 2 ? 1 : 0);
  const required = 10 ** Math.ceil(Math.log10(bound || 1));
  return Number.isFinite(required) && required > 0 ? required : Number.MAX_VALUE;
}

export function calculateRootLocus(system: TransferFunction, maxGain: number, selectedGain?: number): RootLocusData {
  if (!Number.isFinite(maxGain) || maxGain <= 0) {
    throw new Error('K máximo deve ser positivo e finito.');
  }
  if (selectedGain !== undefined && selectedGain > maxGain) throw new Error('K selecionado deve estar dentro da faixa.');
  const selectedPoles = selectedGain === undefined ? [] : rootLocusPoles(system, selectedGain);
  const reference = system.inputMode !== 'coefficients'
    ? TransferFunctionParser.parseTransferFunction(system.rawExpression, 1)
    : { numerator: TransferFunctionParser.parseCoefficientsString(system.numStr) };
  const branches: Complex[][] = [];
  let previous: Complex[] = [];
  let branchIndices: number[] = [];
  let poles: Complex[] = [];
  let previousLeading = 0;
  // Logarithmic spacing resolves low-gain departures as well as large gains.
  const gains = Array.from({ length: 401 }, (_, i) => rootLocusGain(i / 400, maxGain));
  gains[0] = 0;
  gains[gains.length - 1] = maxGain;
  for (const gain of gains) {
    let roots: Complex[];
    try {
      const characteristic = rootLocusCharacteristic(system, gain);
      roots = findPoles(characteristic);
      // A leading-coefficient sign change can send a root through infinity
      // between samples, even when no sample lands on the singular gain.
      if (previousLeading * characteristic[0] < 0) previous = [];
      previousLeading = characteristic[0];
    } catch {
      // Singular gains break the paths instead of connecting across infinity.
      previous = [];
      continue;
    }
    if (gain === 0) poles = roots;
    if (previous.length !== roots.length || previous.length === 0) {
      branchIndices = roots.map(root => branches.push([root]) - 1);
    } else {
      // Match nearest roots globally rather than relying on solver sort order.
      const pairs = previous.flatMap((root, i) => roots.map((next, j) => ({
        i, j, distance: Math.hypot(root.re - next.re, root.im - next.im),
      }))).sort((a, b) => a.distance - b.distance);
      const usedPrevious = new Set<number>();
      const usedNext = new Set<number>();
      const nextIndices: number[] = [];
      for (const { i, j } of pairs) {
        if (usedPrevious.has(i) || usedNext.has(j)) continue;
        branches[branchIndices[i]].push(roots[j]);
        nextIndices[j] = branchIndices[i];
        usedPrevious.add(i);
        usedNext.add(j);
      }
      branchIndices = nextIndices;
    }
    previous = roots;
  }
  return { branches, poles, zeros: Roots.findRoots(reference.numerator), selectedPoles };
}
