import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { 
  LayoutGrid, 
  MapPin, 
  Users, 
  UserSquare2, 
  ClipboardCheck, 
  FileText, 
  LogOut,
  ShieldCheck,
  Clock,
  Book,
  ListChecks,
  BarChart3,
  ArrowLeftRight,
  Download,
  Upload,
  Car
} from 'lucide-react';
import { Logo } from '../ui/Logo';
import { Link, useLocation } from 'react-router-dom';
import { genericService } from '@/lib/firestoreService';

const navGroups = [
  {
    label: 'OPERAÇÃO',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutGrid, roles: ['Admin', 'Supervisor'] },
      { label: 'Livro de Ocorrências', path: '/ocorrencias/list', icon: Book, roles: ['Admin', 'Supervisor'] },
      { label: 'Coberturas', path: '/coberturas', icon: ClipboardCheck, roles: ['Admin', 'Supervisor'] },
      { label: 'Transferências', path: '/transferencias', icon: ArrowLeftRight, roles: ['Admin', 'Supervisor'] },
      { label: 'Relatórios', path: '/relatorios', icon: BarChart3, roles: ['Admin'] },
    ]
  },
  {
    label: 'CADASTROS',
    items: [
      { label: 'Vigilantes', path: '/vigilantes', icon: Users, roles: ['Admin'] },
      { label: 'Viaturas', path: '/viaturas', icon: Car, roles: ['Admin'] },
      { label: 'Postos', path: '/postos', icon: MapPin, roles: ['Admin'] },
      { label: 'Roteiros', path: '/roteiros', icon: Clock, roles: ['Admin'] },
      { label: 'Itens de Checklist', path: '/checklist-items', icon: ListChecks, roles: ['Admin'] },
      { label: 'Motivo de Ausência', path: '/motivos', icon: FileText, roles: ['Admin'] },
      { label: 'Tipos de Cobertura', path: '/tipos-cobertura', icon: ShieldCheck, roles: ['Admin'] },
      { label: 'Usuários', path: '/usuarios', icon: UserSquare2, roles: ['Admin'] },
    ]
  }
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { userData, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleBackup = async () => {
    try {
      const collections = [
        'users', 'postos', 'vigilantes', 'checklistItems', 
        'motivos_falta', 'tipos_cobertura', 'viaturas', 'roteiros', 
        'ocorrencias', 'transferencias', 'settings'
      ];
      
      const allData: Record<string, any> = {};
      
      for (const col of collections) {
        allData[col] = await genericService.list(col);
      }
      
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_guardian_gt_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Backup error:', error);
      alert('Erro ao gerar backup da nuvem.');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const data = JSON.parse(content);
          
          if (confirm("Isso irá importar os dados táticos para a nuvem. Deseja continuar?")) {
            for (const [collection, items] of Object.entries(data)) {
              if (Array.isArray(items)) {
                for (const item of items) {
                  await genericService.create(collection, item);
                }
              }
            }
            alert("Backup restaurado com sucesso na Nuvem tática!");
            window.location.reload();
          }
        } catch (err) {
          alert("Erro ao restaurar backup. Verifique o arquivo JSON.");
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <aside className="w-full h-full bg-[#0a0a0a] text-slate-400 flex flex-col border-r border-[#1a1a1a]">
      {/* Brand */}
      <div className="p-8 flex flex-col items-center gap-4">
        <div className="w-16 h-16 flex items-center justify-center text-brand-400 bg-brand-950/50 rounded-2xl border border-brand-800 shadow-2xl shadow-brand-500/10 transition-transform hover:scale-105 duration-300 group">
          <Logo size={40} className="group-hover:text-brand-300 transition-colors" />
        </div>
        <div className="text-center">
          <span className="text-xl font-black tracking-[0.1em] text-white uppercase font-sans">Guardian GT</span>
          <div className="h-0.5 w-8 bg-brand-400 mx-auto mt-1 rounded-full opacity-60"></div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-6 overflow-y-auto sidebar-scroll font-sans">
        {navGroups.map((group) => {
          const userRole = userData?.role || 'Supervisor';
          const filteredItems = group.items.filter(item => {
            if (!item.roles) return true;
            return item.roles.includes(userRole);
          });

          if (filteredItems.length === 0) return null;

          return (
            <div key={group.label} className="space-y-1">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.25em] px-4 mb-3">
                {group.label}
              </p>
              {filteredItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden",
                    isActive 
                      ? "bg-brand-400 text-brand-950 font-bold shadow-lg shadow-brand-400/10" 
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-400 to-brand-300 opacity-10 blur-xl"></div>
                  )}
                  <item.icon className={cn(
                    "w-5 h-5 transition-all duration-300", 
                    isActive ? "text-brand-950 scale-110" : "text-slate-500 group-hover:text-brand-400 group-hover:scale-110"
                  )} />
                  <span className="text-sm tracking-tight relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
      

      </nav>

      {/* User Footer */}
      <div className="p-4 mt-auto border-t border-white/5 bg-[#050505]/50 backdrop-blur-xl">
        <div className="px-4 py-2 mb-2">
          <p className="text-[9px] text-brand-400 uppercase font-black tracking-[0.25em] leading-none mb-1.5 opacity-80">
             {userData?.role === 'Admin' ? 'ADMINISTRADOR' : 'SUPERVISOR'}
          </p>
          <p className="text-sm font-bold text-white truncate tracking-tight">
            {userData?.displayName || 'Supervisor'}
          </p>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-4 py-3 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-xl transition-all duration-300 text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          <span>Finalizar Sessão</span>
        </button>
      </div>
    </aside>
  );
}
