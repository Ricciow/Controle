import { FrequencyModel } from './types';
import { Polynomial } from './polynomial';
import { Roots } from './roots';

export interface MagnitudeAsymptote {
  label: string;
  offsetDb: number;
  slope: number;
  cornerFrequency: number | null;
}

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
  if (num.every(value => value === 0)) return { terms, padeApproximation };

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

    // Strip exact origin roots before solving, including repeated integrators.
    const corners = Roots.findRoots(coefficients.slice(0, end + 1))
      .map(root => Math.hypot(root.re, root.im)).sort((a, b) => a - b);
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
  return { terms, padeApproximation };
}
