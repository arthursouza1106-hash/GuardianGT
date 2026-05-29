import React, { useState, useEffect } from 'react';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Search, Filter, Plus, Download, Eye, Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { PRIORIDADES } from '@/constants';
import { genericService } from '@/lib/firestoreService';
import { toast } from 'sonner';
import { generateOcorrenciaPDF } from '@/lib/pdfGenerator';
import { useAuth } from '@/lib/AuthContext';
// XLSX removed here as it moved to CoberturasList

export default function OcorrenciasListPage() {
  const navigate = useNavigate();
  const { user, userData, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Robust, case-insensitive role extraction and supervisor alignment
  const roleNorm = (userData?.role || '').toLowerCase().trim();
  const isArthur = 
    userData?.matricula?.toLowerCase().trim() === 'arthur' || 
    userData?.matricula?.toLowerCase().trim() === 'arthursouza1106@gmail.com' ||
    userData?.displayName?.toLowerCase().includes('arthur') ||
    userData?.uid === 'u4' ||
    userData?.uid === 'u8';
  const isAdmin = roleNorm === 'admin' || isArthur;
                  
  const isSupervisor = roleNorm === 'supervisor' && !isAdmin;

  useEffect(() => {
    if (authLoading) return;

    setIsLoading(true);
    const unsubscribe = genericService.subscribe<any>('ocorrencias', (data) => {
      // Admin/Dev sees ALL occurrences; Supervisor sees only their own
      const filtered = isSupervisor 
        ? data.filter(o => {
            const matchesId = o.supervisorId && user?.uid && String(o.supervisorId).toLowerCase().trim() === String(user.uid).toLowerCase().trim();
            const matchesNameSuper = o.nomeSupervisor && user?.displayName && String(o.nomeSupervisor).toLowerCase().trim() === String(user.displayName).toLowerCase().trim();
            const matchesSuper = o.supervisor && user?.displayName && String(o.supervisor).toLowerCase().trim() === String(user.displayName).toLowerCase().trim();
            return matchesId || matchesNameSuper || matchesSuper;
          })
        : data;
      
      // Sort by creation date desc locally with safety fallback to plantao date
      filtered.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : (a.data ? new Date(a.data + 'T00:00:00').getTime() : 0);
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : (b.data ? new Date(b.data + 'T00:00:00').getTime() : 0);
        return dateB - dateA;
      });
      
      setOcorrencias(filtered);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, userData, authLoading, isSupervisor, isAdmin]);

  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!isAdmin || !idToDelete) return;
    
    setIsDeleting(idToDelete);
    try {
      await genericService.delete('ocorrencias', idToDelete);
      toast.success("Ocorrência excluída");
      setIdToDelete(null);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error("Erro ao excluir ocorrência");
    } finally {
      setIsDeleting(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-950" />
      </div>
    );
  }

  const columns: DataTableColumn<any>[] = [
    { 
      header: 'Data do Plantão', 
      accessor: (o: any) => (
        <div>
          <div className="font-bold text-slate-900">{new Date(o.data + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
          <div className="text-[10px] font-black font-mono opacity-50 uppercase tracking-widest">{o.turno}</div>
        </div>
      )
    },
    { header: 'Supervisor', accessor: (o: any) => o.supervisor || o.nomeSupervisor },
    { 
      header: 'Viatura / KM', 
      accessor: (o: any) => (
        <div className="text-xs">
           <span className="font-bold">{o.placaViatura || '---'}</span>
           <span className="text-slate-400 ml-2">({o.kmInicial}-{o.kmFinal})</span>
        </div>
      )
    },
    { 
      header: 'Coberturas', 
      accessor: (o: any) => (
        <span className="text-[10px] bg-brand-50 text-brand-600 px-3 py-1 rounded-full font-black uppercase tracking-wider border border-brand-100">
           {o.coberturas?.length || 0} coberturas
        </span>
      )
    },
    { 
      header: 'Status', 
      accessor: (o: any) => (
        <span className={cn(
          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
          o.status === 'Finalizada' ? "bg-emerald-600 border-emerald-600 text-white" :
          "bg-slate-50 border-slate-200 text-slate-400"
        )}>
          {o.status}
        </span>
      )
    },
    {
      header: 'AÇÕES',
      accessor: (o: any) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={Download} onClick={(e) => {
             e.stopPropagation();
             generateOcorrenciaPDF(o);
          }} />
          {isAdmin && (
            <button 
              disabled={isDeleting === o.id}
              onClick={(e) => { e.stopPropagation(); setIdToDelete(o.id); }}
              className="p-2 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50"
            >
              {isDeleting === o.id ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <Trash2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      )
    }
  ];

  const filteredData = ocorrencias.filter(o => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const supervisorName = (o.nomeSupervisor || o.supervisor || '').toLowerCase();
    const placa = (o.placaViatura || o.viaturaId || '').toLowerCase();
    const postosMatch = (o.postosVisitados || []).some((v: any) => v.nomePosto?.toLowerCase().includes(term));
    return supervisorName.includes(term) || placa.includes(term) || postosMatch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-[-0.02em] uppercase">Livro de Ocorrências</h2>
          <p className="text-xs text-slate-400 font-bold tracking-[0.1em] uppercase opacity-70 mt-1">Histórico operacional consolidado</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => navigate('/ocorrencias/nova')}
            className="px-5 h-12 rounded-2xl flex items-center gap-2 shadow-2xl shadow-brand-950/20 bg-brand-950 hover:bg-black text-white transition-all transform hover:scale-105 active:scale-95 border border-brand-800 text-xs font-black uppercase tracking-wider"
          >
            <Plus className="w-5 h-5 text-brand-400" />
            <span>Novo Livro</span>
          </Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-brand-950/5 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
          <input 
            type="text" 
            placeholder="Filtrar registros do sistema..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-brand-400/20 outline-none transition-all placeholder:text-slate-300"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={Filter} className="rounded-xl border-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-widest px-6 h-11">Filtros</Button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
          <div className="flex-1" />
          <button 
            onClick={() => window.location.reload()}
            disabled={isLoading}
            className="p-3 hover:bg-slate-100 rounded-xl text-slate-400 transition-all hover:text-brand-600 outline-none"
            title="Recarregar"
          >
            <div className={cn("transition-transform duration-700", isLoading && "animate-spin")}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </button>
        </div>
        <DataTable 
          columns={columns} 
          data={filteredData} 
          onRowClick={(o) => console.log('View', o)}
        />
      </div>

      <Modal
        isOpen={!!idToDelete}
        onClose={() => setIdToDelete(null)}
        title="Confirmar Exclusão"
        size="sm"
      >
        <div className="space-y-6 pt-4">
          <p className="text-sm font-bold text-slate-600">
            Deseja realmente excluir permanentemente esta ocorrência? Esta ação não pode ser desfeita.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setIdToDelete(null)} disabled={!!isDeleting}>Cancelar</Button>
            <button 
              onClick={handleDelete}
              disabled={!!isDeleting}
              className="px-8 h-10 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
            >
              {isDeleting ? 'EXCLUINDO...' : 'SIM, EXCLUIR'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
