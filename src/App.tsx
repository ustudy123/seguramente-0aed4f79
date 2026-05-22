import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SuperAdminRoute } from "@/components/admin/SuperAdminRoute";
import { Loader2 } from "lucide-react";

// Eager imports for all protected app pages (no loading delay on navigation)
import Dashboard from "./pages/Dashboard";
import Colaboradores from "./pages/Colaboradores";
import Ponto from "./pages/Ponto";
import Ferias from "./pages/Ferias";
import Documentos from "./pages/Documentos";
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
import MetasModule from "./pages/MetasModule";
import Atestados from "./pages/Atestados";
import Pdi from "./pages/Pdi";
import Financeiro from "./pages/Financeiro";
import Academia from "./pages/Academia";
import Empresa from "./pages/Empresa";
import Marketplace from "./pages/Marketplace";
import Terceiros from "./pages/Terceiros";
import IncidentesAcidentes from "./pages/IncidentesAcidentes";
import CulturaCelebracoes from "./pages/CulturaCelebracoes";
import BemEstar from "./pages/BemEstar";
import Onboarding from "./pages/Onboarding";
import FinanceiroBeneficios from "./pages/FinanceiroBeneficios";
import HubContabil from "./pages/HubContabil";
import Configuracoes from "./pages/Configuracoes";
import Suporte from "./pages/Suporte";
import Usuarios from "./pages/Usuarios";
import PerfisAcesso from "./pages/PerfisAcesso";
import MeuPerfil from "./pages/MeuPerfil";
import Pendencias from "./pages/Pendencias";
import Departamentos from "./pages/cadastros/Departamentos";
import Cargos from "./pages/cadastros/Cargos";
import Filiais from "./pages/cadastros/Filiais";
import AnaliseJornada from "./pages/AnaliseJornada";
import NotFound from "./pages/NotFound";

// Lazy imports only for rarely accessed / public / admin pages
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const QuestionarioPsicossocial = lazy(() => import("./pages/QuestionarioPsicossocial"));
const PdiAssinatura = lazy(() => import("./pages/PdiAssinatura"));
const PontoExterno = lazy(() => import("./pages/PontoExterno"));
const FeriasAssinatura = lazy(() => import("./pages/FeriasAssinatura"));
const TrilhaTerceiroPublica = lazy(() => import("./pages/TrilhaTerceiroPublica"));
const AssinaturaContrato = lazy(() => import("./pages/AssinaturaContrato"));
const ExperienciaAssinatura = lazy(() => import("./pages/ExperienciaAssinatura"));
const OrdemServicoAssinatura = lazy(() => import("./pages/OrdemServicoAssinatura"));
const ManualFuncaoAssinatura = lazy(() => import("./pages/ManualFuncaoAssinatura"));
const AceiteDocumento = lazy(() => import("./pages/AceiteDocumento"));
const OnboardingCliente = lazy(() => import("./pages/OnboardingCliente"));
const AtivarConta = lazy(() => import("./pages/AtivarConta"));
const OnboardingProtegido = lazy(() => import("./pages/OnboardingProtegido"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const TermosDeUso = lazy(() => import("./pages/TermosDeUso"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const PlaceholderPage = lazy(() => import("./pages/PlaceholderPage"));
const CompletarCadastro = lazy(() => import("./pages/CompletarCadastro"));
const SuperAdminDashboard = lazy(() => import("./pages/admin/SuperAdminDashboard"));
const ManualSistema = lazy(() => import("./pages/admin/ManualSistema"));
const QADashboard = lazy(() => import("./pages/admin/QADashboard"));
const BlogAdmin = lazy(() => import("./pages/admin/BlogAdmin"));
const ContratosAceite = lazy(() => import("./pages/admin/ContratosAceite"));
const AssinarContrato = lazy(() => import("./pages/AssinarContrato"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ConfirmDialogProvider />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
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
              <Route path="/p/:token" element={<QuestionarioPsicossocial tokenTipo="participacao" />} />
              <Route path="/pdi-assinatura/:token" element={<PdiAssinatura />} />
              <Route path="/ferias-assinatura/:token" element={<FeriasAssinatura />} />
              <Route path="/trilha-terceiro/:token" element={<TrilhaTerceiroPublica />} />
              <Route path="/ponto-externo" element={<PontoExterno />} />
              <Route path="/ponto-externo/:token" element={<PontoExterno />} />
              <Route path="/contrato-assinatura/:token" element={<AssinaturaContrato />} />
              <Route path="/experiencia-assinatura/:token" element={<ExperienciaAssinatura />} />
              <Route path="/os/:token" element={<OrdemServicoAssinatura />} />
              <Route path="/manual-funcao/assinatura/:token" element={<ManualFuncaoAssinatura />} />
              <Route path="/aceite-documento/:token" element={<AceiteDocumento />} />
              <Route path="/completar-cadastro/:token" element={<CompletarCadastro />} />
              <Route path="/onboarding-cliente/:token" element={<OnboardingCliente />} />
              <Route path="/ativar-conta" element={<AtivarConta />} />
              <Route path="/lp" element={<LandingPage />} />
              <Route path="/termos-de-uso" element={<TermosDeUso />} />
              <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />

              {/* Super Admin Routes */}
              <Route path="/admin" element={<SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>} />
              <Route path="/admin/manual" element={<SuperAdminRoute><ManualSistema /></SuperAdminRoute>} />
              <Route path="/admin/qa" element={<SuperAdminRoute><QADashboard /></SuperAdminRoute>} />
              <Route path="/admin/blog" element={<SuperAdminRoute><BlogAdmin /></SuperAdminRoute>} />

              {/* Protected Onboarding Route */}
              <Route path="/onboarding" element={<ProtectedRoute><OnboardingProtegido /></ProtectedRoute>} />

              {/* Protected App Routes */}
              <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/pendencias" element={<Pendencias />} />
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
                <Route path="/metas" element={<MetasModule />} />
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
                <Route path="/suporte" element={<Suporte />} />
                <Route path="/meu-perfil" element={<MeuPerfil />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
