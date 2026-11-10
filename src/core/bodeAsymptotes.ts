import { FrequencyModel } from './types';
import { Polynomial } from './polynomial';
import { Roots } from './roots';

export interface MagnitudeAsymptote {
  label: string;
  offsetDb: number;
  slope: number;
  cornerFrequency: number | null;
}

export interface PhaseAsymptote {
  label: string;
  offsetDeg: number;
  changeDeg: number;
  cornerFrequency: number | null;
  step?: boolean;
  delay?: number;
}

export const asymptotePhase = (term: PhaseAsymptote, w: number): number => {
  if (term.delay) return -w * term.delay * 180 / Math.PI;
  if (term.cornerFrequency === null) return term.offsetDeg;
  const progress = term.step ? (w < term.cornerFrequency ? 0 : 1)
    : Math.max(0, Math.min(1, (Math.log10(w) - Math.log10(term.cornerFrequency) + 1) / 2));
  return term.offsetDeg + term.changeDeg * progress;
};

export const phaseBreakFrequencies = (term: PhaseAsymptote): number[] => term.cornerFrequency === null ? []
  : term.step ? [term.cornerFrequency] : [term.cornerFrequency / 10, term.cornerFrequency * 10];

export const uniqueFrequencies = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);

export const asymptoteMagnitude = (term: MagnitudeAsymptote, w: number): number =>
  term.offsetDb + term.slope * (term.cornerFrequency === null
    ? Math.log10(w) : Math.max(0, Math.log10(w) - Math.log10(term.cornerFrequency)));

const format = (value: number) => Number(value.toPrecision(4)).toString();

export function magnitudeAsymptotes(numerator: number[], denominator: number[], model?: FrequencyModel) {
  // Open-loop delays have unit magnitude. Closed-loop delays are not rational;
  // use the same Padé model as the pole/zero analysis and label it in the UI.
  const padeApproximation = Boolean(model?.unityFeedback && model.delay);
  const num = Polynomial.clean(model && !model.unityFeedback ? model.numerator : numerator);
  const den = Polynomial.clean(model && !model.unityFeedback ? model.denominator : denominator);
  const terms: MagnitudeAsymptote[] = [];
  const phaseTerms: PhaseAsymptote[] = [];
  if (num.every(value => value === 0)) return { terms, phaseTerms, padeApproximation };
  let gainPhase = num[0] / den[0] < 0 ? -180 : 0;

  const factor = (coefficients: number[], kind: 'zero' | 'pole') => {
    let end = coefficients.length - 1;
    while (end > 0 && coefficients[end] === 0) end--;
    const originCount = coefficients.length - 1 - end;
    const sign = kind === 'zero' ? 1 : -1;
    const label = (count: number) => kind === 'zero'
      ? (count === 1 ? 'Zero' : `${count} zeros`)
      : (count === 1 ? 'Polo' : `${count} polos`);
    if (originCount) terms.push({
      label: `${label(originCount)} na origem`, offsetDb: 0,
      slope: sign * 20 * originCount, cornerFrequency: null,
    });
    if (originCount) phaseTerms.push({ label: `${label(originCount)} na origem`,
      offsetDeg: sign * 90 * originCount, changeDeg: 0, cornerFrequency: null });

    // Strip exact origin roots before solving, including repeated integrators.
    const roots = Roots.findRoots(coefficients.slice(0, end + 1));
    const visited = new Set<number>();
    roots.forEach((root, index) => {
      if (visited.has(index)) return;
      visited.add(index);
      let count = 1;
      if (root.im !== 0) {
        const conjugate = roots.findIndex((other, otherIndex) => !visited.has(otherIndex)
          && Math.hypot(root.re - other.re, root.im + other.im) <= Math.hypot(root.re, root.im) * 1e-5);
        if (conjugate !== -1) { visited.add(conjugate); count = 2; }
      }
      const corner = Math.hypot(root.re, root.im);
      // Right-half-plane factors reverse the phase transition. Real RHP roots
      // also contribute their low-frequency argument to the constant phase.
      if (root.im === 0 && root.re > 0) gainPhase += sign * 180;
      phaseTerms.push({ label: `${label(count)} em ${format(corner)} rad/s${root.re > 0 ? ' (SPD)' : ''}`,
        offsetDeg: 0, changeDeg: sign * (root.re > 0 ? -1 : 1) * 90 * count,
        cornerFrequency: corner, step: root.re === 0 && root.im !== 0 });
    });
    const corners = roots.map(root => Math.hypot(root.re, root.im)).sort((a, b) => a - b);
    for (let i = 0; i < corners.length;) {
      const corner = corners[i];
      let next = i + 1;
      // Conjugate roots and repeated factors share a magnitude contribution.
      while (next < corners.length && Math.abs(corners[next] - corner) <= corner * 1e-6) next++;
      terms.push({
        label: `${label(next - i)} em ${format(corner)} rad/s`, offsetDb: 0,
        slope: sign * 20 * (next - i), cornerFrequency: corner,
      });
      i = next;
    }
    return coefficients[end];
  };

  const numConstant = factor(num, 'zero');
  const denConstant = factor(den, 'pole');
  // The lowest nonzero coefficients give the normalized gain after factoring
  // out origins and writing every other factor with a unit constant term.
  const gainDb = 20 * (Math.log10(Math.abs(numConstant)) - Math.log10(Math.abs(denConstant)));
  terms.unshift({ label: `Ganho: ${format(gainDb)} dB`, offsetDb: gainDb, slope: 0, cornerFrequency: null });
  phaseTerms.unshift({ label: `Fase constante: ${format(gainPhase)}°`, offsetDeg: gainPhase, changeDeg: 0, cornerFrequency: null });
  if (model?.delay && !model.unityFeedback) phaseTerms.push({ label: 'Atraso puro (fase exata)',
    offsetDeg: 0, changeDeg: 0, cornerFrequency: null, delay: model.delay });
  return { terms, phaseTerms, padeApproximation };
}
