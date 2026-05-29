import { Bell, Search, Menu } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '../ui/Button';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { userData } = useAuth();

  return (
    <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-6 md:px-12 sticky top-0 z-40 shadow-sm shadow-slate-100/10">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onMenuClick}
          className="md:hidden text-slate-500 hover:bg-slate-50"
        >
          <Menu className="w-6 h-6" />
        </Button>
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest hidden xs:block">
          Guardian GT • Operacional
        </h2>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-bold text-slate-800 leading-none">{userData?.displayName || 'Sem Nome'}</p>
          <p className="text-[10px] text-slate-400 mt-1">{userData?.matricula || 'Sem Login'}</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-brand-950 flex items-center justify-center text-brand-400 text-lg font-black shadow-2xl shadow-brand-950/20 border border-brand-800 transition-transform hover:scale-105 duration-300 font-sans">
          {(userData?.displayName || 'S').charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
