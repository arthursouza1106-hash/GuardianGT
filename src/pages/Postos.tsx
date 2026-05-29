import React, { useState, useEffect } from 'react';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Search, MapPin, Calendar, ListChecks, Plus, Users, Edit2, Trash2, Database } from 'lucide-react';
import { Posto, ChecklistItem, UserRole } from '@/types';
import { DIAS_SEMANA } from '@/constants';
import { cn } from '@/lib/utils';
import { genericService, serverTimestamp } from '@/lib/firestoreService';
import { forceSeedDatabase } from '@/lib/seed';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

export default function PostosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [postos, setPostos] = useState<Posto[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 300;
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [deleteConfirmPosto, setDeleteConfirmPosto] = useState<Posto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkData, setBulkData] = useState('');
  const [bulkArmado, setBulkArmado] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  const { userData, user } = useAuth();
  const isArthur = 
    userData?.matricula?.toLowerCase().trim() === 'arthur' || 
    userData?.matricula?.toLowerCase().trim() === 'arthursouza1106@gmail.com' ||
    userData?.displayName?.toLowerCase().includes('arthur') ||
    userData?.uid === 'u4' ||
    userData?.uid === 'u8';
  const isSupervisor = userData?.role === 'Admin' || userData?.role === 'Supervisor' || isArthur;
  const isAdmin = userData?.role === 'Admin' || isArthur;

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
  
  const [formData, setFormData] = useState<Partial<Posto>>({
    nome: '',
    armado: false,
    viagem: false
  });

  // Reset page on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleDelete = async (posto: Posto) => {
    if (!isAdmin) {
      toast.error('Acesso restrito para administradores');
      return;
    }
    setIsDeleting(true);

    try {
      await genericService.delete('postos', posto.id);
      toast.success("Posto excluído com sucesso");
      setDeleteConfirmPosto(null);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error("Erro ao excluir posto");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearAll = async () => {
    if (!isAdmin) {
      toast.error('Acesso restrito para administradores');
      return;
    }
    setIsClearingAll(true);
    try {
      const ids = postos.map(p => p.id).filter(id => !!id) as string[];
      if (ids.length > 0) {
        await genericService.deleteAll('postos', ids);
        toast.success("Todos os postos foram apagados com sucesso!");
      } else {
        toast.info("Não há nenhum posto para apagar.");
      }
      setShowClearConfirm(false);
    } catch (error) {
      console.error('Error clearing postos:', error);
      toast.error("Erro ao apagar os postos.");
    } finally {
      setIsClearingAll(false);
    }
  };

  useEffect(() => {
    const unsubPostos = genericService.subscribe<Posto>('postos', (data) => {
      setPostos(data);
      setIsLoadingList(false);
    });
    return () => unsubPostos();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAdmin) {
      toast.error('Acesso restrito para administradores');
      return;
    }
    setSaveError(null);
    
    const nome = formData.nome?.trim() || '';

    if (!nome) {
      toast.error('Informe o nome do posto.');
      return;
    }

    setIsSaving(true);
    
    try {
      const dataToSave = { 
        nome: nome.toUpperCase(),
        cliente: 'GUARDIAN GT',
        supervisorId: userData?.uid || '---',
        armado: !!formData.armado,
        viagem: !!formData.viagem,
        status: 'Ativo' as const,
        updatedAt: serverTimestamp()
      };

      if (formData.id) {
        await genericService.update('postos', formData.id, dataToSave);
        toast.success("Posto atualizado com sucesso!");
      } else {
        await genericService.create('postos', { ...dataToSave, createdAt: serverTimestamp() });
        toast.success("Posto cadastrado com sucesso!");
      }

      // RESET IMEDIATO
      setFormData({ nome: '', armado: false, viagem: false });
      setIsModalOpen(false);

    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar posto');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkSave = async () => {
    setSaveError(null);
    if (!isAdmin) {
      setSaveError('Acesso Negado: Você não tem permissão de administrador.');
      return;
    }
    
    const cleanBulkData = bulkData.trim();
    if (!cleanBulkData) {
      setSaveError('Por favor, informe os dados para o cadastro.');
      return;
    }

    setIsSaving(true);
    
    try {
      const lines = cleanBulkData.split('\n').filter(line => line.trim().length > 0);
      if (lines.length === 0) {
        setSaveError('Por favor, informe os dados para o cadastro.');
        setIsSaving(false);
        return;
      }

      let successCount = 0;
      const duplicates: string[] = [];
      const locallyAddedNames = new Set<string>();

      const toCreate: Partial<Posto>[] = [];

      for (const line of lines) {
        const nomeRaw = line.trim();
        if (!nomeRaw) continue;
        
        const nomeClean = nomeRaw.toUpperCase();
        
        // Check for duplication in current list or current batch
        const alreadyInDb = postos.some(p => p.nome.trim().toUpperCase() === nomeClean);
        const alreadyInBatch = locallyAddedNames.has(nomeClean);

        if (alreadyInDb || alreadyInBatch) {
          duplicates.push(nomeClean);
          continue;
        }

        toCreate.push({
          nome: nomeClean,
          cliente: 'GUARDIAN GT',
          supervisorId: userData?.uid || '---',
          armado: bulkArmado,
          status: 'Ativo' as const,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        locallyAddedNames.add(nomeClean);
      }

      // Create in chunks
      const chunkSize = 400;
      for (let i = 0; i < toCreate.length; i += chunkSize) {
        const chunk = toCreate.slice(i, i + chunkSize);
        await genericService.batchSave('postos', chunk);
        successCount += chunk.length;
      }
      
      if (successCount === 0 && duplicates.length > 0) {
        setSaveError(`Nenhum novo posto cadastrado. ${duplicates.length} duplicados detectados.`);
      } else {
        toast.success(`${successCount} postos cadastrados com sucesso!`);
        if (duplicates.length > 0) {
          toast.info(`${duplicates.length} postos ignorados por duplicidade.`);
        }
        setBulkData('');
        setIsBulkMode(false);
        setIsModalOpen(false);
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Error in handleBulkSave:', error);
      setSaveError('Ocorreu um erro ao processar o cadastro em massa.');
    } finally {
      setIsSaving(false);
    }
  };

  const columns: DataTableColumn<Posto>[] = [

    { 
      header: 'NOME DO POSTO', 
      accessor: (p: Posto) => (
        <div className="font-semibold text-slate-900 uppercase">{p.nome}</div>
      )
    },
    { 
      header: 'AÇÕES', 
      className: "text-right",
      accessor: (p: Posto) => (
        <div className="flex items-center justify-end gap-3">
          {p.viagem && (
            <span className="text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-full border bg-emerald-500/10 text-emerald-700 border-emerald-200 font-extrabold">
              VIAGEM
            </span>
          )}
          <span className={cn(
            "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border",
            p.armado 
              ? "bg-red-50 text-red-700 border-red-100" 
              : "bg-blue-50 text-blue-700 border-blue-100"
          )}>
            {p.armado ? 'ARMADO' : 'DESARMADO'}
          </span>
          {isAdmin && (
            <div className="flex items-center gap-1">
              <button 
                id={`edit-posto-${p.id}`}
                onClick={(e) => { e.stopPropagation(); setFormData(p); setIsSaving(false); setIsModalOpen(true); }}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                title="Editar Posto"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button 
                id={`delete-posto-${p.id}`}
                onClick={(e) => { e.stopPropagation(); setDeleteConfirmPosto(p); }}
                className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                title="Excluir Posto"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-[-0.02em] leading-none uppercase">Postos de Serviço</h1>
          <p className="text-xs text-slate-400 font-bold tracking-[0.1em] uppercase opacity-70 mt-2">Mapeamento de unidades operacionais</p>
        </div>
        {isAdmin && (
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <Button 
              onClick={handleForceSeed}
              disabled={isSeeding}
              className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-6 h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest gap-2 shadow-sm disabled:opacity-50"
            >
              <Database className="w-4 h-4 text-amber-700 font-black animate-pulse" />
              {isSeeding ? 'GRAVANDO...' : 'ALIMENTAR BANCO CLOUD'}
            </Button>
            {postos.length > 0 && (
              <Button
                id="btn-limpar-todos-postos"
                onClick={() => setShowClearConfirm(true)}
                variant="outline"
                className="h-14 px-6 rounded-2xl flex items-center justify-center gap-2 border-slate-100 hover:border-red-200 hover:bg-red-50 text-slate-500 hover:text-red-600 transition-all font-black text-[10px] uppercase tracking-widest"
              >
                <Trash2 className="w-4 h-4" />
                Limpar Todos
              </Button>
            )}
            <Button 
              id="btn-nova-unidade"
              onClick={() => {
                setFormData({
                  nome: '',
                  armado: false,
                  viagem: false
                });
                setIsSaving(false);
                setIsModalOpen(true);
              }}
              className="h-14 px-8 rounded-2xl flex items-center justify-center gap-3 shadow-2xl shadow-brand-950/20 bg-brand-950 hover:bg-black text-white transition-all transform hover:scale-105 active:scale-95 group"
            >
              <Plus className="w-5 h-5 text-brand-400 group-hover:text-white transition-colors" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Nova Unidade</span>
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-brand-950/5 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between gap-4">
          <div className="relative flex-1 group">
            <Search className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Pesquisar unidade operacional..." 
              className="w-full pl-12 pr-4 py-4 bg-slate-50/50 rounded-2xl text-xs font-black uppercase tracking-widest focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-50 transition-all placeholder:text-slate-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-[10px] font-black text-brand-900/30 uppercase tracking-[0.2em] px-4 whitespace-nowrap">
              {postos.length} UNIDADES
            </div>
          </div>
        </div>

        <DataTable 
          columns={columns} 
          data={(() => {
            const filtered = postos.filter(p => (p.nome || '').toLowerCase().includes(searchTerm.toLowerCase()));
            const startIndex = (currentPage - 1) * itemsPerPage;
            return filtered.slice(startIndex, startIndex + itemsPerPage);
          })()} 
          onRowClick={isAdmin ? (p) => { setFormData(p); setIsModalOpen(true); } : undefined}
        />
      </div>

      {/* Pagination Controls */}
      {(() => {
        const filteredCount = postos.filter(p => (p.nome || '').toLowerCase().includes(searchTerm.toLowerCase())).length;
        const totalPages = Math.ceil(filteredCount / itemsPerPage);
        
        if (totalPages <= 1) return null;

        return (
          <div className="flex items-center justify-center gap-2 py-6">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setCurrentPage(p => Math.max(1, p - 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={currentPage === 1}
              className="rounded-xl px-6 bg-white shadow-sm border-slate-100 font-bold uppercase text-[10px] tracking-widest text-slate-400 disabled:opacity-30"
            >
              Anterior
            </Button>
            
            <div className="flex items-center gap-1.5">
              {[...Array(totalPages)].map((_, i) => {
                const page = i + 1;
                // Mostrar um subconjunto se houver muitas páginas
                if (totalPages > 7 && Math.abs(page - currentPage) > 2 && page !== 1 && page !== totalPages) {
                  if (Math.abs(page - currentPage) === 3) return <span key={page} className="text-slate-300 font-black">...</span>;
                  return null;
                }
                
                return (
                  <button
                    key={page}
                    onClick={() => {
                      setCurrentPage(page);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={cn(
                      "w-9 h-9 rounded-xl text-[10px] font-black tracking-tighter transition-all duration-300",
                      currentPage === page 
                        ? "bg-brand-950 text-white shadow-xl shadow-brand-950/20 scale-110 active:scale-95" 
                        : "text-slate-400 hover:bg-slate-50 hover:text-slate-600 active:scale-90"
                    )}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setCurrentPage(p => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={currentPage === totalPages}
              className="rounded-xl px-6 bg-white shadow-sm border-slate-100 font-bold uppercase text-[10px] tracking-widest text-slate-400 disabled:opacity-30"
            >
              Próxima
            </Button>
          </div>
        );
      })()}


      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setSaveError(null);
          setIsBulkMode(false);
          setBulkArmado(false);
        }} 
        title={formData.id ? "Editar Posto de Serviço" : (isBulkMode ? "Cadastro de Postos em Massa" : "Novo Posto de Serviço")}
        size={isBulkMode ? "lg" : "md"}
      >
        <div className="space-y-6">
          {!formData.id && (
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
          )}

          {isBulkMode && !formData.id ? (
            <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); handleBulkSave(); }}>
              {saveError && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold">
                  {saveError}
                </div>
              )}

              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4 shadow-inner">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block px-1">
                  Configuração do Lote
                </label>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black text-slate-900 uppercase tracking-tight">
                      {bulkArmado ? 'Lote de Postos Armados' : 'Lote de Postos Desarmados'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                      Todos os postos deste lote serão salvos como {bulkArmado ? 'Armados' : 'Desarmados'}.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBulkArmado(!bulkArmado)}
                    className={cn(
                      "relative inline-flex h-7 w-12 items-center rounded-full transition-all focus:outline-none shadow-sm",
                      bulkArmado ? "bg-brand-950 shadow-brand-950/20" : "bg-slate-200"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4.5 w-4.5 transform rounded-full bg-white transition-transform duration-300",
                        bulkArmado ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Nomes dos Postos</label>
                <p className="text-[10px] text-brand-500 font-bold uppercase tracking-widest opacity-60 px-1">Informe um nome por linha</p>
                <textarea 
                  rows={10}
                  className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[2rem] focus:bg-white focus:ring-4 focus:ring-brand-50 outline-none transition-all text-xs font-bold shadow-inner placeholder:text-slate-200"
                  placeholder="POSTO ALFA&#10;POSTO BRAVO&#10;POSTO CHARLIE..."
                  value={bulkData}
                  onChange={(e) => setBulkData(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                <Button variant="secondary" type="button" className="rounded-xl px-8 h-12 uppercase text-[10px] font-black tracking-widest" onClick={() => { setIsModalOpen(false); setIsBulkMode(false); setBulkData(''); }}>Cancelar</Button>
                <button 
                  type="submit" 
                  disabled={isSaving} 
                  className="px-12 h-12 font-black tracking-[0.2em] shadow-2xl shadow-brand-950/20 bg-brand-950 hover:bg-black text-white uppercase text-[10px] rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'SALVANDO...' : 'CADASTRAR POSTOS'}
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleSave}>
              {saveError && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold">
                  {saveError}
                </div>
              )}
              <div className="space-y-8">

            <FormField 
              label="Nome da Unidade" 
              placeholder="NOME COMPLETO DO POSTO" 
              value={formData.nome || ''}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              required
              className="rounded-2xl h-14 bg-slate-50 border-slate-100 font-bold text-xs"
            />
            
            <div className="p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100 space-y-4 shadow-inner">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block px-1">
                Protocolo de Segurança
              </label>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-slate-900 uppercase tracking-tight">
                    {formData.armado ? 'Posto Armado' : 'Posto Desarmado'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                    {formData.armado 
                      ? 'Exige agentes com porte de arma.' 
                      : 'Unidade sem exigência tática.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, armado: !formData.armado })}
                  className={cn(
                    "relative inline-flex h-7 w-12 items-center rounded-full transition-all focus:outline-none shadow-sm",
                    formData.armado ? "bg-brand-950 shadow-brand-950/20" : "bg-slate-200"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4.5 w-4.5 transform rounded-full bg-white transition-transform duration-300",
                      formData.armado ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100 space-y-4 shadow-inner">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block px-1">
                Localidade da Unidade
              </label>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 pr-4">
                  <div className="text-xs font-black text-slate-900 uppercase tracking-tight">
                    {formData.viagem ? 'Unidade de Viagem' : '📍 Unidade Local'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 leading-relaxed">
                    {formData.viagem 
                      ? 'Este posto é auditado apenas durante viagens de fiscalização.' 
                      : 'Posto situado na região metropolitana ou local da sede.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, viagem: !formData.viagem })}
                  className={cn(
                    "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-all focus:outline-none shadow-sm",
                    formData.viagem ? "bg-emerald-600 shadow-emerald-600/20" : "bg-slate-200"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4.5 w-4.5 transform rounded-full bg-white transition-transform duration-300",
                      formData.viagem ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-8 border-t border-slate-100">
            <Button variant="secondary" type="button" className="rounded-xl px-8 h-12 uppercase text-[10px] font-black tracking-widest" onClick={() => { setIsModalOpen(false); setIsSaving(false); }} disabled={isSaving}>Cancelar</Button>
            <button 
              type="submit" 
              disabled={isSaving} 
              className="px-12 h-12 font-black tracking-[0.2em] shadow-2xl shadow-brand-950/20 bg-brand-950 hover:bg-black text-white uppercase text-[10px] rounded-xl min-w-[200px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'SALVANDO...' : 'CONFIRMAR CADASTRO'}
            </button>
          </div>
        </form>
      )}
    </div>
  </Modal>

      <Modal
        isOpen={!!deleteConfirmPosto}
        onClose={() => setDeleteConfirmPosto(null)}
        title="Excluir Unidade"
        size="md"
      >
        <div className="space-y-6">
          <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100">
            <p className="text-xs font-bold leading-relaxed">
              Você está prestes a excluir a unidade <span className="font-black underline">{deleteConfirmPosto?.nome}</span> do sistema. Esta operação removerá todos os vínculos operacionais.
            </p>
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button id="cancel-delete-posto" variant="secondary" onClick={() => setDeleteConfirmPosto(null)} disabled={isDeleting}>Cancelar</Button>
            <button 
              id="confirm-delete-posto"
              className="px-8 h-10 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
              disabled={isDeleting}
              onClick={() => deleteConfirmPosto && handleDelete(deleteConfirmPosto)}
            >
              {isDeleting ? 'EXCLUINDO...' : 'SIM, EXCLUIR UNIDADE'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Apagar Todos os Postos"
        size="md"
      >
        <div className="space-y-6">
          <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100">
            <p className="text-xs font-bold leading-relaxed uppercase tracking-wide">
              Aviso Importante: Esta ação irá apagar definitivamente todos os <span className="font-black text-rose-700">{postos.length} postos</span> atualmente cadastrados no sistema.
            </p>
            <p className="text-[10px] font-bold text-rose-500/80 mt-2 uppercase tracking-widest">
              Esta ação não pode ser desfeita. Todos os vínculos a ocorrências e roteiros continuarão existindo, mas os postos listados aqui sumirão de vez.
            </p>
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button id="cancel-clear-all-postos" variant="secondary" onClick={() => setShowClearConfirm(false)} disabled={isClearingAll} className="uppercase text-[10px] font-black tracking-widest rounded-xl h-11">Cancelar</Button>
            <button 
              id="confirm-clear-all-postos"
              className="px-8 h-11 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
              disabled={isClearingAll}
              onClick={handleClearAll}
            >
              {isClearingAll ? 'APAGANDO...' : 'SIM, APAGAR TODOS'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
