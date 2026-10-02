export interface RouthRow {
  power: number;
  values: number[];
  signChange: boolean;
  specialCase?: 'auxiliary' | 'epsilon';
}

export interface RouthResult {
  rows: RouthRow[];
  signChanges: number | null;
  status: 'STABLE' | 'UNSTABLE' | 'BOUNDARY' | 'INCONCLUSIVE';
  notes: string[];
}

// Coefficients are ordered from the highest power to the constant term.
function buildArray(coefficients: number[], epsilon: number): RouthRow[] {
  const degree = coefficients.length - 1;
  const columns = Math.ceil(coefficients.length / 2);
  const rows: RouthRow[] = [];
  for (let i = 0; i <= degree; i++) {
    let values = Array<number>(columns).fill(0);
    if (i < 2) {
      values = values.map((_, j) => coefficients[2 * j + i] ?? 0);
    } else {
      const above = rows[i - 2].values;
      const previous = rows[i - 1].values;
      values = values.map((_, j) => {
        const left = above[j + 1] ?? 0;
        const right = above[0] * ((previous[j + 1] ?? 0) / previous[0]);
        const value = left - right;
        // Only cancel round-off relative to the terms involved, never to 1.
        return Math.abs(value) <= Number.EPSILON * 32 * (Math.abs(left) + Math.abs(right)) ? 0 : value;
      });
    }

    const row: RouthRow = { power: degree - i, values, signChange: false };
    if (i > 0 && values.every(value => value === 0)) {
      const auxiliary = rows[i - 1];
      row.values = auxiliary.values.map((value, j) => value * Math.max(0, auxiliary.power - 2 * j));
      row.specialCase = 'auxiliary';
    } else if (values[0] === 0) {
      row.values[0] = Math.max(...values.map(Math.abs)) * epsilon;
      row.specialCase = 'epsilon';
    }
    if (i > 0) row.signChange = Math.sign(row.values[0]) !== Math.sign(rows[i - 1].values[0]);
    rows.push(row);
  }
  return rows;
}

export function analyzeRouth(denominator: number[]): RouthResult {
  if (!denominator.length || denominator.some(value => !Number.isFinite(value))) {
    throw new Error('Use coeficientes reais e finitos no denominador.');
  }
  const first = denominator.findIndex(value => value !== 0);
  if (first < 0) throw new Error('O denominador não pode ser zero.');
  const coefficients = denominator.slice(first);
  const rows = buildArray(coefficients, 1e-8);
  const notes: string[] = [];
  const auxiliaryRows = rows.filter(row => row.specialCase === 'auxiliary');
  const epsilonRows = rows.filter(row => row.specialCase === 'epsilon');
  if (auxiliaryRows.length) {
    notes.push(`Linha nula em ${auxiliaryRows.map(row => `s^${row.power}`).join(', ')}: substituída pela derivada do polinômio auxiliar da linha anterior.`);
  }
  if (epsilonRows.length) {
    notes.push(`Primeiro elemento nulo em ${epsilonRows.map(row => `s^${row.power}`).join(', ')}: usado ε positivo (10⁻⁸ × escala da linha). Os valores seguintes são aproximações numéricas.`);
  }
  const count = (array: RouthRow[]) => array.filter(row => row.signChange).length;
  let signChanges: number | null = count(rows);
  const finite = (array: RouthRow[]) => array.every(row => row.values.every(Number.isFinite) && row.values[0] !== 0);
  if (!finite(rows) || (epsilonRows.length && [1e-6, 1e-10].some(epsilon => {
    const check = buildArray(coefficients, epsilon);
    return !finite(check) || count(check) !== signChanges;
  }))) {
    signChanges = null;
    notes.push('Resultado inconclusivo: a precisão numérica não permite confirmar a contagem de mudanças de sinal.');
  }
  const status = signChanges === null ? 'INCONCLUSIVE'
    : signChanges > 0 ? 'UNSTABLE'
    : auxiliaryRows.length || epsilonRows.length ? 'BOUNDARY' : 'STABLE';
  if (status === 'BOUNDARY') {
    notes.push('Há polos no eixo imaginário, incluindo a origem. Routh não distingue aqui polos simples de repetidos; o sistema não é assintoticamente estável.');
  }
  return { rows, signChanges, status, notes };
}
