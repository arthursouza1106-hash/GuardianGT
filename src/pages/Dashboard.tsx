import { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
} from 'recharts';
import { 
  AlertTriangle, 
  UserX, 
  ShieldCheck, 
  ChevronRight,
  Clock,
  MapPin,
  TrendingUp,
  AlertCircle,
  Users,
  Database,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { genericService } from '@/lib/firestoreService';
import { seedDatabase, forceSeedDatabase } from '@/lib/seed';
import { Button } from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, userData } = useAuth();
  const roleNorm = (userData?.role || '').toLowerCase().trim();
  const isArthur = 
    userData?.matricula?.toLowerCase().trim() === 'arthur' || 
    userData?.matricula?.toLowerCase().trim() === 'arthursouza1106@gmail.com' ||
    userData?.displayName?.toLowerCase().includes('arthur') ||
    userData?.uid === 'u4' ||
    userData?.uid === 'u8';
  const isAdmin = roleNorm === 'admin' || isArthur;
  const isSupervisor = roleNorm === 'supervisor' && !isAdmin;

  const [stats, setStats] = useState<any[]>([]);
  const [absenceData, setAbsenceData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [lastSync, setLastSync] = useState(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  const [isSeeding, setIsSeeding] = useState(false);
  
  const [postosCount, setPostosCount] = useState(0);
  const [vigilantesCount, setVigilantesCount] = useState(0);
  const [viaturasCount, setViaturasCount] = useState(0);

  const handleSeed = async () => {
    setIsSeeding(true);
    const success = await seedDatabase();
    if (success) {
      toast.success("Banco de dados atualizado com novos dados!");
      window.location.reload();
    }
    setIsSeeding(false);
  };

  useEffect(() => {
    const unsubscribeOcorrencias = genericService.subscribe<any>('ocorrencias', (data) => {
      // Filter by supervisor locally
      const filteredData = isSupervisor 
        ? data.filter(oc => oc.supervisorId === user?.uid)
        : data;

      setLastSync(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      
      // Update stats based on real data
      const total = filteredData.length;
      
      // Calculate total hours from coverages (if they exist)
      let totalHours = 0;
      filteredData.forEach((oc: any) => {
        if (oc.coberturas) {
          oc.coberturas.forEach((cov: any) => {
            totalHours += parseFloat(cov.horasCobertas) || 0;
          });
        }
      });

      setStats([
        { label: 'OCORRÊNCIAS NO PERÍODO', value: total.toString(), icon: TrendingUp },
        { label: 'HORAS DE COBERTURA', value: `${totalHours.toFixed(1)} h`, icon: Clock },
        { label: 'POSTOS VISITADOS', value: new Set(filteredData.flatMap((oc: any) => oc.postosVisitados?.map((v: any) => v.postoId) || [])).size.toString(), icon: MapPin },
        { label: 'SUPERVISORES', value: isSupervisor ? '01' : '08', icon: Users },
      ]);

      // Update absence data for chart
      const postCounts: Record<string, number> = {};
      filteredData.forEach((oc: any) => {
        oc.postosVisitados?.forEach((v: any) => {
          postCounts[v.nomePosto] = (postCounts[v.nomePosto] || 0) + 1;
        });
      });
      
      const chartData = Object.entries(postCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      if (chartData.length > 0) {
        setAbsenceData(chartData);
      } else {
        setAbsenceData([{ name: 'Nenhum Posto', count: 0 }]);
      }
    });

    const unsubscribePostos = genericService.subscribe('postos', (data) => {
      setPostosCount(data.length);
    });

    const unsubscribeVigilantes = genericService.subscribe('vigilantes', (data) => {
      setVigilantesCount(data.length);
    });

    const unsubscribeViaturas = genericService.subscribe('viaturas', (data) => {
      setViaturasCount(data.length);
    });

    const mockCobertura = [
      { name: 'Presencial', value: 70 },
      { name: 'Remota', value: 30 },
    ];
    setStatusData(mockCobertura);

    return () => {
      unsubscribeOcorrencias();
      unsubscribePostos();
      unsubscribeVigilantes();
      unsubscribeViaturas();
    };
  }, [user, userData]);
  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header with Filters */}
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-[-0.05em] flex items-center gap-3 uppercase">
             Olá, <span className="text-brand-500 font-black">{userData?.displayName?.split(' ')[0] || 'Agente'}</span>
          </h1>
          <p className="text-xs text-slate-500 font-bold mt-2 uppercase tracking-[0.2em] opacity-70">Operações e Inteligência em Campo</p>
          <div className="flex items-center gap-4 mt-6">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] flex items-center gap-2 px-4 py-1.5 bg-white rounded-full border border-slate-100 shadow-sm">
              <Clock className="w-3.5 h-3.5 text-brand-400" /> Sincronizado: {lastSync}
            </p>
             <button 
              onClick={() => window.location.reload()}
              className="p-2 hover:bg-white rounded-full text-slate-300 hover:text-brand-600 transition-all border border-transparent hover:border-slate-100 shadow-sm"
              title="Sincronizar Manual"
            >
              <svg className="w-3" style={{ height: '0.75rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="w-full xl:w-auto">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 sm:py-2 sm:pl-6 sm:pr-2 bg-white rounded-2xl sm:rounded-full border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 flex-1 sm:flex-none">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 shrink-0">Início</label>
              <input type="date" className="p-2 w-full sm:w-36 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-full text-xs outline-none focus:ring-2 focus:ring-brand-400/20 transition-all font-bold text-slate-700 hover:bg-slate-100" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 flex-1 sm:flex-none">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 shrink-0">Término</label>
              <input type="date" className="p-2 w-full sm:w-36 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-full text-xs outline-none focus:ring-2 focus:ring-brand-400/20 transition-all font-bold text-slate-700 hover:bg-slate-100" />
            </div>
            <button className="h-[36px] px-6 w-full sm:w-auto bg-brand-950 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl sm:rounded-full hover:bg-black transition-all duration-300 shadow-xs hover:-translate-y-0.5 mt-2 sm:mt-0 flex items-center justify-center shrink-0">
               Filtrar
            </button>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Registros Totais', value: stats[0]?.value || '0', icon: TrendingUp, color: 'brand' },
          { label: 'Horas Cobertas', value: stats[1]?.value?.split(' ')[0] || '0', icon: Clock, color: 'slate' },
          { label: 'Unidades Ativas', value: stats[2]?.value || '0', icon: MapPin, color: 'slate' },
          { label: 'Agentes Online', value: stats[3]?.value || '0', icon: Users, color: 'brand' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-2xl hover:shadow-brand-950/10 hover:-translate-y-2 transition-all duration-500 ring-1 ring-slate-100/50">
            <div className="space-y-3">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{stat.label}</p>
               <div className="flex items-baseline gap-1">
                  <h3 className="text-4xl font-black text-slate-900 tracking-[-0.05em] leading-none">{stat.value}</h3>
                  {stat.label.includes('Horas') && <span className="text-sm font-bold text-slate-300 italic">h</span>}
               </div>
            </div>
            <div className={cn(
              "p-5 rounded-2xl border transition-all duration-500 group-hover:scale-110",
              stat.color === 'brand' ? "bg-brand-50 border-brand-100 text-brand-600" : "bg-slate-50 border-slate-100 text-slate-400"
            )}>
               <stat.icon className="w-7 h-7" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Row 1: Volume Chart & Turn Distribution */}
        <div className="lg:col-span-8 bg-white p-2 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[400px]">
           <div className="p-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-2 h-8 bg-brand-950 rounded-full" />
                <div>
                  <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.3em]">Volume por Posto</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Análise de recorrência operacional</p>
                </div>
              </div>
           </div>
           <div className="flex-1 px-8 pb-10">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={absenceData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fill: '#64748b', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fill: '#64748b', fontWeight: 900 }} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#faf7f2', radius: 10 }}
                    contentStyle={{ 
                      borderRadius: '24px', 
                      border: '1px solid #f4ece4', 
                      boxShadow: '0 20px 40px -10px rgb(26 15 10 / 0.1)',
                      padding: '16px',
                      backgroundColor: '#ffffff'
                    }}
                  />
                  <Bar dataKey="count" fill="#1a0f0a" radius={[12, 12, 4, 4]} barSize={40}>
                    {absenceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#c5a059' : '#1a0f0a'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        <div className="lg:col-span-4 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between h-[400px]">
           <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Status & Sincronização</h3>
              <p className="text-[10px] text-slate-400 mt-1 font-bold">Diagnóstico em tempo real</p>
           </div>
           
           <div className="space-y-4 my-auto">
             <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">🏢 Postos Cadastrados</span>
               <span className="text-xs font-black text-slate-800">{postosCount}</span>
             </div>
             <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">👤 Vigilantes Ativos</span>
               <span className="text-xs font-black text-slate-800">{vigilantesCount}</span>
             </div>
             <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">🚗 Viaturas Sincronizadas</span>
               <span className="text-xs font-black text-slate-800">{viaturasCount}</span>
             </div>
           </div>

           <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nuvem Principal</span>
              <span className="text-[10px] font-black text-green-600 uppercase tracking-widest flex items-center gap-1.5 bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block animate-pulse" /> Sincronizado
              </span>
            </div>
        </div>
      </div>
    </div>
  );
}
