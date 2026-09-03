import { TransferFunction, SystemAnalysis, SecondOrderParams } from './types';
import { TransferFunctionParser } from './parser';
import { Polynomial } from './polynomial';
import { Roots } from './roots';
import { Simulation } from './simulation';
import { Frequency } from './frequency';

export const Analyzer = {
  analyzeTransferFunction(tf: TransferFunction): TransferFunction {
    try {
      let num: number[] = [];
      let den: number[] = [];

      if (tf.inputMode === 'expression') {
        const parsed = TransferFunctionParser.parseTransferFunction(tf.rawExpression);
        num = parsed.numerator;
        den = parsed.denominator;
      } else {
        num = TransferFunctionParser.parseCoefficientsString(tf.numStr);
        den = TransferFunctionParser.parseCoefficientsString(tf.denStr);
      }

      num = Polynomial.clean(num);
      den = Polynomial.clean(den);

      if (den.length === 1 && den[0] === 0) {
        return {
          ...tf,
          numerator: num,
          denominator: den,
          error: 'O denominador não pode ser zero.'
        };
      }

      // Roots
      const zeros = Roots.findRoots(num);
      const poles = Roots.findRoots(den);

      // LaTeX formatting
      const numLatex = Polynomial.toLaTeX(num);
      const denLatex = Polynomial.toLaTeX(den);
      const latex = `\\frac{${numLatex}}{${denLatex}}`;

      // Factored LaTeX
      const gain = (num[0] || 1) / (den[0] || 1);
      const factoredLatex = Polynomial.toFactoredLaTeX(gain, zeros, poles);

      // Stability
      const stability = Simulation.getStability(poles);

      // Time domain simulation
      const timeSim = Simulation.simulateTimeDomain(num, den, poles);

      // Frequency domain simulation
      const freqSim = Frequency.calculateFrequencyResponse(num, den, poles, zeros);

      // Combined Metrics
      const metrics = {
        ...timeSim.metrics,
        gainMarginDb: freqSim.gainMarginDb,
        phaseMarginDeg: freqSim.phaseMarginDeg,
        gainCrossoverFreq: freqSim.gainCrossoverFreq,
        phaseCrossoverFreq: freqSim.phaseCrossoverFreq,
        bandwidth: freqSim.bandwidth
      };

      const analysis: SystemAnalysis = {
        poles,
        zeros,
        isProper: timeSim.isProper,
        stability,
        stepResponse: timeSim.stepResponse,
        impulseResponse: timeSim.impulseResponse,
        bode: freqSim.bode,
        nyquist: freqSim.nyquist,
        metrics
      };

      return {
        ...tf,
        numerator: num,
        denominator: den,
        numStr: num.join(', '),
        denStr: den.join(', '),
        latex,
        factoredLatex,
        error: null,
        analysis
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao processar função de transferência.';
      return {
        ...tf,
        error: message
      };
    }
  },

  createDefaultFunction(
    id: string,
    name: string,
    color: string,
    rawExpression: string = '25 / (s^2 + 2s + 25)'
  ): TransferFunction {
    const base: TransferFunction = {
      id,
      name,
      color,
      visible: true,
      inputMode: 'expression',
      rawExpression,
      numStr: '25',
      denStr: '1, 2, 25',
      numerator: [25],
      denominator: [1, 2, 25],
      latex: '\\frac{25}{s^2 + 2s + 25}',
      factoredLatex: '\\frac{25}{(s^2 + 2s + 25)}',
      error: null
    };

    return Analyzer.analyzeTransferFunction(base);
  },

  getSecondOrderParams(tf: TransferFunction): SecondOrderParams {
    const den = tf.denominator ? Polynomial.clean(tf.denominator) : [];
    if (den.length !== 3) {
      return { isSecondOrder: false, wn: null, zeta: null, a: null, b: null, c: null };
    }
    let a = den[0];
    let b = den[1];
    let c = den[2];

    if (a < 0 && c < 0) {
      a = -a;
      b = -b;
      c = -c;
    }

    if (a <= 0 || c <= 0) {
      return { isSecondOrder: false, wn: null, zeta: null, a: null, b: null, c: null };
    }

    const wn = Math.sqrt(c / a);
    const zeta = b / (2 * Math.sqrt(a * c));

    return {
      isSecondOrder: true,
      wn,
      zeta,
      a,
      b,
      c
    };
  },

  updateDampingRatio(tf: TransferFunction, newZeta: number): TransferFunction {
    const params = this.getSecondOrderParams(tf);
    if (!params.isSecondOrder || params.a === null || params.c === null || params.wn === null) {
      return tf;
    }
    const { a, c, wn } = params;
    const bRaw = 2 * newZeta * wn * a;
    let bNew = Number(bRaw.toFixed(4));
    if (Math.abs(bNew) < 1e-9) bNew = 0;
    if (Math.abs(bNew - Math.round(bNew)) < 1e-4) bNew = Math.round(bNew);

    const newDen = [a, bNew, c];

    if (tf.inputMode === 'coefficients') {
      return this.analyzeTransferFunction({
        ...tf,
        denStr: `${a}, ${bNew}, ${c}`,
        denominator: newDen
      });
    }

    // Expression mode
    let denExpr = '';
    if (a === 1) denExpr = 's^2';
    else if (a === -1) denExpr = '-s^2';
    else denExpr = `${a}s^2`;

    if (bNew !== 0) {
      const sign = bNew > 0 ? ' + ' : ' - ';
      const absB = Math.abs(bNew);
      const bStr = absB === 1 ? '' : `${absB}`;
      denExpr += `${sign}${bStr}s`;
    }

    if (c !== 0) {
      const sign = c > 0 ? ' + ' : ' - ';
      const absC = Math.abs(c);
      denExpr += `${sign}${absC}`;
    }

    // Extract numerator
    let numPart = '';
    const cleanExpr = (tf.rawExpression || '').trim();
    let depth = 0;
    let mainSlashIndex = -1;
    for (let i = 0; i < cleanExpr.length; i++) {
      const char = cleanExpr[i];
      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (char === '/' && depth === 0) {
        mainSlashIndex = i;
        break;
      }
    }

    if (mainSlashIndex !== -1) {
      numPart = cleanExpr.substring(0, mainSlashIndex).trim();
    } else if (tf.numerator && tf.numerator.length > 0) {
      const cleanNum = Polynomial.clean(tf.numerator);
      numPart = cleanNum.length === 1 ? `${cleanNum[0]}` : cleanNum.join(', ');
    } else {
      numPart = `${c}`;
    }

    const newRawExpression = `${numPart} / (${denExpr})`;
    return this.analyzeTransferFunction({
      ...tf,
      rawExpression: newRawExpression,
      denStr: `${a}, ${bNew}, ${c}`,
      denominator: newDen
    });
  },

  convertToSecondOrder(tf: TransferFunction, targetZeta: number = 0.5, targetWn: number = 5): TransferFunction {
    const wn = targetWn;
    const zeta = targetZeta;
    const a = 1;
    const b = Number((2 * zeta * wn).toFixed(4));
    const c = Number((wn * wn).toFixed(4));
    const denExpr = `s^2 + ${b}s + ${c}`;
    const numPart = `${c}`;
    const newRawExpression = `${numPart} / (${denExpr})`;
    return this.analyzeTransferFunction({
      ...tf,
      rawExpression: newRawExpression,
      denStr: `${a}, ${b}, ${c}`,
      numStr: `${numPart}`,
      numerator: [c],
      denominator: [a, b, c]
    });
  }
};
