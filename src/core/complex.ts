import { Complex } from './types';

export const ComplexMath = {
  create(re: number = 0, im: number = 0): Complex {
    return { re, im };
  },

  add(a: Complex, b: Complex): Complex {
    return { re: a.re + b.re, im: a.im + b.im };
  },

  sub(a: Complex, b: Complex): Complex {
    return { re: a.re - b.re, im: a.im - b.im };
  },

  mul(a: Complex, b: Complex): Complex {
    return {
      re: a.re * b.re - a.im * b.im,
      im: a.re * b.im + a.im * b.re
    };
  },

  div(a: Complex, b: Complex): Complex {
    const denom = b.re * b.re + b.im * b.im;
    if (denom === 0) {
      return { re: NaN, im: NaN };
    }
    return {
      re: (a.re * b.re + a.im * b.im) / denom,
      im: (a.im * b.re - a.re * b.im) / denom
    };
  },

  scale(a: Complex, k: number): Complex {
    return { re: a.re * k, im: a.im * k };
  },

  neg(a: Complex): Complex {
    return { re: -a.re, im: -a.im };
  },

  conj(a: Complex): Complex {
    return { re: a.re, im: -a.im };
  },

  mag(a: Complex): number {
    return Math.hypot(a.re, a.im);
  },

  magSq(a: Complex): number {
    return a.re * a.re + a.im * a.im;
  },

  phase(a: Complex): number {
    return Math.atan2(a.im, a.re);
  },

  phaseDeg(a: Complex): number {
    return (Math.atan2(a.im, a.re) * 180) / Math.PI;
  },

  evalPoly(coeffs: number[], s: Complex): Complex {
    // Horner's method for complex polynomial evaluation: c_n*s^n + ... + c_0
    let res: Complex = { re: 0, im: 0 };
    for (let i = 0; i < coeffs.length; i++) {
      res = ComplexMath.add(ComplexMath.mul(res, s), { re: coeffs[i], im: 0 });
    }
    return res;
  },

  format(c: Complex, digits: number = 3): string {
    const reFixed = Math.abs(c.re) < 1e-10 ? 0 : Number(c.re.toFixed(digits));
    const imFixed = Math.abs(c.im) < 1e-10 ? 0 : Number(c.im.toFixed(digits));

    if (imFixed === 0) return `${reFixed}`;
    if (reFixed === 0) {
      if (imFixed === 1) return 'j';
      if (imFixed === -1) return '-j';
      return `${imFixed}j`;
    }
    const sign = imFixed > 0 ? '+' : '-';
    const imAbs = Math.abs(imFixed);
    const imStr = imAbs === 1 ? 'j' : `${imAbs}j`;
    return `${reFixed} ${sign} ${imStr}`;
  }
};
