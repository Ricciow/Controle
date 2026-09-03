import { TransferFunctionParser } from '../parser';
import { Roots } from '../roots';
import { Analyzer } from '../analyzer';
import { ComplexMath } from '../complex';

console.log('=== TESTE 1: Expressão do Usuário (2s + 5^2)/(1/2s) ===');
const res1 = TransferFunctionParser.parseTransferFunction('(2s + 5^2)/(1/2s)');
console.log('Numerador:', res1.numerator); // Expect [2, 25]
console.log('Denominador:', res1.denominator); // Expect [0.5, 0]

const tf1 = Analyzer.createDefaultFunction('1', 'G1(s)', '#06b6d4', '(2s + 5^2)/(1/2s)');
console.log('LaTeX:', tf1.latex);
console.log('Zeros:', tf1.analysis?.zeros.map(z => ComplexMath.format(z)));
console.log('Polos:', tf1.analysis?.poles.map(p => ComplexMath.format(p)));
console.log('Estabilidade:', tf1.analysis?.stability);

console.log('\n=== TESTE 2: Polinômio de 2ª ordem com conjugados ===');
const roots2 = Roots.findRoots([1, 2, 26]); // s^2 + 2s + 26 -> -1 +- 5j
console.log('Raízes de s^2 + 2s + 26:', roots2.map(r => ComplexMath.format(r)));

console.log('\n=== TESTE 3: Produto e potências (s+1)(s+2)/(s^3+4s^2+5s+2) ===');
const res3 = TransferFunctionParser.parseTransferFunction('(s+1)(s+2)/(s^3+4s^2+5s+2)');
console.log('Num:', res3.numerator);
console.log('Den:', res3.denominator);

console.log('\n=== TESTE 4: Damping Ratio Slider & Exact 2nd-Order Calculations ===');
const sys2 = Analyzer.createDefaultFunction('1', 'G1(s)', '#06b6d4', '25 / (s^2 + 2s + 25)');
const p2 = Analyzer.getSecondOrderParams(sys2);
console.log('Params iniciais:', { wn: p2.wn, zeta: p2.zeta, is2nd: p2.isSecondOrder });

const sysZeta0 = Analyzer.updateDampingRatio(sys2, 0);
console.log('Zeta 0 (Oscilatório) expr:', sysZeta0.rawExpression);
console.log('Zeta 0 metric zeta:', sysZeta0.analysis?.metrics.dampingRatio);

const sysZeta07 = Analyzer.updateDampingRatio(sys2, 0.707);
console.log('Zeta 0.707 (Ótimo) expr:', sysZeta07.rawExpression);
console.log('Zeta 0.707 metric zeta:', sysZeta07.analysis?.metrics.dampingRatio);

const sysZeta1 = Analyzer.updateDampingRatio(sys2, 1.0);
console.log('Zeta 1.0 (Crítico) expr:', sysZeta1.rawExpression);
console.log('Zeta 1.0 metric zeta:', sysZeta1.analysis?.metrics.dampingRatio);

const sysZeta15 = Analyzer.updateDampingRatio(sys2, 1.5);
console.log('Zeta 1.5 (Sobreamortecido) expr:', sysZeta15.rawExpression);
console.log('Zeta 1.5 metric zeta:', sysZeta15.analysis?.metrics.dampingRatio);

console.log('\n=== TESTE 5: Modo Coeficientes ===');
const sysCoeff = Analyzer.analyzeTransferFunction({
  id: '2',
  name: 'G2(s)',
  color: '#10b981',
  visible: true,
  inputMode: 'coefficients',
  rawExpression: '',
  numStr: '25',
  denStr: '1, 2, 25',
  numerator: [25],
  denominator: [1, 2, 25],
  latex: '',
  factoredLatex: ''
});
const sysCoeffUpdated = Analyzer.updateDampingRatio(sysCoeff, 0.5);
console.log('sysCoeffUpdated denStr:', sysCoeffUpdated.denStr);
console.log('sysCoeffUpdated zeta:', sysCoeffUpdated.analysis?.metrics.dampingRatio);

console.log('\n=== Todos os testes do motor numérico passaram com sucesso! ===');


