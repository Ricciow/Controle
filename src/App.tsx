import React, { useState, useEffect } from 'react';
import { Activity, Layers, Table, Plus, Sparkles } from 'lucide-react';
import { Navbar, EnabledGraphs } from './components/Navbar';
import { SystemList } from './components/SystemList';
import { PoleZeroPlot } from './components/PoleZeroPlot';
import { StepResponsePlot } from './components/StepResponsePlot';
import { BodePlot } from './components/BodePlot';
import { NyquistPlot } from './components/NyquistPlot';
import { MetricsTable } from './components/MetricsTable';
import { PresetsModal } from './components/PresetsModal';
import { AddSystemModal } from './components/AddSystemModal';
import { TransferFunction, PresetItem } from './core/types';
import { Analyzer } from './core/analyzer';

const INITIAL_COLORS = [
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#a855f7', // Purple
  '#f43f5e', // Rose
  '#3b82f6', // Blue
  '#84cc16', // Lime
  '#ec4899', // Pink
];

export const App: React.FC = () => {
  const [isDark, setIsDark] = useState<boolean>(true);
  const [isPresetsOpen, setIsPresetsOpen] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'graphs' | 'systems' | 'table'>('graphs');

  // Enabled graphs: Step Response, Pole-Zero Map, and Metrics Table active by default
  const [enabledGraphs, setEnabledGraphs] = useState<EnabledGraphs>({
    step: true,
    roots: true,
    bode: false,
    nyquist: false,
    table: true,
  });

  // Initialize with ONE standard 2nd-order underdamped system
  const [systems, setSystems] = useState<TransferFunction[]>(() => {
    const sys1 = Analyzer.createDefaultFunction('1', 'G₁(s)', INITIAL_COLORS[0], '25 / (s^2 + 2s + 25)');
    return [sys1];
  });

  // Dark / Light mode toggle effect
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }, [isDark]);

  // Handlers
  const handleToggleGraph = (key: keyof EnabledGraphs) => {
    setEnabledGraphs(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleOpenAddModal = () => {
    setIsAddModalOpen(true);
  };

  const handleAddSystem = (newSystem: TransferFunction) => {
    setSystems([...systems, newSystem]);
  };

  const handleUpdateSystem = (updated: TransferFunction) => {
    const reAnalyzed = Analyzer.analyzeTransferFunction(updated);
    setSystems(systems.map(s => (s.id === updated.id ? reAnalyzed : s)));
  };

  const handleDuplicateSystem = (system: TransferFunction) => {
    const nextIndex = systems.length + 1;
    const color = INITIAL_COLORS[(nextIndex - 1) % INITIAL_COLORS.length];
    const dup: TransferFunction = {
      ...system,
      id: Date.now().toString(),
      name: `${system.name} (cópia)`,
      color
    };
    const analyzed = Analyzer.analyzeTransferFunction(dup);
    setSystems([...systems, analyzed]);
  };

  const handleDeleteSystem = (id: string) => {
    setSystems(systems.filter(s => s.id !== id));
  };

  const handleSelectPreset = (preset: PresetItem) => {
    const nextIndex = systems.length + 1;
    const color = INITIAL_COLORS[(nextIndex - 1) % INITIAL_COLORS.length];
    const newSys = Analyzer.createDefaultFunction(
      Date.now().toString(),
      `G${nextIndex}(s)`,
      color,
      preset.expression
    );
    setSystems([...systems, newSys]);
  };

  const nextIndex = systems.length + 1;
  const suggestedName = `G${nextIndex}(s)`;
  const suggestedColor = INITIAL_COLORS[(nextIndex - 1) % INITIAL_COLORS.length];

  const hasAnyGraph = enabledGraphs.step || enabledGraphs.roots || enabledGraphs.bode || enabledGraphs.nyquist;
  const activeGraphCount = (enabledGraphs.step ? 1 : 0) + (enabledGraphs.roots ? 1 : 0) + (enabledGraphs.bode ? 1 : 0) + (enabledGraphs.nyquist ? 1 : 0);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden transition-colors">
      {/* Top Navbar */}
      <Navbar
        enabledGraphs={enabledGraphs}
        onToggleGraph={handleToggleGraph}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
      />

      {/* Mobile Top View Switcher (< lg) */}
      <div className="lg:hidden flex items-center justify-around bg-white/95 dark:bg-slate-950/95 border-b border-slate-200 dark:border-slate-800/90 px-3 py-1.5 flex-shrink-0 z-30 shadow-xs">
        <button
          onClick={() => setMobileTab('graphs')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mobileTab === 'graphs'
              ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-500'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Gráficos</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            mobileTab === 'graphs' ? 'bg-cyan-700/80 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}>
            {activeGraphCount}
          </span>
        </button>

        <button
          onClick={() => setMobileTab('systems')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mobileTab === 'systems'
              ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-500'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Sistemas</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            mobileTab === 'systems' ? 'bg-cyan-700/80 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}>
            {systems.length}
          </span>
        </button>

        <button
          onClick={() => setMobileTab('table')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mobileTab === 'table'
              ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-500'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
          }`}
        >
          <Table className="w-3.5 h-3.5" />
          <span>Métricas</span>
        </button>
      </div>

      {/* Main Workspace Layout with Separate Scrollbars */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 w-full">
        {/* Left Sidebar: Multi-System Management (Independent Scrollbar on Desktop, Tab on Mobile) */}
        <div className={`h-full min-h-0 ${mobileTab === 'systems' ? 'flex flex-col flex-1 w-full' : 'hidden lg:flex lg:flex-col'}`}>
          <SystemList
            systems={systems}
            onAddSystem={handleOpenAddModal}
            onUpdateSystem={handleUpdateSystem}
            onDuplicateSystem={handleDuplicateSystem}
            onDeleteSystem={handleDeleteSystem}
            onOpenPresets={() => setIsPresetsOpen(true)}
            onViewGraphs={() => setMobileTab('graphs')}
          />
        </div>

        {/* Center / Right Content: Unified Graph Panel & Metrics Table */}
        <main
          className={`flex-1 h-full overflow-y-auto p-3.5 sm:p-4 lg:p-5 min-h-0 bg-slate-100/60 dark:bg-slate-950/40 ${
            mobileTab === 'systems' ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="space-y-4 sm:space-y-5 pb-8 lg:pb-0">
            {/* Quick Action Shortcuts Bar for Mobile */}
            <div className="flex items-center justify-between gap-2 lg:hidden bg-white/70 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {systems.length} {systems.length === 1 ? 'função ativa' : 'funções ativas'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsPresetsOpen(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/50"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Exemplos</span>
                </button>
                <button
                  onClick={handleOpenAddModal}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs"
                >
                  <Plus className="w-3 h-3" />
                  <span>Adicionar</span>
                </button>
              </div>
            </div>

            {/* Graphs Grid (Shown when on graphs tab or on desktop) */}
            {(mobileTab === 'graphs' || window.innerWidth >= 1024) && hasAnyGraph && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
                {/* 1. Resposta Temporal */}
                {enabledGraphs.step && (
                  <div className="h-[340px] sm:h-[390px] xl:h-[440px]">
                    <StepResponsePlot systems={systems} />
                  </div>
                )}

                {/* 2. Plano de Polos & Zeros */}
                {enabledGraphs.roots && (
                  <div className="h-[340px] sm:h-[390px] xl:h-[440px]">
                    <PoleZeroPlot systems={systems} />
                  </div>
                )}

                {/* 3. Diagrama de Bode */}
                {enabledGraphs.bode && (
                  <div className="h-[390px] sm:h-[440px] xl:h-[480px]">
                    <BodePlot systems={systems} />
                  </div>
                )}

                {/* 4. Diagrama de Nyquist */}
                {enabledGraphs.nyquist && (
                  <div className="h-[380px] sm:h-[420px] xl:h-[460px]">
                    <NyquistPlot systems={systems} />
                  </div>
                )}
              </div>
            )}

            {/* Metrics Comparison Table */}
            {(mobileTab === 'table' || (mobileTab === 'graphs' && enabledGraphs.table) || window.innerWidth >= 1024) && enabledGraphs.table && (
              <div className={mobileTab === 'table' ? 'block' : ''}>
                <MetricsTable systems={systems} />
              </div>
            )}

            {/* If no graphs or tables are enabled */}
            {!hasAnyGraph && !enabledGraphs.table && (
              <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-slate-500 dark:text-slate-400 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/30 p-4 text-center">
                <p className="text-sm font-medium mb-3">Nenhum gráfico selecionado no momento.</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => handleToggleGraph('step')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
                  >
                    Ativar Resposta ao Degrau
                  </button>
                  <button
                    onClick={() => handleToggleGraph('roots')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                  >
                    Ativar Polos e Zeros
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add System Form Modal */}
      <AddSystemModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddSystem}
        suggestedName={suggestedName}
        suggestedColor={suggestedColor}
      />

      {/* Presets Modal */}
      <PresetsModal
        isOpen={isPresetsOpen}
        onClose={() => setIsPresetsOpen(false)}
        onSelectPreset={handleSelectPreset}
      />
    </div>
  );
};

export default App;
