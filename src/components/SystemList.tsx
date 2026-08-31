import React from 'react';
import { Plus, Sparkles, Layers, Activity } from 'lucide-react';
import { TransferFunction } from '../core/types';
import { SystemCard } from './SystemCard';

interface SystemListProps {
  systems: TransferFunction[];
  onAddSystem: () => void;
  onUpdateSystem: (updated: TransferFunction) => void;
  onDuplicateSystem: (system: TransferFunction) => void;
  onDeleteSystem: (id: string) => void;
  onOpenPresets: () => void;
  onViewGraphs?: () => void;
}

export const SystemList: React.FC<SystemListProps> = ({
  systems,
  onAddSystem,
  onUpdateSystem,
  onDuplicateSystem,
  onDeleteSystem,
  onOpenPresets,
  onViewGraphs,
}) => {
  const visibleCount = systems.filter(s => s.visible).length;

  return (
    <aside className="flex flex-col h-full bg-slate-50/70 dark:bg-slate-950/70 border-r border-slate-200 dark:border-slate-800/80 w-full lg:w-[380px] xl:w-[410px] flex-shrink-0 overflow-hidden transition-colors">
      {/* Header Actions - Fixed at top of list */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h2 className="font-semibold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Sistemas Ativos ({systems.length})
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenPresets}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/50 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 transition-colors shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Exemplos</span>
          </button>

          <button
            onClick={onAddSystem}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-sm active:scale-95 font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar</span>
          </button>
        </div>
      </div>

      {/* Systems List - Independent Vertical Scrollbar */}
      <div className="space-y-3 flex-1 overflow-y-auto p-3.5">
        {systems.map((sys) => (
          <SystemCard
            key={sys.id}
            system={sys}
            onUpdate={onUpdateSystem}
            onDuplicate={onDuplicateSystem}
            onDelete={onDeleteSystem}
          />
        ))}

        {systems.length === 0 && (
          <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/20 text-slate-500 dark:text-slate-400">
            <p className="text-sm font-medium mb-3">Nenhum sistema adicionado</p>
            <button
              onClick={onAddSystem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar Função
            </button>
          </div>
        )}

        {/* Mobile Quick Action to View Graphs */}
        {onViewGraphs && systems.length > 0 && (
          <div className="pt-2 pb-6 lg:hidden">
            <button
              onClick={onViewGraphs}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm shadow-lg shadow-cyan-600/25 active:scale-98 transition-all"
            >
              <Activity className="w-4 h-4" />
              <span>Ver Gráficos ({visibleCount} visíveis) →</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

