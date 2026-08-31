import { BodeData, Complex, NyquistPoint } from './types';
import { ComplexMath } from './complex';
import { Polynomial } from './polynomial';

export const Frequency = {
  calculateFrequencyResponse(
    numerator: number[],
    denominator: number[],
    poles: Complex[],
    zeros: Complex[]
  ): {
    bode: BodeData;
    nyquist: NyquistPoint[];
    gainMarginDb: number | null;
    phaseMarginDeg: number | null;
    gainCrossoverFreq: number | null;
    phaseCrossoverFreq: number | null;
    bandwidth: number | null;
  } {
    const num = Polynomial.clean(numerator);
    const den = Polynomial.clean(denominator);

    // Determine relevant frequency range
    const allRoots = [...poles, ...zeros];
    let minFreq = 0.1;
    let maxFreq = 100;

    const rootMags = allRoots
      .map(r => Math.hypot(r.re, r.im))
      .filter(m => m > 1e-4);

    if (rootMags.length > 0) {
      const minRoot = Math.min(...rootMags);
      const maxRoot = Math.max(...rootMags);
      minFreq = Math.pow(10, Math.floor(Math.log10(minRoot)) - 1);
      maxFreq = Math.pow(10, Math.ceil(Math.log10(maxRoot)) + 1);
    }

    // Clamp bounds
    minFreq = Math.max(1e-4, minFreq);
    maxFreq = Math.min(1e6, maxFreq);
    if (maxFreq / minFreq < 100) {
      minFreq = minFreq / 10;
      maxFreq = maxFreq * 10;
    }

    const numPoints = 500;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logStep = (logMax - logMin) / (numPoints - 1);

    const wArr: number[] = [];
    const magDbArr: number[] = [];
    const phaseDegArr: number[] = [];
    const nyquistArr: NyquistPoint[] = [];

    const rawPhaseArr: number[] = [];

    for (let i = 0; i < numPoints; i++) {
      const logW = logMin + i * logStep;
      const w = Math.pow(10, logW);
      wArr.push(w);

      const jw: Complex = { re: 0, im: w };
      const numVal = ComplexMath.evalPoly(num, jw);
      const denVal = ComplexMath.evalPoly(den, jw);
      const hJw = ComplexMath.div(numVal, denVal);

      let mag = ComplexMath.mag(hJw);
      if (isNaN(mag) || !isFinite(mag)) {
        mag = 1e-12;
      }
      const magDb = 20 * Math.log10(Math.max(1e-9, mag));
      magDbArr.push(magDb);

      const phase = ComplexMath.phase(hJw);
      rawPhaseArr.push(phase);

      nyquistArr.push({
        re: isFinite(hJw.re) ? hJw.re : 0,
        im: isFinite(hJw.im) ? hJw.im : 0,
        w
      });
    }

    // Phase unwrapping (in radians then convert to degrees)
    let cumulativeOffset = 0;
    for (let i = 0; i < rawPhaseArr.length; i++) {
      if (i > 0) {
        const diff = rawPhaseArr[i] - rawPhaseArr[i - 1];
        if (diff > Math.PI) {
          cumulativeOffset -= 2 * Math.PI;
        } else if (diff < -Math.PI) {
          cumulativeOffset += 2 * Math.PI;
        }
      }
      const unwrappedRad = rawPhaseArr[i] + cumulativeOffset;
      phaseDegArr.push((unwrappedRad * 180) / Math.PI);
    }

    // Calculate Margins: Gain Crossover (where Mag = 0 dB) and Phase Crossover (where Phase = -180 deg)
    let gainCrossoverFreq: number | null = null;
    let phaseMarginDeg: number | null = null;
    let phaseCrossoverFreq: number | null = null;
    let gainMarginDb: number | null = null;

    // Gain crossover: 0 dB crossing
    for (let i = 0; i < numPoints - 1; i++) {
      if ((magDbArr[i] >= 0 && magDbArr[i + 1] <= 0) || (magDbArr[i] <= 0 && magDbArr[i + 1] >= 0)) {
        // Interpolate frequency
        const frac = -magDbArr[i] / (magDbArr[i + 1] - magDbArr[i]);
        gainCrossoverFreq = wArr[i] + frac * (wArr[i + 1] - wArr[i]);
        const phaseAtWg = phaseDegArr[i] + frac * (phaseDegArr[i + 1] - phaseDegArr[i]);
        
        // PM = 180 + phase
        let pm = 180 + (phaseAtWg % 360);
        if (pm > 180) pm -= 360;
        if (pm < -180) pm += 360;
        phaseMarginDeg = pm;
        break;
      }
    }

    // Phase crossover: -180 deg crossing
    for (let i = 0; i < numPoints - 1; i++) {
      const p1 = phaseDegArr[i];
      const p2 = phaseDegArr[i + 1];
      const targetPhase = -180;

      if ((p1 >= targetPhase && p2 <= targetPhase) || (p1 <= targetPhase && p2 >= targetPhase)) {
        const frac = (targetPhase - p1) / (p2 - p1);
        phaseCrossoverFreq = wArr[i] + frac * (wArr[i + 1] - wArr[i]);
        const magAtWp = magDbArr[i] + frac * (magDbArr[i + 1] - magDbArr[i]);
        gainMarginDb = -magAtWp;
        break;
      }
    }

    // Bandwidth (-3 dB relative to low frequency magnitude)
    let bandwidth: number | null = null;
    const lowFreqMag = magDbArr[0];
    for (let i = 0; i < numPoints; i++) {
      if (magDbArr[i] <= lowFreqMag - 3) {
        bandwidth = wArr[i];
        break;
      }
    }

    return {
      bode: {
        w: wArr,
        magDb: magDbArr,
        phaseDeg: phaseDegArr
      },
      nyquist: nyquistArr,
      gainMarginDb: gainMarginDb !== null ? Number(gainMarginDb.toFixed(2)) : null,
      phaseMarginDeg: phaseMarginDeg !== null ? Number(phaseMarginDeg.toFixed(2)) : null,
      gainCrossoverFreq: gainCrossoverFreq !== null ? Number(gainCrossoverFreq.toFixed(3)) : null,
      phaseCrossoverFreq: phaseCrossoverFreq !== null ? Number(phaseCrossoverFreq.toFixed(3)) : null,
      bandwidth: bandwidth !== null ? Number(bandwidth.toFixed(3)) : null
    };
  }
};
