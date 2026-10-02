import nerdamer from 'nerdamer';
import 'nerdamer/Algebra';
import { TransferFunction } from './types';
import { TransferFunctionParser } from './parser';

const canonical = (expression: string) => nerdamer(`rationalize(${expression})`).toString();
export const symbolicLatex = (expression: string) => nerdamer(expression).toTeX();

function numericPolynomial(coefficients: number[]): string {
  return coefficients.map((coefficient, i) => {
    const value = String(coefficient).replace(/e([+-]?\d+)/i, '*10^($1)');
    return `(${value})*s^${coefficients.length - i - 1}`;
  }).join('+');
}

function expressionParts(system: TransferFunction): [string, string] {
  if (system.inputMode === 'coefficients') {
    return [numericPolynomial(TransferFunctionParser.parseCoefficientsString(system.numStr)), numericPolynomial(TransferFunctionParser.parseCoefficientsString(system.denStr))];
  }
  const source = system.rawExpression.trim();
  if (!/[kK]/.test(source)) {
    const parsed = TransferFunctionParser.parseTransferFunction(source);
    return [numericPolynomial(parsed.numerator), numericPolynomial(parsed.denominator)];
  }
  // Accept precisely the expression alphabet used by the numeric parser.
  if (!/^[\d\s.sSkK+\-*/^()]+$/.test(source)) throw new Error('Use somente s, K, números e operações polinomiais.');
  let depth = 0;
  let slash = -1;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')') depth--;
    else if (source[i] === '/' && depth === 0) { slash = i; break; }
  }
  const explicit = (expression: string) => expression.replace(/S/g, 's').replace(/k/g, 'K')
    .replace(/(\d|\)|s|K)\s*(?=[sK(])/g, '$1*')
    .replace(/(s|K|\))\s*(?=\d)/g, '$1*');
  return slash < 0 ? [explicit(source), '1'] : [explicit(source.slice(0, slash)), explicit(source.slice(slash + 1))];
}

export interface SymbolicRouthResult {
  characteristic: string;
  rows: { power: number; values: string[]; specialCase?: 'auxiliary' | 'epsilon' }[];
  conditions: string[];
  restrictions: string[];
  notes: string[];
  alwaysNonStable: boolean;
}

export function analyzeSymbolicRouth(system: TransferFunction): SymbolicRouthResult {
  const [numerator, denominator] = expressionParts(system);
  if (canonical(denominator) === '0') throw new Error('O denominador não pode ser zero.');
  const characteristic = canonical(system.unityFeedback ? `(${denominator})+(${numerator})` : denominator);
  if (characteristic === '0') throw new Error('O polinômio característico é identicamente zero.');
  const vector = nerdamer(`coeffs((${characteristic}),s)`).toString();
  const coefficients = vector.slice(1, -1).split(',').map(canonical).reverse();
  const degree = coefficients.length - 1;
  if (degree > 12) throw new Error('O modo simbólico suporta até 12ª ordem. Use o modo numérico para ordens maiores.');
  const columns = Math.ceil(coefficients.length / 2);
  const rows: SymbolicRouthResult['rows'] = [];
  const notes: string[] = [];
  const restrictions = new Set<string>();
  const conditions = new Set<string>();
  let alwaysNonStable = false;
  for (let i = 0; i <= degree; i++) {
    let values = Array<string>(columns).fill('0');
    if (i < 2) {
      values = values.map((_, j) => coefficients[2 * j + i] ?? '0');
    } else {
      const above = rows[i - 2].values;
      const previous = rows[i - 1].values;
      values = values.map((_, j) => canonical(`(${above[j + 1] ?? '0'})-(${above[0]})*(${previous[j + 1] ?? '0'})/(${previous[0]})`));
    }
    const row: SymbolicRouthResult['rows'][number] = { power: degree - i, values };
    if (i > 0 && values.every(value => value === '0')) {
      const auxiliary = rows[i - 1];
      row.values = auxiliary.values.map((value, j) => canonical(`(${value})*${Math.max(0, auxiliary.power - 2 * j)}`));
      row.specialCase = 'auxiliary';
      alwaysNonStable = true;
      notes.push(`Linha s^${row.power} identicamente nula: usada a derivada do polinômio auxiliar.`);
    } else if (values[0] === '0') {
      row.values[0] = 'epsilon';
      row.specialCase = 'epsilon';
      alwaysNonStable = true;
      notes.push(`Pivô identicamente nulo em s^${row.power}: ε → 0⁺. Consulte o modo numérico para a contagem no K escolhido.`);
    }
    if (row.values.some(value => value.length > 20000)) throw new Error('Expressão simbólica muito extensa. Use o modo numérico.');
    rows.push(row);
    for (const entry of row.values) {
      // denominator() is provided by the engine but absent from its .d.ts.
      const expression = nerdamer(entry) as nerdamer.Expression & { denominator(): nerdamer.Expression };
      const divisor = expression.denominator().toString();
      if (divisor.includes('K')) restrictions.add(`${symbolicLatex(divisor)} \\ne 0`);
    }
    if (row.values[0].includes('K')) restrictions.add(`${symbolicLatex(row.values[0])} \\ne 0`);
    if (i > 0) {
      const product = canonical(`(${row.values[0]})*(${coefficients[0]})`);
      if (product.includes('K') || product.includes('epsilon')) conditions.add(`${symbolicLatex(product)} > 0`);
      else if (Number(nerdamer(product).evaluate().text('decimals')) <= 0) alwaysNonStable = true;
    }
  }
  notes.push('Nos valores de K que anulam um pivô ou mudam o grau, use o modo numérico para tratar o caso especial. A função G(s) também deve estar definida.');
  return { characteristic, rows, conditions: [...conditions], restrictions: [...restrictions], notes, alwaysNonStable };
}
