import React, { useState, useEffect } from 'react';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Search, Plus, MapPin, Trash2, Calendar, Clock, Edit2 } from 'lucide-react';
import { Roteiro, Posto } from '@/types';
import { DIAS_SEMANA } from '@/constants';
import { cn } from '@/lib/utils';
import { genericService } from '@/lib/firestoreService';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

export default function RoteirosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [turnoFilter, setTurnoFilter] = useState('');
  const [roteiros, setRoteiros] = useState<Roteiro[]>([]);
  const [postos, setPostos] = useState<Posto[]>([]);
  const [deleteConfirmRoteiro, setDeleteConfirmRoteiro] = useState<Roteiro | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const { userData, user } = useAuth();
  const isArthur = 
    userData?.matricula?.toLowerCase().trim() === 'arthur' || 
    userData?.matricula?.toLowerCase().trim() === 'arthursouza1106@gmail.com' ||
    userData?.displayName?.toLowerCase().includes('arthur') ||
    userData?.uid === 'u4' ||
    userData?.uid === 'u8';
  const isSupervisor = userData?.role === 'Admin' || userData?.role === 'Supervisor' || isArthur;
  const isAdmin = userData?.role === 'Admin' || isArthur;
  
  const [formData, setFormData] = useState<Partial<Roteiro>>({
    nome: '',
    diaSemana: 'Segunda-feira',
    turno: 'Diurno',
    postos: []
  });

  useEffect(() => {
    const unsubRoteiros = genericService.subscribe<Roteiro>('roteiros', (data) => {
      setRoteiros(data);
    });
    const unsubPostos = genericService.subscribe<Posto>('postos', (data) => {
      setPostos(data);
    });
    return () => {
      unsubRoteiros();
      unsubPostos();
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAdmin) {
      toast.error('Acesso restrito para administradores');
      return;
    }
    if (isSaving) return;
    
    setIsSaving(true);

    try {
      if ((formData as any).id) {
        await genericService.update('roteiros', (formData as any).id, formData);
        toast.success("Plano atualizado!");
      } else {
        await genericService.create('roteiros', { ...formData, status: 'Ativo' });
        toast.success("Cadastrado com sucesso!");
      }
      
      resetForm();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Save error:', error);
      toast.error("Erro ao salvar.");
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      diaSemana: 'Segunda-feira',
      turno: 'Diurno',
      postos: []
    });
  };

  const addPostoToRoteiro = (postoId: string) => {
    const posto = postos.find(p => p.id === postoId);
    if (!posto) return;
    if (formData.postos?.some(p => p.id === postoId)) return;
    
    setFormData({
      ...formData,
      postos: [...(formData.postos || []), { id: posto.id, nome: posto.nome }]
    });
  };

  const removePostoFromRoteiro = (postoId: string) => {
    setFormData({
      ...formData,
      postos: formData.postos?.filter(p => p.id !== postoId)
    });
  };

  const handleDelete = async (roteiro: Roteiro) => {
    if (!isAdmin) {
      toast.error('Acesso restrito para administradores');
      return;
    }
    setIsDeleting(true);

    try {
      await genericService.delete('roteiros', roteiro.id!);
      toast.success("Roteiro excluído com sucesso");
      setDeleteConfirmRoteiro(null);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error("Erro ao excluir roteiro");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: DataTableColumn<Roteiro>[] = [
    { 
      header: 'Nome do Roteiro', 
      accessor: (r: Roteiro) => (
        <div className="font-bold text-slate-900 tracking-tight uppercase">{r.nome}</div>
      )
    },
    { 
      header: 'Cronograma', 
      accessor: (r: Roteiro) => {
        const isDiurno = r.turno === 'Diurno';
        const isNoturno = r.turno === 'Noturno';
        const isViagem = r.turno === 'Viagem';
        return (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">{r.diaSemana}</span>
            <span className={cn(
              "text-[9px] font-black px-3 py-1 rounded-full self-start uppercase tracking-widest border shadow-sm",
              isDiurno 
                ? "bg-blue-50 border-blue-100 text-blue-700" 
                : isNoturno 
                  ? "bg-green-50 border-green-100 text-green-700" 
                  : isViagem
                    ? "bg-amber-50 border-amber-100 text-amber-700"
                    : "bg-slate-50 border-slate-100 text-slate-500"
            )}>
              {r.turno || 'Não Definido'}
            </span>
          </div>
        );
      }
    },
    { 
      header: 'Efetivo / Unidades', 
      accessor: (r: Roteiro) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-50 text-brand-950 rounded-xl flex items-center justify-center text-[10px] font-black border border-brand-100 shadow-sm">
            {r.postos?.length || 0}
          </div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight truncate max-w-[200px]">
            {r.postos?.map(p => p.nome).join(' • ') || 'NENHUMA UNIDADE'}
          </span>
        </div>
      )
    },
    {
      header: 'AÇÕES',
      className: "text-right",
      accessor: (r: Roteiro) => (
        <div className="flex items-center justify-end gap-1">
          {isAdmin && (
            <>
              <button 
                id={`edit-roteiro-${r.id}`}
                onClick={(e) => { e.stopPropagation(); setFormData(r); setIsModalOpen(true); }}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                title="Editar Roteiro"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button 
                id={`delete-roteiro-${r.id}`}
                onClick={(e) => { e.stopPropagation(); setDeleteConfirmRoteiro(r); }}
                className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                title="Excluir Roteiro"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  const getDayIndex = (day?: string) => {
    if (!day) return 999;
    const d = day.toLowerCase().trim();
    if (d.includes('segunda')) return 0;
    if (d.includes('terça') || d.includes('terca')) return 1;
    if (d.includes('quarta')) return 2;
    if (d.includes('quinta')) return 3;
    if (d.includes('sexta')) return 4;
    if (d.includes('sábado') || d.includes('sabado')) return 5;
    if (d.includes('domingo')) return 6;
    return 999;
  };

  const getTurnoIndex = (turno?: string) => {
    if (!turno) return 3;
    if (turno === 'Diurno') return 0;
    if (turno === 'Noturno') return 1;
    if (turno === 'Viagem') return 2;
    return 3;
  };

  const filteredAndSortedRoteiros = roteiros
    .filter(r => {
      const matchesSearch = r.nome?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTurno = !turnoFilter || r.turno === turnoFilter;
      return matchesSearch && matchesTurno;
    })
    .sort((a, b) => {
      const dayA = getDayIndex(a.diaSemana);
      const dayB = getDayIndex(b.diaSemana);
      if (dayA !== dayB) {
        return dayA - dayB;
      }
      
      const turnoA = getTurnoIndex(a.turno);
      const turnoB = getTurnoIndex(b.turno);
      if (turnoA !== turnoB) {
        return turnoA - turnoB;
      }
      
      return (a.nome || '').localeCompare(b.nome || '');
    });

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-[-0.02em] leading-none uppercase">Roteiros</h1>
          <p className="text-xs text-slate-400 font-bold tracking-[0.1em] uppercase opacity-70 mt-2">Plano tático de fiscalização</p>
        </div>
        {isAdmin && (
          <Button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="h-14 px-8 rounded-2xl flex items-center justify-center gap-3 shadow-2xl shadow-brand-950/20 bg-brand-950 hover:bg-black text-white transition-all transform hover:scale-105 active:scale-95 group"
          >
            <Plus className="w-5 h-5 text-brand-400 group-hover:text-white transition-colors" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Novo Roteiro</span>
          </Button>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-brand-950/5 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 group w-full">
            <Search className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Pesquisar plano tático..." 
              className="w-full pl-12 pr-4 py-4 bg-slate-50/50 rounded-2xl text-xs font-black uppercase tracking-widest focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-50 transition-all placeholder:text-slate-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <select
              value={turnoFilter}
              onChange={(e) => setTurnoFilter(e.target.value)}
              className="h-14 px-5 bg-slate-50/50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-50 transition-all cursor-pointer min-w-[150px]"
            >
              <option value="">TODOS OS TURNOS</option>
              <option value="Diurno">DIURNO</option>
              <option value="Noturno">NOTURNO</option>
              <option value="Viagem">VIAGEM</option>
            </select>
            <div className="text-[10px] font-black text-brand-900/30 uppercase tracking-[0.2em] px-4 whitespace-nowrap">
              {filteredAndSortedRoteiros.length} PLANOS
            </div>
          </div>
        </div>

        <DataTable 
          columns={columns} 
          data={filteredAndSortedRoteiros} 
          onRowClick={isAdmin ? (r) => { setFormData(r); setIsModalOpen(true); } : undefined}
        />
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={formData.id ? "Editar Plano de Fiscalização" : "Novo Plano Operacional"}
        size="lg"
      >
        <form className="space-y-8" onSubmit={handleSave}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-8">
              <FormField 
                label="Identificação do Roteiro" 
                placeholder="EX: ROTEIRO NORTE NOTURNO" 
                value={formData.nome || ''}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
                className="rounded-2xl h-14 bg-slate-50 border-slate-100 font-bold text-xs uppercase"
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField 
                  label="Dia Designado" 
                  as="select"
                  value={formData.diaSemana || 'Segunda'}
                  onChange={(e) => setFormData({ ...formData, diaSemana: e.target.value })}
                  required
                  className="rounded-2xl h-14 bg-slate-50 border-slate-100 font-bold text-xs uppercase"
                >
                  {DIAS_SEMANA.map(d => <option key={d} value={d}>{d}</option>)}
                </FormField>
                
                <FormField 
                  label="Turno Operacional" 
                  as="select"
                  value={formData.turno || ''}
                  onChange={(e) => setFormData({ ...formData, turno: e.target.value as any })}
                  className="rounded-2xl h-14 bg-slate-50 border-slate-100 font-bold text-xs uppercase"
                >
                  <option value="">NENHUM / ESCOLHER DEPOIS</option>
                  <option value="Diurno">DIURNO</option>
                  <option value="Noturno">NOTURNO</option>
                  <option value="Viagem">VIAGEM</option>
                </FormField>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block flex items-center gap-3 px-1">
                <MapPin className="w-3.5 h-3.5 text-brand-400" /> Malha de Unidades
              </label>
              
              <div className="bg-slate-50 rounded-[2.5rem] p-6 border border-slate-100 min-h-[350px] shadow-inner flex flex-col">
                <div className="mb-6">
                  <SearchableSelect
                    label="Anexar Unidade"
                    placeholder="PESQUISAR POSTO..."
                    value=""
                    onChange={addPostoToRoteiro}
                    options={postos.map(p => ({ id: p.id, label: p.nome }))}
                    className="bg-white rounded-2xl h-12 border-slate-200"
                  />
                </div>
                
                <div className="flex-1 space-y-3">
                  {(formData.postos || []).map((p, idx) => (
                    <div key={p.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between group animate-in slide-in-from-left-2 duration-300 shadow-sm" style={{ animationDelay: `${idx * 50}ms` }}>
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-brand-950 text-brand-400 rounded-xl flex items-center justify-center text-[10px] font-black shadow-lg">
                          {idx + 1}
                        </div>
                        <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{p.nome}</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => removePostoFromRoteiro(p.id)}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  {(formData.postos || []).length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300 space-y-3 pb-10">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border border-slate-100 shadow-sm">
                        <Plus className="w-6 h-6 opacity-20" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">Malha Vazia</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-8 border-t border-slate-100">
            <button 
              type="button" 
              className="px-8 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isSaving} 
              className="px-12 h-14 font-black tracking-[0.2em] shadow-2xl shadow-brand-950/20 bg-brand-950 hover:bg-black text-white uppercase text-[10px] rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'SALVANDO...' : 'EFETIVAR ROTEIRO'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!deleteConfirmRoteiro}
        onClose={() => setDeleteConfirmRoteiro(null)}
        title="Excluir Roteiro"
        size="md"
      >
        <div className="space-y-6">
          <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100">
            <p className="text-xs font-bold">
              Confirmar exclusão do roteiro <span className="font-black italic">{deleteConfirmRoteiro?.nome}</span>? Esta ação é irreversível.
            </p>
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirmRoteiro(null)} disabled={isDeleting}>Cancelar</Button>
            <button 
              className="px-8 h-10 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
              disabled={isDeleting}
              onClick={() => deleteConfirmRoteiro && handleDelete(deleteConfirmRoteiro)}
            >
              {isDeleting ? 'EXCLUINDO...' : 'EXCLUIR PLANO'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
