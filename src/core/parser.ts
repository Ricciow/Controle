import { Polynomial } from './polynomial';
import { FrequencyModel } from './types';

type TokenType = 'NUMBER' | 'PARAM' | 'VAR' | '+' | '-' | '*' | '/' | '^' | '(' | ')' | 'EOF';
interface Token { type: TokenType; value: string }
interface Value { numerator: number[]; denominator: number[]; delay: number }
export interface ParsedTransferFunction {
  numerator: number[];
  denominator: number[];
  isExpression: boolean;
  frequencyModel?: FrequencyModel;
}

// Commas denote decimals in expressions and separators in coefficient lists.
export function normalizeExpression(input: string): string {
  const stack: string[] = [];
  for (const char of input) {
    if (char === '(' || char === '[') stack.push(char);
    else if (char === ')' || char === ']') {
      if (stack.pop() !== (char === ')' ? '(' : '[')) throw new Error('Parênteses ou colchetes incompatíveis.');
    }
  }
  if (stack.length) throw new Error('Parêntese ou colchete de fechamento ausente.');
  return input.replace(/\[/g, '(').replace(/\]/g, ')').replace(/,/g, '.');
}

function tokenize(input: string, kValue: number): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  while (pos < input.length) {
    const char = input[pos];
    if (/\s/.test(char)) { pos++; continue; }
    if ('+-*/^()'.includes(char)) { tokens.push({ type: char as TokenType, value: char }); pos++; }
    else if (/[sS]/.test(char)) { tokens.push({ type: 'VAR', value: 's' }); pos++; }
    else if (/[kK]/.test(char)) { tokens.push({ type: 'PARAM', value: String(kValue) }); pos++; }
    else if (char === 'e' || char === 'E') { tokens.push({ type: 'NUMBER', value: String(Math.E) }); pos++; }
    else {
      const number = input.slice(pos).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if (!number) throw new Error(`Caractere inválido na expressão: '${char}' na posição ${pos + 1}`);
      if (input[pos + number[0].length] === '.') throw new Error('Número com mais de um separador decimal.');
      tokens.push({ type: 'NUMBER', value: number[0] });
      pos += number[0].length;
    }
  }
  tokens.push({ type: 'EOF', value: '' });
  return tokens;
}
const constant = (value: number): Value => ({ numerator: [value], denominator: [1], delay: 0 });
const isZero = (polynomial: number[]) => polynomial.every(value => value === 0);
const scalar = (value: Value): number | null => value.delay === 0 && value.numerator.length === 1 && value.denominator.length === 1
  ? value.numerator[0] / value.denominator[0] : null;
function multiply(left: Value, right: Value, divide = false): Value {
  if (divide && isZero(right.numerator)) throw new Error('Divisão por zero.');
  const result = {
    numerator: Polynomial.mul(left.numerator, divide ? right.denominator : right.numerator),
    denominator: Polynomial.mul(left.denominator, divide ? right.numerator : right.denominator),
    delay: left.delay + (divide ? -right.delay : right.delay),
  };
  if (result.denominator.length === 1) {
    result.numerator = Polynomial.scale(result.numerator, 1 / result.denominator[0]);
    result.denominator = [1];
  }
  return result;
}
class ExpressionParser {
  private current = 0;
  constructor(private tokens: Token[]) {}
  private peek(): Token { return this.tokens[this.current]; }
  private match(type: TokenType): boolean {
    if (this.peek().type !== type) return false;
    this.current++;
    return true;
  }
  parse(): Value {
    const value = this.expression();
    if (this.peek().type !== 'EOF') throw new Error(`Sintaxe inesperada próximo a '${this.peek().value}'`);
    if (![...value.numerator, ...value.denominator, value.delay].every(Number.isFinite)) throw new Error('Expressão fora da faixa numérica.');
    return value;
  }
  private expression(): Value {
    let value = this.term();
    while (this.peek().type === '+' || this.peek().type === '-') {
      const sign = this.tokens[this.current++].type === '+' ? 1 : -1;
      const right = this.term();
      if (Math.abs(value.delay - right.delay) > 1e-12 && !isZero(value.numerator) && !isZero(right.numerator)) {
        throw new Error('Fatore o atraso exponencial fora da soma, como 20^(-0,2s)*(s+1).');
      }
      const numerator = Polynomial.add(Polynomial.mul(value.numerator, right.denominator),
        Polynomial.scale(Polynomial.mul(right.numerator, value.denominator), sign));
      value = { numerator, denominator: Polynomial.mul(value.denominator, right.denominator),
        delay: isZero(value.numerator) ? right.delay : value.delay };
    }
    return value;
  }
  private term(): Value {
    let value = this.unary();
    while (true) {
      if (this.match('*')) value = multiply(value, this.unary());
      else if (this.match('/')) value = multiply(value, this.unary(), true);
      else if (['NUMBER', 'PARAM', 'VAR', '('].includes(this.peek().type)) value = multiply(value, this.unary());
      else break;
    }
    return value;
  }
  private unary(): Value {
    if (this.match('+')) return this.unary();
    if (this.match('-')) { const value = this.unary(); return { ...value, numerator: Polynomial.scale(value.numerator, -1) }; }
    return this.power();
  }
  private power(): Value {
    const base = this.base();
    if (!this.match('^')) return base;
    const exponent = this.unary();
    const exp = scalar(exponent);
    const number = scalar(base);
    if (number !== null && exp !== null) {
      const result = number ** exp;
      if (!Number.isFinite(result)) throw new Error('Potência deve produzir um número real e finito.');
      return constant(result);
    }
    if (number !== null && number > 0 && exponent.delay === 0 && exponent.denominator.length === 1 && exponent.numerator.length <= 2) {
      const coefficients = Polynomial.scale(exponent.numerator, 1 / exponent.denominator[0]);
      return { numerator: [number ** coefficients[coefficients.length - 1]], denominator: [1],
        delay: coefficients.length === 2 ? -Math.log(number) * coefficients[0] : 0 };
    }
    if (exp === null || !Number.isInteger(exp) || Math.abs(exp) > 100) {
      throw new Error('Use expoente inteiro de -100 a 100 para polinômios, ou base positiva com expoente linear em s.');
    }
    if (exp < 0 && isZero(base.numerator)) throw new Error('Divisão por zero.');
    return {
      numerator: Polynomial.pow(exp < 0 ? base.denominator : base.numerator, Math.abs(exp)),
      denominator: Polynomial.pow(exp < 0 ? base.numerator : base.denominator, Math.abs(exp)),
      delay: base.delay * exp,
    };
  }
  private base(): Value {
    const token = this.peek();
    if (this.match('NUMBER') || this.match('PARAM')) return constant(Number(token.value));
    if (this.match('VAR')) return { numerator: [1, 0], denominator: [1], delay: 0 };
    if (this.match('(')) {
      const value = this.expression();
      if (!this.match(')')) throw new Error('Parêntese de fechamento ausente.');
      return value;
    }
    throw new Error(`Elemento inesperado: '${token.value || 'Fim de linha'}'`);
  }
}
function parseExpression(input: string, kValue: number): Value {
  if (!Number.isFinite(kValue)) throw new Error('K deve ser um número real e finito.');
  const value = new ExpressionParser(tokenize(normalizeExpression(input), kValue)).parse();
  if (isZero(value.denominator)) throw new Error('O denominador não pode ser zero.');
  if (value.denominator.length === 1) {
    value.numerator = Polynomial.scale(value.numerator, 1 / value.denominator[0]);
    value.denominator = [1];
  }
  return value;
}
export const TransferFunctionParser = {
  parseCoefficientsString(str: string): number[] {
    const trimmed = str.trim().replace(/^\[([\s\S]*)\]$/, '$1').trim();
    if (!trimmed) return [1];
    const nums = trimmed.split(/[\s,]+/).filter(Boolean).map(part => {
      const fraction = part.split('/');
      const values = fraction.map(value => Number(value));
      if (fraction.length > 2 || fraction.some(value => !value) || !values.every(Number.isFinite) || values[1] === 0) {
        throw new Error(`Coeficiente inválido: ${part}`);
      }
      return values[0] / (values[1] ?? 1);
    });
    return Polynomial.clean(nums);
  },
  parsePolynomialExpression(expr: string, kValue = 1): number[] {
    if (!expr.trim()) return [0];
    const value = parseExpression(expr, kValue);
    if (value.delay !== 0 || value.denominator.length !== 1) throw new Error('Esperado um polinômio.');
    return value.numerator;
  },
  parseTransferFunction(input: string, kValue = 1): ParsedTransferFunction {
    if (!Number.isFinite(kValue)) throw new Error('K deve ser um número real e finito.');
    const source = input.trim();
    if (!source) return { numerator: [1], denominator: [1, 1], isExpression: true };
    if (/^[0-9\s,.\-+\[\]\/]+$/.test(source)) {
      const parts = source.split('/');
      if (parts.length > 2) throw new Error('Use uma barra para separar as listas de coeficientes.');
      const numerator = this.parseCoefficientsString(parts[0]);
      const denominator = parts.length === 2 ? this.parseCoefficientsString(parts[1]) : [1];
      if (isZero(denominator)) throw new Error('O denominador não pode ser zero.');
      return { numerator, denominator, isExpression: false };
    }
    const normalized = normalizeExpression(source);
    let depth = 0;
    let slash = -1;
    for (let i = 0; i < normalized.length; i++) {
      if (normalized[i] === '(') depth++;
      else if (normalized[i] === ')') depth--;
      else if (normalized[i] === '/' && depth === 0) { slash = i; break; }
    }
    // Preserve the existing convention: a main slash separates the complete
    // numerator and denominator, even if their outer grouping is omitted.
    const value = parseExpression(slash < 0 ? normalized : `(${normalized.slice(0, slash)})/(${normalized.slice(slash + 1)})`, kValue);
    if (value.delay < -1e-12) throw new Error('O atraso total deve ser não negativo (use expoente negativo em s).');
    if (Math.abs(value.delay) < 1e-12 || isZero(value.numerator)) return { numerator: value.numerator, denominator: value.denominator, isExpression: true };
    const frequencyModel: FrequencyModel = { numerator: value.numerator, denominator: value.denominator, delay: value.delay };
    // Padé [4/4] for tools requiring polynomials. Frequency uses the exact delay.
    const coefficients = [1];
    for (let k = 1; k <= 4; k++) coefficients.push(coefficients[k - 1] * (5 - k) * value.delay / (k * (9 - k)));
    const padeDen = coefficients.slice().reverse();
    const padeNum = coefficients.map((value, k) => k % 2 ? -value : value).reverse();
    const scale = 1 / padeDen[0];
    const numerator = Polynomial.mul(value.numerator, padeNum.map(value => value * scale));
    const denominator = Polynomial.mul(value.denominator, padeDen.map(value => value * scale));
    if (![...numerator, ...denominator].every(Number.isFinite)) throw new Error('Atraso fora da faixa numérica da aproximação.');
    return { numerator, denominator, isExpression: true, frequencyModel };
  },
};
