import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";

// Guarda da Área do Parceiro: exige login E vínculo em parceiro_usuarios.
// Não passa pelo ProtectedRoute do sistema (que exige perfil de tenant).
export function ParceiroRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, parceiroId, profile, isSuperAdmin } = useAuthContext();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1D34]">
        <Loader2 className="w-8 h-8 animate-spin text-[#60ABEF]" />
      </div>
    );
  }
  if (!user) return <Navigate to="/parceiros/entrar" state={{ from: location }} replace />;
  // Quem entrou pela porta do parceiro mas é usuário do sistema (tem perfil de
  // empresa ou é superadmin) vai para o sistema, não para o cadastro de parceiro.
  if (!parceiroId && (profile || isSuperAdmin)) return <Navigate to="/" replace />;
  if (!parceiroId) return <Navigate to="/parceiros/cadastro" replace />;
  return <>{children}</>;
}
