import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from './components/layout/Layout';
import { AuthProvider, useAuth } from './lib/AuthContext';

// Lazy load pages for smaller bundle size and faster initial load on mobile
const VigilantesPage = lazy(() => import('./pages/Vigilantes'));
const ChecklistItemsPage = lazy(() => import('./pages/ChecklistItems'));
const PostosPage = lazy(() => import('./pages/Postos'));
const OcorrenciaWizard = lazy(() => import('./pages/NovaOcorrencia'));
const OcorrenciasListPage = lazy(() => import('./pages/OcorrenciasList'));
const UsuariosPage = lazy(() => import('./pages/Usuarios'));
const ViaturasPage = lazy(() => import('./pages/Viaturas'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NaoConformidadesPage = lazy(() => import('./pages/NaoConformidades'));
const RoteirosPage = lazy(() => import('./pages/Roteiros'));
const LoginPage = lazy(() => import('./pages/Login'));
const TransferenciasPage = lazy(() => import('./pages/Transferencias'));
const CoberturasListPage = lazy(() => import('./pages/CoberturasList'));

const MotivosPage = lazy(() => import('./pages/Motivos'));
const TiposCoberturaPage = lazy(() => import('./pages/TiposCobertura'));
const GenericPage = lazy(() => import('./pages/GenericPage'));

function RouteLoading() {
  return (
    <div className="w-full h-40 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-950 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppRoutes() {
  const { user, userData, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-brand-950 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <LoginPage />
      </Suspense>
    );
  }

  const isAdmin = userData?.role === 'Admin';
  const isSupervisor = userData?.role === 'Supervisor' || isAdmin;

  return (
    <Layout>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          {/* Admin and Supervisor routes */}
          {isSupervisor && (
            <>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transferencias" element={<TransferenciasPage />} />
            </>
          )}

          {/* Admin ONLY routes */}
          {isAdmin && (
            <>
              <Route path="/usuarios" element={<UsuariosPage />} />
              <Route path="/checklist-items" element={<ChecklistItemsPage />} />
              <Route path="/motivos" element={<MotivosPage />} />
              <Route path="/tipos-cobertura" element={<TiposCoberturaPage />} />
              <Route path="/nao-conformidades" element={<NaoConformidadesPage />} />
              <Route path="/relatorios" element={<GenericPage title="Relatórios" />} />
              <Route path="/postos" element={<PostosPage />} />
              <Route path="/roteiros" element={<RoteirosPage />} />
              <Route path="/vigilantes" element={<VigilantesPage />} />
              <Route path="/viaturas" element={<ViaturasPage />} />
            </>
          )}

          {/* Common routes */}
          <Route path="/ocorrencias" element={<OcorrenciasListPage />} />
          <Route path="/ocorrencias/list" element={<OcorrenciasListPage />} />
          <Route path="/coberturas" element={<CoberturasListPage />} />
          <Route path="/ocorrencias/nova" element={<OcorrenciaWizard />} />

          {/* Redirects based on role */}
          <Route 
            path="*" 
            element={
              isSupervisor 
                ? <Navigate to="/" /> 
                : <Navigate to="/ocorrencias/list" />
            } 
          />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default function App() {
  return (
    <Router>
      <Toaster 
        position="top-center" 
        richColors 
        closeButton
        toastOptions={{
          style: { zIndex: 10000 }
        }}
      />
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
