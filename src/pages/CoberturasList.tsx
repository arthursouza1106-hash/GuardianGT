import React, { useState, useEffect } from 'react';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Search, Filter, FileSpreadsheet, Calendar, Eye, User, Briefcase, Clock, Shield } from 'lucide-react';
import { genericService } from '@/lib/firestoreService';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

export default function CoberturasListPage() {
  const { user, userData } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [coberturas, setCoberturas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCoverage, setSelectedCoverage] = useState<any | null>(null);

  const fetchCoberturas = async () => {
    try {
      setIsLoading(true);
      const data = await genericService.list<any>('ocorrencias');
      
      // Filter by supervisor if not admin/dev
      const userDisplay = (user?.displayName || '').toLowerCase().trim();
      const userEmail = (user?.email || '').toLowerCase().trim();
      const userUid = user?.uid;
      const isArthur = 
        userData?.matricula?.toLowerCase().trim() === 'arthur' || 
        userData?.matricula?.toLowerCase().trim() === 'arthursouza1106@gmail.com' ||
        userData?.displayName?.toLowerCase().includes('arthur') ||
        userData?.uid === 'u4' ||
        userData?.uid === 'u8';

      const filteredOccurrences = (userData?.role?.toLowerCase() === 'admin' || isArthur)
        ? data
        : data.filter(o => {
            const matchesId = o.supervisorId && userUid && String(o.supervisorId).toLowerCase().trim() === String(userUid).toLowerCase().trim();
            const matchesNameSuper = o.nomeSupervisor && userDisplay && String(o.nomeSupervisor).toLowerCase().trim() === userDisplay;
            const matchesSuper = o.supervisor && userDisplay && String(o.supervisor).toLowerCase().trim() === userDisplay;
            return matchesId || matchesNameSuper || matchesSuper;
          });
      
      // Flatten all coberturas from all occurrences
      const allCoberturas: any[] = [];
      filteredOccurrences.forEach(occ => {
        if (occ.coberturas && Array.isArray(occ.coberturas)) {
          occ.coberturas.forEach((cob: any) => {
            allCoberturas.push({
              ...cob,
              occurrenceId: occ.id,
              data: occ.data,
              turno: occ.turno,
              supervisor: occ.nomeSupervisor || occ.supervisor
            });
          });
        }
      });

      // Sort by date desc
      allCoberturas.sort((a, b) => {
        const dateA = a.data ? new Date(a.data).getTime() : 0;
        const dateB = b.data ? new Date(b.data).getTime() : 0;
        return dateB - dateA;
      });
      
      setCoberturas(allCoberturas);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCoberturas();
  }, [user, userData]);

  const exportToExcel = () => {
    if (filteredData.length === 0) return;

    const dataToExport = filteredData.map(c => ({
      'Substituto': c.nomeVigilanteCobriu || c.vigilanteCoberturaNome || '---',
      'Posto': c.nomePosto || c.postoNome || '---',
      'Data': c.data ? new Date(c.data + 'T00:00:00').toLocaleDateString('pt-BR') : '---',
      'Horas': `${c.horasCobertas || c.horas || '0'}h`,
      'Tipo de Cobertura': c.tipoCobertura || '---',
      'Ausente': c.nomeVigilanteCoberto || c.vigilanteSustituidoNome || '---',
      'Motivo': c.motivoAusencia || c.motivoNome || '---',
      'Turno': c.turno || '---',
      'Supervisor': c.supervisor || '---',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Coberturas');
    
    XLSX.writeFile(workbook, `Coberturas_GuardianGT_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const columns: DataTableColumn<any>[] = [
    { 
      header: 'Data/Turno', 
      accessor: (c: any) => (
        <div>
          <div className="font-bold text-slate-900 tracking-tight">
            {c.data ? new Date(c.data + 'T00:00:00').toLocaleDateString('pt-BR') : '---'}
          </div>
          <div className="mt-1">
            <span className={cn(
              "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider inline-block border",
              (c.turno || '').toLowerCase().includes('diurno') 
                ? "bg-amber-50 text-amber-700 border-amber-200" 
                : "bg-indigo-50 text-indigo-700 border-indigo-200"
            )}>
              {c.turno || '---'}
            </span>
          </div>
        </div>
      )
    },
    { 
      header: 'Posto', 
      accessor: (c: any) => <span className="font-bold text-slate-700">{c.nomePosto || c.postoNome || '---'}</span> 
    },
    { 
      header: 'Substituição', 
      accessor: (c: any) => (
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
             <span className="w-4 h-4 rounded bg-red-50 text-red-600 flex items-center justify-center text-[8px] font-black border border-red-100" title="Substituído (Que faltou)">A</span>
             <span className="font-bold text-slate-900">{c.nomeVigilanteCoberto || c.vigilanteSustituidoNome || '---'}</span>
          </div>
          <div className="flex items-center gap-2">
             <span className="w-4 h-4 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center text-[8px] font-black border border-emerald-100" title="Cobriu (Substituto)">C</span>
             <span className="font-bold text-slate-900">{c.nomeVigilanteCobriu || c.vigilanteCoberturaNome || '---'}</span>
          </div>
        </div>
      )
    },
    { 
      header: 'Duração', 
      accessor: (c: any) => (
        <div className="text-[10px] bg-slate-50 border border-slate-100 px-3 py-1 rounded-full font-black tracking-tighter text-slate-500 w-fit">
           {c.horasCobertas || c.horas || '0'}h
        </div>
      )
    },
    { 
      header: 'Motivo', 
      accessor: (c: any) => (
        <span className="text-[10px] bg-black text-white px-3 py-1 rounded-full font-black uppercase tracking-widest" title={c.motivoAusencia || c.motivoNome || '---'}>
           {c.motivoAusencia || c.motivoNome || '---'}
        </span>
      )
    },
    { 
      header: 'Supervisor', 
      accessor: (c: any) => <span className="text-xs font-medium text-slate-400">{c.supervisor || '---'}</span> 
    },
    {
      header: 'Visualizar',
      accessor: (c: any) => (
        <Button
          variant="secondary"
          size="icon"
          icon={Eye}
          onClick={() => setSelectedCoverage(c)}
          className="border-slate-100 text-slate-900 font-bold hover:border-brand-400 hover:bg-slate-50 rounded-xl"
        />
      )
    }
  ];

  const filteredData = coberturas.filter(c => {
    const term = searchTerm.toLowerCase();
    const posto = (c.nomePosto || c.postoNome || '').toLowerCase();
    const subbed = (c.nomeVigilanteCoberto || c.vigilanteSustituidoNome || '').toLowerCase();
    const cover = (c.nomeVigilanteCobriu || c.vigilanteCoberturaNome || '').toLowerCase();
    const motive = (c.motivoAusencia || c.motivoNome || '').toLowerCase();
    const superv = (c.supervisor || '').toLowerCase();
    
    return posto.includes(term) ||
           subbed.includes(term) ||
           cover.includes(term) ||
           motive.includes(term) ||
           superv.includes(term);
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-700 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-[-0.02em] flex items-center gap-3 uppercase">
             Coberturas
          </h2>
          <p className="text-xs text-slate-400 font-bold tracking-[0.1em] uppercase opacity-70 mt-1">Gestão de substituições em tempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="secondary"
            onClick={exportToExcel}
            icon={FileSpreadsheet}
            disabled={filteredData.length === 0}
            className="border-slate-100 text-slate-900 font-black uppercase text-[10px] tracking-widest px-8 shadow-xl shadow-brand-950/5 hover:bg-slate-50 hover:border-brand-400 transition-all h-11"
          >
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-brand-950/5 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
          <input 
            type="text" 
            placeholder="Pesquisar registros de cobertura..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-brand-400/20 outline-none transition-all placeholder:text-slate-300"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={Filter} className="rounded-xl border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-widest px-6 h-11">Refinar</Button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
          <div className="flex-1" />
          <button 
            onClick={() => fetchCoberturas()}
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
        />
      </div>

      {/* Details View Modal */}
      <Modal
        isOpen={!!selectedCoverage}
        onClose={() => setSelectedCoverage(null)}
        title="Detalhes Regulamentares da Cobertura"
        size="md"
      >
        {selectedCoverage && (
          <div className="space-y-6 pt-4 text-slate-800">
            <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
              <Calendar className="w-5 h-5 text-brand-900" />
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Período de Plantão</p>
                <p className="text-sm font-extrabold text-slate-800">
                  {selectedCoverage.data ? new Date(selectedCoverage.data + 'T00:00:00').toLocaleDateString('pt-BR') : '---'} — Turno {selectedCoverage.turno || '---'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-1">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-red-600" /> VIGILANTE SUBSTITUÍDO (FALTA)
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {selectedCoverage.nomeVigilanteCoberto || selectedCoverage.vigilanteSustituidoNome || '---'}
                </p>
                <p className="text-[10px] font-medium text-slate-500">
                  Motivo: <span className="font-bold text-slate-700">{selectedCoverage.motivoAusencia || selectedCoverage.motivoNome || '---'}</span>
                </p>
              </div>

              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-1">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" /> VIGILANTE COBERTURA (SUBSTITUTO)
                </p>
                <p className="text-sm font-bold text-slate-950">
                  {selectedCoverage.nomeVigilanteCobriu || selectedCoverage.vigilanteCoberturaNome || '---'}
                </p>
                <p className="text-[10px] font-medium text-slate-500">
                  Pagamento: <span className="font-bold text-slate-700">{selectedCoverage.tipoCobertura || '---'}</span>
                </p>
              </div>
            </div>

            <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 text-slate-800">
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Posto Controlado</span>
                <span className="text-sm font-black text-slate-950">{selectedCoverage.nomePosto || selectedCoverage.postoNome || '---'}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quantidade de Horas</span>
                <span className="text-xs font-black bg-brand-50 text-brand-900 px-3 py-1 rounded-full uppercase">
                  {selectedCoverage.horasCobertas || selectedCoverage.horas || '0'} horas de cobertura
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Supervisor Responsável</span>
                <span className="text-xs font-bold text-slate-600">{selectedCoverage.supervisor || '---'}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedCoverage(null)} className="px-8 font-black text-[10px] uppercase tracking-widest h-10 rounded-xl">
                Fechar Detalhes
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
