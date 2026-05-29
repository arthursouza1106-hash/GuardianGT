import React, { useState, useEffect } from 'react';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Search, Shield, User, Trash2, Lock, Loader2, Plus, Edit2, Mail, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { genericService } from '@/lib/firestoreService';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

export default function UsuariosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [emailGroup, setEmailGroup] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const { userData, logout } = useAuth();
  const roleNorm = (userData?.role || '').toLowerCase().trim();
  const isArthur = 
    userData?.matricula?.toLowerCase().trim() === 'arthur' || 
    userData?.matricula?.toLowerCase().trim() === 'arthursouza1106@gmail.com' ||
    userData?.displayName?.toLowerCase().includes('arthur') ||
    userData?.uid === 'u4' ||
    userData?.uid === 'u8';
  const isAdmin = roleNorm === 'admin' || isArthur;
  const isSupervisor = roleNorm === 'supervisor' && !isAdmin;
  const canManageEmailGroup = isAdmin || isSupervisor;

  // State for new user form
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newUser, setNewUser] = useState({
    uid: '',
    matricula: '',
    password: '',
    displayName: '',
    role: 'Supervisor' as 'Admin' | 'Supervisor'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    const data = await genericService.list<any>('users');
    setUsers(data);

    // Load email group
    const settings = await genericService.list<any>('settings');
    const group = settings.find(s => s.id === 'email_group');
    if (group) setEmailGroup(group.emails || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveEmailGroup = async (newEmails: string[]) => {
    try {
      const existing = (await genericService.list<any>('settings')).find(s => s.id === 'email_group');
      if (existing) {
        await genericService.update('settings', 'email_group', { emails: newEmails });
      } else {
        await genericService.create('settings', { id: 'email_group', emails: newEmails });
      }
      setEmailGroup(newEmails);
    } catch (err) {
      console.error('Error saving email group:', err);
      setError('Erro ao salvar grupo de e-mails.');
    }
  };

  const addEmail = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setError('Por favor, insira um e-mail válido.');
      return;
    }
    if (emailGroup.includes(email)) {
      setNewEmail('');
      return;
    }
    setError(null);
    saveEmailGroup([...emailGroup, email]);
    setNewEmail('');
    toast.success('E-mail adicionado ao grupo');
  };

  const removeEmail = (email: string) => {
    saveEmailGroup(emailGroup.filter(e => e !== email));
  };

  const handleOpenModal = (user: any = null) => {
    if (user) {
      setEditingUser(user);
      setNewUser({
        uid: user.uid,
        matricula: user.matricula || '',
        password: user.password || '', 
        displayName: user.displayName || '',
        role: user.role || 'Supervisor'
      });
    } else {
      setEditingUser(null);
      setNewUser({
        uid: '',
        matricula: '',
        password: '',
        displayName: '',
        role: 'Supervisor'
      });
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // FALLBACK FORÇADO
    const forceReset = setTimeout(() => {
      setIsSubmitting(false);
      setNewUser({ uid: '', matricula: '', password: '', displayName: '', role: 'Supervisor' });
    }, 2000);

    const normalizedMatricula = newUser.matricula.toLowerCase().trim();

    try {
      if (editingUser) {
        genericService.update('users', editingUser.uid, {
          matricula: normalizedMatricula,
          password: newUser.password,
          displayName: newUser.displayName,
          role: newUser.role
        });
      } else {
        // Find if user already exists
        const existing = users.find(u => u.matricula?.toLowerCase() === normalizedMatricula);
        if (existing) {
          throw new Error("Este nome de usuário já existe.");
        }
        
        genericService.create('users', {
          uid: `u_${Date.now()}`,
          matricula: normalizedMatricula,
          password: newUser.password,
          displayName: newUser.displayName,
          role: newUser.role
        });
      }

      toast.success(editingUser ? "Alteração concluída" : "Usuário cadastrado com sucesso");
      
      // RECARREGAR LISTA
      loadData();
      
      // RESET IMEDIATO
      setNewUser({ uid: '', matricula: '', password: '', displayName: '', role: 'Supervisor' });
      setEditingUser(null);
    } catch (err: any) {
      console.error('Error saving user:', err);
      setError(err.message || 'Erro ao salvar usuário.');
    } finally {
      clearTimeout(forceReset);
      setTimeout(() => {
        setIsSubmitting(false);
      }, 300);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    if (deleteConfirmUser.uid === userData?.uid) {
      setError('Você não pode excluir a si mesmo.');
      setDeleteConfirmUser(null);
      return;
    }
    
    setIsDeleting(true);

    try {
      await genericService.delete('users', deleteConfirmUser.uid);
      toast.success("Usuário excluído com sucesso");
      loadData();
      setDeleteConfirmUser(null);
    } catch (err: any) {
      console.error(err);
      setError("Erro ao excluir: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: DataTableColumn<any>[] = [
    { header: 'Nome', accessor: (s: any) => (
      <div>
        <div className="font-bold text-slate-900">{s.displayName || 'Sem Nome'}</div>
        <div className="text-[10px] opacity-60 font-mono font-bold tracking-wider uppercase">
          Usuário: {s.matricula || '---'}
        </div>
      </div>
    )},
    { 
      header: 'Função', 
      accessor: (s: any) => (
        <div className="flex items-center gap-2">
          {s.role === 'Admin' ? (
            <Shield className="w-4 h-4 text-brand-950" />
          ) : (
            <User className="w-4 h-4 text-slate-300" />
          )}
          <span className={cn(
            "font-black text-[10px] uppercase tracking-widest",
            s.role === 'Admin' ? "text-brand-950" : "text-slate-400"
          )}>
            {s.role === 'Admin' ? 'Administrador' : 'Supervisor'}
          </span>
        </div>
      )
    },
    { 
      header: 'Ações', 
      accessor: (s: any) => (
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Button 
                variant="secondary" 
                className="h-8 px-2 text-[10px] flex items-center gap-1"
                onClick={(e) => { e.stopPropagation(); handleOpenModal(s); }}
              >
                <Edit2 className="w-3 h-3" />
                Editar
              </Button>
              <button 
                onClick={(e) => { e.stopPropagation(); setDeleteConfirmUser(s); }}
                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  const filteredUsers = users.filter(s => 
    (s.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.matricula || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-[-0.02em] leading-none uppercase">Gestão de Usuários</h1>
          <p className="text-xs text-slate-400 font-bold tracking-[0.1em] uppercase opacity-70 mt-2">Controle de acessos e privilégios</p>
        </div>
        {isAdmin && (
          <Button 
            onClick={() => handleOpenModal()}
            className="w-14 h-14 rounded-2xl p-0 flex items-center justify-center shadow-2xl shadow-brand-950/20 bg-brand-950 hover:bg-black text-white transition-all transform hover:scale-105 active:scale-95 group"
          >
            <Plus className="w-7 h-7 text-brand-400 group-hover:text-white transition-colors" />
          </Button>
        )}
      </div>

      <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-xl shadow-brand-950/5">
        {error && !isModalOpen && (
          <div className="mb-4 p-4 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-rose-100 flex items-center justify-between">
            {error}
            <button onClick={() => setError(null)} className="opacity-50 hover:opacity-100">X</button>
          </div>
        )}
        <div className="relative flex-1 group">
          <Search className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Pesquisar agente de comando..." 
            className="w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl text-xs font-black uppercase tracking-widest focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-50 transition-all placeholder:text-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Email Group Settings (Available for Admins and Supervisors) */}
      {canManageEmailGroup && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-brand-950/5 mt-8 animate-in slide-in-from-top-4 duration-700">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 bg-brand-950 text-brand-400 rounded-2xl flex items-center justify-center shadow-2xl shadow-brand-950/20">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 uppercase tracking-tight">Grupo de Relatórios</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Distribuição automática de intel</p>
            </div>
          </div>

          <form className="flex gap-3 mb-6" onSubmit={addEmail}>
            <div className="relative flex-1 group">
              <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500" />
              <input 
                type="email" 
                placeholder="E-MAIL OPERACIONAL" 
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:bg-white focus:ring-4 focus:ring-brand-50 outline-none transition-all placeholder:text-slate-200"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              className="px-8 bg-brand-950 border border-brand-950 hover:bg-black text-white text-xs font-black uppercase tracking-widest px-8 rounded-2xl transition-all"
            >
              ADICIONAR
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {emailGroup.map(email => (
              <div key={email} className="bg-white text-slate-700 px-4 py-2 rounded-xl border border-slate-100 flex items-center gap-3 shadow-sm animate-in zoom-in duration-300">
                <span className="text-[10px] font-black tracking-tight">{email}</span>
                <button onClick={() => removeEmail(email)} className="text-slate-300 hover:text-rose-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {emailGroup.length === 0 && (
              <div className="w-full py-8 bg-slate-50/50 rounded-[1.5rem] border border-dashed border-slate-200 text-center">
                 <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.2em]">Canais de transmissão não configurados</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-brand-950/5 overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
          <div className="flex-1" />
          <button 
            onClick={() => loadData()}
            className="p-3 hover:bg-slate-100 rounded-xl text-slate-400 transition-all hover:text-brand-600"
            title="Recarregar Usuários"
          >
            <div className={cn("transition-transform duration-700")}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </button>
        </div>
        <DataTable columns={columns} data={filteredUsers} />
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingUser ? "Editar Perfil de Comando" : "Novo Agente de Comando"}
        size="md"
      >
        <form onSubmit={handleSaveUser} className="space-y-8">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
            {editingUser 
              ? "Atualização de parâmetros de autenticação."
              : "Definição de novas credenciais táticas de acesso."}
          </p>

          {error && (
            <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-rose-100">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <FormField 
              label="Nome de Identificação"
              placeholder="NOME COMPLETO"
              value={newUser.displayName}
              onChange={(e) => setNewUser({...newUser, displayName: e.target.value})}
              required
              icon={User}
              className="rounded-2xl h-14 bg-slate-50 border-slate-100 font-bold text-xs uppercase"
            />

            <FormField 
              label="Login de Acesso"
              placeholder="USUÁRIO"
              value={newUser.matricula}
              onChange={(e) => setNewUser({...newUser, matricula: e.target.value})}
              required
              icon={User}
              className="rounded-2xl h-14 bg-slate-50 border-slate-100 font-bold text-xs uppercase"
            />

            <FormField 
              label={editingUser ? "Redefinir Senha" : "Senha de Acesso"}
              type="password"
              placeholder="********"
              value={newUser.password}
              onChange={(e) => setNewUser({...newUser, password: e.target.value})}
              required
              icon={Lock}
              className="rounded-2xl h-14 bg-slate-50 border-slate-100 font-bold text-xs"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Nível de Acesso</label>
            <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-50 rounded-[1.5rem] border border-slate-100">
              <button
                type="button"
                onClick={() => setNewUser({...newUser, role: 'Supervisor'})}
                className={cn(
                  "py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  newUser.role === 'Supervisor' 
                    ? "bg-white text-brand-950 shadow-xl" 
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                Supervisor
              </button>
              <button
                type="button"
                onClick={() => setNewUser({...newUser, role: 'Admin'})}
                className={cn(
                  "py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  newUser.role === 'Admin' 
                    ? "bg-brand-950 text-white shadow-xl" 
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                Administrador
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-8 border-t border-slate-100 mt-6">
            <Button variant="secondary" className="rounded-xl px-8 h-12 uppercase text-[10px] font-black tracking-widest" onClick={() => setIsModalOpen(false)} type="button">Abafar</Button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="px-12 h-12 font-black tracking-[0.2em] shadow-2xl shadow-brand-950/20 bg-brand-950 hover:bg-black text-white uppercase text-[10px] rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'AGUARDE...' : (editingUser ? 'SALVAR ALTERAÇÕES' : 'CONFIRMAR AGENTE')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!deleteConfirmUser}
        onClose={() => setDeleteConfirmUser(null)}
        title="Excluir Usuário"
        size="md"
      >
        <div className="space-y-6">
          <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100">
            <p className="text-xs font-bold leading-relaxed">
              Deseja remover as credenciais de <span className="font-black italic underline">{deleteConfirmUser?.displayName}</span>? Este usuário perderá acesso imediato ao sistema.
            </p>
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirmUser(null)} disabled={isDeleting}>Cancelar</Button>
            <button 
              className="px-8 h-10 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
              disabled={isDeleting}
              onClick={handleDeleteUser}
            >
              {isDeleting ? 'REMOVENDO...' : 'SIM, REMOVER USUÁRIO'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
