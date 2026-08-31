import { Complex } from './types';
import { ComplexMath } from './complex';

export const Polynomial = {
  clean(p: number[], eps: number = 1e-12): number[] {
    let start = 0;
    while (start < p.length - 1 && Math.abs(p[start]) < eps) {
      start++;
    }
    const res = p.slice(start).map(c => (Math.abs(c) < eps ? 0 : c));
    return res.length > 0 ? res : [0];
  },

  add(p1: number[], p2: number[]): number[] {
    const d1 = p1.length;
    const d2 = p2.length;
    const maxDeg = Math.max(d1, d2);
    const result: number[] = new Array(maxDeg).fill(0);

    for (let i = 0; i < maxDeg; i++) {
      const c1 = i < maxDeg - d1 ? 0 : p1[i - (maxDeg - d1)];
      const c2 = i < maxDeg - d2 ? 0 : p2[i - (maxDeg - d2)];
      result[i] = c1 + c2;
    }
    return Polynomial.clean(result);
  },

  sub(p1: number[], p2: number[]): number[] {
    return Polynomial.add(p1, Polynomial.scale(p2, -1));
  },

  scale(p: number[], scalar: number): number[] {
    return Polynomial.clean(p.map(c => c * scalar));
  },

  mul(p1: number[], p2: number[]): number[] {
    const deg = p1.length + p2.length - 1;
    if (deg <= 0) return [0];
    const result = new Array(deg).fill(0);

    for (let i = 0; i < p1.length; i++) {
      for (let j = 0; j < p2.length; j++) {
        result[i + j] += p1[i] * p2[j];
      }
    }
    return Polynomial.clean(result);
  },

  pow(p: number[], exponent: number): number[] {
    if (exponent === 0) return [1];
    if (exponent === 1) return [...p];
    if (exponent < 0 || !Number.isInteger(exponent)) {
      throw new Error(`Expoente polinomial inválido: ${exponent}`);
    }
    let res = [1];
    let base = [...p];
    let exp = exponent;
    while (exp > 0) {
      if (exp % 2 === 1) {
        res = Polynomial.mul(res, base);
      }
      base = Polynomial.mul(base, base);
      exp = Math.floor(exp / 2);
    }
    return res;
  },

  eval(p: number[], s: number): number {
    let val = 0;
    for (let i = 0; i < p.length; i++) {
      val = val * s + p[i];
    }
    return val;
  },

  toLaTeX(p: number[]): string {
    const cleanP = Polynomial.clean(p);
    const n = cleanP.length - 1;

    if (n === 0) {
      const val = Number(cleanP[0].toFixed(4));
      return `${val}`;
    }

    let latex = '';
    for (let i = 0; i <= n; i++) {
      const coeff = cleanP[i];
      if (Math.abs(coeff) < 1e-9) continue;

      const power = n - i;
      const isPositive = coeff > 0;
      const absCoeff = Math.abs(coeff);
      const coeffStr = Number(absCoeff.toFixed(4));

      // Sign
      if (latex === '') {
        if (!isPositive) latex += '-';
      } else {
        latex += isPositive ? ' + ' : ' - ';
      }

      // Term
      if (power === 0) {
        latex += `${coeffStr}`;
      } else if (power === 1) {
        if (coeffStr === 1) {
          latex += 's';
        } else {
          latex += `${coeffStr}s`;
        }
      } else {
        if (coeffStr === 1) {
          latex += `s^{${power}}`;
        } else {
          latex += `${coeffStr}s^{${power}}`;
        }
      }
    }

    return latex || '0';
  },

  toFactoredLaTeX(gain: number, zeros: Complex[], poles: Complex[]): string {
    const formatRootsGroup = (roots: Complex[]): string => {
      if (roots.length === 0) return '';
      const parts: string[] = [];
      const visited = new Array(roots.length).fill(false);

      for (let i = 0; i < roots.length; i++) {
        if (visited[i]) continue;
        const r = roots[i];

        // Complex conjugate pair check
        if (Math.abs(r.im) > 1e-5) {
          let conjugateIdx = -1;
          for (let j = i + 1; j < roots.length; j++) {
            if (!visited[j] && Math.abs(roots[j].re - r.re) < 1e-4 && Math.abs(roots[j].im + r.im) < 1e-4) {
              conjugateIdx = j;
              break;
            }
          }

          if (conjugateIdx !== -1) {
            visited[i] = true;
            visited[conjugateIdx] = true;
            const wnSq = r.re * r.re + r.im * r.im;
            const twoZetaWn = -2 * r.re;
            const p2 = Number(wnSq.toFixed(3));
            const p1 = Number(twoZetaWn.toFixed(3));
            
            let pairStr = `(s^2`;
            if (p1 > 0) pairStr += ` + ${p1 === 1 ? '' : p1}s`;
            else if (p1 < 0) pairStr += ` - ${Math.abs(p1) === 1 ? '' : Math.abs(p1)}s`;
            
            if (p2 > 0) pairStr += ` + ${p2}`;
            else if (p2 < 0) pairStr += ` - ${Math.abs(p2)}`;
            pairStr += `)`;
            parts.push(pairStr);
            continue;
          }
        }

        // Real root (or isolated)
        visited[i] = true;
        const re = Number((-r.re).toFixed(3));
        if (Math.abs(r.re) < 1e-5 && Math.abs(r.im) < 1e-5) {
          parts.push('s');
        } else if (Math.abs(r.im) < 1e-5) {
          if (re > 0) parts.push(`(s + ${re})`);
          else if (re < 0) parts.push(`(s - ${Math.abs(re)})`);
        } else {
          const rootStr = ComplexMath.format(r, 2);
          parts.push(`(s - (${rootStr}))`);
        }
      }

      return parts.join('');
    };

    const numFactors = formatRootsGroup(zeros);
    const denFactors = formatRootsGroup(poles);
    const gainClean = Number(gain.toFixed(4));
    const gainStr = gainClean === 1 && numFactors ? '' : `${gainClean}`;

    const numTop = gainStr ? (numFactors ? `${gainStr}${numFactors}` : `${gainStr}`) : (numFactors || '1');
    const denBottom = denFactors || '1';

    return `\\frac{${numTop}}{${denBottom}}`;
  }
};
