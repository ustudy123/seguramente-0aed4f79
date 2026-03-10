import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import type { AppRole } from "@/types/database";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, profile, loading, hasMinimumRole, signOut, isSuperAdmin } = useAuthContext();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Superadmins podem não ter profile - redirecionar para área admin
  if (!profile && isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  // Logged in, but missing tenant/profile linkage (não é superadmin)
  // Redireciona para /register para completar o cadastro silenciosamente
  if (!profile && !isSuperAdmin) {
    return <Navigate to="/register" replace />;
  }

  if (requiredRole && !hasMinimumRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function NavigateButton({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:opacity-90"
    >
      {children}
    </Link>
  );
}

