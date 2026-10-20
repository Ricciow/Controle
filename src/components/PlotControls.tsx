import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

export function PlotControls({ onZoom, onPan, onReset }: {
  onZoom: (factor: number) => void;
  onPan: (x: number, y: number) => void;
  onReset: () => void;
}) {
  return <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
    {[
      { label: 'Aumentar zoom', icon: ZoomIn, action: () => onZoom(0.5) },
      { label: 'Reduzir zoom', icon: ZoomOut, action: () => onZoom(2) },
      { label: 'Mover para a esquerda', icon: ChevronLeft, action: () => onPan(0.25, 0) },
      { label: 'Mover para a direita', icon: ChevronRight, action: () => onPan(-0.25, 0) },
      { label: 'Mover para cima', icon: ChevronUp, action: () => onPan(0, 0.25) },
      { label: 'Mover para baixo', icon: ChevronDown, action: () => onPan(0, -0.25) },
      { label: 'Restaurar escala', icon: RotateCcw, action: onReset },
    ].map(({ label, icon: Icon, action }) => <button key={label} type="button" title={label} aria-label={label} onClick={action}
      className="rounded-md p-1 hover:bg-slate-200 dark:hover:bg-slate-800"><Icon className="h-3.5 w-3.5" /></button>)}
  </div>;
}
