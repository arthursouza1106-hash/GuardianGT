import React, { useState, useEffect } from 'react';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Plus, Search, Trash2, Edit2, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { genericService } from '@/lib/firestoreService';
import { useAuth } from '@/lib/AuthContext';

interface Motivo {
  id: string;
  nome: string;
}

export default function MotivosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<Motivo[]>([]);
  const [formData, setFormData] = useState<Partial<Motivo>>({ nome: '' });
  const [isSaving, setIsSaving] = useState(false);
  const { userData } = useAuth();
  const roleNorm = (userData?.role || '').toLowerCase().trim();
  const isArthur = 
    userData?.matricula?.toLowerCase().trim() === 'arthur' || 
    userData?.matricula?.toLowerCase().trim() === 'arthursouza1106@gmail.com' ||
    userData?.displayName?.toLowerCase().includes('arthur') ||
    userData?.uid === 'u4' ||
    userData?.uid === 'u8';
  const isSupervisor = roleNorm === 'admin' || roleNorm === 'supervisor' || isArthur;

/*  useEffect(() => {
    const unsub = genericService.subscribe<Motivo>('motivos_falta', setItems);
    return () => unsub();
  }, []); */

  useEffect(() => {
    genericService.list<Motivo>('motivos_falta').then(setItems);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isSupervisor || !formData.nome || isSaving) return;
    
    setIsSaving(true);
    
    // FALLBACK FORÇADO
    const forceReset = setTimeout(() => {
      setIsSaving(false);
      setFormData({ nome: '' });
    }, 2000);

    try {
      if (formData.id) {
        genericService.update('motivos_falta', formData.id, formData);
        toast.success("Alteração concluída!");
      } else {
        genericService.create('motivos_falta', formData);
        toast.success("Cadastrado com sucesso!");
      }
      
      // RECARREGAR LISTA
      genericService.list<Motivo>('motivos_falta').then(setItems);
      
      // RESET IMEDIATO
      setFormData({ nome: '' });
    } catch (error) {
      console.error('Save error:', error);
      toast.error("Erro ao salvar.");
    } finally {
      clearTimeout(forceReset);
      setTimeout(() => {
        setIsSaving(false);
      }, 300);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [itemToDelete, setItemToDelete] = useState<Motivo | null>(null);

  const handleDelete = async () => {
    if (!isSupervisor || !itemToDelete) return;
    
    setDeletingId(itemToDelete.id);
    try {
      await genericService.delete('motivos_falta', itemToDelete.id);
      toast.success("Excluído com sucesso");
      setItems(prev => prev.filter(item => item.id !== itemToDelete.id));
      setItemToDelete(null);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir.");
    } finally {
      setDeletingId(null);
    }
  };

  const columns: DataTableColumn<Motivo>[] = [
    {
      header: 'MOTIVO DE AUSÊNCIA', 
      accessor: (m: Motivo) => <div className="font-semibold text-slate-900">{m.nome}</div>
    },
    {
      header: 'AÇÕES',
      className: "text-right",
      accessor: (m: Motivo) => (
        <div className="flex items-center justify-end gap-2">
          {isSupervisor && (
            <>
              <button 
                onClick={() => { setFormData(m); setIsModalOpen(true); }}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                disabled={deletingId === m.id}
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setItemToDelete(m)}
                disabled={deletingId === m.id}
                className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
              >
                {deletingId === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-[-0.02em] leading-none uppercase">Motivo de Ausência</h1>
          <p className="text-xs text-slate-400 font-bold tracking-[0.1em] uppercase opacity-70 mt-2">Justificativas operacionais</p>
        </div>
        {isSupervisor && (
          <Button 
            onClick={() => { setFormData({ nome: '' }); setIsModalOpen(true); }}
            className="w-14 h-14 rounded-2xl p-0 flex items-center justify-center shadow-2xl shadow-brand-950/20 bg-brand-950 hover:bg-black text-white transition-all transform hover:scale-105 active:scale-95 group"
          >
            <Plus className="w-7 h-7 text-brand-400 group-hover:text-white transition-colors" />
          </Button>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-brand-950/5 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between gap-4">
          <div className="relative flex-1 group">
            <Search className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Pesquisar motivo..." 
              className="w-full pl-12 pr-4 py-4 bg-slate-50/50 rounded-2xl text-xs font-black uppercase tracking-widest focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-50 transition-all placeholder:text-slate-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-[10px] font-black text-brand-900/30 uppercase tracking-[0.2em] px-4">
            {items.length} REGISTROS
          </div>
        </div>

        <DataTable 
          columns={columns} 
          data={items.filter(i => (i.nome || '').toLowerCase().includes(searchTerm.toLowerCase()))} 
        />
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={formData.id ? "Editar Motivo" : "Novo Motivo de Ausência"}
        size="md"
      >
        <form className="space-y-8" onSubmit={handleSave}>
          <FormField 
            label="Descrição do Motivo" 
            placeholder="JUSTIFICATIVA" 
            value={formData.nome || ''}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            required
            className="rounded-2xl h-14 bg-slate-50 border-slate-100 font-bold text-xs uppercase"
          />
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
            <Button variant="secondary" type="button" className="rounded-xl px-8 h-12 uppercase text-[10px] font-black tracking-widest" onClick={() => setIsModalOpen(false)} disabled={isSaving}>Cancelar</Button>
            <button 
              type="submit" 
              disabled={isSaving} 
              className="px-12 h-12 font-black tracking-[0.2em] shadow-2xl shadow-brand-950/20 bg-brand-950 hover:bg-black text-white uppercase text-[10px] rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'SALVANDO...' : 'EFETIVAR'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        title="Confirmar Exclusão"
        size="sm"
      >
        <div className="space-y-6">
          <p className="text-sm font-bold text-slate-600">
            Deseja realmente excluir o motivo <span className="text-slate-900 underline">"{itemToDelete?.nome}"</span>?
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setItemToDelete(null)} disabled={!!deletingId}>Cancelar</Button>
            <button 
              onClick={handleDelete}
              disabled={!!deletingId}
              className="px-8 h-10 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
            >
              {deletingId ? 'EXCLUINDO...' : 'SIM, EXCLUIR'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
