import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const temporary = mkdtempSync(join(process.cwd(), 'node_modules', '.frequency-tests-'));
const close = (actual, expected, tolerance = 1e-6) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
try {
  const build = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'),
    'src/core/analyzer.ts', 'src/core/transferText.ts', 'src/core/symbolicRouth.ts', '--outDir', temporary,
    '--module', 'commonjs', '--moduleResolution', 'node', '--target', 'ES2020',
    '--strict', '--esModuleInterop', '--skipLibCheck'], { encoding: 'utf8' });
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const { TransferFunctionParser: parser } = require(join(temporary, 'parser.js'));
  const { Analyzer } = require(join(temporary, 'analyzer.js'));
  const { Frequency } = require(join(temporary, 'frequency.js'));
  const { Roots } = require(join(temporary, 'roots.js'));
  const { numericTransferText } = require(join(temporary, 'transferText.js'));
  const { changeInputMode } = require(join(temporary, 'poleZeroInput.js'));
  const { symbolicTransferExpression } = require(join(temporary, 'symbolicRouth.js'));
  const plant = expression => Analyzer.createDefaultFunction('test', 'G(s)', '#06b6d4', expression);
  const response = expression => {
    const parsed = parser.parseTransferFunction(expression);
    return Frequency.calculateFrequencyResponse(parsed.numerator, parsed.denominator,
      Roots.findRoots(parsed.denominator), Roots.findRoots(parsed.numerator), undefined, parsed.frequencyModel);
  };
  assert.deepEqual(parser.parseTransferFunction('[2s+5^2]/[1/2s]').numerator, [2, 25]);
  assert.deepEqual(parser.parseTransferFunction('[2s+5^2]/[1/2s]').denominator, [0.5, 0]);
  assert.deepEqual(parser.parseTransferFunction('1/s^2+2s+1').denominator, [1, 2, 1]);
  assert.deepEqual(parser.parseTransferFunction('[[s+1][s+2]]/[s^2+3s+4]').numerator, [1, 3, 2]);
  assert.deepEqual(parser.parseTransferFunction('[1, 2]/[1, 3, 2]').denominator, [1, 3, 2]);
  assert.deepEqual(parser.parseTransferFunction('[1, 2]').numerator, [1, 2]);
  assert.deepEqual(parser.parseTransferFunction('1/[0,2s+1]').denominator, [0.2, 1]);
  assert.deepEqual(parser.parsePolynomialExpression('s^(2)-2^(-2)'), [1, 0, -0.25]);
  close(parser.parseTransferFunction('e').numerator[0], Math.E);
  close(parser.parseTransferFunction('2e').numerator[0], 2 * Math.E);
  close(parser.parseTransferFunction('e^2').numerator[0], Math.E ** 2);
  close(parser.parseTransferFunction('1e-3*s').numerator[0], 0.001);
  for (const invalid of ['1/[s+1)', '1/[s+1', '1/(s+1]]', '1..2s', '1/[0]', 's^(0,5)', '0^(-1)', '(-2)^(0,5)', 'e^(s^2)', 'e^(0,2s)', 'e^(-s)+1']) {
    assert.throws(() => parser.parseTransferFunction(invalid), undefined, invalid);
  }
  for (const expression of ['20^(-0,2s)', '20^[-0.2s]', 'e^(-0,2s)', 'E^[-0,2S]', '[e^(-0,1s)]^2']) {
    const parsed = parser.parseTransferFunction(expression);
    const delay = expression.startsWith('20') ? 0.2 * Math.log(20) : 0.2;
    close(parsed.frequencyModel.delay, delay);
    close(parsed.frequencyModel.numerator[0], 1);
    const exact = response(expression);
    const index = exact.bode.w.findIndex(w => w >= 10);
    close(exact.bode.magDb[index], 0);
    close(exact.bode.phaseDeg[index], -delay * exact.bode.w[index] * 180 / Math.PI);
    close(exact.gainMarginDb, 0);
    close(exact.phaseMarginDeg, 0);
    close(exact.phaseCrossoverFreq, Math.PI / delay);
  }
  const first = response('10/[s+1]');
  close(first.gainCrossoverFreq, Math.sqrt(99));
  close(first.phaseMarginDeg, 180 - Math.atan(Math.sqrt(99)) * 180 / Math.PI);
  assert.equal(first.gainMarginDb, Infinity);
  const belowUnity = response('0.5/[s+1]');
  assert.equal(belowUnity.phaseMarginDeg, null);
  assert.equal(belowUnity.gainCrossoverFreq, null);
  assert.equal(belowUnity.gainMarginDb, Infinity);
  const cubic = response('1/[s*(s+1)*(s+2)]');
  close(cubic.gainMarginDb, 20 * Math.log10(6));
  close(cubic.phaseCrossoverFreq, Math.sqrt(2));
  const unstable = response('10/[s*(s+1)*(s+2)]');
  close(unstable.gainMarginDb, 20 * Math.log10(0.6));
  assert.ok(unstable.phaseMarginDeg < 0);
  close(response('100000000/s').gainCrossoverFreq, 1e8);
  const multi = response('0.5/[s^2+0.1s+1]');
  const upper = Math.sqrt((1.99 + Math.sqrt(1.99 ** 2 - 3)) / 2);
  close(multi.gainCrossoverFreq, upper);
  close(multi.phaseMarginDeg, 180 - Math.atan2(0.1 * upper, 1 - upper ** 2) * 180 / Math.PI);
  const tangent = response(`${0.5 * Math.sqrt(1 - 0.25 ** 2)}/[s^2+0.5s+1]`);
  close(tangent.gainCrossoverFreq, Math.sqrt(0.875));
  const narrow = response('0.000001/[s^2+0.00000001s+1]');
  assert.ok(narrow.gainCrossoverFreq > 1 && narrow.phaseMarginDeg > 0 && narrow.phaseMarginDeg < 1);
  const highOrder = Frequency.calculateFrequencyResponse([1000], [1, 8, 28, 56, 70, 56, 28, 8, 1], Array.from({ length: 8 }, () => ({ re: -1, im: 0 })), []);
  const w540 = Math.tan(3 * Math.PI / 8);
  close(highOrder.phaseCrossoverFreq, w540);
  close(highOrder.gainMarginDb, 20 * Math.log10((1 + w540 ** 2) ** 4 / 1000));
  const flatPhase = response('1/s^2');
  close(flatPhase.gainMarginDb, 0);
  close(flatPhase.phaseMarginDeg, 0);
  const zero = response('0/[s+1]');
  assert.equal(zero.gainMarginDb, null);
  assert.equal(zero.phaseMarginDeg, null);
  assert.ok(!zero.bode.phaseDeg.some(Number.isFinite));
  // Exact delay: unchanged magnitude, analytically reduced phase margin.
  const delayed = plant('10*e^(-0,2s)/[s+1]');
  assert.equal(delayed.error, null);
  const metrics = delayed.analysis.metrics;
  close(metrics.gainCrossoverFreq, Math.sqrt(99));
  close(metrics.phaseMarginDeg, first.phaseMarginDeg - 0.2 * Math.sqrt(99) * 180 / Math.PI);
  const parsedDelay = parser.parseTransferFunction(delayed.rawExpression);
  const zoom = Frequency.calculateFrequencyResponse(delayed.numerator, delayed.denominator, delayed.analysis.poles, delayed.analysis.zeros, [1e4, 1e6], delayed.frequencyModel);
  close(zoom.phaseMarginDeg, metrics.phaseMarginDeg);
  close(zoom.gainMarginDb, metrics.gainMarginDb);
  close(zoom.bode.phaseDeg[0], -(Math.atan(1e4) + 0.2 * 1e4) * 180 / Math.PI);
  close(parser.parseTransferFunction(numericTransferText(delayed)).frequencyModel.delay, 0.2);
  assert.throws(() => changeInputMode(delayed, 'coefficients'), /preservar o atraso/);
  const closed = Analyzer.analyzeTransferFunction({ ...delayed, unityFeedback: true });
  assert.equal(closed.error, null);
  const at = closed.analysis.bode.w.findIndex(w => w >= 1);
  const w = closed.analysis.bode.w[at];
  const openRe = 10 * (Math.cos(0.2 * w) - w * Math.sin(0.2 * w)) / (1 + w ** 2);
  const openIm = -10 * (w * Math.cos(0.2 * w) + Math.sin(0.2 * w)) / (1 + w ** 2);
  close(closed.analysis.bode.magDb[at], 20 * Math.log10(Math.hypot(openRe, openIm) / Math.hypot(1 + openRe, openIm)));
  for (let i = 1; i < closed.analysis.bode.phaseDeg.length; i++) {
    assert.ok(Math.abs(closed.analysis.bode.phaseDeg[i] - closed.analysis.bode.phaseDeg[i - 1]) < 90, 'Feedback phase must unwrap continuously');
  }
  const edited = Analyzer.analyzeTransferFunction({ ...delayed, rawExpression: '10/[s+1]' });
  assert.equal(edited.frequencyModel, undefined);
  assert.ok(symbolicTransferExpression({ ...plant('K/[s^2+0,2s+1]'), kValue: 2 }).text.includes('K'));
  const reparsed = parser.parseTransferFunction(parsedDelay.numerator.join(',') + '/' + parsedDelay.denominator.join(','));
  assert.equal(reparsed.frequencyModel, undefined);
  // Render the actual Bode component without a browser or a dev server.
  const uiDirectory = join(temporary, 'ui');
  const uiBuild = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'),
    'src/components/BodePlot.tsx', '--outDir', uiDirectory, '--jsx', 'react-jsx',
    '--module', 'commonjs', '--moduleResolution', 'node', '--target', 'ES2020',
    '--strict', '--esModuleInterop', '--skipLibCheck'], { encoding: 'utf8' });
  assert.equal(uiBuild.status, 0, uiBuild.stdout + uiBuild.stderr);
  const { BodePlot } = require(join(uiDirectory, 'components', 'BodePlot.js'));
  const { createElement } = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const cubicSystem = { ...plant('1/[s*(s+1)*(s+2)]'), id: 'cubic', name: 'Sistema cúbico' };
  const firstSystem = { ...plant('10/[s+1]'), id: 'first', name: 'Primeira ordem' };
  const html = renderToStaticMarkup(createElement(BodePlot, { systems: [cubicSystem, firstSystem,
    { ...cubicSystem, id: 'hidden', name: 'Sistema oculto', visible: false }] }));
  for (const text of ['Margem de fase (MF)', 'Margem de ganho (MG)', '15.56 dB', '∞ dB', 'ωgc', 'ωpc', 'Sistema cúbico', 'Primeira ordem']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('Sistema oculto') && !html.includes('NaN') && !html.includes('Infinity'));
  console.log('Frequency/parser: analytic margins, multiple crossovers, infinite/negative margins, zoom independence, Euler, exact delays, brackets, decimal commas, feedback and input validation passed.');
} finally {
  if (!resolve(temporary).startsWith(resolve('node_modules') + sep)) throw new Error('Unsafe temporary directory');
  rmSync(temporary, { recursive: true, force: true });
}
