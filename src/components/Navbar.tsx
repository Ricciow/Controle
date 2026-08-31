import React from 'react';
import { 
  Activity, 
  Target, 
  BarChart2, 
  Compass, 
  Table, 
  Moon, 
  Sun,
  Check
} from 'lucide-react';

export interface EnabledGraphs {
  step: boolean;
  roots: boolean;
  bode: boolean;
  nyquist: boolean;
  table: boolean;
}

interface NavbarProps {
  enabledGraphs: EnabledGraphs;
  onToggleGraph: (key: keyof EnabledGraphs) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  enabledGraphs,
  onToggleGraph,
  isDark,
  onToggleTheme,
}) => {
  const graphToggles = [
    { key: 'step' as const, label: 'Resposta Temporal', icon: Activity },
    { key: 'roots' as const, label: 'Polos & Zeros', icon: Target },
    { key: 'bode' as const, label: 'Bode', icon: BarChart2 },
    { key: 'nyquist' as const, label: 'Nyquist', icon: Compass },
    { key: 'table' as const, label: 'Métricas', icon: Table },
  ];

  return (
    <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/90 z-40 px-3 sm:px-4 py-2 flex-shrink-0 transition-colors">
      <div className="w-full flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
        {/* Top Row on Mobile / Left Section on Desktop */}
        <div className="flex items-center justify-between md:justify-start gap-2.5">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-base text-slate-900 dark:text-slate-100 tracking-tight">
              Control<span className="text-cyan-600 dark:text-cyan-400">Lab</span>
            </h1>
            <span className="text-slate-300 dark:text-slate-700 font-light text-xs hidden sm:inline">|</span>
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium hidden sm:inline">
              Analisador de Funções de Transferência
            </span>
          </div>

          {/* Theme button on mobile (top right) */}
          <div className="flex items-center md:hidden">
            <button
              onClick={onToggleTheme}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors shadow-sm"
              title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Center / Carousel: Graph On/Off Toggle Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto max-w-full touch-pan-x">
          <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 px-2 tracking-wider hidden xl:inline">
            Gráficos:
          </span>
          {graphToggles.map(({ key, label, icon: Icon }) => {
            const isEnabled = enabledGraphs[key];
            return (
              <button
                key={key}
                onClick={() => onToggleGraph(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all select-none flex-shrink-0 ${
                  isEnabled
                    ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-500 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800/60 bg-white/70 dark:bg-slate-950/40 border border-slate-200 dark:border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
                {isEnabled && <Check className="w-3 h-3 text-cyan-100 ml-0.5" />}
              </button>
            );
          })}
        </div>

        {/* Right Tools (Desktop only): Light/Dark Mode Toggle */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={onToggleTheme}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shadow-sm"
            title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
