import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Plus, Car, Trash2, Search, Loader2, Database } from 'lucide-react';
import { genericService, serverTimestamp } from '@/lib/firestoreService';
import { forceSeedDatabase } from '@/lib/seed';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

interface Viatura {
  id: string;
  placa: string;
  createdAt?: any;
}

export default function Viaturas() {
  const { userData, user } = useAuth();
  const isArthur = 
    userData?.matricula?.toLowerCase().trim() === 'arthur' || 
    userData?.matricula?.toLowerCase().trim() === 'arthursouza1106@gmail.com' ||
    userData?.displayName?.toLowerCase().includes('arthur') ||
    userData?.uid === 'u4' ||
    userData?.uid === 'u8';
  const isAdmin = userData?.role === 'Admin' || isArthur;

  const [viaturas, setViaturas] = useState<Viatura[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [placa, setPlaca] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkData, setBulkData] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  const handleForceSeed = async () => {
    if (!isAdmin) {
      toast.error('Acesso restrito para administradores');
      return;
    }
    setIsSeeding(true);
    toast.info('Sincronizando banco remoto com toda a base de cadastro padrão...', { duration: 5000 });
    const success = await forceSeedDatabase();
    if (success) {
      toast.success('Pronto! Toda a base padrão (vigilantes, viaturas, postos...) foi cadastrada na nuvem.');
      setTimeout(() => window.location.reload(), 1500);
    } else {
      toast.error('Erro ao enviar cadastros na nuvem.');
    }
    setIsSeeding(false);
  };

  useEffect(() => {
    const unsub = genericService.subscribe<Viatura>('viaturas', (data) => {
      setViaturas(data.sort((a, b) => (a.placa || '').localeCompare(b.placa || '')));
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAdmin) {
      toast.error('Acesso restrito para administradores');
      return;
    }
    if (!placa.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      await genericService.create('viaturas', { 
        placa: placa.toUpperCase().trim(),
        createdAt: serverTimestamp() 
      });
      toast.success('Viatura cadastrada com sucesso');
      setPlaca('');
      setIsModalOpen(false);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Erro ao cadastrar viatura');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [itemToDelete, setItemToDelete] = useState<Viatura | null>(null);

  const handleDelete = async () => {
    if (!itemToDelete) return;
    if (!isAdmin) {
      toast.error('Acesso restrito para administradores');
      return;
    }
    
    setIsDeleting(itemToDelete.id);
    try {
      await genericService.delete('viaturas', itemToDelete.id);
      toast.success('Viatura excluída');
      setItemToDelete(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir viatura');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleBulkSave = async () => {
    if (!isAdmin) {
      toast.error('Acesso restrito para administradores');
      return;
    }
    setSaveError(null);
    const cleanBulkData = bulkData.trim();
    if (!cleanBulkData) {
      setSaveError('Por favor, informe os dados.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const lines = cleanBulkData.split('\n').filter(line => line.trim().length > 0);
      let successCount = 0;
      const toCreate: { placa: string; createdAt: any }[] = [];

      for (const line of lines) {
        const placaRaw = line.trim().toUpperCase();
        if (!placaRaw) continue;

        const alreadyExists = viaturas.some(v => v.placa === placaRaw);
        if (alreadyExists) continue;

        toCreate.push({ 
          placa: placaRaw,
          createdAt: serverTimestamp()
        });
      }

      const chunkSize = 400;
      for (let i = 0; i < toCreate.length; i += chunkSize) {
        const chunk = toCreate.slice(i, i + chunkSize);
        await Promise.all(chunk.map(v => genericService.create('viaturas', v)));
        successCount += chunk.length;
      }

      toast.success(`${successCount} viaturas cadastradas!`);
      setBulkData('');
      setIsBulkMode(false);
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      setSaveError('Erro ao processar lote.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredViaturas = viaturas.filter(v => 
    (v.placa || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      header: 'Identificação',
      accessor: (item: Viatura) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
            <Car className="w-4 h-4" />
          </div>
          <span className="font-black text-slate-900 group-hover:text-brand-600 transition-colors uppercase">
            {item.placa}
          </span>
        </div>
      )
    },
    ...(isAdmin ? [{
      header: 'Ações',
      className: 'text-right',
      accessor: (item: Viatura) => (
        <div className="flex justify-end">
          <button 
            disabled={isDeleting === item.id}
            onClick={(e) => {
              e.stopPropagation();
              setItemToDelete(item);
            }}
            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
          >
            {isDeleting === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      )
    }] : [])
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50">
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Viaturas</h1>
            <p className="text-slate-500 text-sm mt-1">Gerenciamento da frota operacional</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            {isAdmin && (
              <>
                <Button 
                  onClick={handleForceSeed}
                  disabled={isSeeding}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-6 h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest gap-2 shadow-sm disabled:opacity-50"
                >
                  <Database className="w-4 h-4 text-amber-700 font-black animate-pulse" />
                  {isSeeding ? 'GRAVANDO...' : 'ALIMENTAR BANCO CLOUD'}
                </Button>
                <Button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-brand-950 hover:bg-black text-white px-8 h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest gap-3 shadow-2xl shadow-brand-950/20"
                >
                  <Plus className="w-4 h-4" />
                  Nova Viatura
                </Button>
              </>
            )}
          </div>
        </header>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative group flex-1">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
              <input 
                type="text" 
                placeholder="PESQUISAR PLACA..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-16 pl-14 pr-6 bg-white border border-slate-100 rounded-3xl outline-none focus:ring-4 focus:ring-brand-400/10 transition-all font-black text-xs uppercase tracking-widest shadow-sm"
              />
            </div>
            <button 
              className="p-4 bg-white border border-slate-100 rounded-3xl text-slate-400 transition-all hover:text-brand-600 disabled:opacity-50 shadow-sm"
              title="Viatura Data Sync"
            >
              <div className={cn("transition-transform duration-700", isLoading && "animate-spin")}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            </button>
          </div>

          <DataTable 
            columns={columns} 
            data={filteredViaturas} 
            isLoading={isLoading} 
          />
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setPlaca('');
            setIsBulkMode(false);
            setSaveError(null);
          }}
          title={isBulkMode ? "Carga em Massa (Viaturas)" : "Nova Viatura"}
          size={isBulkMode ? "lg" : "md"}
        >
          <div className="space-y-6">
            <div className="flex gap-2 p-2 bg-slate-50 rounded-[1.5rem] border border-slate-100 mb-2">
              <button
                type="button"
                onClick={() => setIsBulkMode(false)}
                className={cn(
                  "flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all",
                  !isBulkMode ? "bg-brand-950 text-white shadow-xl shadow-brand-950/20" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Individual
              </button>
              <button
                type="button"
                onClick={() => setIsBulkMode(true)}
                className={cn(
                  "flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all",
                  isBulkMode ? "bg-brand-950 text-white shadow-xl shadow-brand-950/20" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Em Massa
              </button>
            </div>

            {isBulkMode ? (
              <form onSubmit={(e) => { e.preventDefault(); handleBulkSave(); }} className="space-y-8">
                {saveError && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold">
                    {saveError}
                  </div>
                )}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Placas (uma por linha)</label>
                  <textarea 
                    rows={10}
                    className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[2rem] focus:bg-white focus:ring-4 focus:ring-brand-50 outline-none transition-all text-xs font-bold shadow-inner placeholder:text-slate-200"
                    placeholder="ABC-1234&#10;DEF-5678&#10;GHI-9012..."
                    value={bulkData}
                    onChange={(e) => setBulkData(e.target.value)}
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                  <Button variant="secondary" type="button" className="rounded-xl px-8 h-12 uppercase text-[10px] font-black tracking-widest" onClick={() => { setIsModalOpen(false); setIsBulkMode(false); setBulkData(''); }}>Cancelar</Button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="px-12 h-12 font-black tracking-[0.2em] shadow-2xl shadow-brand-950/20 bg-brand-950 hover:bg-black text-white uppercase text-[10px] rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'SALVANDO...' : 'PROCESSAR PLACAS'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <FormField 
                  label="Placa da Viatura" 
                  placeholder="ABC-1234"
                  value={placa}
                  onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                  required
                  autoFocus
                  className="rounded-2xl h-14 bg-slate-50 border-slate-100 font-bold text-xs"
                />
                
                <div className="flex gap-3">
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 h-12"
                  >
                    Cancelar
                  </Button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="flex-1 h-12 bg-brand-950 hover:bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'SALVANDO...' : 'SALVAR VIATURA'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </Modal>

        <Modal
          isOpen={!!itemToDelete}
          onClose={() => setItemToDelete(null)}
          title="Confirmar Exclusão"
          size="sm"
        >
          <div className="space-y-6 pt-4">
            <p className="text-sm font-bold text-slate-600">
              Deseja realmente excluir a viatura <span className="text-slate-900 underline">"{itemToDelete?.placa}"</span>?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setItemToDelete(null)} disabled={!!isDeleting}>Cancelar</Button>
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
