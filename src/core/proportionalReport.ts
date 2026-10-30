import { DesignCase, DesignRequirements, DesignSearch, ProportionalModel } from './proportionalDesign';
import { calculateRootLocus } from './rootLocus';
import { axisTicks } from './timePlot';
import { ComplexMath } from './complex';

export const designNumber = (value: number | null, digits = 3) => value === null || !Number.isFinite(value) ? '—' : Number(value.toFixed(digits)).toString();
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]!));
const colors = ['#0891b2', '#7c3aed', '#ea580c', '#059669', '#db2777', '#2563eb', '#b45309', '#475569'];
export function stabilityDescription(model: ProportionalModel): string {
  const intervals = model.stability.stabilityCondition?.intervals;
  if (!intervals) return model.stability.alwaysNonStable ? 'Nenhum intervalo assintoticamente estável.' : 'Intervalo não resolvido simbolicamente; consulte Routh e a análise numérica.';
  const positive = intervals.filter(interval => interval.upper > 0).map(interval => ({ lower: Math.max(0, interval.lower), upper: interval.upper }));
  return positive.length ? positive.map(interval => `${designNumber(interval.lower,6)} < K${interval.upper === Infinity ? '' : ` < ${designNumber(interval.upper,6)}`}`).join(' ou ') : 'Nenhum K positivo assintoticamente estável.';
}
interface PlotLine { name: string; color: string; points: { x: number; y: number }[]; markers?: boolean }
function svgPlot(title: string, xLabel: string, yLabel: string, lines: PlotLine[], range: [number, number, number, number], decorations = ''): string {
  const [xmin,xmax,ymin,ymax] = range;
  const x = (value:number) => 64 + (value-xmin)/(xmax-xmin)*584;
  const y = (value:number) => 300 - (value-ymin)/(ymax-ymin)*242;
  const grid = axisTicks(xmin,xmax,6).map(value => `<path d="M${x(value)},58V300" stroke="#e2e8f0"/><text x="${x(value)}" y="319" text-anchor="middle">${designNumber(value)}</text>`).join('') +
    axisTicks(ymin,ymax,5).map(value => `<path d="M64,${y(value)}H648" stroke="#e2e8f0"/><text x="56" y="${y(value)+4}" text-anchor="end">${designNumber(value)}</text>`).join('');
  const paths = lines.map(line => {
    if (line.markers) return line.points.filter(point => Number.isFinite(point.x)&&Number.isFinite(point.y)).map(point => `<circle cx="${x(point.x)}" cy="${y(point.y)}" r="4" fill="${line.color}" stroke="white"><title>${escape(line.name)}: ${designNumber(point.x)} + j${designNumber(point.y)}</title></circle>`).join('');
    let connected = false;
    const path = line.points.map(point => {
      if (![point.x,point.y].every(Number.isFinite) || point.x<xmin || point.x>xmax) { connected=false; return ''; }
      const command = `${connected?'L':'M'}${x(point.x).toFixed(2)},${y(point.y).toFixed(2)}`; connected=true; return command;
    }).join(' ');
    return `<path d="${path}" stroke="${line.color}" stroke-width="1.7" fill="none"><title>${escape(line.name)}</title></path>`;
  }).join('');
  const legends = lines.filter(line=>line.markers || !lines.some(other=>other.markers)).filter((line,i,array)=>array.findIndex(other=>other.name===line.name)===i)
    .map((line,i)=>`<text x="${70+i%4*145}" y="${365+Math.floor(i/4)*18}" fill="${line.color}">${escape(line.name)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 410" role="img" aria-label="${escape(title)}" style="width:100%;height:auto;background:white;color:#0f172a;font:11px system-ui"><title>${escape(title)}</title><rect width="680" height="410" fill="white"/><text x="340" y="24" font-size="16" text-anchor="middle">${escape(title)}</text>${grid}<svg x="64" y="58" width="584" height="242" viewBox="64 58 584 242" overflow="hidden">${decorations}${paths}</svg><path d="M64,58V300H648" fill="none" stroke="#475569"/><text x="354" y="342" text-anchor="middle">${escape(xLabel)}</text><text x="16" y="180" transform="rotate(-90 16 180)" text-anchor="middle">${escape(yLabel)}</text>${legends}</svg>`;
}
export function designLocusSvg(model: ProportionalModel, cases: DesignCase[], requirements: DesignRequirements): string {
  const locus = calculateRootLocus(model.system, Math.max(100,...cases.map(item=>item.gain*1.15)));
  const points = [...locus.branches.flat(),...cases.flatMap(item=>item.poles)];
  const left = Math.min(-2,...points.map(point=>point.re))*1.2;
  const right = Math.max(1,...points.map(point=>point.re))*1.2;
  const height = Math.max(2,...points.map(point=>Math.abs(point.im)))*1.2;
  const x = (value:number) => 64+(value-left)/(right-left)*584;
  const sigma = -4/requirements.settlingTime;
  const line = `<path d="M${x(sigma)},58V300" stroke="#16a34a" stroke-dasharray="5 4"><title>Estimativa Ts ≈ 4/σ; não é critério exato para a planta de ordem superior.</title></path>`;
  return svgPlot('LGR e polos de malha fechada', 'Re(s) (s⁻¹)', 'Im(s) (rad/s)', [
    ...locus.branches.map(branch=>({name:'LGR',color:'#94a3b8',points:branch.map(point=>({x:point.re,y:point.im}))})),
    ...cases.map((item,i)=>({name:`K = ${designNumber(item.gain,5)}`,color:colors[i%colors.length],markers:true,points:item.poles.map(point=>({x:point.re,y:point.im}))})),
  ],[left,right,-height,height],line);
}
export function designStepSvg(cases: DesignCase[], horizon = 12): string {
  const lines = cases.map((item,i)=>({name:`K = ${designNumber(item.gain,5)}`,color:colors[i%colors.length],points:item.response?.t.map((time,j)=>({x:time,y:item.response!.y[j]}))??[]}));
  const values = lines.flatMap(line=>line.points.filter(point=>point.x<=horizon&&Number.isFinite(point.y)).map(point=>point.y));
  const low = Math.min(0,...values), high = Math.max(1.05,...values);
  const margin = (high-low)*0.08;
  return svgPlot('Respostas ao degrau unitário', 'Tempo (s)', 'Saída y(t) (adimensional)', lines,[0,horizon,low-margin,high+margin]);
}
export function designConclusion(search: DesignSearch | null): string {
  if (!search) return 'Execute a busca para investigar os requisitos simultâneos.';
  if (search.feasible.length) return `${search.feasible.length} ganhos testados atendem aos requisitos. Isso não significa que todo o intervalo entre eles seja viável.`;
  return `Nenhum ganho testado entre ${designNumber(search.options.min)} e ${designNumber(search.options.max)} atendeu simultaneamente aos requisitos. A busca finita é evidência numérica e não prova de inexistência em um intervalo contínuo.`;
}
export function designReportHtml(model: ProportionalModel, requirements: DesignRequirements, cases: DesignCase[], search: DesignSearch | null): string {
  const best = search?.best;
  const rows = cases.map(item=>`<tr><td>${designNumber(item.gain,6)}</td><td>${item.stability}</td><td>${escape(item.poles.map(pole=>ComplexMath.format(pole,5)).join('; '))}</td><td>${designNumber(item.overshoot)}%</td><td>${designNumber(item.settlingTime)} s</td><td>${designNumber(item.predictedSettlingTime)} s</td><td>${designNumber(item.predictedOvershoot)}%</td><td>${item.meets?'Sim':'Não'}</td></tr>`).join('');
  const method = 'O LGR é construído resolvendo D(s)+K N(s)=0 para 401 ganhos com amostragem logarítmica e associando as raízes vizinhas. O código usa fórmulas de 1ª/2ª ordem e Durand–Kerner nas ordens superiores, com reescala. Routh-Hurwitz fornece a estabilidade. A resposta temporal usa uma realização no espaço de estados e exponencial de matriz por série de Taylor com escala e quadrados sucessivos; não há chamada pronta a control.root_locus ou step. Nerdamer é usado na álgebra simbólica. Sobressinal e acomodação são medidos na resposta completa, sem arredondamento antes da comparação. A acomodação usa a última saída da faixa de ±2% do valor final; o limite de tempo é estrito.';
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Relatório de projeto proporcional por LGR</title><style>body{font:15px/1.55 system-ui;max-width:1100px;margin:36px auto;padding:0 20px;color:#172033}h1,h2{line-height:1.2}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #cbd5e1;padding:7px;text-align:left}code{overflow-wrap:anywhere}svg{break-inside:avoid}@media print{body{margin:0}h2{break-after:avoid}table{font-size:10px}}</style><h1>Projeto de desempenho com ganho proporcional</h1><p>Exportado em ${escape(new Date().toISOString())}. Planta: ${escape(model.system.name)}.</p><h2>Modelagem e requisitos</h2><p><code>G(s,K) = ${escape(model.system.rawExpression)}</code><br>T(s,K)=K N(s)/[D(s)+K N(s)], com realimentação unitária negativa. Somente controle proporcional.</p>${model.assignment?'<p>T(s,K)=K/(s³+7s²+10s+K). Routh tem primeira coluna 1, 7, (70−K)/7, K. Portanto, 0&lt;K&lt;70; K=0 e K=70 são fronteiras. Em K=70: (s+7)(s²+10)=0.</p>':''}<p>Ganho positivo; estabilidade assintótica; Mp ≤ ${requirements.overshoot}%; Ts(2%) &lt; ${requirements.settlingTime} s.</p><h2>Método e precisão</h2><p>${method}</p><p>Para o projeto: horizonte de pelo menos 8 constantes de tempo dominantes, limitado a 120 s; passo temporal no máximo 0,01 s, até 12.001 amostras. Casos sem horizonte suficiente são inconclusivos para acomodação e não são aprovados. Métricas de regime transitório não são atribuídas a casos instáveis ou de fronteira.</p><p>${search?`Busca: ${search.options.samples} ganhos uniformes de ${search.options.min} até ${search.options.max}, com até 101 avaliações de refinamento local no melhor candidato que respeita Mp. Total de ganhos distintos: ${search.cases.length}.`:'A busca de ganhos ainda não foi executada.'}</p><h2>Comparação de ganhos</h2><table><tr><th>K</th><th>Estabilidade</th><th>Polos</th><th>Mp simulado</th><th>Ts simulado</th><th>Ts pelos polos</th><th>Mp pelos polos</th><th>Atende</th></tr>${rows}</table><p>Valores ausentes não significam zero. A aproximação usa Ts≈−ln(0,02)/σ e Mp≈100 exp(−πσ/|ωd|); os demais polos e os zeros afetam a resposta real.</p>${designLocusSvg(model,cases,requirements)}<p>Linha verde tracejada: Re(s)=−4/Ts alvo, estimativa de segunda ordem; o gráfico não certifica atendimento.</p>${designStepSvg(cases)}<p>As respostas são exibidas de 0 a 12 s; as métricas usam o horizonte adaptativo completo de cada ganho.</p><h2>Respostas às questões</h2><ol><li><strong>Faixa de estabilidade:</strong> ${escape(stabilityDescription(model))}</li><li><strong>Aumentar K sempre acelera?</strong> Não. A frequência pode aumentar enquanto o amortecimento diminui; polos próximos ao eixo imaginário prolongam as oscilações e a acomodação.</li><li><strong>Há ganho que atende?</strong> ${escape(designConclusion(search))}</li><li><strong>Compromisso limitante:</strong> ${best?`o menor Ts encontrado respeitando Mp foi ${designNumber(best.settlingTime)} s, em K≈${designNumber(best.gain,6)}, com Mp≈${designNumber(best.overshoot)}%. Compare com ${requirements.settlingTime} s.`:'Nenhum candidato com métricas confirmadas respeitou o limite de sobressinal na faixa pesquisada, ou a busca não foi executada.'}</li><li><strong>Explicação pelo LGR:</strong> o semiplano esquerdo indica decaimento, o eixo imaginário marca a fronteira e polos no semiplano direito indicam crescimento. A distância ao eixo e o ângulo dos polos explicam a duração e a oscilação dos transitórios.</li><li><strong>Previsão versus simulação:</strong> a tabela confronta a aproximação pelo polo dominante com a resposta completa. Para a planta de terceira ordem, a contribuição do terceiro polo e os resíduos tornam as previsões de segunda ordem aproximadas.</li></ol><h2>Conclusão</h2><p>${escape(designConclusion(search))}</p><p>Não foi introduzido PI, PD ou PID. Uma demonstração matemática de inviabilidade contínua exigiria análise adicional além da busca finita. O resultado válido do experimento pode ser a ausência de solução entre os ganhos avaliados.</p></html>`;
}
