import { PerformanceCase, PerformanceLimits, GainSweep, PerformanceModel } from './performanceAnalysis';
import { calculateRootLocus } from './rootLocus';
import { axisTicks } from './timePlot';

export const performanceNumber = (value: number | null, digits = 3) => value === null || !Number.isFinite(value) ? '—' : Number(value.toFixed(digits)).toString();
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]!));
const colors = ['#0891b2', '#7c3aed', '#ea580c', '#059669', '#db2777', '#2563eb', '#b45309', '#475569'];
export function stabilityDescription(model: PerformanceModel): string {
  const intervals = model.stability.stabilityCondition?.intervals;
  if (!intervals) return model.stability.alwaysNonStable ? 'Nenhum intervalo assintoticamente estável.' : 'Intervalo não resolvido simbolicamente; consulte Routh e a análise numérica.';
  const positive = intervals.filter(interval => interval.upper > 0).map(interval => ({ lower: Math.max(0, interval.lower), upper: interval.upper }));
  return positive.length ? positive.map(interval => `${performanceNumber(interval.lower,6)} < K${interval.upper === Infinity ? '' : ` < ${performanceNumber(interval.upper,6)}`}`).join(' ou ') : 'Nenhum K positivo assintoticamente estável.';
}
interface PlotLine { name: string; color: string; points: { x: number; y: number }[]; markers?: boolean }
function svgPlot(title: string, xLabel: string, yLabel: string, lines: PlotLine[], range: [number, number, number, number], decorations = ''): string {
  const [xmin,xmax,ymin,ymax] = range;
  const x = (value:number) => 64 + (value-xmin)/(xmax-xmin)*584;
  const y = (value:number) => 300 - (value-ymin)/(ymax-ymin)*242;
  const grid = axisTicks(xmin,xmax,6).map(value => `<path d="M${x(value)},58V300" stroke="#e2e8f0"/><text x="${x(value)}" y="319" text-anchor="middle">${performanceNumber(value)}</text>`).join('') +
    axisTicks(ymin,ymax,5).map(value => `<path d="M64,${y(value)}H648" stroke="#e2e8f0"/><text x="56" y="${y(value)+4}" text-anchor="end">${performanceNumber(value)}</text>`).join('');
  const paths = lines.map(line => {
    if (line.markers) return line.points.filter(point => Number.isFinite(point.x)&&Number.isFinite(point.y)).map(point => `<circle cx="${x(point.x)}" cy="${y(point.y)}" r="4" fill="${line.color}" stroke="white"><title>${escape(line.name)}: ${performanceNumber(point.x)} + j${performanceNumber(point.y)}</title></circle>`).join('');
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
export function performanceLocusSvg(model: PerformanceModel, cases: PerformanceCase[], requirements: PerformanceLimits = {}): string {
  const locus = calculateRootLocus(model.system, Math.max(100,...cases.map(item=>item.gain*1.15)));
  const points = [...locus.branches.flat(),...cases.flatMap(item=>item.poles)];
  const left = Math.min(-2,...points.map(point=>point.re))*1.2;
  const right = Math.max(1,...points.map(point=>point.re))*1.2;
  const height = Math.max(2,...points.map(point=>Math.abs(point.im)))*1.2;
  const x = (value:number) => 64+(value-left)/(right-left)*584;
  const sigma = requirements.settlingTime === undefined ? null : -4/requirements.settlingTime;
  const line = sigma === null ? '' : `<path d="M${x(sigma)},58V300" stroke="#16a34a" stroke-dasharray="5 4"><title>Estimativa Ts ≈ 4/σ; não é critério exato para a planta de ordem superior.</title></path>`;
  return svgPlot('LGR e polos de malha fechada', 'Re(s) (s⁻¹)', 'Im(s) (rad/s)', [
    ...locus.branches.map(branch=>({name:'LGR',color:'#94a3b8',points:branch.map(point=>({x:point.re,y:point.im}))})),
    ...cases.map((item,i)=>({name:`K = ${performanceNumber(item.gain,5)}`,color:colors[i%colors.length],markers:true,points:item.poles.map(point=>({x:point.re,y:point.im}))})),
  ],[left,right,-height,height],line);
}
export function performanceStepSvg(cases: PerformanceCase[], horizon = 12): string {
  const lines = cases.map((item,i)=>({name:`K = ${performanceNumber(item.gain,5)}`,color:colors[i%colors.length],points:item.response?.t.map((time,j)=>({x:time,y:item.response!.y[j]}))??[]}));
  const values = lines.flatMap(line=>line.points.filter(point=>point.x<=horizon&&Number.isFinite(point.y)).map(point=>point.y));
  const low = Math.min(0,...values), high = Math.max(1.05,...values);
  const margin = (high-low)*0.08;
  return svgPlot('Respostas ao degrau unitário', 'Tempo (s)', 'Saída y(t) (adimensional)', lines,[0,horizon,low-margin,high+margin]);
}

export type SweepMetric = 'overshoot' | 'settlingTime' | 'damping' | 'naturalFrequency';
export function sweepMetricSvg(sweep: GainSweep, metric: SweepMetric): string {
  const names = { overshoot: 'Sobressinal (%)', settlingTime: 'Acomodação de 2% (s)', damping: 'Amortecimento (ζ)', naturalFrequency: 'Frequência natural (rad/s)' };
  const points = sweep.cases.map(item => ({ x: item.gain, y: item[metric] ?? NaN }));
  const values = points.map(point => point.y).filter(Number.isFinite);
  const low = Math.min(0, ...values), high = Math.max(1, ...values);
  return svgPlot(names[metric] + ' em função de K', 'Ganho K', names[metric],
    [{ name: names[metric], color: '#0891b2', points }], [sweep.options.min,sweep.options.max,low-(high-low)*0.05,high+(high-low)*0.1]);
}
