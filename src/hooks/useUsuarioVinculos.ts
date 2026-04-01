import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Tipos de usuário considerados "profissionais" — precisam de filtro por vínculo.
 * Internos (admin, rh_dp, gestor, etc.) veem todas as empresas do tenant.
 */
const TIPOS_PROFISSIONAIS = [
  "clinica_parceira",
  "consultor_externo",
  "prestador_terceiro",
  "auditor",
  "suporte_autorizado",
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
  const { user, tenantId } = useAuth();

  // 1) Busca o registro do usuario_base a partir do auth_user_id
  const { data: usuarioBase, isLoading: loadingBase } = useQuery({
    queryKey: ["usuario_base_by_auth", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("usuarios_base" as never)
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
    staleTime: 5 * 60 * 1000, // cache 5 min
  });

  const isProfissional = !!usuarioBase?.tipo_usuario &&
    TIPOS_PROFISSIONAIS.includes(usuarioBase.tipo_usuario as any);

  // 2) Se for profissional, busca vínculos ativos
  const { data: vinculos = [], isLoading: loadingVinculos } = useQuery({
    queryKey: ["usuario_vinculos", usuarioBase?.id, tenantId],
    queryFn: async () => {
      if (!usuarioBase?.id || !tenantId) return [];
      const { data, error } = await supabase
        .from("usuario_vinculos" as never)
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
    enabled: !!usuarioBase?.id && !!tenantId && isProfissional,
    staleTime: 2 * 60 * 1000,
  });

  // IDs das empresas vinculadas (vazio = sem restrição)
  const empresaIdsPermitidas = isProfissional
    ? vinculos.map((v) => v.empresa_id)
    : [];

  return {
    isProfissional,
    vinculos,
    empresaIdsPermitidas,
    isLoading: loadingBase || (isProfissional && loadingVinculos),
    usuarioBaseId: usuarioBase?.id || null,
    tipoUsuario: usuarioBase?.tipo_usuario || null,
  };
}
