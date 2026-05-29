import React, { useState, useEffect } from 'react';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Plus, Search, Filter, UserPlus, Users, AlertCircle, Trash2, Edit2, Database } from 'lucide-react';
import { Vigilante, StatusVigilante, FuncaoVigilante } from '@/types';
import { STATUS_VIGILANTE, FUNCOES } from '@/constants';
import { cn } from '@/lib/utils';
import { genericService } from '@/lib/firestoreService';
import { forceSeedDatabase } from '@/lib/seed';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

export default function VigilantesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedVigilanteId, setSelectedVigilanteId] = useState<string | null>(null);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [deleteConfirmVigilante, setDeleteConfirmVigilante] = useState<Vigilante | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 300;
  const [bulkData, setBulkData] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyNoMatricula, setShowOnlyNoMatricula] = useState(false);
  const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Recalcular página quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, showOnlyNoMatricula, showOnlyDuplicates]);

  const [vigilantes, setVigilantes] = useState<Vigilante[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { userData, user } = useAuth();
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
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
  
  const [formData, setFormData] = useState<Partial<Vigilante>>({
    nome: '',
    matricula: '',
    funcao: FuncaoVigilante.Vigilante,
    armado: false,
  });

  useEffect(() => {
    const unsubscribe = genericService.subscribe<Vigilante>('vigilantes', (data) => {
      setVigilantes(data.sort((a, b) => (a.nome || '').localeCompare(b.nome || '')));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    
    try {
      const trimmedNome = formData.nome?.trim() || '';
      if (!trimmedNome) {
        toast.error('O nome é obrigatório');
        setIsSaving(false);
        return;
      }

      if (isEditing && selectedVigilanteId) {
        await genericService.update('vigilantes', selectedVigilanteId, formData);
        toast.success('Alteração concluída!');
      } else {
        await genericService.create('vigilantes', {
          ...formData,
          situacao: StatusVigilante.Ativo,
          armado: !!formData.armado,
          createdAt: new Date().toISOString()
        });
        toast.success('Cadastrado com sucesso!');
      }
      
      setFormData({
        nome: '',
        matricula: '',
        funcao: FuncaoVigilante.Vigilante,
        armado: false,
      });
      setIsEditing(false);
      setSelectedVigilanteId(null);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar informações');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (v: Vigilante) => {
    setFormData({
      nome: v.nome,
      matricula: v.matricula || '',
      funcao: v.funcao,
      armado: !!v.armado
    });
    setSelectedVigilanteId(v.id);
    setIsEditing(true);
    setIsBulkMode(false);
    setIsModalOpen(true);
  };

  const handleDelete = async (v: Vigilante) => {
    if (!v.id) return;
    setDeletingId(v.id);

    try {
      await genericService.delete('vigilantes', v.id);
      toast.success('Vigilante excluído com sucesso');
      setDeleteConfirmVigilante(null);
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao excluir cadastro');
    } finally {
      setDeletingId(null);
    }
  };

  const openCreateModal = () => {
    setFormData({
      nome: '',
      matricula: '',
      funcao: FuncaoVigilante.Vigilante,
      armado: false,
    });
    setSelectedVigilanteId(null);
    setIsEditing(false);
    setIsBulkMode(false);
    setIsModalOpen(true);
  };

  const handleBulkSave = async () => {
    setSaveError(null);
    const cleanBulkData = bulkData.trim();
    if (!cleanBulkData) {
      setSaveError('Por favor, informe os dados para o cadastro.');
      return;
    }

    setIsSaving(true);
    
    try {
      const lines = cleanBulkData.split('\n').filter(line => line.trim().length > 0);
      let successCount = 0;
      const duplicates: string[] = [];
      const locallyAddedMatriculas = new Set<string>();
      const locallyAddedNames = new Set<string>();

      const toCreate: Partial<Vigilante>[] = [];

      for (const line of lines) {
        let nomeRaw = '';
        let matricula = '';
        
        // Multi-delimiter split (tab, comma, semicolon, dash)
        const parts = line.split(/[;,\t\-]+/).map(p => p.trim());
        
        if (parts.length >= 2) {
          nomeRaw = parts[0];
          matricula = parts.slice(1).join('-').trim();
        } else {
          nomeRaw = parts[0];
          matricula = '';
        }

        if (!nomeRaw) continue;
        
        const nomeClean = nomeRaw.trim();
        const nomeLower = nomeClean.toLowerCase();
        const trimmedMatricula = matricula.trim();
        
        const alreadyInDb = vigilantes.some(v => {
          const vMatricula = v.matricula?.toString().trim();
          return trimmedMatricula && vMatricula === trimmedMatricula;
        });
        
        const alreadyInBatch = trimmedMatricula && locallyAddedMatriculas.has(trimmedMatricula);

        if (trimmedMatricula && (alreadyInDb || alreadyInBatch)) {
          duplicates.push(`${nomeClean} (${trimmedMatricula})`);
          continue;
        }

        toCreate.push({
          nome: nomeClean,
          matricula: trimmedMatricula || '',
          funcao: FuncaoVigilante.Vigilante,
          situacao: StatusVigilante.Ativo,
          armado: false,
          createdAt: new Date().toISOString()
        });

        if (trimmedMatricula) locallyAddedMatriculas.add(trimmedMatricula);
      }

      // Process in batches of 400
      const chunkSize = 400;
      for (let i = 0; i < toCreate.length; i += chunkSize) {
        const chunk = toCreate.slice(i, i + chunkSize);
        await genericService.batchSave('vigilantes', chunk);
        successCount += chunk.length;
      }
      
      if (successCount === 0 && duplicates.length > 0) {
        setSaveError(`Nenhum novo agente cadastrado. ${duplicates.length} matrículas já existiam.`);
      } else {
        toast.success(`${successCount} agentes preparados e salvos com sucesso!`);
        if (duplicates.length > 0) {
          toast.info(`${duplicates.length} registros ignorados por já possuírem matrícula no sistema.`);
        }
        setBulkData('');
        setIsBulkMode(false);
        setIsModalOpen(false);
      }
    } catch (error) {
      console.error('Error in handleBulkSave:', error);
      setSaveError('Erro ao processar lote. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const columns: DataTableColumn<Vigilante>[] = [
    { 
      header: 'Nome Completo', 
      className: "w-2/5 min-w-[140px]",
      accessor: (v: Vigilante) => (
        <span className="font-bold text-slate-900 whitespace-nowrap text-[10px] block truncate">{v.nome}</span>
      )
    },
    { 
      header: 'Matrícula', 
      className: "w-24 text-center",
      accessor: (v: Vigilante) => (
        <div className={cn(
          "font-mono text-[9px] w-full text-center",
          !v.matricula ? "text-red-400 italic" : "text-slate-600 font-bold"
        )}>
          {v.matricula || '---'}
        </div>
      )
    },
    { 
      header: 'Função', 
      className: "w-24 px-0",
      accessor: (v: Vigilante) => (
        <span className="text-[9px] font-bold text-slate-500 uppercase">{v.funcao}</span>
      )
    },
    {
      header: 'Ações',
      className: "w-28",
      accessor: (v: Vigilante) => (
        <div className="flex items-center gap-1">
          {isAdmin && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(v);
                }}
                className="text-[9px] h-7 px-2 font-bold uppercase tracking-wider border-slate-200 hover:bg-slate-50 shrink-0"
              >
                <Edit2 className="w-3 h-3 mr-1" />
                Editar
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                type="button"
                isLoading={deletingId === v.id}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setDeleteConfirmVigilante(v);
                }}
                className={cn(
                  "text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0 flex items-center justify-center rounded-lg shrink-0",
                  deletingId === v.id && "bg-red-50"
                )}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
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
          <h1 className="text-3xl font-black text-slate-900 tracking-[-0.02em] leading-none uppercase">Vigilantes</h1>
          <p className="text-xs text-slate-400 font-bold tracking-[0.1em] uppercase opacity-70 mt-2">Gestão estratégica de efetivo</p>
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
                onClick={openCreateModal}
                className="h-14 px-8 rounded-2xl flex items-center justify-center gap-3 shadow-2xl shadow-brand-950/20 bg-brand-950 hover:bg-black text-white transition-all transform hover:scale-105 active:scale-95 group"
              >
                <Plus className="w-5 h-5 text-brand-400 group-hover:text-white transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Novo Agente</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-end px-2 gap-4">
          <div className="flex items-center bg-brand-50 border border-brand-100 px-4 py-2 rounded-xl gap-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-brand-900/40 uppercase tracking-[0.2em]">Efetivo Total:</span>
              <span className="text-brand-950 font-black text-xs font-mono">{vigilantes.length}</span>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-xl shadow-brand-950/5 flex flex-col lg:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
            <input 
              type="text" 
              placeholder="Pesquisar agente por nome ou matrícula..." 
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase tracking-tight focus:bg-white focus:ring-4 focus:ring-brand-50 outline-none transition-all placeholder:text-slate-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-6 w-full lg:w-auto justify-end px-2">
            <div className="flex items-center gap-3">
              <span className={cn(
                "text-[9px] font-black uppercase tracking-widest transition-colors",
                showOnlyNoMatricula ? "text-brand-950" : "text-slate-300"
              )}>
                Pendente Matrícula
              </span>
              <button 
                type="button"
                onClick={() => {
                  setShowOnlyNoMatricula(!showOnlyNoMatricula);
                  if (!showOnlyNoMatricula) setShowOnlyDuplicates(false);
                }}
                className={cn(
                  "relative inline-flex h-5 w-10 items-center rounded-full transition-all duration-300 outline-none shrink-0",
                  showOnlyNoMatricula ? "bg-brand-950" : "bg-slate-100"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-300 shadow-sm",
                    showOnlyNoMatricula ? "translate-x-5.5" : "translate-x-1"
                  )}
                />
              </button>
            </div>

            <div className="h-4 w-[1px] bg-slate-100 hidden lg:block" />

            <div className="flex items-center gap-3">
              <span className={cn(
                "text-[9px] font-black uppercase tracking-widest transition-colors",
                showOnlyDuplicates ? "text-rose-600" : "text-slate-300"
              )}>
                Duplicados
              </span>
              <button 
                type="button"
                onClick={() => {
                  setShowOnlyDuplicates(!showOnlyDuplicates);
                  if (!showOnlyDuplicates) setShowOnlyNoMatricula(false);
                }}
                className={cn(
                  "relative inline-flex h-5 w-10 items-center rounded-full transition-all duration-300 outline-none shrink-0",
                  showOnlyDuplicates ? "bg-rose-500" : "bg-slate-100"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-300 shadow-sm",
                    showOnlyDuplicates ? "translate-x-5.5" : "translate-x-1"
                  )}
                />
              </button>
            </div>
            
            <div className="h-4 w-[1px] bg-slate-100 hidden lg:block" />
   
            {isAdmin && vigilantes.length > 0 && (
              <div className="flex items-center gap-2">
                {showDeleteAllConfirm ? (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                    <button 
                      className="h-10 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase px-6 rounded-xl border-none shadow-xl shadow-rose-200 transition-all disabled:opacity-50"
                      disabled={isClearingAll}
                      onClick={async () => {
                        setIsClearingAll(true);
                        
                        try {
                          const ids = vigilantes.map(v => v.id);
                          await genericService.deleteAll('vigilantes', ids);
                          toast.success('Exclusão total realizada com sucesso');
                          setShowDeleteAllConfirm(false);
                        } catch (error) {
                          console.error('Error clearing all:', error);
                          setSaveError('Erro ao excluir registros.');
                        } finally {
                          setIsClearingAll(false);
                        }
                      }}
                    >
                      {isClearingAll ? 'APAGANDO...' : 'Sim, Apagar Tudo'}
                    </button>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="h-10 text-[10px] font-black uppercase px-4 rounded-xl border-slate-100"
                      disabled={isClearingAll}
                      onClick={() => setShowDeleteAllConfirm(false)}
                    >
                      X
                    </Button>
                  </div>
                ) : (
                  <Button 
                    variant="ghost" 
                    icon={Trash2} 
                    className="rounded-2xl h-11 text-[10px] px-6 font-black uppercase tracking-widest text-slate-300 hover:bg-rose-50 hover:text-rose-600 border border-transparent hover:border-rose-100 transition-all"
                    onClick={() => setShowDeleteAllConfirm(true)}
                  >
                    Excluir Tudo
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-brand-950/5 overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between gap-4">
           <div className="flex-1" />
           <div className="flex items-center gap-4">
            <div className="text-[10px] font-black text-brand-900/30 uppercase tracking-[0.2em] px-4 whitespace-nowrap">
              {vigilantes.length} AGENTES
            </div>
          </div>
        </div>
        <DataTable 
          columns={columns} 
          data={(() => {

          // Identify duplicate matriculas
          const matriculaCounts = new Map<string, number>();
          vigilantes.forEach(v => {
            if (v.matricula && v.matricula.trim()) {
              const m = v.matricula.trim();
              matriculaCounts.set(m, (matriculaCounts.get(m) || 0) + 1);
            }
          });
          const duplicateMatriculas = new Set(
            Array.from(matriculaCounts.entries())
              .filter(([_, count]) => count > 1)
              .map(([m]) => m)
          );

          const filtered = vigilantes
            .filter(v => {
              const matchesSearch = (v.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                   v.matricula?.toLowerCase().includes(searchTerm.toLowerCase());
              const matchesMatriculaFilter = showOnlyNoMatricula ? !v.matricula : true;
              const matchesDuplicateFilter = showOnlyDuplicates 
                ? (v.matricula && duplicateMatriculas.has(v.matricula.trim())) 
                : true;
              return matchesSearch && matchesMatriculaFilter && matchesDuplicateFilter;
            })
            .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
          
          const startIndex = (currentPage - 1) * itemsPerPage;
          return filtered.slice(startIndex, startIndex + itemsPerPage);
        })()} 
      />

      {/* Pagination Controls */}
      {(() => {
        const matriculaCounts = new Map<string, number>();
        vigilantes.forEach(v => {
          if (v.matricula && v.matricula.trim()) {
            const m = v.matricula.trim();
            matriculaCounts.set(m, (matriculaCounts.get(m) || 0) + 1);
          }
        });
        const duplicateMatriculas = new Set(
          Array.from(matriculaCounts.entries())
            .filter(([_, count]) => count > 1)
            .map(([m]) => m)
        );

        const filteredCount = vigilantes.filter(v => {
          const matchesSearch = (v.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                              v.matricula?.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesMatriculaFilter = showOnlyNoMatricula ? !v.matricula : true;
          const matchesDuplicateFilter = showOnlyDuplicates 
            ? (v.matricula && duplicateMatriculas.has(v.matricula.trim())) 
            : true;
          return matchesSearch && matchesMatriculaFilter && matchesDuplicateFilter;
        }).length;
        
        const totalPages = Math.ceil(filteredCount / itemsPerPage);
        
        if (totalPages <= 1) return null;

        return (
          <div className="flex items-center justify-center gap-2 py-6 border-t border-slate-50">
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
                        ? "bg-brand-950 text-white shadow-xl shadow-brand-950/20 scale-110" 
                        : "text-slate-400 hover:bg-slate-50"
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
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { 
          setIsModalOpen(false); 
          setSaveError(null); 
          setIsBulkMode(false);
        }} 
        title={isEditing ? "Editar Vigilante" : (isBulkMode ? "Cadastro em Massa" : "Cadastrar Novo Vigilante")}
        size="lg"
      >
        <div className="space-y-6">
          {!isEditing && (
            <div className="flex gap-2 p-2 bg-slate-50 rounded-[1.5rem] border border-slate-100 mb-2">
              <button
                onClick={() => setIsBulkMode(false)}
                className={cn(
                  "flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all",
                  !isBulkMode ? "bg-brand-950 text-white shadow-xl shadow-brand-950/20" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Inscrição Individual
              </button>
              <button
                onClick={() => setIsBulkMode(true)}
                className={cn(
                  "flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all",
                  isBulkMode ? "bg-brand-950 text-white shadow-xl shadow-brand-950/20" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Carga em Massa
              </button>
            </div>
          )}

          {isBulkMode && !isEditing ? (
            <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); handleBulkSave(); }}>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Conjunto de Dados (Agente - Registro)</label>
                <p className="text-[10px] text-brand-500 font-bold uppercase tracking-widest opacity-60 px-1">Padrão: Nome do Agente - Matrícula (um por linha)</p>
                <textarea 
                  rows={10}
                  className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[2rem] focus:bg-white focus:ring-4 focus:ring-brand-50 outline-none transition-all text-xs font-bold shadow-inner placeholder:text-slate-200"
                  placeholder="Carlos Alberto - 102030&#10;Fernando Souza - 405060..."
                  value={bulkData}
                  onChange={(e) => setBulkData(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                <Button variant="secondary" type="button" className="rounded-xl px-8 h-12 uppercase text-[10px] font-black tracking-widest" onClick={() => { setIsModalOpen(false); setIsBulkMode(false); setBulkData(''); }}>Abortar</Button>
                <button 
                  type="submit" 
                  disabled={isSaving} 
                  className="px-12 h-12 font-black tracking-[0.2em] shadow-2xl shadow-brand-950/20 bg-brand-950 hover:bg-black text-white uppercase text-[10px] rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'SALVANDO...' : 'PROCESSAR INSCRIÇÕES'}
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-8" onSubmit={handleSave}>
              {saveError && (
                <div className="p-5 bg-rose-50 border border-rose-100 rounded-[2rem] flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-rose-900 uppercase tracking-widest">Falha na Operação</p>
                    <p className="text-xs text-rose-700 font-bold leading-tight">{saveError}</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="md:col-span-2">
                  <FormField 
                    label="Nome do Agente" 
                    placeholder="IDENTIFICAÇÃO COMPLETA" 
                    value={formData.nome || ''}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                    className="rounded-2xl h-14 bg-slate-50 border-slate-100 font-bold text-xs"
                  />
                </div>
                <FormField 
                  label="Código de Matrícula" 
                  placeholder="REGISTRO CORPORATIVO" 
                  value={formData.matricula || ''}
                  onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                  className="rounded-2xl h-14 bg-slate-50 border-slate-100 font-bold text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-8 border-t border-slate-100">
                <Button variant="secondary" type="button" className="rounded-xl px-8 h-12 uppercase text-[10px] font-black tracking-widest" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                <button 
                  type="submit" 
                  disabled={isSaving} 
                  className="px-12 h-12 font-black tracking-[0.2em] shadow-2xl shadow-brand-950/20 bg-brand-950 hover:bg-black text-white uppercase text-[10px] rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'SALVANDO...' : 'EFETIVAR CADASTRO'}
                </button>
              </div>
            </form>
          )}

        </div>
      </Modal>

      {/* Custom Deletion Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmVigilante}
        onClose={() => setDeleteConfirmVigilante(null)}
        title="Confirmar Exclusão"
        size="md"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-red-50 rounded-2xl border border-red-100">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-red-900 uppercase tracking-tight">Excluir Vigilante</h3>
              <p className="text-xs text-red-700 font-medium whitespace-normal">
                Você tem certeza que deseja excluir o cadastro de <span className="font-black italic">{deleteConfirmVigilante?.nome}</span>?
              </p>
            </div>
          </div>
          
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
            Esta ação não pode ser desfeita e removerá todos os dados associados a este colaborador do sistema de forma permanente.
          </p>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDeleteConfirmVigilante(null)} disabled={!!deletingId}>
              Cancelar
            </Button>
            <button 
              disabled={!!deletingId} 
              onClick={() => deleteConfirmVigilante && handleDelete(deleteConfirmVigilante)}
              className="px-8 h-10 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg shadow-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deletingId ? 'EXCLUINDO...' : 'SIM, EXCLUIR REGISTRO'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
