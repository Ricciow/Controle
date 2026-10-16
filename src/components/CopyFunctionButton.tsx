import React, { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export const CopyFunctionButton: React.FC<{ text: string; label?: string }> = ({ text, label = 'Copiar função' }) => {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  useEffect(() => { setStatus('idle'); }, [text]);
  useEffect(() => {
    if (status === 'idle') return;
    const timer = window.setTimeout(() => setStatus('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [status]);
  return <span className="inline-flex items-center gap-1.5">
    <button type="button" aria-label={label} title={`${label} como texto simples`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setStatus('copied');
        } catch {
          setStatus('error');
        }
      }} className="inline-flex items-center gap-1 rounded border border-slate-300 dark:border-slate-700 px-1.5 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:border-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-300">
      {status === 'copied' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {status === 'copied' ? 'Copiado!' : 'Copiar'}
    </button>
    <span role="status" className={status === 'error' ? 'text-[11px] text-rose-500' : 'sr-only'}>
      {status === 'copied' ? 'Função copiada como texto simples.' : status === 'error' ? 'Não foi possível copiar. Tente novamente.' : ''}
    </span>
  </span>;
};
