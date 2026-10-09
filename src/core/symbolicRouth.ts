import nerdamer from 'nerdamer';
import 'nerdamer/Algebra';
import { TransferFunction } from './types';
import { TransferFunctionParser } from './parser';

const canonical = (expression: string): string => {
  const symbol = nerdamer.getCore().PARSER.parse(expression);
  let combined: string;
  if (!symbol.isComposite()) combined = nerdamer(`rationalize(${expression})`).toString();
  else {
    // rationalize() combines a sum but drops its outer multiplier and power.
    // Restore both so negative signs and repeated factors survive.
    const multiplier = symbol.multiplier.toString();
    const power = symbol.power.toString();
    const base = symbol.clone();
    base.toUnitMultiplier();
    base.toLinear();
    combined = nerdamer(`(${multiplier})*(rationalize(${base}))^(${power})`).toString();
  }
  const [numerator, denominator] = rationalParts(combined);
  if (nerdamer(numerator).variables().join(',') === 'K' && nerdamer(denominator).variables().join(',') === 'K') {
    const common = nerdamer(`gcd((${numerator}),(${denominator}))`).toString();
    if (common !== '1' && !common.includes('gcd')) {
      return nerdamer(`divide((${numerator}),(${common}))/divide((${denominator}),(${common}))`).toString();
    }
  }
  return combined;
};
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

type RationalExpression = nerdamer.Expression & {
  numerator(): nerdamer.Expression;
  denominator(): nerdamer.Expression;
};
const rationalParts = (source: string) => {
  const expression = nerdamer(source) as RationalExpression;
  return [expression.numerator().toString(), expression.denominator().toString()];
};
const polynomialCoefficients = (source: string, variable: string) =>
  nerdamer(`coeffs((${source}),${variable})`).toString().slice(1, -1).split(',').map(canonical);

export interface GainConditions {
  latex: string;
  intervals: { lower: number; upper: number }[];
  approximate: boolean;
}

// Rational expressions keep the same sign between their zeros and poles.
export function solveGainConditions(positive: string[], nonZero: string[]): GainConditions | null {
  try {
    const boundaries: { value: number; latex: string }[] = [];
    let approximate = false;
    const polynomial = (source: string) => {
      const symbolic = polynomialCoefficients(source, 'K');
      const coefficients = symbolic.map(value => Number(nerdamer(value).evaluate().text('decimals')));
      if (!coefficients.every(Number.isFinite)) throw new Error('Coeficientes não numéricos.');
      const degree = coefficients.length - 1;
      if (degree > 12) throw new Error('Polinômio de K muito extenso.');
      let roots: string[] = [];
      if (degree === 1) roots = [canonical(`-(${symbolic[0]})/(${symbolic[1]})`)];
      else if (degree === 2) {
        const [c, b, a] = symbolic;
        const discriminant = canonical(`(${b})^2-4*(${a})*(${c})`);
        if (Number(nerdamer(discriminant).evaluate().text('decimals')) >= 0) {
          roots = [-1, 1].map(sign => canonical(`(-(${b})+${sign}*sqrt(${discriminant}))/(2*(${a}))`));
        }
      } else if (degree > 2) {
        roots = nerdamer(`roots(${source})`).toString().slice(1, -1).split(',');
        approximate = true;
      }
      for (const root of roots) {
        const evaluated = nerdamer(root).evaluate();
        if (evaluated.isImaginary()) continue;
        const value = Number(evaluated.text('decimals'));
        if (!Number.isFinite(value)) throw new Error('Limite de K não resolvido.');
        const label = degree > 2 ? String(Number(value.toPrecision(8))).replace(/e([+-]?\d+)/i, '*10^($1)') : root;
        boundaries.push({ value, latex: symbolicLatex(label) });
      }
      const scale = Math.max(...coefficients.map(Math.abs)) || 1;
      return (gain: number) => coefficients.reduceRight((value, coefficient) => value * gain + coefficient / scale, 0);
    };
    const tests = positive.map(source => {
      const [numerator, denominator] = rationalParts(canonical(source));
      const num = polynomial(numerator);
      const den = polynomial(denominator);
      return (gain: number) => Math.sign(num(gain)) * Math.sign(den(gain)) > 0;
    });
    for (const source of nonZero) {
      const [numerator, denominator] = rationalParts(canonical(source));
      const num = polynomial(numerator);
      const den = polynomial(denominator);
      tests.push(gain => num(gain) !== 0 && den(gain) !== 0);
    }
    boundaries.sort((a, b) => a.value - b.value);
    const unique = boundaries.filter((boundary, i) => i === 0 || boundary.value !== boundaries[i - 1].value);
    // Distinct roots closer than numerical precision must not hide a narrow interval.
    if (unique.some((boundary, i) => i > 0 && boundary.value - unique[i - 1].value < 1e-10 * Math.max(1, Math.abs(boundary.value)))) {
      throw new Error('Limites de K próximos demais para confirmar o intervalo.');
    }
    const cuts = [-Infinity, ...unique.map(boundary => boundary.value), Infinity];
    const intervals: GainConditions['intervals'] = [];
    const conditions: string[] = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const lower = cuts[i];
      const upper = cuts[i + 1];
      const sample = lower === -Infinity ? upper === Infinity ? 0 : upper - Math.max(1, Math.abs(upper))
        : upper === Infinity ? lower + Math.max(1, Math.abs(lower)) : lower / 2 + upper / 2;
      if (!Number.isFinite(sample)) throw new Error('Intervalo fora da faixa numérica.');
      if (!tests.every(test => test(sample))) continue;
      intervals.push({ lower, upper });
      conditions.push(lower === -Infinity ? upper === Infinity ? 'K \\in \\mathbb{R}' : `K < ${unique[i].latex}`
        : upper === Infinity ? `K > ${unique[i - 1].latex}` : `${unique[i - 1].latex} < K < ${unique[i].latex}`);
    }
    return { latex: conditions.join(' \\quad \\text{ou} \\quad ') || 'K \\in \\varnothing', intervals, approximate };
  } catch {
    // Keep the original inequalities when the engine cannot confirm the solution.
    return null;
  }
}


export interface SymbolicRouthResult {
  characteristic: string;
  rows: { power: number; values: string[]; specialCase?: 'auxiliary' | 'epsilon' }[];
  conditions: string[];
  restrictions: string[];
  notes: string[];
  alwaysNonStable: boolean;
  stabilityCondition: GainConditions | null;
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
  const positiveExpressions = new Set<string>();
  const nonZeroExpressions = new Set<string>([coefficients[0]]);
  // Keep the plant defined, including K-dependent divisors and gains that
  // make every coefficient of its denominator zero.
  for (const source of [numerator, denominator]) {
    const sourceCoefficients = polynomialCoefficients(canonical(source), 's');
    for (const coefficient of sourceCoefficients) nonZeroExpressions.add(rationalParts(coefficient)[1]);
    if (source === denominator) {
      const numerators = sourceCoefficients.map(coefficient => rationalParts(coefficient)[0]).filter(value => value !== '0');
      const common = numerators.some(value => !value.includes('K')) ? '1'
        : numerators.reduce((factor, coefficient) => canonical(`gcd((${factor}),(${coefficient}))`));
      nonZeroExpressions.add(common);
    }
  }
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
      if (divisor.includes('K')) nonZeroExpressions.add(divisor);
      if (divisor.includes('K')) restrictions.add(`${symbolicLatex(divisor)} \\ne 0`);
    }
    if (row.values[0].includes('K')) nonZeroExpressions.add(row.values[0]);
    if (row.values[0].includes('K')) restrictions.add(`${symbolicLatex(row.values[0])} \\ne 0`);
    if (i > 0) {
      const product = canonical(`(${row.values[0]})*(${coefficients[0]})`);
      positiveExpressions.add(product);
      if (product.includes('K') || product.includes('epsilon')) conditions.add(`${symbolicLatex(product)} > 0`);
      else if (Number(nerdamer(product).evaluate().text('decimals')) <= 0) alwaysNonStable = true;
    }
  }
  notes.push('Nos valores de K que anulam um pivô ou mudam o grau, use o modo numérico para tratar o caso especial. A função G(s) também deve estar definida.');
  const stabilityCondition = alwaysNonStable ? null : solveGainConditions([...positiveExpressions], [...nonZeroExpressions]);
  return { characteristic, rows, conditions: [...conditions], restrictions: [...restrictions], notes, alwaysNonStable, stabilityCondition };
}
