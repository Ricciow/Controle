import { Complex, SimulationResult, SystemMetrics, StabilityStatus } from './types';
import { Polynomial } from './polynomial';
import { responseDetails } from './timePlot';

// Scaling and squaring avoids integrating from t=0 every time the view moves.
function transitionMatrix(matrix: number[][], time: number): number[][] {
  const n = matrix.length;
  const identity = (): number[][] => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
  const multiply = (a: number[][], b: number[][]) => a.map(row => row.map((_, j) => row.reduce((sum, value, k) => sum + value * b[k][j], 0)));
  const norm = Math.max(...matrix.map(row => row.reduce((sum, value) => sum + Math.abs(value), 0))) * time;
  if (!Number.isFinite(norm)) return matrix.map(row => row.map(() => NaN));
  const squarings = Math.max(0, Math.ceil(Math.log2(norm || 1)));
  const scaled = matrix.map(row => row.map(value => value * (time * 2 ** -squarings)));
  let result = identity();
  let term = identity();
  for (let k = 1; k <= 40; k++) {
    term = multiply(term, scaled).map(row => row.map(value => value / k));
    result = result.map((row, i) => row.map((value, j) => value + term[i][j]));
    if (Math.max(...term.flat().map(Math.abs)) < 1e-16) break;
  }
  for (let i = 0; i < squarings; i++) result = multiply(result, result);
  return result;
}

export const Simulation = {
  getStability(poles: Complex[]): StabilityStatus {
    if (poles.length === 0) return 'STABLE';

    let hasRHP = false;
    let hasImaginary = false;
    const imagMap = new Map<number, number>();

    for (const p of poles) {
      if (p.re > 1e-6) {
        hasRHP = true;
        break;
      }
      if (Math.abs(p.re) <= 1e-6) {
        hasImaginary = true;
        // Conjugate poles +jω and -jω are distinct, not a repeated pole.
        const key = Math.round(p.im * 100) / 100;
        imagMap.set(key, (imagMap.get(key) || 0) + 1);
      }
    }

    if (hasRHP) return 'UNSTABLE';

    // Multiple poles on the imaginary axis -> unstable
    for (const count of imagMap.values()) {
      if (count > 1) return 'UNSTABLE';
    }

    if (hasImaginary) return 'MARGINALLY_STABLE';
    return 'STABLE';
  },

  simulateTimeDomain(
    numerator: number[],
    denominator: number[],
    poles: Complex[],
    endTime?: number,
    startTime = 0,
    sampleCount?: number
  ): {
    stepResponse: SimulationResult;
    impulseResponse: SimulationResult;
    metrics: SystemMetrics;
    isProper: boolean;
  } {
    if (!Number.isFinite(startTime) || startTime < 0 || (endTime !== undefined && (!Number.isFinite(endTime) || endTime <= startTime))) {
      throw new Error('Intervalo de tempo inválido.');
    }
    if (sampleCount !== undefined && (!Number.isInteger(sampleCount) || sampleCount < 2 || sampleCount > 24001)) throw new Error('Quantidade de amostras inválida.');
    const num = Polynomial.clean(numerator);
    const den = Polynomial.clean(denominator);

    const m = num.length - 1;
    const n = den.length - 1;

    if (n < m) {
      // Strictly improper system
      return {
        stepResponse: { t: [0, 1], y: [0, 0] },
        impulseResponse: { t: [0, 1], y: [0, 0] },
        metrics: this.emptyMetrics(),
        isProper: false
      };
    }

    if (n === 0) {
      // Pure gain system: H(s) = K
      const gain = num[0] / den[0];
      const duration = endTime ?? Math.max(4.95, startTime + 1);
      const t = Array.from({ length: 100 }, (_, i) => startTime + i * (duration - startTime) / 99);
      return {
        stepResponse: { t, y: t.map(() => gain) },
        impulseResponse: { t, y: t.map((val) => (val === 0 ? gain * 100 : 0)) },
        metrics: {
          ...this.emptyMetrics(),
          steadyStateValue: gain,
          dcGain: gain,
          settlingTime: 0,
          riseTime: 0,
          overshootPercent: 0
        },
        isProper: true
      };
    }

    // Determine simulation time window T_final
    let tFinal = 5;
    let minStableRe = 0;

    for (const p of poles) {
      if (p.re < 0) {
        if (minStableRe === 0 || Math.abs(p.re) < minStableRe) {
          minStableRe = Math.abs(p.re);
        }
      }
    }

    const stability = this.getStability(poles);

    if (stability === 'STABLE') {
      const tauDom = minStableRe > 0 ? 1 / minStableRe : 1;
      tFinal = 6 * tauDom;
    } else if (stability === 'MARGINALLY_STABLE') {
      const maxIm = Math.max(...poles.map(p => Math.abs(p.im)), 1);
      tFinal = Math.max(2, Math.min(40, (10 * 2 * Math.PI) / maxIm));
    } else {
      // Unstable: simulate until initial growth
      const maxRhp = Math.max(...poles.filter(p => p.re > 0).map(p => p.re), 1);
      tFinal = Math.max(1, Math.min(10, 4 / maxRhp));
    }

    const baseDuration = tFinal;
    if (endTime !== undefined) tFinal = endTime;

    // Normalize denominator to monic
    const aLead = den[0];
    const aMonic = den.map(c => c / aLead);
    const bMonic = new Array(n + 1).fill(0);
    const numOffset = (n + 1) - num.length;
    for (let i = 0; i < num.length; i++) {
      bMonic[numOffset + i] = num[i] / aLead;
    }

    const D = bMonic[0];
    const beta: number[] = [];
    for (let i = 0; i < n; i++) {
      // beta_i corresponds to s^{n-1-i}
      beta[i] = bMonic[i + 1] - D * aMonic[i + 1];
    }

    const duration = tFinal - startTime;
    const numPoints = sampleCount ?? Math.min(6400, Math.max(400, Math.ceil(duration / baseDuration * 399) + 1));
    const sampleDt = duration / (numPoints - 1);
    const tArr: number[] = [];
    const yStepArr: number[] = [];
    const yImpulseArr: number[] = [];

    // State vectors: x = [x1, ..., xn] where x1 is lowest derivative, xn is highest
    // Controllable canonical form:
    // dx1 = x2, ..., dx_{n-1} = xn
    // dxn = -a0*x1 - a1*x2 - ... - a_{n-1}*xn + u
    const stateMatrix = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i < n - 1; i++) stateMatrix[i][i + 1] = 1;
    for (let i = 0; i < n; i++) stateMatrix[n - 1][i] = -aMonic[n - i];
    stateMatrix[n - 1][n] = 1;
    const initial = transitionMatrix(stateMatrix, startTime);
    const advance = transitionMatrix(stateMatrix, sampleDt);
    let xStep = initial.map(row => row[n]);
    let xImp = initial.map(row => row[n - 1]);
    const nextState = (state: number[]) => advance.map(row => row.reduce((sum, value, i) => sum + value * state[i], 0));

    const computeY = (x: number[], u: number): number => {
      let yVal = D * u;
      for (let i = 0; i < n; i++) {
        // beta[n - 1 - i] corresponds to x_i
        yVal += beta[n - 1 - i] * x[i];
      }
      return yVal;
    };

    for (let step = 0; step < numPoints; step++) {
      const curT = step === numPoints - 1 ? tFinal : startTime + step * sampleDt;
      tArr.push(curT);

      // Output values
      const yS = computeY(xStep, 1);
      const yI = computeY(xImp, 0);

      yStepArr.push(Number.isFinite(yS) ? yS : NaN);
      yImpulseArr.push(Number.isFinite(yI) ? yI : NaN);
      xStep = nextState(xStep);
      xImp = nextState(xImp);
    }

    const metrics = startTime === 0 ? this.computeMetrics(tArr, yStepArr, stability, num, den, poles) : this.emptyMetrics();

    return {
      stepResponse: { t: tArr, y: yStepArr },
      impulseResponse: { t: tArr, y: yImpulseArr },
      metrics,
      isProper: true
    };
  },

  computeMetrics(
    t: number[],
    y: number[],
    stability: StabilityStatus,
    num: number[],
    den: number[],
    poles: Complex[]
  ): SystemMetrics {
    const lastNum = num[num.length - 1];
    const lastDen = den[den.length - 1];
    const dcGain = Math.abs(lastDen) > 1e-12 ? lastNum / lastDen : null;

    // Dominant second-order pole metrics (wn and zeta)
    let naturalFrequency: number | null = null;
    let dampingRatio: number | null = null;

    if (den.length === 3 && den[0] > 0 && den[2] > 0) {
      const a = den[0];
      const b = den[1];
      const c = den[2];
      naturalFrequency = Math.sqrt(c / a);
      dampingRatio = b / (2 * Math.sqrt(a * c));
    } else {
      // Find dominant complex pair or slowest pole
      const complexPoles = poles.filter(p => Math.abs(p.im) > 1e-4);
      if (complexPoles.length > 0) {
        // Pick pair closest to imaginary axis (slowest decaying)
        complexPoles.sort((a, b) => b.re - a.re);
        const dom = complexPoles[0];
        const wn = Math.hypot(dom.re, dom.im);
        naturalFrequency = wn;
        dampingRatio = wn > 0 ? -dom.re / wn : 0;
      } else if (poles.length > 0) {
        // Real dominant pole
        const sorted = [...poles].sort((a, b) => b.re - a.re);
        const dom = sorted[0];
        naturalFrequency = Math.abs(dom.re);
        dampingRatio = 1.0;
      }
    }

    if (stability !== 'STABLE' || dcGain === null) {
      return {
        ...this.emptyMetrics(),
        dcGain,
        naturalFrequency: naturalFrequency !== null ? Number(naturalFrequency.toFixed(3)) : null,
        dampingRatio: dampingRatio !== null ? Number(dampingRatio.toFixed(3)) : null
      };
    }

    const yss = dcGain;
    const y0 = y[0];
    const totalChange = yss - y0;

    let riseTime: number | null = null;
    const { peakTime, settlingTime, overshoot: overshootPercent } = responseDetails({ t, y }, yss);

    // Rise time (10% to 90% of steady state)
    if (Math.abs(totalChange) > 1e-6) {
      const y10 = y0 + 0.1 * totalChange;
      const y90 = y0 + 0.9 * totalChange;
      let t10: number | null = null;
      let t90: number | null = null;

      for (let i = 0; i < y.length; i++) {
        if (t10 === null && (totalChange > 0 ? y[i] >= y10 : y[i] <= y10)) {
          t10 = t[i];
        }
        if (t90 === null && (totalChange > 0 ? y[i] >= y90 : y[i] <= y90)) {
          t90 = t[i];
          break;
        }
      }

      if (t10 !== null && t90 !== null) {
        riseTime = t90 - t10;
      }
    }

    return {
      riseTime: riseTime !== null ? Number(riseTime.toFixed(3)) : null,
      peakTime: peakTime !== null ? Number(peakTime.toFixed(3)) : null,
      settlingTime: settlingTime !== null ? Number(settlingTime.toFixed(3)) : null,
      overshootPercent: overshootPercent !== null ? Number(overshootPercent.toFixed(2)) : null,
      steadyStateValue: Number(yss.toFixed(4)),
      dcGain: dcGain !== null ? Number(dcGain.toFixed(4)) : null,
      naturalFrequency: naturalFrequency !== null ? Number(naturalFrequency.toFixed(3)) : null,
      dampingRatio: dampingRatio !== null ? Number(dampingRatio.toFixed(3)) : null,
      gainMarginDb: null,
      phaseMarginDeg: null,
      gainCrossoverFreq: null,
      phaseCrossoverFreq: null,
      bandwidth: null
    };
  },

  emptyMetrics(): SystemMetrics {
    return {
      riseTime: null,
      peakTime: null,
      settlingTime: null,
      overshootPercent: null,
      steadyStateValue: null,
      dcGain: null,
      naturalFrequency: null,
      dampingRatio: null,
      gainMarginDb: null,
      phaseMarginDeg: null,
      gainCrossoverFreq: null,
      phaseCrossoverFreq: null,
      bandwidth: null
    };
  }
};
