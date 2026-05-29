import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option {
  id: string;
  label: string;
  subLabel?: string;
}

interface SearchableSelectProps {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  error?: boolean;
  errorMessage?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Selecione uma opção...",
  className,
  error,
  errorMessage,
  disabled
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  
  const selectedOption = options.find(opt => opt.id === value);
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase()) || 
    (opt.subLabel && opt.subLabel.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("space-y-1 relative", className)} ref={containerRef}>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2 px-1">
        {label}
      </label>
      
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "w-full px-4 py-2 border rounded-xl transition-all flex items-center justify-between min-h-[42px]",
          disabled ? "bg-slate-100 border-slate-200 cursor-not-allowed opacity-70" :
          isOpen ? "border-brand-500 ring-4 ring-brand-50 bg-white cursor-pointer hover:bg-white" : 
          error ? "border-red-500 ring-4 ring-red-50 bg-white cursor-pointer hover:bg-white" : "border-slate-200 bg-slate-50 cursor-pointer hover:bg-white"
        )}
      >
        <div className="flex flex-col truncate mr-2">
          {selectedOption ? (
            <div className="flex flex-col">
              <span className={cn(
                "text-[10px] font-black uppercase tracking-tight truncate leading-tight",
                error ? "text-red-700" : "text-slate-800"
              )}>
                {selectedOption.label}
              </span>
              {selectedOption.subLabel && (
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-widest truncate leading-none mt-0.5",
                  error ? "text-red-400" : "text-slate-400"
                )}>
                  Matrícula: {selectedOption.subLabel}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
              {placeholder}
            </span>
          )}
        </div>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform shrink-0", error ? "text-red-400" : "text-slate-400", isOpen && "rotate-180")} />
      </div>

      {errorMessage && (
        <p className="text-[9px] font-black text-red-500 uppercase tracking-widest px-1 mt-1 animate-in fade-in slide-in-from-top-1">
          {errorMessage}
        </p>
      )}

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="p-2 border-b border-slate-100 flex items-center bg-slate-50">
            <Search className="w-4 h-4 text-slate-400 ml-2" />
            <input
              autoFocus
              type="text"
              className="w-full p-2 bg-transparent outline-none text-xs font-bold"
              placeholder="Pesquisar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            {search && (
              <button onClick={() => setSearch('')} className="p-1 hover:bg-slate-200 rounded">
                <X className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    "px-4 py-3 cursor-pointer transition-all flex flex-col hover:bg-brand-50",
                    value === opt.id ? "bg-brand-50 border-l-4 border-brand-500" : ""
                  )}
                >
                  <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{opt.label}</span>
                  {opt.subLabel && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Matrícula: {opt.subLabel}</span>}
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Nenhum resultado encontrado
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
