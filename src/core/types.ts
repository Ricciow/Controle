export interface Complex {
  re: number;
  im: number;
}

export type InputMode = 'expression' | 'coefficients';

export type StabilityStatus = 'STABLE' | 'MARGINALLY_STABLE' | 'UNSTABLE';

export interface SystemMetrics {
  riseTime: number | null; // 10% to 90% (or 0% to 100% for overdamped)
  peakTime: number | null;
  settlingTime: number | null; // 2% criterion
  overshootPercent: number | null;
  steadyStateValue: number | null;
  dcGain: number | null;
  naturalFrequency: number | null; // wn for dominant second order pair
  dampingRatio: number | null; // zeta
  gainMarginDb: number | null;
  phaseMarginDeg: number | null;
  gainCrossoverFreq: number | null;
  phaseCrossoverFreq: number | null;
  bandwidth: number | null;
}

export interface SimulationResult {
  t: number[];
  y: number[];
}

export interface BodeData {
  w: number[];
  magDb: number[];
  phaseDeg: number[];
}

export interface NyquistPoint {
  re: number;
  im: number;
  w: number;
}

export interface SystemAnalysis {
  poles: Complex[];
  zeros: Complex[];
  isProper: boolean;
  stability: StabilityStatus;
  stepResponse: SimulationResult;
  impulseResponse: SimulationResult;
  bode: BodeData;
  nyquist: NyquistPoint[];
  metrics: SystemMetrics;
}

export interface TransferFunction {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  inputMode: InputMode;
  rawExpression: string; // e.g. "(2s + 5^2)/(1/2s)"
  numStr: string;        // e.g. "2, 25"
  denStr: string;        // e.g. "0.5, 0"
  numerator: number[];   // [2, 25]
  denominator: number[]; // [0.5, 0]
  latex: string;
  factoredLatex: string;
  error?: string | null;
  analysis?: SystemAnalysis;
}

export interface PresetItem {
  id: string;
  category: string;
  name: string;
  description: string;
  expression: string;
  numerator: number[];
  denominator: number[];
}

export interface SecondOrderParams {
  isSecondOrder: boolean;
  wn: number | null;
  zeta: number | null;
  a: number | null;
  b: number | null;
  c: number | null;
}

