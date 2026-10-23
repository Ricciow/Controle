import nerdamer from 'nerdamer';
import { Complex, InputMode, TransferFunction } from './types';
import { TransferFunctionParser } from './parser';
import { Roots } from './roots';
import { numericTransferText } from './transferText';

const numberText = (value: number) => String(value).replace(/e([+-]?\d+)/i, '*10^($1)');

function parseRoots(input: string): Complex[] {
  if (!input.trim()) return [];
  return input.split(/[,;]/).map(entry => {
    const source = entry.trim().replace(/[jJ]/g, 'i');
    if (!source || !/^(?:sqrt|pi|[eEi\d+\-*/^().\s])+$/.test(source)) {
      throw new Error('Informe polos e zeros separados por vírgulas, como 1, 2, -4.');
    }
    const value = nerdamer(source).evaluate();
    const re = Number(nerdamer(`realpart(${value})`).evaluate().text('decimals'));
    const im = Number(nerdamer(`imagpart(${value})`).evaluate().text('decimals'));
    if (value.variables().length || ![re, im].every(Number.isFinite)) throw new Error('Polos e zeros devem ser valores finitos.');
    return { re, im };
  });
}

function rootFactors(input: string): string {
  const roots = parseRoots(input);
  const factors: string[] = [];
  while (roots.length) {
    const root = roots.shift()!;
    if (Math.abs(root.im) <= 1e-10) {
      factors.push(`(s-(${numberText(root.re)}))`);
    } else {
      const conjugate = roots.findIndex(other => Math.hypot(other.re - root.re, other.im + root.im) <= 1e-7 * Math.max(1, Math.hypot(root.re, root.im)));
      if (conjugate < 0) throw new Error('Inclua os pares conjugados, como -1+2j, -1-2j.');
      roots.splice(conjugate, 1);
      factors.push(`(s^2-(${numberText(2 * root.re)})*s+(${numberText(root.re ** 2 + root.im ** 2)}))`);
    }
  }
  return factors.join('*') || '1';
}

export function poleZeroExpression(poles: string, zeros: string): string {
  return `K*(${rootFactors(zeros)})/(${rootFactors(poles)})`;
}

// Read the plant, before feedback, when changing how the same function is edited.
export function changeInputMode(system: TransferFunction, inputMode: InputMode): TransferFunction {
  if (inputMode === system.inputMode) return system;
  const plant = system.inputMode === 'coefficients'
    ? { numerator: TransferFunctionParser.parseCoefficientsString(system.numStr), denominator: TransferFunctionParser.parseCoefficientsString(system.denStr) }
    : TransferFunctionParser.parseTransferFunction(system.rawExpression, system.kValue ?? 1);
  if (inputMode === 'roots') {
    const list = (coefficients: number[]) => Roots.findRoots(coefficients).map(root => {
      const re = Number(root.re.toPrecision(12));
      const im = Number(root.im.toPrecision(12));
      return Math.abs(im) < 1e-10 ? String(re) : `${re}${im < 0 ? '' : '+'}${im}j`;
    }).join(', ');
    const polesStr = list(plant.denominator);
    const zerosStr = list(plant.numerator);
    return { ...system, inputMode, polesStr, zerosStr, kValue: plant.numerator[0] / plant.denominator[0], rawExpression: poleZeroExpression(polesStr, zerosStr) };
  }
  return { ...system, inputMode, numStr: plant.numerator.join(', '), denStr: plant.denominator.join(', '),
    rawExpression: system.inputMode === 'coefficients' ? numericTransferText({ ...system, ...plant }) : system.rawExpression };
}
