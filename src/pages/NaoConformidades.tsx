import React, { useState, useEffect } from 'react';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Search, Filter, AlertTriangle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { genericService } from '@/lib/firestoreService';

export default function NaoConformidadesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [nonConformities, setNonConformities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = genericService.subscribe<any>('ocorrencias', (data) => {
      const extracted: any[] = [];
      
      data.forEach((occ: any) => {
        (occ.postosVisitados || []).forEach((visit: any) => {
          (visit.checklist || []).forEach((item: any) => {
            if (item.status === 'Não conforme') {
              extracted.push({
                id: `${occ.id}-${visit.id}-${item.itemId}`,
                date: occ.data,
                post: visit.nomePosto,
                item: item.nome,
                observation: item.observacao || 'Sem observação detalhada.',
                supervisor: occ.nomeSupervisor,
                status: 'Pendente', // In a real app, this might be a separate field to track resolution
                priority: occ.priority || 'Média',
                occurrenceId: occ.id
              });
            }
          });
        });
      });

      // Sort by date descending
      extracted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setNonConformities(extracted);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const columns: DataTableColumn<any>[] = [
    { 
      header: 'Identificação', 
      accessor: (nc: any) => (
        <div>
          <div className="font-bold text-slate-900">{nc.post}</div>
          <div className="text-[10px] uppercase font-black text-red-600 tracking-[0.1em] flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
            {nc.item}
          </div>
        </div>
      )
    },
    { 
      header: 'Análise do Supervisor', 
      accessor: (nc: any) => (
        <div className="max-w-xs truncate text-[11px] italic font-medium text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100">
          "{nc.observation}"
        </div>
      )
    },
    { header: 'Supervisor', accessor: 'supervisor' },
    { 
      header: 'Prioridade', 
      accessor: (nc: any) => (
        <span className={cn(
          "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border shadow-sm",
          nc.priority === 'Crítica' || nc.priority === 'Alta' ? "bg-red-50 border-red-200 text-red-700" :
          "bg-orange-50 border-orange-200 text-orange-700"
        )}>
          {nc.priority}
        </span>
      )
    },
    { 
      header: 'Status', 
      accessor: (nc: any) => (
        <span className={cn(
          "px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
          nc.status === 'Pendente' ? "bg-red-100 text-red-600 border-red-200 shadow-sm" : "bg-blue-100 text-blue-600"
        )}>
          {nc.status}
        </span>
      )
    },
    {
      header: 'Ações',
      accessor: (nc: any) => (
        <Button variant="ghost" size="icon" icon={ExternalLink} onClick={() => console.log('Link to', nc.occurrenceId)} />
      )
    }
  ];

  const filteredData = nonConformities.filter(nc => 
    nc.post.toLowerCase().includes(searchTerm.toLowerCase()) ||
    nc.supervisor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    nc.item.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Não Conformidades</h2>
          <p className="text-sm text-slate-500">Acompanhamento de falhas críticas identificadas nas fiscalizações.</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="px-4 py-2 bg-red-50 border border-red-100 rounded-xl text-red-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm">
             <AlertTriangle className="w-4 h-4" />
             {filteredData.length} Pendências Ativas
           </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Pesquisar por posto, item ou supervisor..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="secondary" icon={Filter}>Filtrar Prioridade</Button>
      </div>

      <DataTable 
        columns={columns} 
        data={filteredData} 
        isLoading={isLoading}
      />
    </div>
  );
}
