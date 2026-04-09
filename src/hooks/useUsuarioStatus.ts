import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";

/**
 * Hook que verifica o status do usuário logado na tabela usuarios_base.
 * Retorna se o usuário está bloqueado/suspenso/inativo.
 */
export function useUsuarioStatus(authUserId?: string, tenantId?: string) {
  const { data, isLoading } = useQuery({
    queryKey: ["meu-usuario-status", authUserId, tenantId],
    queryFn: async () => {
      if (!authUserId || !tenantId) return null;
      const { data, error } = await fromTable("usuarios_base")
        .select("id, status")
        .eq("auth_user_id", authUserId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) {
        console.error("Erro ao verificar status do usuário:", error);
        return null;
      }
      return data as { id: string; status: string } | null;
    },
    enabled: !!authUserId && !!tenantId,
    staleTime: 30 * 1000, // Check every 30s
    refetchInterval: 60 * 1000, // Re-check every minute
  });

  const isBloqueado = data?.status === "bloqueado" || data?.status === "suspenso" || data?.status === "inativo";

  return {
    status: data?.status || null,
    isBloqueado,
    isLoading,
  };
}
