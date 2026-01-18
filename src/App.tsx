import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Colaboradores from "./pages/Colaboradores";
import Ponto from "./pages/Ponto";
import Ferias from "./pages/Ferias";
import Documentos from "./pages/Documentos";
import Admissao from "./pages/Admissao";
import PlaceholderPage from "./pages/PlaceholderPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/feed" element={<PlaceholderPage />} />
            <Route path="/colaboradores" element={<Colaboradores />} />
            <Route path="/cadastros/departamentos" element={<PlaceholderPage />} />
            <Route path="/cadastros/cargos" element={<PlaceholderPage />} />
            <Route path="/cadastros/filiais" element={<PlaceholderPage />} />
            <Route path="/financeiro/folha" element={<PlaceholderPage />} />
            <Route path="/financeiro/beneficios" element={<PlaceholderPage />} />
            <Route path="/ponto" element={<Ponto />} />
            <Route path="/admissao" element={<Admissao />} />
            <Route path="/ferias" element={<Ferias />} />
            <Route path="/avaliacoes" element={<PlaceholderPage />} />
            <Route path="/pdi" element={<PlaceholderPage />} />
            <Route path="/epis" element={<PlaceholderPage />} />
            <Route path="/felicidade" element={<PlaceholderPage />} />
            <Route path="/documentos" element={<Documentos />} />
            <Route path="/configuracoes" element={<PlaceholderPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
