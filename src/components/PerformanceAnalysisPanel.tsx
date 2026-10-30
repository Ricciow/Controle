import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TransferFunction } from '../core/types';
import { createPerformanceModel, evaluatePerformance, GainSweep, PerformanceCase, PerformanceLimits, performanceCsv, sweepGain } from '../core/performanceAnalysis';
import { performanceLocusSvg, performanceNumber as fmt, performanceStepSvg, stabilityDescription, SweepMetric, sweepMetricSvg } from '../core/performancePlots';
import { symbolicTransferExpression } from '../core/symbolicRouth';
import { ComplexMath } from '../core/complex';
import { MathView } from './MathView';
import { CopyFunctionButton } from './CopyFunctionButton';

const field = 'rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm font-mono w-28';
const button = 'rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium hover:border-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed';
const stabilityName = (value: PerformanceCase) => ({ STABLE:'Estável', BOUNDARY:'Fronteira', UNSTABLE:'Instável', INCONCLUSIVE:'Inconclusivo' }[value.stability]);
function download(text: string, mime: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const CasesTable: React.FC<{ cases: PerformanceCase[]; onSelect: (gain:number)=>void }> = ({ cases, onSelect }) => <div className="overflow-x-auto">
  <table className="w-full text-xs text-left"><thead><tr>{['K','Estabilidade','Mp (%)','Ts de 2% (s)','ζ','ωn (rad/s)','Limites definidos'].map(label=><th key={label} className="p-2 whitespace-nowrap">{label}</th>)}</tr></thead>
    <tbody>{cases.map(item=><tr key={item.gain} className="border-t border-slate-200 dark:border-slate-800">
      <td className="p-2"><button type="button" aria-label={`Inspecionar K=${item.gain}`} onClick={()=>onSelect(item.gain)} className="text-cyan-600 dark:text-cyan-300 underline">{fmt(item.gain,6)}</button></td>
      <td className="p-2" title={item.error}>{stabilityName(item)}</td><td className="p-2">{fmt(item.overshoot)}</td><td className="p-2">{fmt(item.settlingTime)}</td>
      <td className="p-2">{fmt(item.damping)}</td><td className="p-2">{fmt(item.naturalFrequency)}</td><td className="p-2">{item.meets===null?'—':item.meets?'Dentro':'Fora'}</td>
    </tr>)}</tbody>
  </table>
</div>;

export const PerformanceAnalysisPanel: React.FC<{
  systems: TransferFunction[];
  onApply: (system: TransferFunction, gains: number[]) => void;
}> = ({ systems, onApply }) => {
  const [sourceId,setSourceId] = useState('');
  const source = systems.find(system=>system.id===sourceId) ?? systems.find(system=>system.visible) ?? systems[0];
  const [gain,setGain] = useState(1);
  const [duration,setDuration] = useState(12);
  const [limits,setLimits] = useState<PerformanceLimits>({});
  const [options,setOptions] = useState({min:0,max:100,samples:501});
  const [comparison,setComparison] = useState('');
  const [sweep,setSweep] = useState<GainSweep|null>(null);
  const [metric,setMetric] = useState<SweepMetric>('overshoot');
  const [page,setPage] = useState(0);
  const [progress,setProgress] = useState<number|null>(null);
  const [error,setError] = useState('');
  const controller = useRef<AbortController|null>(null);
  useEffect(()=>{setGain(source?.kValue??1);},[source?.id,source?.kValue]);
  useEffect(()=>{setComparison('');},[source?.id]);
  const prepared = useMemo(()=>{
    if(!source) return {model:null,error:''};
    try{return {model:createPerformanceModel(source),error:''};}
    catch(error){return {model:null,error:error instanceof Error?error.message:'Função inválida.'};}
  },[source]);
  const model = prepared.model;
  const analysisKey = JSON.stringify([source?.id,source?.inputMode,source?.rawExpression,source?.numStr,source?.denStr,limits,options]);
  useEffect(()=>{
    controller.current?.abort();setSweep(null);setProgress(null);setError('');setPage(0);
    return ()=>controller.current?.abort();
  },[analysisKey]);
  const evaluated = useMemo(()=>{
    try{return {item:model?evaluatePerformance(model,gain,limits,true,duration):null,error:''};}
    catch(error){return {item:null,error:error instanceof Error?error.message:'Parâmetros inválidos.'};}
  },[model,gain,limits,duration]);
  const selected = evaluated.item;
  const comparisonResult = useMemo(()=>{
    try{
      const values = comparison.trim() ? [...new Set(comparison.split(/[,;\s]+/).filter(Boolean).map(Number))] : [];
      if(values.length>8||values.some(value=>!Number.isFinite(value)||value<0||value>1e6))throw new Error('Informe até oito ganhos de 0 a 1.000.000. Separe por vírgulas e use ponto decimal.');
      return {cases:model?values.map(value=>evaluatePerformance(model,value,limits,true,duration)):[],gains:values,error:''};
    }catch(error){return {cases:[],gains:[],error:error instanceof Error?error.message:'Ganhos inválidos.'};}
  },[model,comparison,limits,duration]);
  const cases = useMemo(()=>selected?[selected,...comparisonResult.cases.filter(item=>item.gain!==gain)]:comparisonResult.cases,[selected,comparisonResult.cases,gain]);
  const formula = useMemo(()=>model?symbolicTransferExpression(model.system):null,[model]);
  const charts = useMemo(()=>model&&cases.length?{locus:performanceLocusSvg(model,cases,limits),step:performanceStepSvg(cases,duration)}:null,[model,cases,limits,duration]);
  const sweepChart = useMemo(()=>sweep?sweepMetricSvg(sweep,metric):null,[sweep,metric]);
  const runSweep = async()=>{
    if(!model)return;
    controller.current?.abort();const active=new AbortController();controller.current=active;
    setProgress(0);setSweep(null);setError('');setPage(0);
    try{
      const result=await sweepGain(model,limits,options,value=>{if(!active.signal.aborted)setProgress(value);},active.signal);
      if(!active.signal.aborted)setSweep(result);
    }catch(error){if(!active.signal.aborted)setError(error instanceof Error?error.message:'Erro na varredura.');}
    finally{if(!active.signal.aborted)setProgress(null);}
  };
  const setLimit = (key:keyof PerformanceLimits, text:string)=>setLimits(previous=>{
    const next={...previous};if(text==='')delete next[key];else next[key]=Number(text);return next;
  });
  return <section aria-label="Análise de desempenho" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 sm:p-5 space-y-4 text-sm text-slate-700 dark:text-slate-300">
    <div><h2 className="font-semibold text-base text-slate-900 dark:text-white">Análise de desempenho</h2><p className="text-xs mt-1">Explore uma função cadastrada, varie K e compare o efeito nos polos e na resposta temporal.</p></div>
    {!source&&<p>Adicione uma função na lista de sistemas para iniciar a análise.</p>}
    {!!systems.length&&<label className="flex flex-col gap-1 text-xs">Função analisada<select aria-label="Função para análise de desempenho" value={source?.id??''} onChange={event=>setSourceId(event.target.value)} className={`${field} !w-full`}>{systems.map(system=><option key={system.id} value={system.id}>{system.name}</option>)}</select></label>}
    {(prepared.error||evaluated.error||error)&&<p role="alert" className="text-rose-600 dark:text-rose-400">{prepared.error||evaluated.error||error}</p>}
    {model&&<>
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 p-3"><div className="min-w-0 overflow-x-auto flex-1"><MathView math={`T(s,K)=${formula!.latex}`} block/></div><CopyFunctionButton text={formula!.text} label="Copiar função da análise"/></div>
      <p className="text-xs">Malha fechada com realimentação unitária negativa; K multiplica a planta informada. Faixa estável para K positivo: <strong>{stabilityDescription(model)}</strong></p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs">K<input aria-label="K da análise de desempenho" type="number" step="any" min="0" max="1000000" value={gain} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber))setGain(event.target.valueAsNumber);}} className={field}/></label>
        <label className="flex flex-col gap-1 text-xs">Janela do gráfico (s)<input aria-label="Janela temporal da comparação" type="number" step="any" min="0.01" max="120" value={duration} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber))setDuration(event.target.valueAsNumber);}} className={field}/></label>
        <button type="button" className={button} disabled={!selected} onClick={()=>onApply(model.system,[gain])}>Usar K nos gráficos principais</button>
      </div>
      <fieldset className="flex flex-wrap gap-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3"><legend className="px-1 text-xs font-medium">Limites opcionais para referência</legend>
        <label className="flex flex-col gap-1 text-xs">Mp máximo (%)<input aria-label="Limite opcional de sobressinal" type="number" min="0" max="1000" step="any" placeholder="Sem limite" value={limits.overshoot??''} onChange={event=>setLimit('overshoot',event.target.value)} className={field}/></label>
        <label className="flex flex-col gap-1 text-xs">Ts(2%) menor que (s)<input aria-label="Limite opcional de acomodação" type="number" min="0.001" max="120" step="any" placeholder="Sem limite" value={limits.settlingTime??''} onChange={event=>setLimit('settlingTime',event.target.value)} className={field}/></label>
        <p className="basis-full text-xs text-slate-500">Deixe em branco para observar as métricas sem aplicar critérios. A linha tracejada no LGR só aparece com um limite de Ts e representa a aproximação Re(s)=−4/Ts.</p>
      </fieldset>
      {selected&&<div aria-live="polite" className="space-y-2">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 text-xs">{[['Estabilidade',stabilityName(selected)],['Sobressinal',`${fmt(selected.overshoot)}%`],['Acomodação (±2%)',`${fmt(selected.settlingTime)} s`],['ζ / ωn',`${fmt(selected.damping)} / ${fmt(selected.naturalFrequency)} rad/s`]].map(([label,value])=><div key={label} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><span className="block text-slate-500">{label}</span><strong className="block mt-1">{value}</strong></div>)}</div>
        <p className="font-mono text-xs break-words">Polos: {selected.poles.map(pole=>ComplexMath.format(pole,5)).join('; ')||'Nenhum'}</p>
        <p className="text-xs">Aproximação pelos polos dominantes: Mp≈{fmt(selected.predictedOvershoot)}%, Ts≈{fmt(selected.predictedSettlingTime)} s. Compare com as métricas da resposta completa acima.</p>
        {selected.meets!==null&&<p className="text-xs">Limites definidos: {selected.meets?'dentro dos limites':'fora dos limites ou métricas inconclusivas'}.</p>}
        <p className="text-xs text-slate-500">Horizonte das métricas: {fmt(selected.horizon)} s; passo: {fmt(selected.timeStep,4)} s.{!selected.stable?' Sem acomodação assintótica.':!selected.complete?' Horizonte insuficiente para confirmar a acomodação.':''}</p>
      </div>}
      <details className="border-t border-slate-200 dark:border-slate-800 pt-3"><summary className="cursor-pointer font-semibold">Varredura de K</summary><div className="space-y-3 pt-3">
        <p className="text-xs">Defina a faixa e observe Mp, Ts, ζ e ωn em função do ganho. A varredura mede os pontos escolhidos, sem selecionar uma solução.</p>
        <div className="flex flex-wrap items-end gap-3">{([['min','K mínimo'],['max','K máximo'],['samples','Amostras de K']] as const).map(([key,label])=><label key={key} className="flex flex-col gap-1 text-xs">{label}<input type="number" aria-label={label} step={key==='samples'?1:'any'} value={options[key]} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber))setOptions({...options,[key]:event.target.valueAsNumber});}} className={field}/></label>)}
          <button type="button" className={button} disabled={progress!==null} onClick={runSweep}>Varrer faixa de K</button>
          {progress!==null&&<button type="button" className={button} onClick={()=>{controller.current?.abort();setProgress(null);}}>Cancelar varredura</button>}
        </div>
        {progress!==null&&<div role="status"><progress value={progress} max="1" className="w-full accent-cyan-600"/><span className="text-xs">{Math.round(progress*100)}%</span></div>}
        {sweep&&<>
          <p role="status" className="text-xs">{sweep.cases.length} pontos avaliados de K={fmt(sweep.options.min)} a K={fmt(sweep.options.max)}. Valores ausentes são inconclusivos ou não se aplicam.</p>
          <label className="flex flex-col gap-1 text-xs">Métrica da varredura<select aria-label="Métrica da varredura" value={metric} onChange={event=>setMetric(event.target.value as SweepMetric)} className={`${field} !w-auto self-start`}><option value="overshoot">Sobressinal (%)</option><option value="settlingTime">Acomodação de 2% (s)</option><option value="damping">Amortecimento (ζ)</option><option value="naturalFrequency">Frequência natural (rad/s)</option></select></label>
          {sweepChart&&<div className="overflow-x-auto [&>svg]:min-w-[640px]" dangerouslySetInnerHTML={{__html:sweepChart}}/>}
          <CasesTable cases={sweep.cases.slice(page*25,(page+1)*25)} onSelect={setGain}/>
          <div className="flex flex-wrap gap-2 items-center text-xs"><button type="button" className={button} disabled={page===0} onClick={()=>setPage(page-1)}>Anterior</button><span>Página {page+1} de {Math.ceil(sweep.cases.length/25)}</span><button type="button" className={button} disabled={(page+1)*25>=sweep.cases.length} onClick={()=>setPage(page+1)}>Próxima</button>
            <button type="button" className={button} onClick={()=>download(performanceCsv(sweep.cases),'text/csv;charset=utf-8','varredura-k.csv')}>Exportar varredura CSV</button>
          </div>
        </>}
      </div></details>
      <details className="border-t border-slate-200 dark:border-slate-800 pt-3"><summary className="cursor-pointer font-semibold">Comparação de ganhos</summary><div className="space-y-3 pt-3">
        <label className="flex flex-col gap-1 text-xs">Ganhos adicionais (vírgula como separador, ponto decimal)<input aria-label="Ganhos adicionais para comparação" placeholder="Digite os ganhos a comparar" value={comparison} onChange={event=>setComparison(event.target.value)} className={`${field} !w-full`}/></label>
        {comparisonResult.error&&<p role="alert" className="text-xs text-rose-500">{comparisonResult.error}</p>}
        <CasesTable cases={cases} onSelect={setGain}/>
        {!!comparisonResult.gains.length&&<button type="button" disabled={!comparisonResult.cases.length} className={button} onClick={()=>onApply(model.system,comparisonResult.gains)}>Levar comparação aos gráficos principais</button>}
      </div></details>
      {charts&&<>
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3"><div className="rounded-xl overflow-x-auto [&>svg]:min-w-[640px]" dangerouslySetInnerHTML={{__html:charts.locus}}/><div className="rounded-xl overflow-x-auto [&>svg]:min-w-[640px]" dangerouslySetInnerHTML={{__html:charts.step}}/></div>
        <p className="text-xs text-slate-500">Os gráficos mostram o K selecionado e os ganhos adicionais. A janela do gráfico e o horizonte usado nas métricas são independentes. Deslize na horizontal em telas pequenas.</p>
        <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={()=>download(charts.locus,'image/svg+xml','lgr.svg')}>Exportar LGR SVG</button><button type="button" className={button} onClick={()=>download(charts.step,'image/svg+xml','respostas-degrau.svg')}>Exportar degraus SVG</button><button type="button" className={button} onClick={()=>download(performanceCsv(cases),'text/csv;charset=utf-8','metricas.csv')}>Exportar métricas CSV</button></div>
      </>}
    </>}
  </section>;
};
