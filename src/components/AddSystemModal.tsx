import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, AlertCircle, Sparkles, Check } from 'lucide-react';
import { TransferFunction, InputMode } from '../core/types';
import { Analyzer } from '../core/analyzer';
import { ComplexMath } from '../core/complex';
import { MathView } from './MathView';

interface AddSystemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (newSystem: TransferFunction) => void;
  suggestedName: string;
  suggestedColor: string;
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

export const AddSystemModal: React.FC<AddSystemModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  suggestedName,
  suggestedColor,
}) => {
  const [name, setName] = useState(suggestedName);
  const [color, setColor] = useState(suggestedColor);
  const [inputMode, setInputMode] = useState<InputMode>('expression');
  const [rawExpression, setRawExpression] = useState('');
  const [numStr, setNumStr] = useState('');
  const [denStr, setDenStr] = useState('');

  // Start with empty inputs by default whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setName(suggestedName);
      setColor(suggestedColor);
      setRawExpression('');
      setNumStr('');
      setDenStr('');
      setInputMode('expression');
    }
  }, [isOpen, suggestedName, suggestedColor]);

  // Real-time analysis of draft inputs
  const draftAnalysis = useMemo(() => {
    const isEmpty = inputMode === 'expression'
      ? !rawExpression.trim()
      : (!numStr.trim() || !denStr.trim());

    if (isEmpty) {
      return {
        isEmpty: true,
        error: null,
        latex: '',
        analysis: null,
        system: null
      };
    }

    const draft: TransferFunction = {
      id: 'draft',
      name: name.trim() || 'G(s)',
      color,
      visible: true,
      inputMode,
      rawExpression,
      numStr,
      denStr,
      numerator: [],
      denominator: [],
      latex: '',
      factoredLatex: ''
    };

    const analyzed = Analyzer.analyzeTransferFunction(draft);
    return {
      isEmpty: false,
      error: analyzed.error,
      latex: analyzed.latex,
      analysis: analyzed.analysis,
      system: analyzed
    };
  }, [name, color, inputMode, rawExpression, numStr, denStr]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (draftAnalysis.isEmpty || draftAnalysis.error || !draftAnalysis.system) return;

    const newSystem: TransferFunction = {
      ...draftAnalysis.system,
      id: Date.now().toString(),
      name: name.trim() || suggestedName,
      color,
      visible: true
    };

    onAdd(newSystem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg max-h-[92vh] shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 sm:p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Adicionar Nova Função</h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">Insira a função de transferência para análise imediata</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1">
          {/* Row 1: Name and Color */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Identificador / Nome:
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
                placeholder="Ex: G₂(s)"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Cor nos Gráficos:
              </label>
              <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1">
                {PALETTE.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center ${
                      color === c ? 'ring-2 ring-cyan-500 scale-110' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  >
                    {color === c && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Modo de Entrada:
            </label>
            <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setInputMode('expression')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                  inputMode === 'expression'
                    ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Expressão Natural (s)
              </button>
              <button
                type="button"
                onClick={() => setInputMode('coefficients')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                  inputMode === 'coefficients'
                    ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Coeficientes
              </button>
            </div>
          </div>

          {/* Input Fields */}
          {inputMode === 'expression' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Expressão Matemática em <span className="font-mono text-cyan-600 dark:text-cyan-400">s</span>:
              </label>
              <input
                type="text"
                value={rawExpression}
                onChange={(e) => setRawExpression(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
                placeholder="Ex: 10 / (s^2 + 3s + 10) ou (2s + 5^2)/(1/2s)"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Suporta potências (<code className="font-mono font-bold">5^2</code>), frações (<code className="font-mono font-bold">1/2s</code>), produtos e parênteses.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Numerador <span className="text-[10px] text-slate-400 font-normal">(s^m ... s^0)</span>:
                </label>
                <input
                  type="text"
                  value={numStr}
                  onChange={(e) => setNumStr(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="Ex: 10"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Denominador <span className="text-[10px] text-slate-400 font-normal">(s^n ... s^0)</span>:
                </label>
                <input
                  type="text"
                  value={denStr}
                  onChange={(e) => setDenStr(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="Ex: 1, 3, 10"
                />
              </div>
            </div>
          )}

          {/* Real-time Preview Box */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-3 space-y-2 min-h-[90px] flex flex-col justify-center">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>Pré-visualização LaTeX:</span>
              <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            </div>

            {draftAnalysis.isEmpty ? (
              <div className="py-2 text-center text-slate-400 dark:text-slate-500 text-xs italic">
                Digite a função acima para visualizar a fórmula em LaTeX e suas raízes.
              </div>
            ) : draftAnalysis.error ? (
              <div className="flex items-center gap-2 p-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-lg text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{draftAnalysis.error}</span>
              </div>
            ) : (
              <div className="py-1 text-center text-slate-900 dark:text-slate-100 overflow-x-auto">
                <MathView math={`${name.trim() || 'G(s)'} = ${draftAnalysis.latex}`} block />
              </div>
            )}

            {/* Roots preview */}
            {!draftAnalysis.isEmpty && !draftAnalysis.error && draftAnalysis.analysis && (
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] border-t border-slate-200 dark:border-slate-800/80">
                <div>
                  <span className="text-slate-400 block font-medium">Polos ({draftAnalysis.analysis.poles.length}):</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {draftAnalysis.analysis.poles.length > 0 
                      ? draftAnalysis.analysis.poles.map(p => ComplexMath.format(p)).join(', ') 
                      : 'Nenhum'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Zeros ({draftAnalysis.analysis.zeros.length}):</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {draftAnalysis.analysis.zeros.length > 0 
                      ? draftAnalysis.analysis.zeros.map(z => ComplexMath.format(z)).join(', ') 
                      : 'Nenhum'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={draftAnalysis.isEmpty || !!draftAnalysis.error}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all shadow-md shadow-cyan-600/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Sistema</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
