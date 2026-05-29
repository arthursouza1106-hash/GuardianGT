import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { useAuth } from '@/lib/AuthContext';
import { Logo } from '@/components/ui/Logo';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const result = await login(username, password);
      if (!result.success) {
        setError(result.error || 'Nome ou senha incorretos.');
      } else {
        navigate('/');
      }
    } catch (error: any) {
      setError('Erro ao processar login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative gradients for tech feel */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-400 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-800 blur-[150px] rounded-full"></div>
      </div>

      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10 relative z-10 transition-all duration-700 hover:shadow-brand-400/20">
        <div className="p-12 flex flex-col items-center space-y-10">
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-brand-950 rounded-3xl flex items-center justify-center shadow-2xl shadow-brand-400/20 border border-brand-800 transition-transform hover:rotate-12 duration-500">
              <Logo size={50} className="text-brand-400" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-black text-slate-900 tracking-[0.15em] uppercase">Guardian GT</h1>
              <div className="h-1 w-12 bg-brand-400 mx-auto mt-2 rounded-full"></div>
            </div>
          </div>
          
          <div className="text-center space-y-2">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Autenticação</h2>
            <p className="text-slate-500 text-sm font-medium tracking-tight">Insira suas credenciais de acesso tático.</p>
          </div>

          <form onSubmit={handleLogin} className="w-full space-y-6">
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex gap-3 text-red-600 text-xs font-bold uppercase tracking-widest leading-none animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <FormField 
                icon={UserIcon}
                label="Agente"
                placeholder="USUÁRIO"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="rounded-2xl bg-slate-50 border-slate-100"
              />

              <FormField 
                icon={Lock}
                label="Senha"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-2xl bg-slate-50 border-slate-100"
              />
            </div>

            <Button 
              type="submit"
              disabled={loading}
              className="w-full h-14 text-xs font-black uppercase tracking-[0.25em] shadow-2xl shadow-brand-400/10 rounded-2xl bg-brand-950 hover:bg-black"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-3 animate-spin text-brand-400" />
                  Sincronizando...
                </>
              ) : (
                'Acessar Painel'
              )}
            </Button>


            
            <p className="text-center text-[9px] text-slate-300 uppercase font-black tracking-[0.2em] pt-4">
              © 2026 Guardian GT • Inteligência Operacional
            </p>
          </form>
        </div>

        <div className="bg-slate-50 px-10 py-6 flex flex-col items-center justify-center border-t border-slate-100">
          <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase opacity-60">Segurança Privada de Elite</p>
        </div>
      </div>
    </div>
  );
}
