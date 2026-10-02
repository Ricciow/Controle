import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const buildDirectory = mkdtempSync(join(process.cwd(), 'node_modules', '.routh-tests-'));
try {
  const compilation = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'),
    'src/core/routh.ts', 'src/core/analyzer.ts', 'src/core/symbolicRouth.ts', '--outDir', buildDirectory, '--esModuleInterop',
    '--module', 'commonjs', '--moduleResolution', 'node', '--target', 'ES2020', '--strict', '--skipLibCheck',
  ], { encoding: 'utf8' });
  assert.equal(compilation.status, 0, compilation.stdout + compilation.stderr);
  const { analyzeRouth } = require(join(buildDirectory, 'routh.js'));
  const { Analyzer } = require(join(buildDirectory, 'analyzer.js'));
  const { TransferFunctionParser: parser } = require(join(buildDirectory, 'parser.js'));
  const { analyzeSymbolicRouth } = require(join(buildDirectory, 'symbolicRouth.js'));
  const nerdamer = require('nerdamer');
  require('nerdamer/Algebra');
  const cases = [
    [[1, 2, 25], 0, 'STABLE'],
    [[1, 6, 11, 6], 0, 'STABLE'],
    [[1, 2, 3, 10], 2, 'UNSTABLE'],
    [[1, -2, 1], 2, 'UNSTABLE'],
    [[1, 2, -3], 1, 'UNSTABLE'],
    [[1, 0, 1], 0, 'BOUNDARY'],
    [[1, 0, -1], 1, 'UNSTABLE'],
    [[1, 2, 5, 10], 0, 'BOUNDARY'],
    [[1, 0, 2, 0, 1], 0, 'BOUNDARY'],
    [[1, 0, 0], 0, 'BOUNDARY'],
    [[1, 1, 0], 0, 'BOUNDARY'],
    [[1, -1, 0], 1, 'UNSTABLE'],
    [[1, 2, 2, 4, 1], 2, 'UNSTABLE'],
    [[1, 0, -2, 0, 1], 2, 'UNSTABLE'],
    [[5], 0, 'STABLE'],
    [[0, 0, 1, 2, 25], 0, 'STABLE'],
    [[1, 1e-15, 1], 0, 'STABLE'],
  ];
  for (const [denominator, changes, status] of cases) {
    for (const scale of [1, -1, 1e-20, 1e20]) {
      const result = analyzeRouth(denominator.map(value => value * scale));
      assert.equal(result.signChanges, changes, `Sign changes for ${denominator}, scale ${scale}`);
      assert.equal(result.status, status, `Status for ${denominator}, scale ${scale}`);
      assert.ok(result.rows.every(row => row.values.every(Number.isFinite)));
    }
  }
  assert.deepEqual(analyzeRouth([1, 2, 3, 10]).rows.map(row => row.values), [[1, 3], [2, 10], [-2, 0], [10, 0]]);
  assert.equal(analyzeRouth([1, 2, 2, 4, 1]).rows[2].specialCase, 'epsilon');
  assert.equal(analyzeRouth([1, 2, 5, 10]).rows[2].specialCase, 'auxiliary');
  for (const invalid of [[], [0], [0, 0], [1, NaN], [1, Infinity]]) assert.throws(() => analyzeRouth(invalid));

  const system = Analyzer.createDefaultFunction('test', 'G(s)', '#06b6d4');
  assert.equal(analyzeRouth(system.denominator).status, 'STABLE');
  assert.equal(analyzeRouth(Analyzer.updateDampingRatio(system, 0).denominator).status, 'BOUNDARY');
  assert.equal(analyzeRouth(Analyzer.updateDampingRatio(system, -0.2).denominator).signChanges, 2);
  const coefficientsSystem = Analyzer.analyzeTransferFunction({ ...system, inputMode: 'coefficients', numStr: '1', denStr: '1, 2, 3, 10' });
  assert.equal(analyzeRouth(coefficientsSystem.denominator).signChanges, 2);
  for (const [kValue, status, changes] of [[0, 'BOUNDARY', 0], [1, 'STABLE', 0], [6, 'BOUNDARY', 0], [10, 'UNSTABLE', 2], [-1, 'UNSTABLE', 1]]) {
    const withK = Analyzer.analyzeTransferFunction({ ...system, rawExpression: 'K / (s^3 + 2s^2 + 3s + K)', kValue });
    assert.equal(withK.error, null);
    assert.deepEqual(withK.numerator, [kValue]);
    assert.deepEqual(withK.denominator, [1, 2, 3, kValue]);
    assert.equal(analyzeRouth(withK.denominator).status, status);
    assert.equal(analyzeRouth(withK.denominator).signChanges, changes);
  }
  assert.deepEqual(parser.parseTransferFunction('2Ks / (s^2 + Ks + k^2)', -2).denominator, [1, -2, 4]);
  assert.deepEqual(parser.parseTransferFunction('2Ks / (s^2 + Ks + k^2)', -2).numerator, [-4, 0]);
  assert.ok(Analyzer.analyzeTransferFunction({ ...system, rawExpression: '1 / K', kValue: 0 }).error);
  assert.deepEqual(parser.parseTransferFunction('K').numerator, [1]);
  assert.throws(() => parser.parseTransferFunction('K', Infinity));

  const plant = Analyzer.createDefaultFunction('feedback', 'G(s)', '#06b6d4', 'K / (s*(s+1)*(s+2))');
  const closed = Analyzer.analyzeTransferFunction({ ...plant, unityFeedback: true, kValue: 3 });
  assert.deepEqual(closed.denominator, [1, 3, 2, 3]);
  assert.deepEqual(closed.numerator, [3]);
  assert.equal(closed.denStr, '1, 3, 2, 0');
  assert.deepEqual(Analyzer.analyzeTransferFunction(closed).denominator, closed.denominator);
  assert.deepEqual(Analyzer.analyzeTransferFunction({ ...closed, inputMode: 'coefficients' }).denominator, closed.denominator);
  assert.deepEqual(Analyzer.analyzeTransferFunction({ ...closed, unityFeedback: false }).denominator, [1, 3, 2, 0]);
  const constant = Analyzer.createDefaultFunction('constant', 'G(s)', '#fff', '2');
  const constantClosed = Analyzer.analyzeTransferFunction({ ...constant, unityFeedback: true });
  assert.equal(constantClosed.analysis.metrics.dcGain, 2 / 3);
  assert.ok(Analyzer.analyzeTransferFunction({ ...constant, rawExpression: '-1', unityFeedback: true }).error);

  const symbolic = analyzeSymbolicRouth(closed);
  assert.equal(symbolic.rows.length, 4);
  assert.ok(symbolic.rows[2].values[0].includes('K'));
  assert.equal(symbolic.conditions.length, 2);
  assert.equal(symbolic.alwaysNonStable, false);
  assert.equal(Analyzer.analyzeTransferFunction({ ...closed, kValue: 6 }).analysis.stability, 'MARGINALLY_STABLE');
  const { Simulation } = require(join(buildDirectory, 'simulation.js'));
  assert.equal(Simulation.getStability([{ re: 0, im: 1 }, { re: 0, im: -1 }]), 'MARGINALLY_STABLE');
  assert.equal(Simulation.getStability([{ re: 0, im: 1 }, { re: 0, im: 1 }]), 'UNSTABLE');
  assert.equal(Analyzer.analyzeTransferFunction({ ...closed, inputMode: 'coefficients', denStr: '0' }).analysis, undefined);
  const parameterSystems = [
    closed,
    { ...plant, rawExpression: 'K/(s^3+2s^2+3s+K)', unityFeedback: false },
    { ...plant, rawExpression: '(2Ks+K^2)/(s^3+4s^2+5s+2)', unityFeedback: true },
    { ...plant, rawExpression: '1/(K*s^2+2s+1)', unityFeedback: false },
    { ...plant, rawExpression: '1/(s^2+Ks+1)', unityFeedback: false },
    { ...plant, rawExpression: '1/(s^2+2s+1/K)', unityFeedback: false },
  ];
  for (const parameterSystem of parameterSystems) {
    const symbolicResult = analyzeSymbolicRouth(parameterSystem);
    for (const kValue of [-2, -1, 1, 3, 5, 10]) {
      const numeric = Analyzer.analyzeTransferFunction({ ...parameterSystem, kValue });
      assert.equal(numeric.error, null);
      const numericResult = analyzeRouth(numeric.denominator);
      assert.equal(symbolicResult.rows.length, numericResult.rows.length);
      for (let i = 0; i < symbolicResult.rows.length; i++) {
        for (let j = 0; j < symbolicResult.rows[i].values.length; j++) {
          const calculated = Number(nerdamer(symbolicResult.rows[i].values[j], { K: String(kValue) }).evaluate().text('decimals'));
          const expected = numericResult.rows[i].values[j];
          assert.ok(Math.abs(calculated - expected) < 1e-6 * Math.max(1, Math.abs(expected)), `Symbolic row ${i}, column ${j}, K=${kValue}: ${calculated} != ${expected}`);
        }
      }
    }
  }
  assert.equal(analyzeSymbolicRouth({ ...plant, rawExpression: '1/(s^2+1)' }).rows[1].specialCase, 'auxiliary');
  assert.equal(analyzeSymbolicRouth({ ...plant, rawExpression: '1/(s^2+1)' }).alwaysNonStable, true);
  assert.equal(analyzeSymbolicRouth({ ...closed, inputMode: 'coefficients' }).rows.length, 4);
  assert.throws(() => analyzeSymbolicRouth({ ...plant, rawExpression: 'K/(s+invalid)' }));
  console.log(`${cases.length * 4} polynomial cases, symbolic/numeric comparisons at 36 parameter settings, K and unity feedback passed.`);
} finally {
  rmSync(buildDirectory, { recursive: true, force: true });
}
