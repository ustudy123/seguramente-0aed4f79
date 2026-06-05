import { useAuth } from "./useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GafPerfil = 'admin' | 'rh' | 'dp' | 'sst' | 'medicina' | 'juridico' | 'gestor' | 'executivo';

export interface GafPermissions {
  podeVerCid: boolean;
  podeVerAnexosMedicos: boolean;
  podeGerenciarTudo: boolean;
  podeVerDadosFinanceiros: boolean;
  podeVerDashboardsGerais: boolean;
  perfil?: GafPerfil;
}

export function useGafPermissions() {
  const { user, tenantId, roles, isSuperAdmin } = useAuth();

  const { data: gafPerfil, isLoading } = useQuery({
    queryKey: ['gaf-perfil', user?.id, tenantId],
    queryFn: async () => {
      if (!user?.id || !tenantId) return null;
      
      const { data, error } = await supabase
        .from('gaf_usuarios_perfis')
        .select('*')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!tenantId,
  });

  const getPermissions = (): GafPermissions => {
    // Admin ou Dono tem acesso total
    if (isSuperAdmin || roles.includes('admin') || roles.includes('owner')) {
      return {
        podeVerCid: true,
        podeVerAnexosMedicos: true,
        podeGerenciarTudo: true,
        podeVerDadosFinanceiros: true,
        podeVerDashboardsGerais: true,
        perfil: 'admin'
      };
    }

    const perfil = (gafPerfil?.perfil as GafPerfil) || 'gestor';

    const basePermissions: GafPermissions = {
      podeVerCid: gafPerfil?.pode_ver_cid || false,
      podeVerAnexosMedicos: gafPerfil?.pode_ver_anexos_medicos || false,
      podeGerenciarTudo: false,
      podeVerDadosFinanceiros: false,
      podeVerDashboardsGerais: true,
      perfil
    };

    switch (perfil) {
      case 'medicina':
        return { ...basePermissions, podeVerCid: true, podeVerAnexosMedicos: true };
      case 'rh':
        return { ...basePermissions, podeGerenciarTudo: true };
      case 'dp':
        return { ...basePermissions, podeVerDadosFinanceiros: true };
      case 'sst':
        return { ...basePermissions };
      case 'juridico':
        return { ...basePermissions };
      case 'gestor':
        return { ...basePermissions, podeVerDashboardsGerais: false };
      case 'executivo':
        return { ...basePermissions };
      default:
        return basePermissions;
    }
  };

  return {
    permissions: getPermissions(),
    isLoading,
  };
}
