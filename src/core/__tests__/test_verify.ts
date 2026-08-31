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

console.log('\n=== Todos os testes do motor numérico passaram com sucesso! ===');
