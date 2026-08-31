import { TransferFunction, SystemAnalysis } from './types';
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
  }
};
