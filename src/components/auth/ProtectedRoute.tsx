import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import type { AppRole } from "@/types/database";
import { Loader2, Ban, ShieldOff } from "lucide-react";
import { useUsuarioStatus } from "@/hooks/useUsuarioStatus";
import { Button } from "@/components/ui/button";
import { usePerfilPermissions } from "@/hooks/usePerfilPermissions";
import { getModuloForPath, ALWAYS_ALLOWED_PATHS } from "@/lib/moduleAccess";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, profile, loading, hasMinimumRole, signOut, isSuperAdmin } = useAuthContext();
  const location = useLocation();
  const { isBloqueado, isLoading: loadingStatus } = useUsuarioStatus(user?.id, profile?.tenant_id);

  if (loading || (user && profile && loadingStatus)) {
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
  if (!profile && !isSuperAdmin) {
    return <Navigate to="/login" replace />;
  }

  // Usuário bloqueado/suspenso/inativo — impedir acesso
  if (isBloqueado && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full mx-4 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <Ban className="w-8 h-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Acesso Bloqueado</h1>
            <p className="text-muted-foreground">
              Sua conta foi bloqueada por um administrador. 
              Você não pode acessar o sistema até que o bloqueio seja removido.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Entre em contato com o administrador da sua empresa para mais informações.
          </p>
          <Button
            variant="outline"
            onClick={() => signOut()}
            className="mt-4"
          >
            Sair da conta
          </Button>
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
