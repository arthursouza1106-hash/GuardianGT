import React from 'react';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  header: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
}

export function DataTable<T extends { id: string | number }>({ 
  columns, 
  data, 
  onRowClick,
  isLoading 
}: DataTableProps<T>) {
  return (
    <div className="w-full">
      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:border-slate-300 transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/75 border-b border-slate-200">
              <tr>
                {columns.map((col, i) => (
                  <th key={i} className={cn(
                    "px-4 py-3 text-[10px] uppercase font-extrabold tracking-wider text-slate-500",
                    col.className
                  )}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100 bg-white">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {columns.map((_, j) => (
                      <td key={j} className="px-3 py-2">
                        <div className="h-4 bg-slate-50 rounded-full w-full"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-16 text-center text-slate-300 font-medium tracking-wide">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr 
                    key={item.id} 
                    onClick={() => onRowClick?.(item)}
                    className={cn(
                      "group transition-all duration-200",
                      onRowClick ? "cursor-pointer hover:bg-blue-50/30" : ""
                    )}
                  >
                    {columns.map((col, i) => (
                      <td key={i} className={cn("px-3 py-2", col.className)}>
                        <div className="text-slate-500 group-hover:text-slate-900 transition-colors">
                          {typeof col.accessor === 'function' 
                            ? col.accessor(item) 
                            : (item[col.accessor] as any)}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 animate-pulse space-y-2">
              <div className="h-4 bg-slate-50 rounded w-1/3"></div>
              <div className="h-3 bg-slate-50 rounded w-1/2"></div>
            </div>
          ))
        ) : data.length === 0 ? (
          <div className="bg-white p-12 text-center text-slate-300 text-xs font-bold uppercase tracking-widest rounded-3xl border border-slate-100">
            Nenhum registro
          </div>
        ) : (
          data.map((item) => (
            <div 
              key={item.id}
              onClick={() => onRowClick?.(item)}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform space-y-3"
            >
              {columns.map((col, i) => {
                if (col.header.toLowerCase() === 'ações' || col.header.toLowerCase() === 'ações' || col.header.toLowerCase() === 'actions') return null;
                return (
                  <div key={i} className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">{col.header}</span>
                    <div className="text-slate-600 text-sm">
                       {typeof col.accessor === 'function' ? col.accessor(item) : (item[col.accessor] as any)}
                    </div>
                  </div>
                );
              })}
              {/* Optional: Add a subtle action indicator or explicit action buttons at the bottom of the card */}
              <div className="pt-2 border-t border-slate-50 flex justify-end">
                {(() => {
                  const actCol = columns.find(c => c.header.toLowerCase() === 'ações' || c.header.toLowerCase() === 'actions');
                  return typeof actCol?.accessor === 'function' && (actCol.accessor as Function)(item);
                })()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
