import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { genericService } from '@/lib/firestoreService';
import { Vigilante, Posto, Transferencia, StatusVigilante } from '@/types';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Modal } from '@/components/ui/Modal';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { 
  ArrowRight, 
  AlertCircle, 
  Clock, 
  History,
  CheckCircle,
  Search,
  Plus,
  RotateCcw,
  Trash2,
  Check,
  Eye,
  FileSpreadsheet,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import * as XLSX from 'xlsx';

export default function TransferenciasPage() {
  const { userData, user } = useAuth();
  const roleNorm = (userData?.role || '').toLowerCase().trim();
  const isArthur = 
    userData?.matricula?.toLowerCase().trim() === 'arthur' || 
    userData?.matricula?.toLowerCase().trim() === 'arthursouza1106@gmail.com' ||
    userData?.displayName?.toLowerCase().includes('arthur') ||
    userData?.uid === 'u4' ||
    userData?.uid === 'u8';
  const isAdmin = roleNorm === 'admin' || isArthur;
  
  const [vigilantes, setVigilantes] = useState<Vigilante[]>([]);
  const [postos, setPostos] = useState<Posto[]>([]);
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [motivosList, setMotivosList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    vigilanteSaindoId: '',
    vigilanteEntrandoId: '',
    postoDestinoId: '',
    postoOrigemId: '',
    dataTransferencia: new Date().toISOString().split('T')[0],
    motivo: '',
    horarioTurno: ''
  });

  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [showSequencePrompt, setShowSequencePrompt] = useState(false);
  const [lastSubstitute, setLastSubstitute] = useState<{ id: string; nome: string } | null>(null);
  const [viewTransferDetails, setViewTransferDetails] = useState<Transferencia | null>(null);

  useEffect(() => {
    loadData();
    
    const unsubscribe = genericService.subscribe<Transferencia>('transferencias', (data) => {
      // Sort desc locally by creation date
      const sorted = [...data].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setTransferencias(sorted);
    });
    
    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    try {
      const [vData, pData, mData] = await Promise.all([
        genericService.list<Vigilante>('vigilantes'),
        genericService.list<Posto>('postos'),
        genericService.list<{nome: string}>('motivos_falta')
      ]);
      setVigilantes(vData);
      setPostos(pData);
      
      const dbMotivos = mData.map(m => m.nome.trim().toUpperCase());
      const standardMotivos = ["FÉRIAS", "DESLIGADO", "RETORNO DE FÉRIAS"];
      const combined = Array.from(new Set([...standardMotivos, ...dbMotivos])).sort();
      setMotivosList(combined);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSuccessMessage(null);
    setIsSaving(true);
    
    const leavingId = formData.vigilanteSaindoId;
    const enteringId = formData.vigilanteEntrandoId;
    const destinationPostId = formData.postoDestinoId;
    const originPostId = formData.postoOrigemId;
    const transferDate = formData.dataTransferencia;
    const reason = formData.motivo;
    const shiftTime = formData.horarioTurno;

    if (!leavingId || !enteringId || !destinationPostId || !originPostId || !reason || !shiftTime) {
      setSaveError('Por favor, preencha todos os campos do formulário (incluindo postos e horário do turno).');
      setIsSaving(false);
      return;
    }

    if (leavingId === enteringId) {
      setSaveError('O vigilante substituído não pode ser o mesmo que o substituto.');
      setIsSaving(false);
      return;
    }

    try {
      const vigilanteSaindo = vigilantes.find(v => v.id === leavingId);
      const vigilanteEntrando = vigilantes.find(v => v.id === enteringId);
      const postoDestino = postos.find(p => p.id === destinationPostId);
      const postoOrigem = postos.find(p => p.id === originPostId);

      const newTransfer = {
        vigilanteSaindoId: leavingId,
        nomeVigilanteSaindo: vigilanteSaindo?.nome || '',
        vigilanteEntrandoId: enteringId,
        nomeVigilanteEntrando: vigilanteEntrando?.nome || '',
        postoDestinoId: destinationPostId,
        nomePostoDestino: postoDestino?.nome || '',
        postoOrigemId: originPostId,
        nomePostoOrigem: postoOrigem?.nome || 'Reserva/Outro',
        dataTransferencia: transferDate,
        motivo: reason,
        horarioTurno: shiftTime,
        status: 'Pendente',
        supervisorId: user?.uid || userData?.uid || '',
        nomeSupervisor: userData?.displayName || 'Supervisor',
        createdAt: new Date().toISOString()
      };

      await genericService.create('transferencias', newTransfer);

      // Optionally update status of the leaving guard if the reason includes "DESLIGADO"
      const reasonUpper = reason.toUpperCase();
      if (reasonUpper.includes('DESLIGADO') && leavingId) {
        await genericService.update('vigilantes', leavingId, {
          situacao: StatusVigilante.DesligadoPendente
        });
      }

      setSuccessMessage(`Solicitação criada: ${vigilanteEntrando?.nome} assumindo no ${postoDestino?.nome}!`);
      
      // Armazena as informações para o fluxo de sequência de transferência
      setLastSubstitute({
        id: enteringId,
        nome: vigilanteEntrando?.nome || ''
      });
      setShowSequencePrompt(true);
      
      // Clean form except date
      setFormData({
        vigilanteSaindoId: '',
        vigilanteEntrandoId: '',
        postoDestinoId: '',
        postoOrigemId: '',
        dataTransferencia: new Date().toISOString().split('T')[0],
        motivo: '',
        horarioTurno: ''
      });
    } catch (error) {
      console.error('Error saving transfer:', error);
      setSaveError('Erro ao criar a solicitação de transferência. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const approveTransfer = async (t: Transferencia) => {
    if (!isAdmin) return;
    
    try {
      await genericService.update('transferencias', t.id!, {
        status: 'Realizada'
      });
      setSuccessMessage('Transferência confirmada com sucesso!');
    } catch (error) {
      console.error('Error approving:', error);
      setSaveError('Erro ao confirmar transferência.');
    }
  };

  const exportTransfersToExcel = () => {
    if (filteredTransfers.length === 0) return;

    const dataToExport = filteredTransfers.map(t => ({
      'Substituto': t.nomeVigilanteEntrando || '---',
      'Posto Destino': t.nomePostoDestino || '---',
      'Posto Origem': t.nomePostoOrigem || '---',
      'Data': t.dataTransferencia ? new Date(t.dataTransferencia + 'T00:00:00').toLocaleDateString('pt-BR') : '---',
      'Turno / Horário': t.horarioTurno || '---',
      'Ausente / Saindo': t.nomeVigilanteSaindo || '---',
      'Motivo': t.motivo || '---',
      'Supervisor': t.nomeSupervisor || '---',
      'Status': t.status || '---'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transferencias');
    
    XLSX.writeFile(workbook, `Transferencias_GuardianGT_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const columns: DataTableColumn<Transferencia>[] = [
    { 
      header: 'Data/Turno', 
      accessor: (t) => (
        <div>
          <div className="font-bold text-slate-900 tracking-tight">
            {t.dataTransferencia ? new Date(t.dataTransferencia + 'T00:00:00').toLocaleDateString('pt-BR') : '---'}
          </div>
          <div className="mt-1">
            <span className={cn(
              "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider inline-block border",
              (t.horarioTurno || '').toLowerCase().includes('diurno') || (t.horarioTurno || '').toLowerCase().includes('dia') || (t.horarioTurno || '').toLowerCase().includes('07:00') 
                ? "bg-amber-50 text-amber-700 border-amber-200" 
                : "bg-indigo-50 text-indigo-700 border-indigo-200"
            )}>
              {t.horarioTurno || '---'}
            </span>
          </div>
        </div>
      )
    },
    { 
      header: 'Posto Destino', 
      accessor: (t) => (
        <span className="font-bold text-slate-700">{t.nomePostoDestino || '---'}</span>
      )
    },
    { 
      header: 'Substituição', 
      accessor: (t) => (
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
             <span className="w-4 h-4 rounded bg-red-50 text-red-600 flex items-center justify-center text-[8px] font-black border border-red-100" title="Saindo / Ausente">A</span>
             <span className="font-bold text-slate-900">{t.nomeVigilanteSaindo || '---'}</span>
          </div>
          <div className="flex items-center gap-2">
             <span className="w-4 h-4 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center text-[8px] font-black border border-emerald-100" title="Entrando / Substituto">C</span>
             <span className="font-bold text-slate-900">{t.nomeVigilanteEntrando || '---'}</span>
          </div>
        </div>
      )
    },
    { 
      header: 'Motivo', 
      accessor: (t) => (
        <span className="inline-block px-3 py-1 rounded-xl text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200/60" title={t.motivo || '---'}>
           {t.motivo || '---'}
        </span>
      )
    },
    { 
      header: 'Supervisor', 
      accessor: (t) => <span className="text-xs font-medium text-slate-400">{t.nomeSupervisor || '---'}</span> 
    },
    { 
      header: 'Status', 
      accessor: (t) => (
        <span className={cn(
          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border block w-fit",
          t.status === 'Realizada' ? "bg-emerald-600 border-emerald-600 text-white" :
          "bg-amber-50 border-amber-200 text-amber-700 font-bold"
        )}>
          {t.status}
        </span>
      )
    },
    {
      header: 'Ações',
      accessor: (t) => (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            icon={Eye}
            onClick={() => setViewTransferDetails(t)}
            className="border-slate-100 text-slate-900 font-bold hover:border-brand-400 hover:bg-slate-50 rounded-xl"
            title="Ver Detalhes"
          />
          {t.status === 'Pendente' && isAdmin && (
            <Button
              variant="secondary"
              size="icon"
              icon={Check}
              onClick={() => approveTransfer(t)}
              title="Confirmar Transferência"
              className="border-emerald-100 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 rounded-xl"
            />
          )}
          {isAdmin && (
            <Button
              variant="secondary"
              size="icon"
              icon={Trash2}
              onClick={() => setIdToDelete(t.id!)}
              title="Excluir Registro"
              className="border-rose-100 text-rose-650 hover:bg-rose-50 hover:border-rose-300 rounded-xl"
            />
          )}
        </div>
      )
    }
  ];

  const filteredTransfers = transferencias.filter(t => 
    t.nomeVigilanteSaindo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.nomeVigilanteEntrando.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.nomePostoDestino.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <div className="p-12 text-center text-slate-400">Carregando dados...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700 w-full max-w-7xl mx-auto p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-[-0.02em] flex items-center gap-3 uppercase">
             Transferências
          </h2>
          <p className="text-xs text-slate-400 font-bold tracking-[0.1em] uppercase opacity-70 mt-1">Gestão de movimentações de pessoal em tempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="secondary"
            onClick={exportTransfersToExcel}
            icon={FileSpreadsheet}
            disabled={filteredTransfers.length === 0}
            className="border-slate-100 text-slate-900 font-black uppercase text-[10px] tracking-widest px-8 shadow-xl shadow-brand-950/5 hover:bg-slate-50 hover:border-brand-400 transition-all h-11"
          >
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Simplified, beautifully integrated Movement Request form card in a balanced responsive grid */}
      <form onSubmit={handleSave} className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-brand-950/5 overflow-hidden">
        <div className="p-6 md:p-8 space-y-6">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 pb-3 border-b border-slate-50">
            <Plus className="w-4 h-4 text-brand-500" /> Solicitar Movimentação
          </h3>

          {successMessage && (
            <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold shadow-xs text-center">
              {successMessage}
            </div>
          )}

          {saveError && (
            <div className="p-4 bg-rose-50 text-rose-600 rounded-xl text-xs font-semibold border border-rose-100 text-center">
              {saveError}
            </div>
          )}

          {/* Form fields grouped in a highly organized and intuitive relational structure */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100">
            {/* COLUMN 1 (LEFT): Vigilante Substituto (Quem entra) & Posto de Origem */}
            <div className="space-y-4">
              <div className="space-y-1">
                <SearchableSelect 
                  label="VIGILANTE SUBSTITUTO (QUEM ENTRA / ASSUME)"
                  placeholder="Selecione quem assume..."
                  value={formData.vigilanteEntrandoId}
                  onChange={(val) => {
                    if (val && val === formData.vigilanteSaindoId) {
                       setSaveError('Conflito de identidade: o vigilante de entrada não pode ser igual ao substituído.');
                       return;
                    }
                    const selectedVig = vigilantes.find(v => v.id === val);
                    setFormData(prev => ({
                      ...prev, 
                      vigilanteEntrandoId: val || '',
                      postoOrigemId: selectedVig?.postoFixoId || prev.postoOrigemId
                    }));
                  }}
                  options={vigilantes.map(v => ({ id: v.id, label: v.nome, subLabel: v.matricula }))}
                />
              </div>

              <div className="space-y-1">
                <FormField 
                  label="POSTO DE ORIGEM (DE ONDE ESTÁ SAINDO)"
                  as="select"
                  value={formData.postoOrigemId}
                  onChange={(e) => setFormData(prev => ({ ...prev, postoOrigemId: e.target.value }))}
                  required
                >
                  <option value="">SELECIONE UNIDADE DE ORIGEM...</option>
                  {postos.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </FormField>
              </div>
            </div>

            {/* COLUMN 2 (RIGHT): Vigilante Substituído (Quem sai / ausente) & Posto de Destino */}
            <div className="space-y-4">
              <div className="space-y-1">
                <SearchableSelect 
                  label="VIGILANTE SUBSTITUÍDO (QUEM SAI / AUSENTE)"
                  placeholder="Selecione o vigilante..."
                  value={formData.vigilanteSaindoId}
                  onChange={(val) => {
                    if (val && val === formData.vigilanteEntrandoId) {
                      setSaveError('Conflito de identidade: o vigilante substituído não pode ser igual ao de entrada.');
                      return;
                    }
                    const selectedVig = vigilantes.find(v => v.id === val);
                    setFormData(prev => ({
                      ...prev, 
                      vigilanteSaindoId: val || '',
                      postoDestinoId: selectedVig?.postoFixoId || prev.postoDestinoId
                    }));
                  }}
                  options={vigilantes.map(v => ({ id: v.id, label: v.nome, subLabel: v.matricula }))}
                />
              </div>

              <div className="space-y-1">
                <FormField 
                  label="POSTO DE DESTINO (ONDE VAI ASSUMIR)"
                  as="select"
                  value={formData.postoDestinoId}
                  onChange={(e) => setFormData(prev => ({ ...prev, postoDestinoId: e.target.value }))}
                  required
                >
                  <option value="">SELECIONE UNIDADE DE DESTINO...</option>
                  {postos.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </FormField>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="space-y-1">
              <FormField 
                label="DATA DA OPERAÇÃO"
                type="date"
                value={formData.dataTransferencia}
                onChange={(e) => setFormData(prev => ({ ...prev, dataTransferencia: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1">
              <FormField 
                label="MOTIVO / JUSTIFICATIVA"
                as="select"
                value={formData.motivo}
                onChange={(e) => setFormData(prev => ({ ...prev, motivo: e.target.value }))}
                required
              >
                <option value="">SELECIONE UM MOTIVO...</option>
                {motivosList.map(mot => (
                  <option key={mot} value={mot}>{mot}</option>
                ))}
              </FormField>
            </div>

            <div className="space-y-1">
              <FormField 
                label="HORÁRIO DO TURNO"
                type="text"
                placeholder="Exemplo: 07:00 às 19:00 ou 12x36"
                value={formData.horarioTurno}
                onChange={(e) => setFormData(prev => ({ ...prev, horarioTurno: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-50 flex justify-end">
            <Button 
              type="submit" 
              disabled={isSaving}
              className="w-full sm:w-64 h-11 bg-slate-900 hover:bg-black text-[10px] font-black uppercase tracking-widest text-white rounded-xl shadow-xs transition-all"
            >
              {isSaving ? 'Processando...' : 'Confirmar Solicitação'}
            </Button>
          </div>
        </div>
      </form>

      {/* Search and Filters visually identical to Coberturas */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-brand-950/5 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
          <input 
            type="text" 
            placeholder="Pesquisar registros de transferência por substituto, substituído ou destino..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-brand-400/20 outline-none transition-all placeholder:text-slate-300"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={Filter} className="rounded-xl border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-widest px-6 h-11">Refinar</Button>
        </div>
      </div>

      {/* Histórico DataTable block aligned to Coberturas */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Histórico Regular de Transferências</h3>
          </div>
        </div>
        <DataTable 
          columns={columns} 
          data={filteredTransfers} 
        />
        {filteredTransfers.length === 0 && (
          <div className="py-20 text-center flex flex-col items-center">
             <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                <Clock className="w-5 h-5 text-slate-300 animate-pulse" />
             </div>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.25em]">Nenhum registro tático de movimentação foi encontrado</p>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!idToDelete}
        onClose={() => setIdToDelete(null)}
        title="Confirmar Exclusão"
        size="sm"
      >
        <div className="space-y-6 pt-2">
          <p className="text-xs font-bold text-slate-600 leading-relaxed uppercase tracking-wider">
            Deseja realmente excluir este registro de transferência? Esta operação é irreversível.
          </p>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIdToDelete(null)} className="h-9 font-bold text-[10px] uppercase tracking-wider">Cancelar</Button>
            <button 
              onClick={async () => {
                if (idToDelete) {
                  await genericService.delete('transferencias', idToDelete);
                  setIdToDelete(null);
                }
              }}
              className="px-6 h-9 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-sm"
            >
              Excluir
            </button>
          </div>
        </div>
      </Modal>

      {/* Sequence Prompt Modal */}
      <Modal
        isOpen={showSequencePrompt}
        onClose={() => {
          setShowSequencePrompt(false);
          setLastSubstitute(null);
        }}
        title="Deseja continuar a sequência?"
        size="sm"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs font-medium text-slate-600 leading-relaxed">
            Deseja transferir algum vigilante para o local onde <strong className="text-slate-950 font-bold">{lastSubstitute?.nome}</strong> estava?
          </p>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => {
                setShowSequencePrompt(false);
                setLastSubstitute(null);
                setFormData({
                  vigilanteSaindoId: '',
                  vigilanteEntrandoId: '',
                  postoDestinoId: '',
                  dataTransferencia: new Date().toISOString().split('T')[0],
                  motivo: '',
                  horarioTurno: ''
                });
              }}
              className="h-9 font-bold text-[10px] uppercase tracking-wider px-4"
            >
              Não
            </Button>
            <Button
              onClick={() => {
                if (lastSubstitute) {
                  setFormData({
                    vigilanteSaindoId: lastSubstitute.id,
                    vigilanteEntrandoId: '',
                    postoDestinoId: '',
                    dataTransferencia: new Date().toISOString().split('T')[0],
                    motivo: '',
                    horarioTurno: ''
                  });
                }
                setShowSequencePrompt(false);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 font-black text-[10px] uppercase tracking-wider px-5 rounded-lg transition-all"
            >
              Sim
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Details Modal */}
      <Modal
        isOpen={!!viewTransferDetails}
        onClose={() => setViewTransferDetails(null)}
        title="Detalhes da Transferência"
        size="md"
      >
        {viewTransferDetails && (
          <div className="space-y-5 pt-2">
            {/* Postos de Origem e Destino */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-3 border-b border-slate-100 text-center">
              <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">POSTO DE ORIGEM DO SUBSTITUTO</span>
                <p className="text-xs font-extrabold text-slate-600 tracking-tight">
                  {viewTransferDetails.nomePostoOrigem || 'Reserva/Outro'}
                </p>
              </div>
              <div className="bg-brand-50/20 p-2.5 rounded-xl border border-brand-100/30">
                <span className="text-[9px] font-black text-brand-500 uppercase tracking-widest leading-none block mb-1">POSTO DE DESTINO</span>
                <p className="text-xs font-extrabold text-slate-900 tracking-tight">
                  {viewTransferDetails.nomePostoDestino}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Vigilante Substituto */}
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/80 flex flex-col justify-center min-w-0">
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none block mb-1">Vigilante Substituto</span>
                <p className="text-xs font-bold text-slate-850 break-words" title={viewTransferDetails.nomeVigilanteEntrando}>
                  {viewTransferDetails.nomeVigilanteEntrando}
                </p>
              </div>

              {/* Vigilante Substituído */}
              <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100/80 flex flex-col justify-center min-w-0">
                <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest leading-none block mb-1">Vigilante Substituído</span>
                <p className="text-xs font-bold text-slate-850 break-words" title={viewTransferDetails.nomeVigilanteSaindo}>
                  {viewTransferDetails.nomeVigilanteSaindo}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Data da Operação</span>
                  <p className="text-xs font-bold text-slate-700">
                    {new Date(viewTransferDetails.dataTransferencia + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Horário do Turno</span>
                  <p className="text-xs font-bold text-slate-900">
                    {viewTransferDetails.horarioTurno || 'Não Informado'}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-200/60 pt-3">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Motivo / Justificativa</span>
                <p className="text-xs font-semibold text-slate-755 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100">
                  {viewTransferDetails.motivo}
                </p>
              </div>

              <div className="border-t border-slate-200/60 pt-3 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none block">Registrado por</span>
                  <p className="text-[11px] font-bold text-slate-700">{viewTransferDetails.nomeSupervisor}</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Status</span>
                  <div className={cn(
                    "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border flex items-center gap-1 select-none w-fit",
                    viewTransferDetails.status === 'Realizada' ? "bg-emerald-600 border-emerald-600 text-white" : "bg-brand-50 border-brand-200 text-brand-700 font-bold"
                  )}>
                    {viewTransferDetails.status === 'Realizada' ? <CheckCircle className="w-3 h-3 text-white" /> : <Clock className="w-3 h-3 text-brand-500 animate-pulse" />}
                    {viewTransferDetails.status}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="secondary"
                onClick={() => setViewTransferDetails(null)}
                className="h-9 font-bold text-[10px] uppercase tracking-wider px-5"
              >
                Fechar Detalhes
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
