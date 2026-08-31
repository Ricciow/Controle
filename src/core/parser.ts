import { Polynomial } from './polynomial';

type TokenType = 'NUMBER' | 'VAR' | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'CARET' | 'LPAREN' | 'RPAREN' | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

class Lexer {
  private input: string;
  private pos: number = 0;

  constructor(input: string) {
    this.input = input;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.input.length) {
      const char = this.input[this.pos];

      if (/\s/.test(char)) {
        this.pos++;
        continue;
      }

      if (char === '+') {
        tokens.push({ type: 'PLUS', value: '+', pos: this.pos++ });
      } else if (char === '-') {
        tokens.push({ type: 'MINUS', value: '-', pos: this.pos++ });
      } else if (char === '*') {
        tokens.push({ type: 'STAR', value: '*', pos: this.pos++ });
      } else if (char === '/') {
        tokens.push({ type: 'SLASH', value: '/', pos: this.pos++ });
      } else if (char === '^') {
        tokens.push({ type: 'CARET', value: '^', pos: this.pos++ });
      } else if (char === '(') {
        tokens.push({ type: 'LPAREN', value: '(', pos: this.pos++ });
      } else if (char === ')') {
        tokens.push({ type: 'RPAREN', value: ')', pos: this.pos++ });
      } else if (char === 's' || char === 'S') {
        tokens.push({ type: 'VAR', value: 's', pos: this.pos++ });
      } else if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(this.input[this.pos + 1] || ''))) {
        let numStr = '';
        const startPos = this.pos;
        while (this.pos < this.input.length && /[0-9.]/.test(this.input[this.pos])) {
          numStr += this.input[this.pos++];
        }
        tokens.push({ type: 'NUMBER', value: numStr, pos: startPos });
      } else {
        throw new Error(`Caractere inválido na expressão: '${char}' na posição ${this.pos + 1}`);
      }
    }

    tokens.push({ type: 'EOF', value: '', pos: this.pos });
    return tokens;
  }
}

class ExpressionParser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.current] || { type: 'EOF', value: '', pos: 0 };
  }

  private match(...types: TokenType[]): boolean {
    const t = this.peek();
    if (types.includes(t.type)) {
      this.current++;
      return true;
    }
    return false;
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private checkImplicitMul(): boolean {
    const prev = this.tokens[this.current - 1];
    const curr = this.tokens[this.current];
    if (!prev || !curr) return false;

    // Implicit multiplication cases:
    // NUMBER VAR (e.g. 2s)
    // NUMBER LPAREN (e.g. 2(s+1))
    // VAR LPAREN (e.g. s(s+1))
    // RPAREN LPAREN (e.g. (s+1)(s+2))
    // RPAREN VAR (e.g. (s+1)s)
    // RPAREN NUMBER (e.g. (s+1)2)
    // VAR VAR (e.g. s s)
    if (
      (prev.type === 'NUMBER' && (curr.type === 'VAR' || curr.type === 'LPAREN')) ||
      (prev.type === 'VAR' && (curr.type === 'VAR' || curr.type === 'LPAREN')) ||
      (prev.type === 'RPAREN' && (curr.type === 'LPAREN' || curr.type === 'VAR' || curr.type === 'NUMBER'))
    ) {
      return true;
    }
    return false;
  }

  public parse(): number[] {
    const poly = this.expression();
    if (this.peek().type !== 'EOF') {
      throw new Error(`Sintaxe inesperada próximo a '${this.peek().value}'`);
    }
    return Polynomial.clean(poly);
  }

  private expression(): number[] {
    let expr = this.term();

    while (this.peek().type === 'PLUS' || this.peek().type === 'MINUS') {
      const op = this.peek().type;
      this.current++;
      const nextTerm = this.term();
      if (op === 'PLUS') {
        expr = Polynomial.add(expr, nextTerm);
      } else {
        expr = Polynomial.sub(expr, nextTerm);
      }
    }

    return expr;
  }

  private term(): number[] {
    let termVal = this.factor();

    while (true) {
      if (this.match('STAR')) {
        const nextFactor = this.factor();
        termVal = Polynomial.mul(termVal, nextFactor);
      } else if (this.match('SLASH')) {
        // Division inside term: check if dividing by constant or polynomial
        const divisor = this.factor();
        const cleanDiv = Polynomial.clean(divisor);
        if (cleanDiv.length === 1 && cleanDiv[0] !== 0) {
          termVal = Polynomial.scale(termVal, 1 / cleanDiv[0]);
        } else {
          throw new Error('Divisão interna por polinômio não constante detectada. Use barra principal para separar numerador e denominador.');
        }
      } else if (this.checkImplicitMul()) {
        const nextFactor = this.factor();
        termVal = Polynomial.mul(termVal, nextFactor);
      } else {
        break;
      }
    }

    return termVal;
  }

  private factor(): number[] {
    let baseVal = this.base();

    if (this.match('CARET')) {
      const expToken = this.peek();
      if (expToken.type === 'NUMBER') {
        this.current++;
        const exp = parseFloat(expToken.value);
        if (!Number.isInteger(exp) || exp < 0) {
          throw new Error(`Expoente deve ser um inteiro não-negativo (recebido: ${expToken.value})`);
        }
        baseVal = Polynomial.pow(baseVal, exp);
      } else {
        throw new Error(`Esperado número após '^', mas encontrado '${expToken.value}'`);
      }
    }

    return baseVal;
  }

  private base(): number[] {
    if (this.match('PLUS')) {
      return this.base();
    }
    if (this.match('MINUS')) {
      return Polynomial.scale(this.base(), -1);
    }

    if (this.match('NUMBER')) {
      const numVal = parseFloat(this.previous().value);
      // Check if this number is followed by slash and number directly (e.g. 1/2s -> 0.5s)
      if (this.peek().type === 'SLASH' && this.tokens[this.current + 1]?.type === 'NUMBER') {
        this.current++; // consume '/'
        const denToken = this.tokens[this.current++];
        const denVal = parseFloat(denToken.value);
        if (denVal === 0) throw new Error('Divisão por zero em fração numérica');
        return [numVal / denVal];
      }
      return [numVal];
    }

    if (this.match('VAR')) {
      // 's' polynomial: 1*s + 0 -> [1, 0]
      return [1, 0];
    }

    if (this.match('LPAREN')) {
      const inside = this.expression();
      if (!this.match('RPAREN')) {
        throw new Error('Parêntese de fechamento \')\' ausente');
      }
      return inside;
    }

    throw new Error(`Elemento inesperado: '${this.peek().value || 'Fim de linha'}'`);
  }
}

export const TransferFunctionParser = {
  parseCoefficientsString(str: string): number[] {
    const trimmed = str.trim();
    if (!trimmed) return [1];

    // Split by comma or space
    const parts = trimmed.split(/[\s,]+/).filter(Boolean);
    const nums = parts.map(p => {
      // Support simple fractions like 1/2 in coefficient mode
      if (p.includes('/')) {
        const [n, d] = p.split('/');
        const num = parseFloat(n);
        const den = parseFloat(d);
        if (isNaN(num) || isNaN(den) || den === 0) {
          throw new Error(`Coeficiente fracionário inválido: ${p}`);
        }
        return num / den;
      }
      const val = parseFloat(p);
      if (isNaN(val)) {
        throw new Error(`Coeficiente inválido: ${p}`);
      }
      return val;
    });

    return Polynomial.clean(nums);
  },

  parsePolynomialExpression(expr: string): number[] {
    const trimmed = expr.trim();
    if (!trimmed) return [0];
    const lexer = new Lexer(trimmed);
    const tokens = lexer.tokenize();
    const parser = new ExpressionParser(tokens);
    return parser.parse();
  },

  parseTransferFunction(input: string): { numerator: number[]; denominator: number[]; isExpression: boolean } {
    const cleanInput = input.trim();
    if (!cleanInput) {
      return { numerator: [1], denominator: [1, 1], isExpression: true };
    }

    // Check if user entered bracket/comma format e.g. "[1, 2] / [1, 2, 10]" or "1, 2 / 1, 2, 10"
    if (/^[0-9\s,.\-\[\]\/]+$/.test(cleanInput) && !/[sS]/.test(cleanInput)) {
      if (cleanInput.includes('/')) {
        const slashIdx = cleanInput.indexOf('/');
        const numPart = cleanInput.slice(0, slashIdx).replace(/[\[\]]/g, '');
        const denPart = cleanInput.slice(slashIdx + 1).replace(/[\[\]]/g, '');
        return {
          numerator: TransferFunctionParser.parseCoefficientsString(numPart),
          denominator: TransferFunctionParser.parseCoefficientsString(denPart),
          isExpression: false
        };
      } else {
        return {
          numerator: TransferFunctionParser.parseCoefficientsString(cleanInput),
          denominator: [1],
          isExpression: false
        };
      }
    }

    // Find main division slash '/' outside balanced parentheses
    let depth = 0;
    let mainSlashIndex = -1;

    for (let i = 0; i < cleanInput.length; i++) {
      const char = cleanInput[i];
      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (char === '/' && depth === 0) {
        mainSlashIndex = i;
        break;
      }
    }

    if (mainSlashIndex !== -1) {
      let numStr = cleanInput.substring(0, mainSlashIndex).trim();
      let denStr = cleanInput.substring(mainSlashIndex + 1).trim();

      // Unwrap outer parentheses if any: e.g. (2s + 5^2) -> 2s + 5^2
      if (numStr.startsWith('(') && numStr.endsWith(')')) {
        // verify balanced
        let d = 0;
        let balanced = true;
        for (let k = 0; k < numStr.length - 1; k++) {
          if (numStr[k] === '(') d++;
          if (numStr[k] === ')') d--;
          if (d === 0) { balanced = false; break; }
        }
        if (balanced) numStr = numStr.slice(1, -1).trim();
      }

      if (denStr.startsWith('(') && denStr.endsWith(')')) {
        let d = 0;
        let balanced = true;
        for (let k = 0; k < denStr.length - 1; k++) {
          if (denStr[k] === '(') d++;
          if (denStr[k] === ')') d--;
          if (d === 0) { balanced = false; break; }
        }
        if (balanced) denStr = denStr.slice(1, -1).trim();
      }

      const num = TransferFunctionParser.parsePolynomialExpression(numStr);
      const den = TransferFunctionParser.parsePolynomialExpression(denStr);

      if (Polynomial.clean(den).length === 1 && Polynomial.clean(den)[0] === 0) {
        throw new Error('O denominador da função de transferência não pode ser nulo (zero).');
      }

      return {
        numerator: num,
        denominator: den,
        isExpression: true
      };
    }

    // No top-level division: expression is numerator with denominator = 1
    let numStr = cleanInput;
    if (numStr.startsWith('(') && numStr.endsWith(')')) {
      let d = 0;
      let balanced = true;
      for (let k = 0; k < numStr.length - 1; k++) {
        if (numStr[k] === '(') d++;
        if (numStr[k] === ')') d--;
        if (d === 0) { balanced = false; break; }
      }
      if (balanced) numStr = numStr.slice(1, -1).trim();
    }

    const num = TransferFunctionParser.parsePolynomialExpression(numStr);
    return {
      numerator: num,
      denominator: [1],
      isExpression: true
    };
  }
};
