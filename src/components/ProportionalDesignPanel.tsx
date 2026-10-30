import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Play, X } from 'lucide-react';
import { TransferFunction } from '../core/types';
import { ASSIGNMENT_PLANT, createProportionalModel, DEFAULT_REQUIREMENTS, DesignCase, DesignSearch, designSearchCsv, evaluateDesign, searchProportionalGain } from '../core/proportionalDesign';
import { designConclusion, designLocusSvg, designNumber as fmt, designReportHtml, designStepSvg, stabilityDescription } from '../core/proportionalReport';
import { ComplexMath } from '../core/complex';
import { symbolicTransferExpression } from '../core/symbolicRouth';
import { MathView } from './MathView';
import { CopyFunctionButton } from './CopyFunctionButton';

function download(text: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fieldClass = 'rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-sm font-mono w-28';
const buttonClass = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium hover:border-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed';
const statusLabel = (item: DesignCase) => item.stability === 'STABLE' ? 'Estável' : item.stability === 'BOUNDARY' ? 'Fronteira' : item.stability === 'UNSTABLE' ? 'Instável' : 'Inconclusiva';

export const ProportionalDesignPanel: React.FC<{
  systems: TransferFunction[];
  onApply: (system: TransferFunction, gains: number[]) => void;
}> = ({ systems, onApply }) => {
  const [sourceId, setSourceId] = useState('__assignment__');
  const [gain, setGain] = useState(10);
  const [requirements, setRequirements] = useState({ ...DEFAULT_REQUIREMENTS });
  const [options, setOptions] = useState({ min: 0, max: 100, samples: 1001 });
  const [comparison, setComparison] = useState('1, 6, 80');
  const [search, setSearch] = useState<DesignSearch | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const source = sourceId === '__assignment__' ? ASSIGNMENT_PLANT : systems.find(system=>system.id===sourceId);
  const prepared = useMemo(() => {
    try { if (!source) throw new Error('Selecione uma planta disponível.'); return { model: createProportionalModel(source), error: '' }; }
    catch (error) { return { model: null, error: error instanceof Error ? error.message : 'Planta inválida.' }; }
  },[source]);
  const model = prepared.model;
  const key = JSON.stringify([source?.inputMode,source?.rawExpression,source?.numStr,source?.denStr,requirements,options]);
  useEffect(()=> {
    controller.current?.abort(); setSearch(null); setProgress(null); setError('');
    return ()=>controller.current?.abort();
  },[key]);
  const evaluated = useMemo(()=> {
    try { return { selected: model ? evaluateDesign(model,gain,requirements) : null, error: '' }; }
    catch(error) { return { selected:null,error:error instanceof Error ? error.message : 'Ganho inválido.' }; }
  },[model,gain,requirements]);
  const selected = evaluated.selected;
  const comparisons = useMemo(()=> {
    try {
      const values = comparison.split(/[,;\s]+/).filter(Boolean).map(Number);
      if (!values.length || values.length > 8 || values.some(value=>!Number.isFinite(value)||value<0||value>1e6)) throw new Error('Informe de 1 a 8 ganhos entre 0 e 1.000.000, separados por vírgulas. Use ponto decimal.');
      const gains = [...new Set(values)];
      return { cases: model ? gains.map(value=>evaluateDesign(model,value,requirements)) : [], error:'', gains };
    } catch(error) { return { cases:[],gains:[],error:error instanceof Error ? error.message : 'Comparação inválida.' }; }
  },[model,comparison,requirements]);
  const chartCases = useMemo(()=>selected ? [selected,...comparisons.cases.filter(item=>Math.abs(item.gain-gain)>1e-12)] : comparisons.cases,[selected,comparisons.cases,gain]);
  const charts = useMemo(()=>model && chartCases.length > 0 ? { locus:designLocusSvg(model,chartCases,requirements), step:designStepSvg(chartCases) } : null,[model,chartCases,requirements]);
  const formula = useMemo(()=>model ? symbolicTransferExpression(model.system) : null,[model]);
  const runSearch = async () => {
    if (!model) return;
    controller.current?.abort();
    const active = new AbortController(); controller.current = active;
    setProgress(0); setError(''); setSearch(null);
    try {
      const result = await searchProportionalGain(model,requirements,options,value=> { if (!active.signal.aborted) setProgress(value); },active.signal);
      if (!active.signal.aborted) setSearch(result);
    } catch(error) {
      if (!active.signal.aborted) setError(error instanceof Error ? error.message : 'Não foi possível concluir a busca.');
    } finally { if (!active.signal.aborted) setProgress(null); }
  };
  const exportReport = () => {
    if (model && charts) download(designReportHtml(model,requirements,chartCases,search),'text/html;charset=utf-8','relatorio-projeto-lgr.html');
  };
  const message = prepared.error || evaluated.error || error;
  return <section aria-label="Projeto de desempenho proporcional" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 sm:p-5 space-y-5 text-sm text-slate-700 dark:text-slate-300">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-semibold text-base text-slate-900 dark:text-white">Projeto de desempenho por LGR</h2><p className="text-xs mt-1">Ganho proporcional, realimentação unitária negativa e avaliação da resposta completa.</p></div>
      <button type="button" onClick={exportReport} disabled={!model||comparisons.cases.length<3||progress!==null||!search} className={buttonClass}><Download className="w-4 h-4"/>Baixar relatório HTML</button>
    </div>
    <label className="flex flex-col gap-1 text-xs font-medium">Planta do projeto
      <select aria-label="Planta do projeto" value={sourceId} onChange={event=>setSourceId(event.target.value)} className="max-w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2">
        <option value="__assignment__">Enunciado: K/[s(s+2)(s+5)]</option>
        {systems.map(system=><option key={system.id} value={system.id}>{system.name}</option>)}
      </select>
    </label>
    {message && <p role="alert" className="text-rose-600 dark:text-rose-400">{message}</p>}
    {model && <>
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3">
        <div className="min-w-0 overflow-x-auto flex-1"><MathView math={`T(s,K)=${formula!.latex}`} block/></div>
        <CopyFunctionButton text={formula!.text} label="Copiar função do projeto"/>
      </div>
      <div className="rounded-lg border border-cyan-200 dark:border-cyan-800 p-3 text-xs space-y-2">
        <p><strong>Estabilidade assintótica para K positivo:</strong> {stabilityDescription(model)}</p>
        {model.assignment && <><p>Routh: primeira coluna 1, 7, (70−K)/7, K. Em K=0 há polo na origem; em K=70 os polos são −7 e ±j√10; acima de 70 o sistema é instável.</p><p>Requisito original: Mp ≤ 20% e Ts(2%) &lt; 3 s. A linha verde no LGR mostra Re(s)=−4/Ts alvo, apenas uma previsão de segunda ordem.</p></>}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs">K selecionado<input type="number" aria-label="K do projeto" min="0" max="1000000" step="any" value={gain} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber))setGain(event.target.valueAsNumber);}} className={fieldClass}/></label>
        <label className="flex flex-col gap-1 text-xs">Sobressinal máximo (%)<input type="number" aria-label="Sobressinal máximo do projeto" min="0" max="1000" step="any" value={requirements.overshoot} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber))setRequirements({...requirements,overshoot:event.target.valueAsNumber});}} className={fieldClass}/></label>
        <label className="flex flex-col gap-1 text-xs">Ts(2%) menor que (s)<input type="number" aria-label="Tempo de acomodação máximo do projeto" min="0.001" max="120" step="any" value={requirements.settlingTime} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber))setRequirements({...requirements,settlingTime:event.target.valueAsNumber});}} className={fieldClass}/></label>
        <button type="button" className={buttonClass} disabled={!selected} onClick={()=>onApply(model.system,[gain])}>Usar este K nos gráficos principais</button>
      </div>
      {selected && <div aria-live="polite" className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 text-xs">
          {[['Estabilidade',statusLabel(selected),selected.stable],['Sobressinal simulado',`${fmt(selected.overshoot)}%`,selected.passesOvershoot],['Acomodação simulada (±2%)',`${fmt(selected.settlingTime)} s`,selected.passesSettling],['Requisitos simultâneos',selected.meets?'Atendidos':'Não atendidos',selected.meets]].map(([label,value,pass])=><div key={String(label)} className={`rounded-lg border p-3 ${pass?'border-emerald-300 dark:border-emerald-800':'border-amber-300 dark:border-amber-800'}`}><span className="block text-slate-500 dark:text-slate-400">{label}</span><strong className="block mt-1 text-sm">{value}</strong></div>)}
        </div>
        <p className="text-xs font-mono break-words">Polos: {selected.poles.map(pole=>ComplexMath.format(pole,5)).join('; ')||'Nenhum'}</p>
        <p className="text-xs">Previsão pelos polos dominantes: ζ≈{fmt(selected.damping)}, Mp≈{fmt(selected.predictedOvershoot)}%, Ts≈{fmt(selected.predictedSettlingTime)} s. As previsões não substituem a resposta simulada de ordem completa.</p>
        <p className="text-xs text-slate-500">Horizonte das métricas: {fmt(selected.horizon)} s; passo: {fmt(selected.timeStep,4)} s.{!selected.stable?' Não há acomodação assintótica neste ganho.':!selected.complete?' Horizonte insuficiente para confirmar acomodação; este caso não é aprovado.':''}</p>
      </div>}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
        <h3 className="font-semibold">Buscar ganho que atenda aos requisitos</h3>
        <div className="flex flex-wrap items-end gap-3">
          {([['min','K mínimo'],['max','K máximo'],['samples','Amostras de K']] as const).map(([name,label])=><label key={name} className="flex flex-col gap-1 text-xs">{label}<input type="number" aria-label={label} value={options[name]} step={name==='samples'?1:'any'} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber))setOptions({...options,[name]:event.target.valueAsNumber});}} className={fieldClass}/></label>)}
          <button type="button" disabled={progress!==null} onClick={runSearch} className={`${buttonClass} bg-cyan-600 text-white`}><Play className="w-3.5 h-3.5"/>Buscar K</button>
          {progress!==null && <button type="button" className={buttonClass} onClick={()=>{controller.current?.abort();setProgress(null);}}><X className="w-3.5 h-3.5"/>Cancelar busca</button>}
        </div>
        {progress!==null && <div role="status"><progress className="w-full accent-cyan-600" max="1" value={progress}/><p className="text-xs">Busca em andamento: {Math.round(progress*100)}%</p></div>}
        <div role="status" className="rounded-lg bg-slate-50 dark:bg-slate-950/60 p-3 text-xs space-y-2">
          <p>{designConclusion(search)}</p>
          {search && <><p>{search.cases.length} ganhos distintos avaliados; {search.cases.filter(item=>item.stable).length} estáveis; {search.cases.filter(item=>item.stability==='INCONCLUSIVE').length} inconclusivos. Amostragem uniforme e refinamento local. A ausência de resultado na malha não prova inexistência entre amostras.</p>
            {search.best && <p>Menor Ts encontrado respeitando o limite de Mp: <strong>{fmt(search.best.settlingTime)} s</strong> em K≈{fmt(search.best.gain,6)}, com Mp≈{fmt(search.best.overshoot)}%.</p>}
            <div className="flex flex-wrap gap-2">
              {search.best && <button type="button" className={buttonClass} onClick={()=>setGain(search.best!.gain)}>Inspecionar melhor compromisso</button>}
              <button type="button" className={buttonClass} onClick={()=>download(designSearchCsv(search),'text/csv;charset=utf-8','busca-ganhos-lgr.csv')}>Baixar busca CSV</button>
            </div>
          </>}
        </div>
      </div>
      <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
        <h3 className="font-semibold">Comparar ganhos e preparar a apresentação</h3>
        <p className="text-xs text-slate-500">Para baixar o relatório completo, execute a busca e compare pelo menos três ganhos distintos.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs">Ganhos para comparação (ponto decimal)<input aria-label="Ganhos de comparação" value={comparison} onChange={event=>setComparison(event.target.value)} className={`${fieldClass} !w-56 max-w-full`}/></label>
          <button type="button" disabled={!comparisons.cases.length} onClick={()=>onApply(model.system,comparisons.gains)} className={buttonClass}>Levar comparação aos gráficos principais</button>
        </div>
        {comparisons.error && <p role="alert" className="text-xs text-rose-500">{comparisons.error}</p>}
        {comparisons.cases.length<3 && <p className="text-xs text-amber-600">O entregável exige pelo menos três ganhos distintos; inclua um caso estável e um instável, quando aplicável.</p>}
        <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead><tr>{['K','Estabilidade','Mp simulado (%)','Ts simulado (s)','Ts pelos polos (s)','Atende'].map(label=><th key={label} className="p-2 whitespace-nowrap">{label}</th>)}</tr></thead><tbody>{comparisons.cases.map(item=><tr key={item.gain} className="border-t border-slate-200 dark:border-slate-800"><td className="p-2"><button type="button" onClick={()=>setGain(item.gain)} className="text-cyan-600 dark:text-cyan-300 underline">{fmt(item.gain,6)}</button></td><td className="p-2">{statusLabel(item)}</td><td className="p-2">{fmt(item.overshoot)}</td><td className="p-2">{fmt(item.settlingTime)}</td><td className="p-2">{fmt(item.predictedSettlingTime)}</td><td className="p-2">{item.meets?'Sim':'Não'}</td></tr>)}</tbody></table></div>
        {charts && <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3"><div className="rounded-xl overflow-x-auto [&>svg]:min-w-[640px]" dangerouslySetInnerHTML={{__html:charts.locus}}/><div className="rounded-xl overflow-x-auto [&>svg]:min-w-[640px]" dangerouslySetInnerHTML={{__html:charts.step}}/></div>}
        <p className="text-xs text-slate-500">Os gráficos incluem o K selecionado e os ganhos de comparação. As curvas temporais mostram 0–12 s; a tabela usa o horizonte adaptativo completo. Em telas pequenas, deslize os gráficos na horizontal para ler os eixos.</p>
        {charts && <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} onClick={()=>download(charts.locus,'image/svg+xml','lgr-comparacao.svg')}>Baixar LGR SVG</button><button type="button" className={buttonClass} onClick={()=>download(charts.step,'image/svg+xml','degraus-comparacao.svg')}>Baixar degraus SVG</button></div>}
      </div>
    </>}
  </section>;
};
