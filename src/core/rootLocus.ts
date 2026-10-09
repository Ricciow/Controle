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
  const explicitK = system.inputMode === 'expression' && /[kK]/.test(system.rawExpression);
  const plant = system.inputMode === 'expression'
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
  return maxGain * Math.expm1(progress * Math.log(1001)) / 1000;
}

export function calculateRootLocus(system: TransferFunction, maxGain: number, selectedGain?: number): RootLocusData {
  if (!Number.isFinite(maxGain) || maxGain <= 0 || maxGain > 1e6) {
    throw new Error('K máximo deve estar entre 0 e 1.000.000.');
  }
  if (selectedGain !== undefined && selectedGain > maxGain) throw new Error('K selecionado deve estar dentro da faixa.');
  const selectedPoles = selectedGain === undefined ? [] : rootLocusPoles(system, selectedGain);
  const reference = system.inputMode === 'expression'
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
