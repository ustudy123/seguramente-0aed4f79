 import { Navigate } from 'react-router-dom';
 import { useAuthContext } from '@/contexts/AuthContext';
 import { Loader2 } from 'lucide-react';
 
 interface SuperAdminRouteProps {
   children: React.ReactNode;
 }
 
 export function SuperAdminRoute({ children }: SuperAdminRouteProps) {
   const { user, isSuperAdmin, loading } = useAuthContext();
 
   if (loading) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-background">
         <div className="flex flex-col items-center gap-4">
           <Loader2 className="w-8 h-8 animate-spin text-primary" />
           <p className="text-muted-foreground">Verificando permissões...</p>
         </div>
       </div>
     );
   }
 
   if (!user) {
     return <Navigate to="/login" replace />;
   }
 
   if (!isSuperAdmin) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-background">
         <div className="text-center">
           <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
           <p className="text-muted-foreground">
             Esta área é restrita a Super Administradores.
           </p>
         </div>
       </div>
     );
   }
 
   return <>{children}</>;
 }