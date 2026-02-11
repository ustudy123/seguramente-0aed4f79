import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { ChatIAWidget } from "@/components/chat/ChatIAWidget";

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
import Admissao from "./pages/Admissao";
import Epis from "./pages/Epis";
import Feed from "./pages/Feed";
import Ouvidoria from "./pages/Ouvidoria";
import FeedbackOcorrencias from "./pages/FeedbackOcorrencias";
import AprendizadoPapeis from "./pages/AprendizadoPapeis";
import Estrategia from "./pages/Estrategia";
import Ergonomia from "./pages/Ergonomia";
import ComplianceSST from "./pages/ComplianceSST";
import PlanoAcao from "./pages/PlanoAcao";
import PlanoAcaoDetalhe from "./pages/PlanoAcaoDetalhe";
import Avaliacoes from "./pages/Avaliacoes";
import Atestados from "./pages/Atestados";
import PlaceholderPage from "./pages/PlaceholderPage";
import Financeiro from "./pages/Financeiro";
import Empresa from "./pages/Empresa";
import NotFound from "./pages/NotFound";
import QuestionarioPsicossocial from "./pages/QuestionarioPsicossocial";

// Cadastros Pages
import Departamentos from "./pages/cadastros/Departamentos";
import Cargos from "./pages/cadastros/Cargos";
import Filiais from "./pages/cadastros/Filiais";

// Admin Pages
import SuperAdminDashboard from "./pages/admin/SuperAdminDashboard";
import { SuperAdminRoute } from "@/components/admin/SuperAdminRoute";

const queryClient = new QueryClient();

const App = () => (
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

          {/* Super Admin Routes */}
          <Route
            path="/admin/*"
            element={
              <SuperAdminRoute>
                <SuperAdminDashboard />
              </SuperAdminRoute>
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
              <Route path="/cadastros/departamentos" element={<Departamentos />} />
              <Route path="/cadastros/cargos" element={<Cargos />} />
              <Route path="/cadastros/filiais" element={<Filiais />} />
              <Route path="/financeiro" element={<Financeiro />} />
              <Route path="/empresa" element={<Empresa />} />
              <Route path="/ponto" element={<Ponto />} />
              <Route path="/admissao" element={<Admissao />} />
              <Route path="/ferias" element={<Ferias />} />
              <Route path="/avaliacoes" element={<Avaliacoes />} />
              <Route path="/atestados" element={<Atestados />} />
              <Route path="/plano-acao" element={<PlanoAcao />} />
              <Route path="/plano-acao/:id" element={<PlanoAcaoDetalhe />} />
              <Route path="/epis" element={<Epis />} />
              <Route path="/compliance-sst" element={<ComplianceSST />} />
              <Route path="/feedback-ocorrencias" element={<FeedbackOcorrencias />} />
              <Route path="/aprendizado-papeis" element={<AprendizadoPapeis />} />
              <Route path="/estrategia" element={<Estrategia />} />
              <Route path="/ouvidoria" element={<Ouvidoria />} />
              <Route path="/ergonomia" element={<Ergonomia />} />
              <Route path="/felicidade" element={<PlaceholderPage />} />
              <Route path="/documentos" element={<Documentos />} />
              <Route path="/configuracoes" element={<PlaceholderPage />} />
              {/* Catch-all inside protected layout */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          
          {/* Chat IA Widget - disponível em todas as páginas protegidas */}
          <ChatIAWidget />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
