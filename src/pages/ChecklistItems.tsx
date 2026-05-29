import React, { useState, useEffect } from 'react';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Search, ListChecks, CheckCircle2, Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import { ChecklistItem } from '@/types';
import { cn } from '@/lib/utils';
import { genericService } from '@/lib/firestoreService';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

export default function ChecklistItemsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  const { userData } = useAuth();
  const roleNorm = (userData?.role || '').toLowerCase().trim();
  const isArthur = 
    userData?.matricula?.toLowerCase().trim() === 'arthur' || 
    userData?.matricula?.toLowerCase().trim() === 'arthursouza1106@gmail.com' ||
    userData?.displayName?.toLowerCase().includes('arthur') ||
    userData?.uid === 'u4' ||
    userData?.uid === 'u8';
  const isAdmin = roleNorm === 'admin' || isArthur;
  
  const [formData, setFormData] = useState<Partial<ChecklistItem>>({
    nome: '',
    aplicacao: 'Ambos',
  });

  const fetchItems = async () => {
    try {
      const data = await genericService.list<ChecklistItem>('checklistItems');
      setItems(data);
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAdmin || isSaving) return;
    
    setIsSaving(true);
    
    // FALLBACK FORÇADO
    const forceReset = setTimeout(() => {
      setIsSaving(false);
      setFormData({
        nome: '',
        aplicacao: 'Ambos',
      });
    }, 2000);

    try {
      if (formData.id) {
        genericService.update('checklistItems', formData.id, formData);
        toast.success("Alteração concluída!");
      } else {
        genericService.create('checklistItems', {
          ...formData,
          status: 'Ativo',
          createdAt: new Date().toISOString()
        });
        toast.success("Item cadastrado!");
      }
      
      // RECARREGAR LISTA
      fetchItems();

      // RESET IMEDIATO
      setFormData({
        nome: '',
        aplicacao: 'Ambos',
      });
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

  const [itemToDelete, setItemToDelete] = useState<ChecklistItem | null>(null);

  const handleDelete = async () => {
    if (!isAdmin || !itemToDelete) return;
    
    setDeletingId(itemToDelete.id);
    try {
      await genericService.delete('checklistItems', itemToDelete.id);
      toast.success("Item excluído");
      fetchItems();
      setItemToDelete(null);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error("Erro ao excluir item");
    } finally {
      setDeletingId(null);
    }
  };

  const columns: DataTableColumn<ChecklistItem>[] = [
    { 
      header: 'Item de Verificação', 
      accessor: (i: ChecklistItem) => (
        <div className="font-bold text-slate-900">{i.nome}</div>
      )
    },
    { 
      header: 'Aplicação', 
      accessor: (i: ChecklistItem) => (
        <span className={cn(
          "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border",
          i.aplicacao === 'Armado' ? "bg-rose-50 text-rose-700 border-rose-100" :
          i.aplicacao === 'Desarmado' ? "bg-slate-50 text-slate-600 border-slate-200" :
          "bg-blue-50 text-blue-700 border-blue-100"
        )}>
          {i.aplicacao}
        </span>
      )
    },
    {
      header: 'Ações',
      className: "text-right",
      accessor: (i: ChecklistItem) => (
        <div className="flex items-center justify-end gap-2">
          {isAdmin && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); setFormData(i); setIsModalOpen(true); }}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                disabled={deletingId === i.id}
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setItemToDelete(i); }}
                className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                disabled={deletingId === i.id}
              >
                {deletingId === i.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
          <h1 className="text-3xl font-black text-slate-900 tracking-[-0.02em] leading-none uppercase">Itens de Checklist</h1>
          <p className="text-xs text-slate-400 font-bold tracking-[0.1em] uppercase opacity-70 mt-2">Parâmetros de inspeção técnica</p>
        </div>
        {isAdmin && (
          <Button 
            onClick={() => {
              setFormData({
                nome: '',
                aplicacao: 'Ambos',
              });
              setIsModalOpen(true);
            }}
            className="w-14 h-14 rounded-2xl p-0 flex items-center justify-center shadow-2xl shadow-brand-950/20 bg-brand-950 hover:bg-black text-white transition-all transform hover:scale-105 active:scale-95 group"
          >
            <Plus className="w-7 h-7 text-brand-400 group-hover:text-white transition-colors" />
          </Button>
        )}
      </div>

      <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-xl shadow-brand-950/5 flex items-center gap-4">
        <div className="relative flex-1 group">
          <Search className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Pesquisar critério de vistorio..." 
            className="w-full pl-12 pr-4 py-4 bg-slate-50/50 rounded-2xl text-xs font-black uppercase tracking-widest focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-50 transition-all placeholder:text-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-brand-950/5 overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between gap-4">
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <button 
              onClick={() => fetchItems()}
              className="p-3 hover:bg-slate-100 rounded-xl text-slate-400 transition-all hover:text-brand-600 outline-none"
              title="Recarregar"
            >
              <div className={cn("transition-transform duration-700")}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            </button>
            <div className="text-[10px] font-black text-brand-900/30 uppercase tracking-[0.2em] px-4">
              {items.length} ITENS
            </div>
          </div>
        </div>
        <DataTable 
          columns={columns} 
          data={items.filter(i => (i.nome || '').toLowerCase().includes(searchTerm.toLowerCase()))} 
          onRowClick={isAdmin ? (i) => { setFormData(i); setIsModalOpen(true); } : undefined}
        />
      </div>


      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={formData.id ? "Editar Item de Checklist" : "Novo Item de Checklist"}
        size="md"
      >
        <form className="space-y-6" onSubmit={handleSave}>
          <div className="space-y-8">
            <FormField 
              label="Descrição do Item" 
              placeholder="QUESTIONAMENTO TÉCNICO" 
              value={formData.nome || ''}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              required
              className="rounded-2xl h-14 bg-slate-50 border-slate-100 font-bold text-xs uppercase"
            />
            
            <FormField 
              label="Escopo de Aplicação" 
              as="select"
              value={formData.aplicacao || 'Ambos'}
              onChange={(e) => setFormData({ ...formData, aplicacao: e.target.value as any })}
              className="rounded-2xl h-14 bg-slate-50 border-slate-100 font-bold text-xs uppercase"
            >
              <option value="Ambos">PADRÃO (ARMADO E DESARMADO)</option>
              <option value="Armado">EXCLUSIVO: POSTO ARMADO</option>
              <option value="Desarmado">EXCLUSIVO: POSTO DESARMADO</option>
            </FormField>

            <div className="mt-4 p-5 bg-black text-brand-400 rounded-[1.5rem] border border-white/10 flex items-start gap-4 shadow-2xl">
              <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
              <p className="text-[10px] font-black uppercase tracking-widest leading-loose">
                Este parâmetro será injetado nos protocolos de vistoria conforme a natureza tática da unidade selecionada.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-8 border-t border-slate-100">
            <Button variant="secondary" type="button" className="rounded-xl px-8 h-12 uppercase text-[10px] font-black tracking-widest" onClick={() => setIsModalOpen(false)} disabled={isSaving}>Cancelar</Button>
            <button 
              type="submit" 
              disabled={isSaving} 
              className="px-12 h-12 font-black tracking-[0.2em] shadow-2xl shadow-brand-950/20 bg-brand-950 hover:bg-black text-white uppercase text-[10px] rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'SALVANDO...' : 'EFETIVAR ITEM'}
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
            Deseja realmente excluir o item <span className="text-slate-900 underline">"{itemToDelete?.nome}"</span>?
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
