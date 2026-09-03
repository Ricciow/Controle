import React, { useState } from 'react';
import { 
  Eye, 
  EyeOff, 
  Trash2, 
  Copy, 
  AlertCircle, 
  HelpCircle,
  Sliders
} from 'lucide-react';
import { TransferFunction, InputMode } from '../core/types';
import { MathView } from './MathView';
import { ComplexMath } from '../core/complex';
import { Analyzer } from '../core/analyzer';

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

const PRESET_ZETAS = [
  { label: '0.0', desc: 'Oscilatório', val: 0 },
  { label: '0.2', desc: 'Subamortecido', val: 0.2 },
  { label: '0.5', desc: 'Subamortecido', val: 0.5 },
  { label: '0.707', desc: 'Ótimo (Mp ≈ 4.3%)', val: 0.707 },
  { label: '1.0', desc: 'Crítico', val: 1.0 },
  { label: '1.5', desc: 'Sobreamortecido', val: 1.5 },
];

const getRegimeInfo = (zeta: number) => {
  if (zeta < -1e-4) {
    return {
      label: 'Instável (Amortecimento negativo)',
      badgeClass: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
    };
  }
  if (Math.abs(zeta) <= 1e-4) {
    return {
      label: 'Não-amortecido (Oscilatório puro)',
      badgeClass: 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/30'
    };
  }
  if (zeta < 0.999) {
    return {
      label: 'Subamortecido (Oscilações)',
      badgeClass: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
    };
  }
  if (Math.abs(zeta - 1.0) <= 0.005) {
    return {
      label: 'Criticamente amortecido',
      badgeClass: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
    };
  }
  return {
    label: 'Sobreamortecido (Suave)',
    badgeClass: 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30'
  };
};

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

  const params = Analyzer.getSecondOrderParams(system);
  const currentZeta = params.zeta !== null ? Number(params.zeta.toFixed(3)) : 0;
  const regime = getRegimeInfo(currentZeta);
  const minSlider = Math.min(0, Math.floor(currentZeta * 10) / 10);
  const maxSlider = Math.max(2.0, Math.ceil(currentZeta * 10) / 10);

  const handleZetaChange = (val: number) => {
    const updated = Analyzer.updateDampingRatio(system, val);
    onUpdate(updated);
  };

  const handleConvertToSecondOrder = () => {
    const updated = Analyzer.convertToSecondOrder(system, 0.5, 5);
    onUpdate(updated);
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
            className="bg-transparent font-semibold text-sm text-slate-900 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 focus:bg-slate-100 dark:focus:bg-slate-800 focus:outline-none px-1.5 py-0.5 rounded transition-colors w-28 sm:w-36 min-w-0"
            placeholder="Nome do sistema"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
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
      <div className="p-3.5 sm:p-4 space-y-3">
        {/* Input Mode Selector */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-950/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] sm:text-xs">
            <button
              onClick={() => handleModeChange('expression')}
              className={`px-2 sm:px-2.5 py-1 rounded-md font-medium transition-all ${
                system.inputMode === 'expression'
                  ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Expressão (s)
            </button>
            <button
              onClick={() => handleModeChange('coefficients')}
              className={`px-2 sm:px-2.5 py-1 rounded-md font-medium transition-all ${
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

        {/* Damping Ratio (ζ) Control Section */}
        {!system.error && (
          params.isSecondOrder && params.zeta !== null ? (
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 space-y-2.5">
              {/* Header: Title + Numerical input + wn */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Fator de Amortecimento (<span className="font-serif italic font-bold">ζ</span>):
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    min={minSlider}
                    max={maxSlider}
                    value={currentZeta}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) handleZetaChange(val);
                    }}
                    className="w-16 px-1.5 py-0.5 text-xs font-mono font-bold text-right bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-cyan-300 focus:outline-none focus:border-cyan-500"
                    title="Ajuste fino ou digite o valor exato de ζ"
                  />
                  {params.wn !== null && (
                    <span className="text-[10px] text-slate-400 font-mono" title="Frequência natural ωn mantida constante">
                      (ωₙ = {params.wn.toFixed(1)} rad/s)
                    </span>
                  )}
                </div>
              </div>

              {/* Damping Regime Badge */}
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${regime.badgeClass}`}>
                  {regime.label}
                </span>
              </div>

              {/* Continuous Interactive Range Slider */}
              <div className="space-y-1">
                <input
                  type="range"
                  min={minSlider}
                  max={maxSlider}
                  step="0.01"
                  value={currentZeta}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) handleZetaChange(val);
                  }}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer transition-all"
                  style={{ accentColor: system.color }}
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>{minSlider.toFixed(1)}</span>
                  <span className="text-slate-500 font-medium">1.0 (crítico)</span>
                  <span>{maxSlider.toFixed(1)}</span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                <span className="text-[10px] text-slate-400 mr-0.5 font-medium">Atalhos:</span>
                {PRESET_ZETAS.map((pz) => {
                  const isActive = Math.abs(currentZeta - pz.val) < 0.015;
                  return (
                    <button
                      key={pz.val}
                      type="button"
                      onClick={() => handleZetaChange(pz.val)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-all ${
                        isActive
                          ? 'bg-cyan-600 text-white font-bold shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                      title={`${pz.desc} (ζ = ${pz.val})`}
                    >
                      {pz.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs flex items-center justify-between gap-2">
              <div className="text-slate-500 dark:text-slate-400 text-[11px] leading-snug">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">Fator de Amortecimento (ζ):</span>
                Aplicável a sistemas de 2ª ordem (<code className="font-mono">s² + 2ζωₙs + ωₙ²</code>)
              </div>
              <button
                type="button"
                onClick={handleConvertToSecondOrder}
                className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium whitespace-nowrap transition-colors"
                title="Transformar em sistema padrão de 2ª ordem para controlar ζ"
              >
                Adaptar p/ 2ª ordem
              </button>
            </div>
          )
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
