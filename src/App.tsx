import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Auth Pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

// App Pages
import Dashboard from "./pages/Dashboard";
import Colaboradores from "./pages/Colaboradores";
import Ponto from "./pages/Ponto";
import Ferias from "./pages/Ferias";
import Documentos from "./pages/Documentos";
// Admissao route redirects to /colaboradores
import ContratosExperiencia from "./pages/ContratosExperiencia";
import Epis from "./pages/Epis";
import Feed from "./pages/Feed";
import Ouvidoria from "./pages/Ouvidoria";
import FeedbackOcorrencias from "./pages/FeedbackOcorrencias";
import AprendizadoPapeis from "./pages/AprendizadoPapeis";
import Trilhas from "./pages/Trilhas";
import Estrategia from "./pages/Estrategia";
import Ergonomia from "./pages/Ergonomia";
import Psicossocial from "./pages/Psicossocial";
import ComplianceSST from "./pages/ComplianceSST";
import PlanoAcao from "./pages/PlanoAcao";
import PlanoAcaoDetalhe from "./pages/PlanoAcaoDetalhe";
import Avaliacoes from "./pages/Avaliacoes";
import Atestados from "./pages/Atestados";
import PlaceholderPage from "./pages/PlaceholderPage";
import Pdi from "./pages/Pdi";
import Financeiro from "./pages/Financeiro";
import Academia from "./pages/Academia";
import Empresa from "./pages/Empresa";
import Marketplace from "./pages/Marketplace";
import Terceiros from "./pages/Terceiros";
import IncidentesAcidentes from "./pages/IncidentesAcidentes";
import CulturaCelebracoes from "./pages/CulturaCelebracoes";
import NotFound from "./pages/NotFound";
import BemEstar from "./pages/BemEstar";
import QuestionarioPsicossocial from "./pages/QuestionarioPsicossocial";
import PdiAssinatura from "./pages/PdiAssinatura";
import PontoExterno from "./pages/PontoExterno";
import FeriasAssinatura from "./pages/FeriasAssinatura";
import TrilhaTerceiroPublica from "./pages/TrilhaTerceiroPublica";
import Onboarding from "./pages/Onboarding";
import FinanceiroBeneficios from "./pages/FinanceiroBeneficios";
import HubContabil from "./pages/HubContabil";
import Configuracoes from "./pages/Configuracoes";
import LandingPage from "./pages/LandingPage";
import TermosDeUso from "./pages/TermosDeUso";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import AssinaturaContrato from "./pages/AssinaturaContrato";
import ExperienciaAssinatura from "./pages/ExperienciaAssinatura";
import AceiteDocumento from "./pages/AceiteDocumento";
import OnboardingCliente from "./pages/OnboardingCliente";
import AtivarConta from "./pages/AtivarConta";
import OnboardingProtegido from "./pages/OnboardingProtegido";
import AnaliseJornada from "./pages/AnaliseJornada";
import Usuarios from "./pages/Usuarios";
import PerfisAcesso from "./pages/PerfisAcesso";
import MeuPerfil from "./pages/MeuPerfil";

// Cadastros Pages
import Departamentos from "./pages/cadastros/Departamentos";
import Cargos from "./pages/cadastros/Cargos";
import Filiais from "./pages/cadastros/Filiais";

// Admin Pages
import SuperAdminDashboard from "./pages/admin/SuperAdminDashboard";
import ManualSistema from "./pages/admin/ManualSistema";
import QADashboard from "./pages/admin/QADashboard";
import ProgramaValidador from "./pages/admin/ProgramaValidador";
import { SuperAdminRoute } from "@/components/admin/SuperAdminRoute";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Auth Routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
            </Route>

            {/* Rota Pública - Questionário Psicossocial */}
            <Route path="/questionario/:token" element={<QuestionarioPsicossocial />} />
            {/* Rota por token de participação individual (controle de adesão) */}
            <Route path="/p/:token" element={<QuestionarioPsicossocial tokenTipo="participacao" />} />
            <Route path="/pdi-assinatura/:token" element={<PdiAssinatura />} />
            <Route path="/ferias-assinatura/:token" element={<FeriasAssinatura />} />
            <Route path="/trilha-terceiro/:token" element={<TrilhaTerceiroPublica />} />
            <Route path="/ponto-externo/:token" element={<PontoExterno />} />
            <Route path="/contrato-assinatura/:token" element={<AssinaturaContrato />} />
            <Route path="/aceite-documento/:token" element={<AceiteDocumento />} />
            <Route path="/onboarding-cliente/:token" element={<OnboardingCliente />} />
            <Route path="/ativar-conta" element={<AtivarConta />} />
            <Route path="/lp" element={<LandingPage />} />
            <Route path="/termos-de-uso" element={<TermosDeUso />} />
            <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />

          {/* Super Admin Routes */}
          <Route
            path="/admin"
            element={
              <SuperAdminRoute>
                <SuperAdminDashboard />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/admin/validador"
            element={
              <SuperAdminRoute>
                <ProgramaValidador />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/admin/manual"
            element={
              <SuperAdminRoute>
                <ManualSistema />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/admin/qa"
            element={
              <SuperAdminRoute>
                <QADashboard />
              </SuperAdminRoute>
            }
          />

            {/* Protected Onboarding Route (outside MainLayout so it's full-screen) */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingProtegido />
                </ProtectedRoute>
              }
            />

            {/* Protected App Routes */}
            <Route
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/colaboradores" element={<Colaboradores />} />
              <Route path="/contratos-experiencia" element={<ContratosExperiencia />} />
              <Route path="/cadastros/departamentos" element={<Departamentos />} />
              <Route path="/cadastros/cargos" element={<Cargos />} />
              <Route path="/cadastros/filiais" element={<Filiais />} />
              <Route path="/financeiro" element={<Financeiro />} />
              <Route path="/financeiro/beneficios" element={<FinanceiroBeneficios />} />
              <Route path="/empresa" element={<Empresa />} />
              <Route path="/ponto" element={<Ponto />} />
              <Route path="/admissao" element={<Navigate to="/colaboradores" replace />} />
              <Route path="/ferias" element={<Ferias />} />
              <Route path="/avaliacoes" element={<Avaliacoes />} />
              <Route path="/atestados" element={<Atestados />} />
              <Route path="/plano-acao" element={<PlanoAcao />} />
              <Route path="/plano-acao/:id" element={<PlanoAcaoDetalhe />} />
              <Route path="/pdi" element={<Pdi />} />
              <Route path="/epis" element={<Epis />} />
              <Route path="/compliance-sst" element={<ComplianceSST />} />
              <Route path="/feedback-ocorrencias" element={<FeedbackOcorrencias />} />
              <Route path="/aprendizado-papeis" element={<AprendizadoPapeis />} />
              <Route path="/trilhas" element={<Trilhas />} />
              <Route path="/estrategia" element={<Estrategia />} />
              <Route path="/ouvidoria" element={<Ouvidoria />} />
              <Route path="/ergonomia" element={<Ergonomia />} />
              <Route path="/psicossocial" element={<Psicossocial />} />
              <Route path="/felicidade" element={<BemEstar />} />
              <Route path="/documentos" element={<Documentos />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/terceiros" element={<Terceiros />} />
              <Route path="/incidentes-acidentes" element={<IncidentesAcidentes />} />
              <Route path="/cultura-celebracoes" element={<CulturaCelebracoes />} />
              <Route path="/onboarding-rh" element={<Onboarding />} />
              <Route path="/hub-contabil" element={<HubContabil />} />
              <Route path="/academia" element={<SuperAdminRoute><Academia /></SuperAdminRoute>} />
              <Route path="/analise-jornada" element={<AnaliseJornada />} />
              <Route path="/usuarios" element={<Usuarios />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/meu-perfil" element={<MeuPerfil />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          
          {/* Chat IA Widget removido */}
          
          {/* WhatsApp flutuante */}
          <WhatsAppButton />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
