import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import type { AppRole } from "@/types/database";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, profile, loading, hasMinimumRole, signOut } = useAuthContext();
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

  // Logged in, but missing tenant/profile linkage
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full px-6 text-center space-y-4">
          <h1 className="text-2xl font-bold">Finalize seu cadastro</h1>
          <p className="text-muted-foreground">
            Sua conta foi autenticada, mas ainda não está vinculada a uma empresa.
            Cadastre sua empresa ou peça um convite ao administrador.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <NavigateButton to="/register">Cadastrar empresa</NavigateButton>
            <button
              type="button"
              onClick={() => signOut()}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );
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

