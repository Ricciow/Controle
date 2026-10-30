import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const temporary = mkdtempSync(join(process.cwd(),'node_modules','.design-tests-'));
try {
  const compiled = spawnSync(process.execPath,[require.resolve('typescript/bin/tsc'),'src/core/proportionalDesign.ts','src/core/proportionalReport.ts','--outDir',temporary,'--module','commonjs','--moduleResolution','node','--target','ES2020','--strict','--skipLibCheck','--esModuleInterop'],{encoding:'utf8'});
  assert.equal(compiled.status,0,compiled.stdout+compiled.stderr);
  const {ASSIGNMENT_PLANT,createProportionalModel,evaluateDesign,searchProportionalGain,DEFAULT_REQUIREMENTS,designSearchCsv} = require(join(temporary,'proportionalDesign.js'));
  const {designReportHtml,designLocusSvg,designStepSvg} = require(join(temporary,'proportionalReport.js'));
  const model = createProportionalModel(ASSIGNMENT_PLANT);
  assert.deepEqual(model.stability.stabilityCondition.intervals,[{lower:0,upper:70}]);
  const cases = [1,6,10,70,80].map(gain=>evaluateDesign(model,gain));
  assert.equal(evaluateDesign(model,0).stability,'BOUNDARY');
  assert.equal(cases[0].stability,'STABLE');
  assert.equal(cases[3].stability,'BOUNDARY');
  assert.equal(cases[4].stability,'UNSTABLE');
  assert.equal(cases[3].overshoot,null); assert.equal(cases[4].settlingTime,null);
  assert.equal(cases[1].meets,false); assert.ok(cases[1].passesOvershoot);
  // Independent integration of y''' + 7y'' + 10y' + K y = K (RK4, dt=0.0005).
  function independentMetrics(gain) {
    let state=[0,0,0], maximum=0,lastOutside=0;
    const dt=0.0005, derivative=([y,v,a])=>[v,a,gain-7*a-10*v-gain*y];
    const add=(base,k,factor)=>base.map((value,i)=>value+factor*k[i]);
    for(let i=0;i<=24000;i++) {
      maximum=Math.max(maximum,state[0]); if(Math.abs(state[0]-1)>0.02)lastOutside=i*dt;
      const a=derivative(state),b=derivative(add(state,a,dt/2)),c=derivative(add(state,b,dt/2)),d=derivative(add(state,c,dt));
      state=state.map((value,j)=>value+dt/6*(a[j]+2*b[j]+2*c[j]+d[j]));
    }
    return {mp:(maximum-1)*100,ts:lastOutside+dt};
  }
  for(const item of cases.slice(1,3)) {
    const independent=independentMetrics(item.gain);
    assert.ok(Math.abs(item.overshoot-independent.mp)<0.002);
    assert.ok(Math.abs(item.settlingTime-independent.ts)<0.011);
  }
  const firstOrder=createProportionalModel({...ASSIGNMENT_PLANT,rawExpression:'1/(s+1)'});
  const first=evaluateDesign(firstOrder,1);
  assert.ok(first.meets);
  assert.ok(Math.abs(first.settlingTime-Math.log(50)/2)<0.007);
  const strict=evaluateDesign(firstOrder,1,{overshoot:20,settlingTime:first.settlingTime});
  assert.equal(strict.passesSettling,false);
  for(const expression of ['K^2/(s+1)','(K+1)/(s+1)','K/(s+K)','0/(s+1)']) assert.throws(()=>createProportionalModel({...ASSIGNMENT_PLANT,rawExpression:expression}));
  for(const gain of [-1,NaN,Infinity,1e6+1])assert.throws(()=>evaluateDesign(model,gain));
  const slow=evaluateDesign(model,0.001);assert.equal(slow.complete,false);assert.equal(slow.settlingTime,null);assert.equal(slow.meets,false);
  const abort=new AbortController();abort.abort();
  await assert.rejects(searchProportionalGain(model,DEFAULT_REQUIREMENTS,{min:0,max:100,samples:101},undefined,abort.signal),/cancelada/);
  const result=await searchProportionalGain(model,DEFAULT_REQUIREMENTS,{min:0,max:100,samples:1001});
  assert.equal(result.feasible.length,0);
  assert.ok(result.best.gain>6&&result.best.gain<6.2);
  assert.ok(result.best.settlingTime>3.5&&result.best.settlingTime<3.7);
  assert.ok(result.best.passesOvershoot);
  assert.ok(result.cases.every(item=>!item.response));
  const relaxed=await searchProportionalGain(model,{overshoot:20,settlingTime:5},{min:0,max:20,samples:101});
  assert.ok(relaxed.feasible.length>0);
  const staticPlant=createProportionalModel({...ASSIGNMENT_PLANT,rawExpression:'-1'});
  const singular=await searchProportionalGain(staticPlant,DEFAULT_REQUIREMENTS,{min:0,max:2,samples:101});
  assert.equal(singular.cases.find(item=>item.gain===1).stability,'INCONCLUSIVE');
  assert.ok(singular.feasible.length>0);
  assert.ok(designSearchCsv(result).startsWith('K,estabilidade,'));
  const report=designReportHtml(model,DEFAULT_REQUIREMENTS,cases,result);
  assert.ok(report.includes('0&lt;K&lt;70'));assert.ok(report.includes('evidência numérica'));assert.equal((report.match(/<svg xmlns=/g)||[]).length,2);
  const hostile=designReportHtml({...model,system:{...model.system,name:'<script>alert(1)</script>'}},DEFAULT_REQUIREMENTS,cases,result);
  assert.ok(!hostile.includes('<script>'));assert.ok(hostile.includes('&lt;script&gt;'));
  if(process.argv.includes('--report')) {
    mkdirSync('docs',{recursive:true});
    const examples=[1,6.074,80].map(gain=>evaluateDesign(model,gain));
    writeFileSync('docs/relatorio-projeto-lgr.html',designReportHtml(model,DEFAULT_REQUIREMENTS,examples,result));
    writeFileSync('docs/lgr-comparacao.svg',designLocusSvg(model,examples,DEFAULT_REQUIREMENTS));
    writeFileSync('docs/degraus-comparacao.svg',designStepSvg(examples));
    writeFileSync('docs/busca-ganhos-lgr.csv',designSearchCsv(result));
  }
  console.log(`Projeto LGR: Routh 0<K<70, validação independente RK4, metas estritas, busca e relatório passaram. Melhor compromisso amostrado: K=${result.best.gain}, Ts=${result.best.settlingTime.toFixed(3)} s, Mp=${result.best.overshoot.toFixed(3)}%.`);
} finally {
  if (!resolve(temporary).startsWith(resolve(process.cwd(),'node_modules')+sep)) throw new Error('Diretório temporário fora de node_modules.');
  rmSync(temporary,{recursive:true,force:true});
}
