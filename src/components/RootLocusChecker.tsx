import React, { useMemo, useState } from 'react';
import { Complex, TransferFunction } from '../core/types';
import { ComplexMath } from '../core/complex';
import { checkRootLocusPoint, parsePointCoordinate, rootLocusDistances } from '../core/rootLocusCheck';
import { RootLocusDistancePlot } from './RootLocusDistancePlot';

export const RootLocusChecker: React.FC<{
  systems: TransferFunction[];
}> = ({ systems }) => {
  const [real, setReal] = useState('-1');
  const [imaginary, setImaginary] = useState('1');
  const [point, setPoint] = useState<Complex | null>({ re: -1, im: 1 });
  const [inputError, setInputError] = useState('');
  const results = useMemo(() => point ? systems.filter(system => system.visible && system.analysis).map(system => {
    try {
      return { system, result: checkRootLocusPoint(system, point), geometry: rootLocusDistances(system, point), error: null };
    } catch (error) {
      return { system, result: null, geometry: null, error: error instanceof Error ? error.message : 'Não foi possível verificar.' };
    }
  }) : [], [systems, point]);

  return <div className="border-t border-slate-200 dark:border-slate-800 pt-2 space-y-2">
    <p className="font-semibold text-slate-800 dark:text-slate-100">Verificar coordenada no LGR</p>
    <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
      event.preventDefault();
      try {
        const re = parsePointCoordinate(real);
        const im = parsePointCoordinate(imaginary);
        setInputError('');
        setPoint({ re, im });
      } catch (error) {
        setPoint(null);
        setInputError((error as Error).message);
      }
    }}>
      <label className="flex flex-col gap-1">Parte real (σ)
        <input aria-label="Parte real da coordenada" placeholder="sqrt(2)/2" value={real}
          onChange={event => { setReal(event.target.value); setPoint(null); setInputError(''); }}
          className="w-36 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 font-mono" />
      </label>
      <label className="flex flex-col gap-1">Parte imaginária (ω)
        <input aria-label="Parte imaginária da coordenada" placeholder="sqrt(2)/2" value={imaginary}
          onChange={event => { setImaginary(event.target.value); setPoint(null); setInputError(''); }}
          className="w-36 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 font-mono" />
      </label>
      <button type="submit" className="rounded-md bg-cyan-600 px-2.5 py-1.5 font-semibold text-white hover:bg-cyan-500">Verificar coordenada</button>
    </form>
    <div role="status" aria-live="polite" className="space-y-1.5">
      {inputError && <p className="text-rose-600 dark:text-rose-400">{inputError}</p>}
      {point && <p className="font-mono">s = {ComplexMath.format(point, 6)}</p>}
      {results.map(({ system, result, geometry, error }) => <div key={system.id} className="rounded border border-slate-200 dark:border-slate-700 p-2">
        <span className="font-semibold">{system.name}: </span>
        {error ? <span className="text-rose-600 dark:text-rose-400">{error}</span>
          : result?.allGains ? <span>Pertence ao LGR para todo K ≥ 0 em que a planta e a equação característica estejam definidas (polo fixo).</span>
          : result?.belongs ? <>
            <span className="text-emerald-700 dark:text-emerald-400">Pertence ao LGR. </span>
            {result.gains.map(gain => <span key={gain} className="inline-flex flex-wrap items-center gap-1.5 mr-2">
              <span className="font-mono">K ≈ {Number(gain.toPrecision(8))}</span>
            </span>)}
          </> : <span>Não pertence ao LGR para K ≥ 0.</span>}
        {point && geometry && <RootLocusDistancePlot point={point} geometry={geometry} onPointChange={next => {
          setReal(String(next.re));
          setImaginary(String(next.im));
          setPoint(next);
        }} />}
        {result && !geometry && <p className="mt-2 text-slate-500 dark:text-slate-400">Construção geométrica indisponível para esta expressão.</p>}
      </div>)}
      {point && results.length === 0 && <p>Adicione ou exiba um sistema válido para verificar a coordenada.</p>}
    </div>
  </div>;
};
