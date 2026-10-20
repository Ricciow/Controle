import { PointerEvent, RefObject, useEffect, useRef } from 'react';

export function usePlotDrag(svgRef: RefObject<SVGSVGElement | null>, onPan: (dx: number, dy: number) => void, onZoom: (factor: number) => void) {
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  const callbacks = useRef({ onPan, onZoom });
  callbacks.current = { onPan, onZoom };
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      callbacks.current.onZoom(Math.exp(Math.max(-1, Math.min(1, event.deltaY / 200))));
    };
    svg.addEventListener('wheel', wheel, { passive: false });
    return () => svg.removeEventListener('wheel', wheel);
  });
  const position = (event: PointerEvent<SVGSVGElement>) => {
    const matrix = event.currentTarget.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : null;
  };
  const end = (event: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return {
    onPointerDown: (event: PointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) return;
      const point = position(event);
      if (!point) return;
      if (!pointers.current.size) moved.current = 0;
      pointers.current.set(event.pointerId, point);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<SVGSVGElement>) => {
      const previous = pointers.current.get(event.pointerId);
      const point = position(event);
      if (!previous || !point) return;
      moved.current += Math.hypot(point.x - previous.x, point.y - previous.y);
      const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(previous.x - other.x, previous.y - other.y);
        const after = Math.hypot(point.x - other.x, point.y - other.y);
        if (before > 0 && after > 0) callbacks.current.onZoom(before / after);
      } else callbacks.current.onPan(point.x - previous.x, point.y - previous.y);
      pointers.current.set(event.pointerId, point);
    },
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: (event: PointerEvent<SVGSVGElement>) => { pointers.current.delete(event.pointerId); },
    onClickCapture: (event: React.MouseEvent<SVGSVGElement>) => {
      if (moved.current > 3) { event.preventDefault(); event.stopPropagation(); }
    },
  };
}
