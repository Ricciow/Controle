import { BodeData, Complex, FrequencyModel, NyquistPoint } from './types';
import { ComplexMath } from './complex';
import { Polynomial } from './polynomial';
import { Roots } from './roots';

interface Sample { w: number; mag: number; phase: number; value: Complex; feedbackPhase: number }
interface Margin { value: number; w: number }

// Refine crossings in log frequency using the actual transfer function.
function crossing(left: Sample, right: Sample, target: number, field: 'mag' | 'phase', evaluate: (w: number) => Sample): Sample {
  if (Math.abs(left[field] - target) < 1e-10) return left;
  if (Math.abs(right[field] - target) < 1e-10) return right;
  for (let i = 0; i < 45; i++) {
    const middle = evaluate(Math.sqrt(left.w * right.w));
    if (!Number.isFinite(middle[field])) break;
    if (Math.abs(middle[field] - target) < 1e-10) return middle;
    if ((left[field] - target) * (middle[field] - target) <= 0) right = middle;
    else left = middle;
  }
  return evaluate(Math.sqrt(left.w * right.w));
}
const straddles = (a: number, b: number, target: number) => Number.isFinite(a) && Number.isFinite(b)
  && a !== b && (a - target) * (b - target) <= 0;
const critical = (margins: Margin[]): Margin | undefined => margins.reduce<Margin | undefined>((best, margin) =>
  !best || Math.abs(margin.value) < Math.abs(best.value) - 1e-8 ? margin : best, undefined);
const phaseMargin = (phase: number) => {
  let margin = 180 + phase % 360;
  if (margin > 180) margin -= 360;
  if (margin < -180) margin += 360;
  return margin;
};

export const Frequency = {
  calculateFrequencyResponse(
    numerator: number[], denominator: number[], poles: Complex[], zeros: Complex[],
    frequencyRange?: [number, number], model?: FrequencyModel,
  ): {
    bode: BodeData; nyquist: NyquistPoint[];
    gainMarginDb: number | null; phaseMarginDeg: number | null;
    gainCrossoverFreq: number | null; phaseCrossoverFreq: number | null; bandwidth: number | null;
  } {
    const num = Polynomial.clean(model?.numerator ?? numerator);
    const den = Polynomial.clean(model?.denominator ?? denominator);
    const rationalPoles = model ? Roots.findRoots(den) : poles;
    const rationalZeros = model ? Roots.findRoots(num) : zeros;
    const delay = model?.delay ?? 0;
    const evaluate = (w: number): Sample => {
      const jw = { re: 0, im: w };
      const rational = ComplexMath.div(ComplexMath.evalPoly(num, jw), ComplexMath.evalPoly(den, jw));
      const open = ComplexMath.mul(rational, { re: Math.cos(w * delay), im: -Math.sin(w * delay) });
      const value = model?.unityFeedback ? ComplexMath.div(open, { re: 1 + open.re, im: open.im }) : open;
      const magnitude = ComplexMath.mag(model?.unityFeedback ? value : rational);
      const expected = (num[0] / den[0] < 0 ? -Math.PI : 0)
        + rationalZeros.reduce((sum, root) => sum + Math.atan2(w - root.im, -root.re), 0)
        - rationalPoles.reduce((sum, root) => sum + Math.atan2(w - root.im, -root.re), 0);
      const raw = ComplexMath.phase(rational);
      let phase = raw + 2 * Math.PI * Math.round((expected - raw) / (2 * Math.PI)) - w * delay;
      const feedbackPhase = model?.unityFeedback ? Math.atan2(open.im, 1 + open.re) * 180 / Math.PI : 0;
      return { w, value, mag: magnitude > 0 && Number.isFinite(magnitude) ? 20 * Math.log10(magnitude) : NaN,
        phase: magnitude > 0 ? phase * 180 / Math.PI - feedbackPhase : NaN, feedbackPhase };
    };
    const rootMags = [...rationalPoles, ...rationalZeros].map(root => Math.hypot(root.re, root.im)).filter(value => value > 0 && Number.isFinite(value));
    const minRoot = rootMags.length ? Math.min(...rootMags) : 1;
    const maxRoot = rootMags.length ? Math.max(...rootMags) : 1;
    // Search independently of the viewport, including gains far from root scales.
    const degreeDifference = num.length - den.length;
    const gainScale = degreeDifference ? Math.abs(num[0] / den[0]) ** (-1 / degreeDifference) : 1;
    const scales = [minRoot, maxRoot, gainScale, ...(delay ? [1 / delay] : [])].filter(value => value > 0 && Number.isFinite(value));
    const searchMin = Math.max(-14, Math.min(-6, Math.floor(Math.log10(Math.min(...scales))) - 4));
    const searchMax = Math.min(14, Math.max(6, Math.ceil(Math.log10(Math.max(...scales))) + 4));
    const count = Math.ceil((searchMax - searchMin) * 160);
    const frequencies = Array.from({ length: count + 1 }, (_, i) => 10 ** (searchMin + i * (searchMax - searchMin) / count));
    // Include resonances narrower than the logarithmic grid spacing.
    for (const root of [...rationalPoles, ...rationalZeros]) {
      if (root.im !== 0) frequencies.push(Math.abs(root.im));
    }
    const samples = [...new Set(frequencies)].filter(w => w >= 1e-14 && w <= 1e14).sort((a, b) => a - b).map(evaluate);
    const phaseMargins: Margin[] = [];
    const gainMargins: Margin[] = [];
    const extrema: Sample[] = [];
    for (let i = 1; i < samples.length - 1; i++) {
      const a = samples[i - 1], b = samples[i], c = samples[i + 1];
      if (![a.mag, b.mag, c.mag].every(Number.isFinite)) continue;
      const maximum = b.mag > a.mag + 1e-10 && b.mag > c.mag + 1e-10;
      const minimum = b.mag < a.mag - 1e-10 && b.mag < c.mag - 1e-10;
      if ((!maximum && !minimum) || a.mag * c.mag <= 0) continue;
      let low = Math.log(a.w), high = Math.log(c.w);
      for (let j = 0; j < 45; j++) {
        const left = low + (high - low) / 3, right = high - (high - low) / 3;
        const difference = evaluate(Math.exp(left)).mag - evaluate(Math.exp(right)).mag;
        if (maximum ? difference > 0 : difference < 0) high = right;
        else low = left;
      }
      const point = evaluate(Math.exp((low + high) / 2));
      extrema.push(point);
      if (Math.abs(point.mag) < 1e-8) phaseMargins.push({ value: phaseMargin(point.phase), w: point.w });
    }
    samples.push(...extrema);
    samples.sort((a, b) => a.w - b.w);
    for (let i = 0; i < samples.length - 1; i++) {
      const left = samples[i], right = samples[i + 1];
      if (straddles(left.mag, right.mag, 0)) {
        const point = crossing(left, right, 0, 'mag', evaluate);
        phaseMargins.push({ value: phaseMargin(point.phase), w: point.w });
      }
      if (![left.phase, right.phase].every(Number.isFinite)) continue;
      const low = Math.min(left.phase, right.phase), high = Math.max(left.phase, right.phase);
      const first = Math.ceil((low + 180) / 360), last = Math.floor((high + 180) / 360);
      // Delays can span many turns in one interval. Keep the endpoints and the
      // turn nearest unity gain, which matters for the critical gain margin.
      const fraction = left.mag === right.mag ? 0.5 : Math.max(0, Math.min(1, -left.mag / (right.mag - left.mag)));
      const nearUnity = Math.round((left.phase + fraction * (right.phase - left.phase) + 180) / 360);
      const targets = new Set(first <= last ? [first, last, Math.max(first, Math.min(last, nearUnity))] : []);
      for (const turn of targets) {
        const target = -180 + turn * 360;
        if (!straddles(left.phase, right.phase, target)) continue;
        const point = crossing(left, right, target, 'phase', evaluate);
        // A feedback denominator may wrap its argument on the positive real
        // axis. Only actual negative-real crossings define a gain margin.
        if (Number.isFinite(point.mag) && point.value.re < 0 && Math.abs(point.value.im) <= 1e-6 * ComplexMath.mag(point.value)) {
          gainMargins.push({ value: -point.mag, w: point.w });
        }
      }
    }
    // A curve lying on the negative real axis is already at phase crossover.
    if (!gainMargins.length && samples.every(point => Number.isFinite(point.phase) && Math.abs(phaseMargin(point.phase)) < 1e-8)) {
      const point = phaseMargins.length ? evaluate(critical(phaseMargins)!.w)
        : samples.reduce((best, point) => Math.abs(point.mag) < Math.abs(best.mag) ? point : best);
      if (Number.isFinite(point.mag)) gainMargins.push({ value: -point.mag, w: point.w });
    }
    // A unit-magnitude delay meets every gain crossover; use the phase
    // crossover as the critical point instead of dividing by a flat slope.
    if (gainMargins.length && samples.every(point => Math.abs(point.mag) < 1e-9)) {
      phaseMargins.push({ value: 0, w: critical(gainMargins)!.w });
    }
    const pm = critical(phaseMargins), gm = critical(gainMargins);
    let minFreq = 10 ** (Math.floor(Math.log10(minRoot)) - 1);
    let maxFreq = 10 ** (Math.ceil(Math.log10(maxRoot)) + 1);
    if (delay) { minFreq = Math.min(minFreq, 0.1 / delay); maxFreq = Math.max(maxFreq, 10 / delay); }
    for (const margin of [pm, gm]) {
      if (margin) { minFreq = Math.min(minFreq, margin.w / 10); maxFreq = Math.max(maxFreq, margin.w * 10); }
    }
    minFreq = Math.max(1e-14, minFreq);
    maxFreq = Math.min(1e14, maxFreq);
    if (frequencyRange) {
      [minFreq, maxFreq] = frequencyRange;
      if (![minFreq, maxFreq].every(Number.isFinite) || minFreq <= 0 || maxFreq <= minFreq) throw new Error('Faixa de frequência inválida.');
    }
    const numPoints = Math.min(6400, Math.max(500, Math.ceil((Math.log10(maxFreq) - Math.log10(minFreq)) * 120) + 1,
      model?.unityFeedback ? Math.ceil(maxFreq * delay * 16 / Math.PI) : 0));
    const plot = Array.from({ length: numPoints }, (_, i) => evaluate(10 ** (Math.log10(minFreq) + i * Math.log10(maxFreq / minFreq) / (numPoints - 1))));
    // Anchor feedback phase to the same search reference when panning/zooming.
    let feedbackOffset = 0;
    let lastFeedbackPhase = samples[0].feedbackPhase;
    for (const point of samples) {
      if (point.w > minFreq) break;
      const diff = point.feedbackPhase - lastFeedbackPhase;
      if (diff > 180) feedbackOffset -= 360;
      if (diff < -180) feedbackOffset += 360;
      lastFeedbackPhase = point.feedbackPhase;
    }
    if (plot[0].feedbackPhase - lastFeedbackPhase > 180) feedbackOffset -= 360;
    if (plot[0].feedbackPhase - lastFeedbackPhase < -180) feedbackOffset += 360;
    const phaseDeg = plot.map((point, i) => {
      if (i > 0) {
        const diff = point.feedbackPhase - plot[i - 1].feedbackPhase;
        if (diff > 180) feedbackOffset -= 360;
        if (diff < -180) feedbackOffset += 360;
      }
      return point.phase - feedbackOffset;
    });
    let bandwidth: number | null = null;
    for (let i = 1; i < plot.length; i++) {
      if (straddles(plot[i - 1].mag, plot[i].mag, plot[0].mag - 3) && plot[i].mag < plot[i - 1].mag) {
        bandwidth = crossing(plot[i - 1], plot[i], plot[0].mag - 3, 'mag', evaluate).w;
        break;
      }
    }
    return {
      bode: { w: plot.map(point => point.w), magDb: plot.map(point => point.mag), phaseDeg },
      nyquist: plot.map(point => ({ ...point.value, w: point.w })),
      gainMarginDb: gm?.value ?? (num.some(value => value !== 0) ? Infinity : null),
      phaseMarginDeg: pm?.value ?? null,
      gainCrossoverFreq: pm?.w ?? null,
      phaseCrossoverFreq: gm?.w ?? null,
      bandwidth,
    };
  },
};
