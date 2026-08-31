import { Complex, SimulationResult, SystemMetrics, StabilityStatus } from './types';
import { Polynomial } from './polynomial';

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
        const key = Math.round(Math.abs(p.im) * 100) / 100;
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
    poles: Complex[]
  ): {
    stepResponse: SimulationResult;
    impulseResponse: SimulationResult;
    metrics: SystemMetrics;
    isProper: boolean;
  } {
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
      const t = Array.from({ length: 100 }, (_, i) => i * 0.05);
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
    let maxFreq = 1;

    for (const p of poles) {
      const mag = Math.hypot(p.re, p.im);
      if (mag > maxFreq) maxFreq = mag;
      if (p.re < -1e-5) {
        if (minStableRe === 0 || Math.abs(p.re) < minStableRe) {
          minStableRe = Math.abs(p.re);
        }
      }
    }

    const stability = this.getStability(poles);

    if (stability === 'STABLE') {
      const tauDom = minStableRe > 0 ? 1 / minStableRe : 1;
      tFinal = Math.max(1, Math.min(60, 6 * tauDom));
    } else if (stability === 'MARGINALLY_STABLE') {
      const maxIm = Math.max(...poles.map(p => Math.abs(p.im)), 1);
      tFinal = Math.max(2, Math.min(40, (10 * 2 * Math.PI) / maxIm));
    } else {
      // Unstable: simulate until initial growth
      const maxRhp = Math.max(...poles.filter(p => p.re > 0).map(p => p.re), 1);
      tFinal = Math.max(1, Math.min(10, 4 / maxRhp));
    }

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

    // RK4 Simulation
    const numPoints = 400;
    const dt = tFinal / (numPoints - 1);
    const tArr: number[] = [];
    const yStepArr: number[] = [];
    const yImpulseArr: number[] = [];

    // State vectors: x = [x1, ..., xn] where x1 is lowest derivative, xn is highest
    // Controllable canonical form:
    // dx1 = x2, ..., dx_{n-1} = xn
    // dxn = -a0*x1 - a1*x2 - ... - a_{n-1}*xn + u
    let xStep = new Array(n).fill(0);
    
    // For impulse: initial state x(0+) = B = [0, 0, ..., 1]^T
    let xImp = new Array(n).fill(0);
    xImp[n - 1] = 1;

    const fDeriv = (x: number[], u: number): number[] => {
      const dx = new Array(n);
      for (let i = 0; i < n - 1; i++) {
        dx[i] = x[i + 1];
      }
      let sum = 0;
      for (let i = 0; i < n; i++) {
        // aMonic[n - i] is coefficient of s^i
        sum += aMonic[n - i] * x[i];
      }
      dx[n - 1] = -sum + u;
      return dx;
    };

    const computeY = (x: number[], u: number): number => {
      let yVal = D * u;
      for (let i = 0; i < n; i++) {
        // beta[n - 1 - i] corresponds to x_i
        yVal += beta[n - 1 - i] * x[i];
      }
      return yVal;
    };

    for (let step = 0; step < numPoints; step++) {
      const curT = step * dt;
      tArr.push(curT);

      // Output values
      const yS = computeY(xStep, 1);
      const yI = computeY(xImp, 0);

      // Clamp runaway numbers for unstable systems to avoid NaN/Infinity crashes
      yStepArr.push(Math.abs(yS) > 1e7 ? Math.sign(yS) * 1e7 : yS);
      yImpulseArr.push(Math.abs(yI) > 1e7 ? Math.sign(yI) * 1e7 : yI);

      if (step < numPoints - 1) {
        // RK4 for Step
        const k1_s = fDeriv(xStep, 1);
        const xStep_k2 = xStep.map((xi, i) => xi + 0.5 * dt * k1_s[i]);
        const k2_s = fDeriv(xStep_k2, 1);
        const xStep_k3 = xStep.map((xi, i) => xi + 0.5 * dt * k2_s[i]);
        const k3_s = fDeriv(xStep_k3, 1);
        const xStep_k4 = xStep.map((xi, i) => xi + dt * k3_s[i]);
        const k4_s = fDeriv(xStep_k4, 1);

        for (let i = 0; i < n; i++) {
          xStep[i] += (dt / 6) * (k1_s[i] + 2 * k2_s[i] + 2 * k3_s[i] + k4_s[i]);
        }

        // RK4 for Impulse (u=0 for t > 0)
        const k1_i = fDeriv(xImp, 0);
        const xImp_k2 = xImp.map((xi, i) => xi + 0.5 * dt * k1_i[i]);
        const k2_i = fDeriv(xImp_k2, 0);
        const xImp_k3 = xImp.map((xi, i) => xi + 0.5 * dt * k2_i[i]);
        const k3_i = fDeriv(xImp_k3, 0);
        const xImp_k4 = xImp.map((xi, i) => xi + dt * k3_i[i]);
        const k4_i = fDeriv(xImp_k4, 0);

        for (let i = 0; i < n; i++) {
          xImp[i] += (dt / 6) * (k1_i[i] + 2 * k2_i[i] + 2 * k3_i[i] + k4_i[i]);
        }
      }
    }

    const metrics = this.computeMetrics(tArr, yStepArr, stability, num, den, poles);

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

    if (stability !== 'STABLE' || dcGain === null) {
      return {
        ...this.emptyMetrics(),
        dcGain
      };
    }

    const yss = y[y.length - 1]; // or dcGain
    const y0 = y[0];
    const totalChange = yss - y0;

    let riseTime: number | null = null;
    let peakTime: number | null = null;
    let settlingTime: number | null = null;
    let overshootPercent: number | null = null;

    // Peak and Overshoot
    let yPeak = y0;
    let peakIdx = 0;
    for (let i = 0; i < y.length; i++) {
      if (Math.abs(y[i] - y0) > Math.abs(yPeak - y0)) {
        yPeak = y[i];
        peakIdx = i;
      }
    }

    peakTime = t[peakIdx];
    if (Math.abs(yss) > 1e-6) {
      const diff = (yPeak - yss) / Math.abs(yss);
      if (diff > 0.001) {
        overshootPercent = diff * 100;
      } else {
        overshootPercent = 0;
      }
    }

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

    // Settling time (2% band)
    const band = 0.02 * Math.abs(yss);
    for (let i = y.length - 1; i >= 0; i--) {
      if (Math.abs(y[i] - yss) > band) {
        settlingTime = i < y.length - 1 ? t[i + 1] : t[i];
        break;
      }
    }
    if (settlingTime === null && y.length > 0) {
      settlingTime = 0;
    }

    // Dominant second-order pole metrics (wn and zeta)
    let naturalFrequency: number | null = null;
    let dampingRatio: number | null = null;

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
