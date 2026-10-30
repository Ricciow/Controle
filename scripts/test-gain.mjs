import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const temporary = mkdtempSync(join(process.cwd(), 'node_modules', '.gain-tests-'));
try {
  const build = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'),
    'src/core/gainCalculator.ts', 'src/core/analyzer.ts', '--outDir', temporary,
    '--module', 'commonjs', '--moduleResolution', 'node', '--target', 'ES2020',
    '--strict', '--esModuleInterop', '--skipLibCheck'], { encoding: 'utf8' });
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const { calculateGain, evaluateGain, withCalculatedGain } = require(join(temporary, 'gainCalculator.js'));
  const { Analyzer } = require(join(temporary, 'analyzer.js'));
  const plant = expression => Analyzer.createDefaultFunction('gain', 'G(s)', '#06b6d4', expression);
  const first = plant('1/(s+1)');
  const measured = evaluateGain(first, 1);
  assert.equal(measured.overshoot, 0);
  assert.ok(Math.abs(measured.settlingTime - Math.log(50) / 2) < 0.006);
  const second = evaluateGain(plant('K/(s^2+2s+2)'), 2, 2);
  assert.ok(Math.abs(second.overshoot - 100 * Math.exp(-Math.PI / Math.sqrt(3))) < 0.002);
  assert.equal(evaluateGain(plant('K/(s*(s+1)*(s+2))'), 7), null);
  assert.equal(evaluateGain(plant('K/(s*(s+1)*(s+2))'), 6), null);
  assert.equal(evaluateGain(plant('K*s/(s+1)'), 1), null); // Zero final value.
  assert.equal(evaluateGain(plant('K*s^2/(s+1)'), 1), null); // Improper response.

  const limits = { maxOvershoot: 5, maxSettlingTime: 1, minGain: 0.001, maxGain: 100 };
  const found = await calculateGain(first, limits);
  assert.ok(found && found.overshoot <= 5 && found.settlingTime <= 1);
  const applied = Analyzer.analyzeTransferFunction(withCalculatedGain(first, found.gain));
  assert.equal(applied.error, null);
  assert.equal(applied.unityFeedback, true);
  assert.ok(Math.abs(applied.denominator[1] - (1 + found.gain)) < 1e-9);
  const reapplied = Analyzer.analyzeTransferFunction(withCalculatedGain(applied, found.gain));
  assert.deepEqual(reapplied.numerator, applied.numerator);
  assert.deepEqual(reapplied.denominator, applied.denominator);
  for (const system of [
    { ...first, inputMode: 'coefficients', numStr: '1', denStr: '1, 1', unityFeedback: true },
    { ...first, inputMode: 'roots', polesStr: '-1', zerosStr: '', unityFeedback: true },
    plant('K/(s+1)'),
  ]) {
    const result = await calculateGain(system, limits);
    assert.ok(result && result.settlingTime <= 1);
    const updated = Analyzer.analyzeTransferFunction(withCalculatedGain(system, result.gain));
    assert.ok(Math.abs(updated.numerator[0] - result.gain) < 1e-8);
    assert.ok(Math.abs(updated.denominator[1] - (1 + result.gain)) < 1e-8);
  }
  // Equal initial and final values can still have a transient peak (direct feedthrough).
  const feedthrough = evaluateGain(plant('(s^2+4s+1)/(s^2+1)'), 1, 2);
  assert.ok(feedthrough && Math.abs(feedthrough.overshoot - 200 / Math.E) < 0.01);
  const singularReference = await calculateGain(plant('K/((K-1)*s+1)'), { maxOvershoot: 5, maxSettlingTime: 10, minGain: 2, maxGain: 4 });
  assert.ok(singularReference);
  const nonlinear = plant('K/(s^2+K*s+1)');
  const nonlinearResult = evaluateGain(nonlinear, 2);
  assert.ok(nonlinearResult && nonlinearResult.overshoot > 0);
  assert.deepEqual(Analyzer.analyzeTransferFunction(withCalculatedGain(nonlinear, 2)).denominator, [1, 2, 3]);
  const onlyOvershoot = await calculateGain(first, { maxOvershoot: 0, minGain: 0.1, maxGain: 1 });
  assert.ok(onlyOvershoot && onlyOvershoot.overshoot === 0);
  const onlySettling = await calculateGain(first, { maxSettlingTime: 1, minGain: 0.1, maxGain: 10 });
  assert.ok(onlySettling && onlySettling.settlingTime <= 1);
  assert.equal(await calculateGain(first, { maxSettlingTime: 0.01, minGain: 0.1, maxGain: 1 }), null);
  assert.equal(await calculateGain(plant('K/(s*(s+2)*(s+5))'), { maxOvershoot: 20, maxSettlingTime: 3, minGain: 0.001, maxGain: 1000 }), null);
  for (const requirements of [
    { minGain: 1, maxGain: 2 },
    { maxOvershoot: -1, minGain: 1, maxGain: 2 },
    { maxOvershoot: NaN, minGain: 1, maxGain: 2 },
    { maxSettlingTime: 0, minGain: 1, maxGain: 2 },
    { maxSettlingTime: 1, minGain: 0, maxGain: 2 },
    { maxSettlingTime: 1, minGain: 2, maxGain: 1 },
  ]) await assert.rejects(calculateGain(first, requirements));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(calculateGain(first, limits, controller.signal), { name: 'AbortError' });
  console.log('Gain calculator: analytic responses, feasible and infeasible requirements, single limits, explicit/implicit K, input modes, feedback application, validation and cancellation passed.');
} finally {
  if (!resolve(temporary).startsWith(resolve('node_modules') + sep)) throw new Error('Unsafe temporary directory');
  rmSync(temporary, { recursive: true, force: true });
}
