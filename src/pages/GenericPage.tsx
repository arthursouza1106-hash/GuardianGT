import React from 'react';

export default function GenericPage({ title }: { title: string }) {
  return (
    <div className="p-12 animate-in fade-in duration-700">
      <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">{title}</h1>
      <div className="mt-8 p-24 border-2 border-dashed border-brand-200 rounded-[3rem] flex flex-col items-center justify-center text-slate-400 font-medium bg-white/50">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-50">Inteligência Operacional</p>
        <p className="tracking-tight">O módulo <span className="text-brand-950 font-bold">{title}</span> está sendo processado.</p>
      </div>
    </div>
  );
}
