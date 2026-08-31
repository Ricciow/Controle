import { Complex } from './types';
import { ComplexMath } from './complex';
import { Polynomial } from './polynomial';

export const Roots = {
  findRoots(coeffs: number[]): Complex[] {
    const p = Polynomial.clean(coeffs);
    const n = p.length - 1;

    if (n <= 0) {
      return [];
    }

    // Degree 1: a*s + b = 0 -> s = -b/a
    if (n === 1) {
      return [{ re: -p[1] / p[0], im: 0 }];
    }

    // Degree 2: a*s^2 + b*s + c = 0
    if (n === 2) {
      const a = p[0];
      const b = p[1];
      const c = p[2];
      const disc = b * b - 4 * a * c;

      if (Math.abs(disc) < 1e-12) {
        const r = -b / (2 * a);
        return [
          { re: r, im: 0 },
          { re: r, im: 0 }
        ];
      } else if (disc > 0) {
        const sqrtDisc = Math.sqrt(disc);
        // Numerically stable quadratic formula
        const q = -0.5 * (b + Math.sign(b || 1) * sqrtDisc);
        return [
          { re: q / a, im: 0 },
          { re: c / q, im: 0 }
        ].sort((r1, r2) => r1.re - r2.re);
      } else {
        const re = -b / (2 * a);
        const im = Math.sqrt(-disc) / (2 * a);
        return [
          { re, im: Math.abs(im) },
          { re, im: -Math.abs(im) }
        ];
      }
    }

    // Degree >= 3: Durand-Kerner (Weierstrass) method with Aberth acceleration
    // Make monic: s^n + a_{n-1} s^{n-1} + ... + a_0
    const lead = p[0];
    const monic = p.map(c => c / lead);

    // Initial root estimates distributed on a Cauchy / Fujiwara bound radius circle
    const maxCoeff = Math.max(...monic.slice(1).map(c => Math.abs(c)));
    const radius = 1 + maxCoeff;
    const roots: Complex[] = [];

    const angleOffset = Math.PI / (2 * n);
    for (let k = 0; k < n; k++) {
      const theta = (2 * Math.PI * k) / n + angleOffset;
      // Slight radius perturbation to break symmetry
      const r = radius * Math.pow(0.8, k / n);
      roots.push({
        re: r * Math.cos(theta),
        im: r * Math.sin(theta)
      });
    }

    const maxIterations = 200;
    const tolerance = 1e-12;

    for (let iter = 0; iter < maxIterations; iter++) {
      let maxDelta = 0;

      for (let i = 0; i < n; i++) {
        const zi = roots[i];
        // Evaluate P(zi)
        const pVal = ComplexMath.evalPoly(monic, zi);

        // Denominator product \prod_{j \neq i} (zi - zj)
        let prod: Complex = { re: 1, im: 0 };
        for (let j = 0; j < n; j++) {
          if (j !== i) {
            const diff = ComplexMath.sub(zi, roots[j]);
            prod = ComplexMath.mul(prod, diff);
          }
        }

        const delta = ComplexMath.div(pVal, prod);
        if (!isNaN(delta.re) && !isNaN(delta.im)) {
          roots[i] = ComplexMath.sub(zi, delta);
          const dMag = ComplexMath.mag(delta);
          if (dMag > maxDelta) {
            maxDelta = dMag;
          }
        }
      }

      if (maxDelta < tolerance) {
        break;
      }
    }

    // Polish roots: if imaginary part is negligible (< 1e-6 relative to magnitude), snap to 0
    // If complex conjugate pairs exist, snap their real and imaginary parts to be exactly symmetric
    for (let i = 0; i < roots.length; i++) {
      const mag = ComplexMath.mag(roots[i]);
      const threshold = Math.max(1e-7, mag * 1e-6);
      if (Math.abs(roots[i].im) < threshold) {
        roots[i].im = 0;
      }
    }

    // Match conjugates
    for (let i = 0; i < roots.length; i++) {
      if (Math.abs(roots[i].im) > 1e-6) {
        for (let j = i + 1; j < roots.length; j++) {
          if (
            Math.abs(roots[i].re - roots[j].re) < 1e-4 &&
            Math.abs(roots[i].im + roots[j].im) < 1e-4
          ) {
            const avgRe = (roots[i].re + roots[j].re) / 2;
            const avgIm = (Math.abs(roots[i].im) + Math.abs(roots[j].im)) / 2;
            roots[i].re = avgRe;
            roots[j].re = avgRe;
            roots[i].im = avgIm;
            roots[j].im = -avgIm;
            break;
          }
        }
      }
    }

    // Sort roots for consistent display: real part ascending (most stable first), then imaginary part
    roots.sort((a, b) => {
      if (Math.abs(a.re - b.re) > 1e-5) return a.re - b.re;
      return a.im - b.im;
    });

    return roots;
  }
};
