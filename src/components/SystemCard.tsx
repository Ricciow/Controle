import React, { useState } from 'react';
import { 
  Eye, 
  EyeOff, 
  Trash2, 
  Copy, 
  AlertCircle, 
  HelpCircle
} from 'lucide-react';
import { TransferFunction, InputMode } from '../core/types';
import { MathView } from './MathView';
import { ComplexMath } from '../core/complex';

interface SystemCardProps {
  system: TransferFunction;
  onUpdate: (updated: TransferFunction) => void;
  onDuplicate: (system: TransferFunction) => void;
  onDelete: (id: string) => void;
}

const PALETTE = [
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#3b82f6', // Blue
  '#84cc16', // Lime
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
];

export const SystemCard: React.FC<SystemCardProps> = ({
  system,
  onUpdate,
  onDuplicate,
  onDelete,
}) => {
  const [showFactored, setShowFactored] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleModeChange = (mode: InputMode) => {
    onUpdate({
      ...system,
      inputMode: mode
    });
  };

  const handleExpressionChange = (expr: string) => {
    onUpdate({
      ...system,
      rawExpression: expr
    });
  };

  const handleCoeffsChange = (numStr: string, denStr: string) => {
    onUpdate({
      ...system,
      numStr,
      denStr
    });
  };

  const handleColorSelect = (color: string) => {
    onUpdate({ ...system, color });
    setShowColorPicker(false);
  };

  return (
    <div 
      className={`rounded-xl border transition-all duration-200 bg-white dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 shadow-sm ${
        system.visible 
          ? 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700' 
          : 'border-slate-200/50 dark:border-slate-800/50 opacity-60'
      }`}
      style={{
        borderLeftColor: system.color,
        borderLeftWidth: '4px'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/40">
        <div className="flex items-center gap-2.5">
          {/* Color Tag Button */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="w-4 h-4 rounded-full transition-transform hover:scale-125 focus:outline-none ring-2 ring-slate-300 dark:ring-slate-700/50"
              style={{ backgroundColor: system.color }}
              title="Mudar cor do sistema"
            />
            {showColorPicker && (
              <div className="absolute top-6 left-0 z-50 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl grid grid-cols-5 gap-1.5 w-36">
                {PALETTE.map(c => (
                  <button
                    key={c}
                    onClick={() => handleColorSelect(c)}
                    className="w-5 h-5 rounded-full hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}
          </div>

          <input
            type="text"
            value={system.name}
            onChange={(e) => onUpdate({ ...system, name: e.target.value })}
            className="bg-transparent font-semibold text-sm text-slate-900 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 focus:bg-slate-100 dark:focus:bg-slate-800 focus:outline-none px-1.5 py-0.5 rounded transition-colors w-32"
            placeholder="Nome do sistema"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onUpdate({ ...system, visible: !system.visible })}
            className={`p-1.5 rounded-lg transition-colors ${
              system.visible 
                ? 'text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10' 
                : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={system.visible ? 'Ocultar dos gráficos' : 'Mostrar nos gráficos'}
          >
            {system.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          
          <button
            onClick={() => onDuplicate(system)}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Duplicar sistema"
          >
            <Copy className="w-4 h-4" />
          </button>

          <button
            onClick={() => onDelete(system.id)}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
            title="Excluir sistema"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Input Mode Selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center bg-slate-100 dark:bg-slate-950/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => handleModeChange('expression')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                system.inputMode === 'expression'
                  ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Expressão Natural (s)
            </button>
            <button
              onClick={() => handleModeChange('coefficients')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                system.inputMode === 'coefficients'
                  ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Coeficientes
            </button>
          </div>

          <button
            onClick={() => setShowHelp(!showHelp)}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1 transition-colors"
            title="Exemplos de sintaxe"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Sintaxe</span>
          </button>
        </div>

        {/* Syntax Quick Help */}
        {showHelp && (
          <div className="p-2.5 bg-slate-50 dark:bg-slate-950/90 rounded-lg border border-slate-200 dark:border-cyan-500/20 text-xs text-slate-700 dark:text-slate-300 space-y-1">
            <div className="font-semibold text-cyan-600 dark:text-cyan-400">Exemplos aceitos no modo expressão:</div>
            <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
              <li><span className="text-slate-900 dark:text-slate-200 font-bold">25 / (s^2 + 2s + 25)</span> (segunda ordem)</li>
              <li><span className="text-slate-900 dark:text-slate-200 font-bold">(2s + 5^2)/(1/2s)</span> (potências e frações)</li>
              <li><span className="text-slate-900 dark:text-slate-200 font-bold">(s + 1)*(s + 3) / (s^2 + 4s + 13)</span> (produtos)</li>
              <li><span className="text-slate-900 dark:text-slate-200 font-bold">10 / (s^3 + 2s^2 + 5s + 10)</span> (alta ordem)</li>
            </ul>
          </div>
        )}

        {/* Inputs */}
        {system.inputMode === 'expression' ? (
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Função de Transferência <span className="font-mono text-cyan-600 dark:text-cyan-400">H(s)</span>:
            </label>
            <input
              type="text"
              value={system.rawExpression}
              onChange={(e) => handleExpressionChange(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
              placeholder="Ex: 25 / (s^2 + 2s + 25)"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Numerador <span className="text-[10px] text-slate-400 dark:text-slate-500">(s^m ... s^0)</span>:
              </label>
              <input
                type="text"
                value={system.numStr}
                onChange={(e) => handleCoeffsChange(e.target.value, system.denStr)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                placeholder="Ex: 25"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Denominador <span className="text-[10px] text-slate-400 dark:text-slate-500">(s^n ... s^0)</span>:
              </label>
              <input
                type="text"
                value={system.denStr}
                onChange={(e) => handleCoeffsChange(system.numStr, e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                placeholder="Ex: 1, 2, 25"
              />
            </div>
          </div>
        )}

        {/* Error Display */}
        {system.error && (
          <div className="flex items-center gap-1.5 p-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{system.error}</span>
          </div>
        )}

        {/* LaTeX Math Preview */}
        {!system.error && system.latex && (
          <div className="bg-slate-50 dark:bg-slate-950/60 rounded-lg p-2.5 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center relative group">
            <div className="text-center overflow-x-auto max-w-full py-1 text-slate-900 dark:text-slate-100">
              <MathView 
                math={`${system.name} = ${showFactored && system.factoredLatex ? system.factoredLatex : system.latex}`} 
                block 
              />
            </div>
            
            {/* Factored form toggle */}
            {system.factoredLatex && (
              <button
                onClick={() => setShowFactored(!showFactored)}
                className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
              >
                {showFactored ? '← Ver forma polinomial' : 'Ver forma fatorada (zeros/polos) →'}
              </button>
            )}
          </div>
        )}

        {/* Quick Roots & Parameters Info */}
        {system.analysis && (
          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="bg-slate-50 dark:bg-slate-950/40 rounded p-2 border border-slate-200 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400 font-medium block mb-1">
                Polos ({system.analysis.poles.length}):
              </span>
              <div className="font-mono text-slate-900 dark:text-slate-200 text-[11px] truncate" title={system.analysis.poles.map(p => ComplexMath.format(p)).join(', ')}>
                {system.analysis.poles.length > 0 
                  ? system.analysis.poles.map(p => ComplexMath.format(p)).join(', ') 
                  : 'Nenhum'}
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/40 rounded p-2 border border-slate-200 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400 font-medium block mb-1">
                Zeros ({system.analysis.zeros.length}):
              </span>
              <div className="font-mono text-slate-900 dark:text-slate-200 text-[11px] truncate" title={system.analysis.zeros.map(z => ComplexMath.format(z)).join(', ')}>
                {system.analysis.zeros.length > 0 
                  ? system.analysis.zeros.map(z => ComplexMath.format(z)).join(', ') 
                  : 'Nenhum'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
