import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import { AuthLayout } from "@/components/layout/AuthLayout";

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
import PlaceholderPage from "./pages/PlaceholderPage";
import NotFound from "./pages/NotFound";

// Cadastros Pages
import Departamentos from "./pages/cadastros/Departamentos";
import Cargos from "./pages/cadastros/Cargos";
import Filiais from "./pages/cadastros/Filiais";

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

            {/* Protected App Routes */}
            <Route
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/feed" element={<PlaceholderPage />} />
              <Route path="/colaboradores" element={<Colaboradores />} />
              <Route path="/cadastros/departamentos" element={<Departamentos />} />
              <Route path="/cadastros/cargos" element={<Cargos />} />
              <Route path="/cadastros/filiais" element={<Filiais />} />
              <Route path="/financeiro/folha" element={<PlaceholderPage />} />
              <Route path="/financeiro/beneficios" element={<PlaceholderPage />} />
              <Route path="/ponto" element={<Ponto />} />
              <Route path="/admissao" element={<Admissao />} />
              <Route path="/ferias" element={<Ferias />} />
              <Route path="/avaliacoes" element={<PlaceholderPage />} />
              <Route path="/pdi" element={<PlaceholderPage />} />
              <Route path="/epis" element={<Epis />} />
              <Route path="/felicidade" element={<PlaceholderPage />} />
              <Route path="/documentos" element={<Documentos />} />
              <Route path="/configuracoes" element={<PlaceholderPage />} />
              {/* Catch-all inside protected layout */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
