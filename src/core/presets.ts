import { PresetItem } from './types';

export const PRESETS: PresetItem[] = [
  {
    id: 'underdamped_2nd',
    category: 'Sistemas de 2ª Ordem',
    name: 'Subamortecido (ζ = 0.2, ωn = 5 rad/s)',
    description: 'Apresenta oscilações acentuadas e sobressinal elevado (Mp ≈ 52%).',
    expression: '25 / (s^2 + 2s + 25)',
    numerator: [25],
    denominator: [1, 2, 25]
  },
  {
    id: 'critically_damped',
    category: 'Sistemas de 2ª Ordem',
    name: 'Criticamente Amortecido (ζ = 1.0)',
    description: 'Resposta mais rápida possível sem sobressinal (polos reais duplos).',
    expression: '16 / (s^2 + 8s + 16)',
    numerator: [16],
    denominator: [1, 8, 16]
  },
  {
    id: 'overdamped_2nd',
    category: 'Sistemas de 2ª Ordem',
    name: 'Sobreamortecido (ζ = 1.5)',
    description: 'Resposta lenta e suave, sem qualquer oscilação (dois polos reais distintos).',
    expression: '6 / (s^2 + 5s + 6)',
    numerator: [6],
    denominator: [1, 5, 6]
  },
  {
    id: 'first_order_lag',
    category: 'Sistemas Clássicos',
    name: 'Sistema de 1ª Ordem (τ = 0.5s)',
    description: 'Comportamento exponencial simples de carga/descarga.',
    expression: '2 / (s + 2)',
    numerator: [2],
    denominator: [1, 2]
  },
  {
    id: 'integrator',
    category: 'Sistemas Clássicos',
    name: 'Integrador Puro (1/s)',
    description: 'Polo na origem (s = 0), rampa contínua na resposta ao degrau.',
    expression: '1 / s',
    numerator: [1],
    denominator: [1, 0]
  },
  {
    id: 'non_minimum_phase',
    category: 'Comportamentos Especiais',
    name: 'Fase Não-Mínima (Zero no Semiplano Direito)',
    description: 'Causa efeito de "undercut" (mergulho inicial negativo no tempo).',
    expression: '(-s + 2) / (s^2 + 3s + 2)',
    numerator: [-1, 2],
    denominator: [1, 3, 2]
  },
  {
    id: 'unstable_rhp',
    category: 'Estabilidade',
    name: 'Sistema Instável (Polos no Semiplano Direito)',
    description: 'Polos com parte real positiva geram divergência exponencial no tempo.',
    expression: '10 / (s^2 - 0.6s + 9)',
    numerator: [10],
    denominator: [1, -0.6, 9]
  },
  {
    id: 'lead_compensator',
    category: 'Controladores e Compensadores',
    name: 'Compensador por Avanço de Fase (Lead)',
    description: 'Aumenta a margem de fase e a velocidade de resposta do sistema.',
    expression: '10*(s + 1) / (s + 10)',
    numerator: [10, 10],
    denominator: [1, 10]
  },
  {
    id: 'lag_compensator',
    category: 'Controladores e Compensadores',
    name: 'Compensador por Atraso de Fase (Lag)',
    description: 'Melhora o erro em regime estacionário (alto ganho em baixas frequências).',
    expression: '(s + 0.1) / (s + 0.01)',
    numerator: [1, 0.1],
    denominator: [1, 0.01]
  },
  {
    id: 'butterworth_3rd',
    category: 'Filtros',
    name: 'Filtro Butterworth de 3ª Ordem',
    description: 'Resposta de magnitude maximalmente plana na banda passante.',
    expression: '1 / (s^3 + 2s^2 + 2s + 1)',
    numerator: [1],
    denominator: [1, 2, 2, 1]
  }
];

export interface PresetCategory {
  id: string;
  name: string;
  items: PresetItem[];
}

export const PRESET_CATEGORIES: PresetCategory[] = [
  {
    id: '2nd_order',
    name: 'Sistemas de 2ª Ordem',
    items: PRESETS.filter(p => p.category === 'Sistemas de 2ª Ordem')
  },
  {
    id: 'classics',
    name: 'Sistemas Clássicos',
    items: PRESETS.filter(p => p.category === 'Sistemas Clássicos')
  },
  {
    id: 'special',
    name: 'Comportamentos Especiais',
    items: PRESETS.filter(p => p.category === 'Comportamentos Especiais' || p.category === 'Estabilidade')
  },
  {
    id: 'controllers',
    name: 'Controladores & Filtros',
    items: PRESETS.filter(p => p.category === 'Controladores e Compensadores' || p.category === 'Filtros')
  }
];
