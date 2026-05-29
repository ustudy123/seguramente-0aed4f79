import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "@/hooks/useAuth";

/**
 * Tipos de usuário externos/profissionais que SEMPRE precisam de filtro por vínculo,
 * mesmo se a lista de vínculos vier vazia (acesso bloqueado por segurança).
 */
const TIPOS_PROFISSIONAIS = [
  "clinica_parceira",
  "consultor_externo",
  "prestador_terceiro",
  "auditor",
  "suporte_autorizado",
] as const;

/**
 * Tipos com acesso amplo a todas as empresas do tenant (não filtrados por vínculo).
 * Apenas papéis de propriedade/administração global. Qualquer outro tipo
 * (gestor, rh_dp, liderança, etc.) DEVE ser filtrado pelos vínculos cadastrados.
 */
const TIPOS_ACESSO_GLOBAL = [
  "proprietario",
  "owner",
  "admin",
  "administrador",
] as const;

export interface UsuarioVinculo {
  id: string;
  empresa_id: string;
  tipo_vinculo: string;
  status: string;
  data_inicio: string;
  data_fim: string | null;
}

export function useUsuarioVinculos() {
  const { user, tenantId, hasMinimumRole, isSuperAdmin } = useAuth();

  const isOwnerOrAdmin = hasMinimumRole("admin") || isSuperAdmin;

  // 1) Busca o registro do usuario_base a partir do auth_user_id
  const { data: usuarioBase, isLoading: loadingBase } = useQuery({
    queryKey: ["usuario_base_by_auth", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await fromTable("usuarios_base")
        .select("id, tipo_usuario")
        .eq("auth_user_id", user.id)
        .maybeSingle() as { data: { id: string; tipo_usuario: string | null } | null; error: Error | null };
      if (error) {
        console.warn("useUsuarioVinculos: erro ao buscar usuario_base", error);
        return null;
      }
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const tipoUsuario = usuarioBase?.tipo_usuario || null;
  const isProfissional = !!tipoUsuario && TIPOS_PROFISSIONAIS.includes(tipoUsuario as any);
  const temAcessoGlobal = isOwnerOrAdmin || (!!tipoUsuario && TIPOS_ACESSO_GLOBAL.includes(tipoUsuario as any));

  // Busca vínculos para qualquer usuário não-global. Owners/admins ignoram este filtro.
  const deveBuscarVinculos = !!usuarioBase?.id && !!tenantId && !temAcessoGlobal;

  const { data: vinculos = [], isLoading: loadingVinculos } = useQuery({
    queryKey: ["usuario_vinculos", usuarioBase?.id, tenantId],
    queryFn: async () => {
      if (!usuarioBase?.id || !tenantId) return [];
      const { data, error } = await fromTable("usuario_vinculos")
        .select("id, empresa_id, tipo_vinculo, status, data_inicio, data_fim")
        .eq("usuario_id", usuarioBase.id)
        .eq("tenant_id", tenantId)
        .eq("status", "ativo") as { data: UsuarioVinculo[] | null; error: Error | null };
      if (error) {
        console.warn("useUsuarioVinculos: erro ao buscar vínculos", error);
        return [];
      }
      return (data || []) as UsuarioVinculo[];
    },
    enabled: deveBuscarVinculos,
    staleTime: 2 * 60 * 1000,
  });

  // Lista de empresas permitidas: vazia para usuários globais (sem restrição)
  const empresaIdsPermitidas = temAcessoGlobal ? [] : vinculos.map((v) => v.empresa_id);

  // "Restrito" = qualquer usuário que NÃO é owner/admin global (deve ser filtrado por vínculo)
  const isRestrito = !!usuarioBase && !temAcessoGlobal;

  return {
    /** @deprecated use isRestrito — mantido para compatibilidade */
    isProfissional: isProfissional || isRestrito,
    isRestrito,
    temAcessoGlobal,
    vinculos,
    empresaIdsPermitidas,
    isLoading: loadingBase || (deveBuscarVinculos && loadingVinculos),
    usuarioBaseId: usuarioBase?.id || null,
    tipoUsuario,
  };
}
