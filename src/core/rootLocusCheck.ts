import { Complex, TransferFunction } from './types';
import { ComplexMath } from './complex';
import { Roots } from './roots';
import { rootLocusCharacteristic } from './rootLocus';
import { rootLocusGainCoefficients } from './symbolicRouth';

export interface RootLocusCheck {
  belongs: boolean;
  gains: number[];
  allGains: boolean;
}

const tolerance = 1e-6;
const evaluationScale = (coefficients: number[], point: Complex) =>
  coefficients.reduce((sum, coefficient) => sum * ComplexMath.mag(point) + Math.abs(coefficient), 0);

export function checkRootLocusPoint(system: TransferFunction, point: Complex): RootLocusCheck {
  if (![point.re, point.im].every(Number.isFinite)) throw new Error('Informe partes real e imaginária finitas.');
  const polynomials = rootLocusGainCoefficients(system);
  const values = polynomials.map(coefficients => {
    const value = ComplexMath.evalPoly(coefficients, point);
    const scale = evaluationScale(coefficients, point);
    if (![value.re, value.im, scale].every(Number.isFinite)) throw new Error('Coordenada fora da faixa numérica.');
    return {
      re: Math.abs(value.re) <= 1e-12 * scale ? 0 : value.re,
      im: Math.abs(value.im) <= 1e-12 * scale ? 0 : value.im,
    };
  });
  const validates = (gain: number) => {
    try {
      const characteristic = rootLocusCharacteristic(system, gain);
      const scale = evaluationScale(characteristic, point);
      const residual = ComplexMath.mag(ComplexMath.evalPoly(characteristic, point));
      return Number.isFinite(scale) && Number.isFinite(residual) && residual <= tolerance * scale;
    } catch {
      return false;
    }
  };
  if (values.every(value => value.re === 0 && value.im === 0)) {
    // A common factor can keep a pole fixed for every gain where the plant
    // and characteristic are defined. Never accept an identically zero one.
    const belongs = Array.from({ length: 14 }, (_, i) => i).some(validates);
    return { belongs, gains: [], allGains: belongs };
  }
  const re = values.map(value => value.re);
  const im = values.map(value => value.im);
  const coefficients = (Math.max(...re.map(Math.abs)) >= Math.max(...im.map(Math.abs)) ? re : im).slice().reverse();
  while (coefficients.length > 1 && coefficients[0] === 0) coefficients.shift();
  const leading = coefficients[0];
  const normalized = coefficients.map(value => value / leading);
  const scale = Math.max(1, ...normalized.slice(1).map((value, i) => Math.abs(value) ** (1 / (i + 1))));
  const candidates = Roots.findRoots(normalized.map((value, i) => value / scale ** i));
  const gains = candidates.flatMap(root => {
    const gain = root.re * scale;
    return Number.isFinite(gain) && gain >= 0 && Math.abs(root.im * scale) <= tolerance * Math.max(1, gain) && validates(gain)
      ? [gain === 0 ? 0 : gain] : [];
  }).sort((a, b) => a - b).filter((gain, i, list) => i === 0 || Math.abs(gain - list[i - 1]) > tolerance * Math.max(1, gain));
  return { belongs: gains.length > 0, gains, allGains: false };
}
