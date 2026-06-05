import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "./useAuth";
import { useMemo } from "react";

/**
 * Hook centralizado que busca as permissões do perfil de acesso vinculado ao usuário atual.
 * Retorna uma função `temPermissao(modulo, acao)` que verifica se o usuário
 * possui determinada ação em um módulo, baseado no perfil vinculado.
 *
 * Superadmins e owners têm acesso total automaticamente.
 */
export function usePerfilPermissions() {
  const { user, tenantId, isSuperAdmin, hasMinimumRole } = useAuth();

  const isOwner = hasMinimumRole("owner") || isSuperAdmin;

  // 1. Buscar o usuarios_base.id a partir do auth user id
  const { data: usuarioBase } = useQuery({
    queryKey: ["meu_usuario_base_id", user?.id, tenantId],
    queryFn: async () => {
      if (!user?.id || !tenantId) return null;
      const { data, error } = await fromTable("usuarios_base")
        .select("id")
        .eq("auth_user_id", user.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) {
        console.error("Erro ao buscar usuario_base:", error);
        return null;
      }
      return data as { id: string } | null;
    },
    enabled: !!user?.id && !!tenantId,
    staleTime: 1000, // Reduced from 10m to 1s to ensure fresh data after edits
    gcTime: 1000 * 60 * 5,
  });

  // 2. Buscar o perfil vinculado ativo do usuário (usando usuarios_base.id)
  const { data: vinculo } = useQuery({
    queryKey: ["meu_perfil_vinculo", usuarioBase?.id, tenantId],
    queryFn: async () => {
      if (!usuarioBase?.id || !tenantId) return null;
      const { data, error } = await fromTable("usuario_perfil_vinculos")
        .select("perfil_id, is_perfil_principal")
        .eq("usuario_id", usuarioBase.id)
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .order("is_perfil_principal", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("Erro ao buscar vínculo de perfil:", error);
        return null;
      }
      return data as { perfil_id: string } | null;
    },
    enabled: !!usuarioBase?.id && !!tenantId,
    staleTime: 1000,
    gcTime: 1000 * 60 * 5,
  });

  // 3. Buscar as permissões do perfil
  const { data: permissoes = [], isLoading } = useQuery({
    queryKey: ["minhas_perfil_permissoes", vinculo?.perfil_id],
    queryFn: async () => {
      if (!vinculo?.perfil_id) return [];
      const { data, error } = await fromTable("perfil_permissoes")
        .select("modulo, acao, escopo, ativo")
        .eq("perfil_id", vinculo.perfil_id)
        .eq("ativo", true);
      if (error) {
        console.error("Erro ao buscar permissões do perfil:", error);
        return [];
      }
      return data as Array<{ modulo: string; acao: string; escopo: string; ativo: boolean }>;
    },
    enabled: !!vinculo?.perfil_id,
    staleTime: 1000,
    gcTime: 1000 * 60 * 5,
  });

  // 3. Criar um Set para lookup rápido
  const permissaoSet = useMemo(() => {
    const set = new Set<string>();
    for (const p of permissoes) {
      set.add(`${p.modulo}:${p.acao}`);
    }
    return set;
  }, [permissoes]);

  /**
   * Verifica se o usuário tem permissão para uma ação em um módulo.
   * Owners e superadmins sempre retornam true.
   */
  const temPermissao = useMemo(() => {
    return (modulo: string, acao: string): boolean => {
      if (isOwner) return true;
      return permissaoSet.has(`${modulo}:${acao}`);
    };
  }, [permissaoSet, isOwner]);

  /**
   * Verifica se o usuário tem acesso a qualquer ação de um módulo (qualquer escopo).
   * Use para telas de auto-serviço (ex.: meu PDI, minhas trilhas).
   */
  const temAcessoModulo = useMemo(() => {
    return (modulo: string): boolean => {
      if (isOwner) return true;
      return permissoes.some((p) => p.modulo === modulo);
    };
  }, [permissoes, isOwner]);

  /**
   * Verifica se o usuário tem acesso ADMINISTRATIVO ao módulo — i.e., qualquer
   * permissão cujo escopo NÃO seja `proprio_usuario`. Usado para liberar telas
   * de listagem/gestão (ex.: /colaboradores, /cadastros/*). Um colaborador com
   * `colaboradores:visualizar` no escopo `proprio_usuario` deve ver apenas o
   * próprio perfil — NÃO a listagem completa.
   */
  const temAcessoModuloAdmin = useMemo(() => {
    return (modulo: string): boolean => {
      if (isOwner) return true;
      return permissoes.some(
        (p) => p.modulo === modulo && p.escopo !== "proprio_usuario"
      );
    };
  }, [permissoes, isOwner]);

  return {
    temPermissao,
    temAcessoModulo,
    temAcessoModuloAdmin,
    permissoes,
    isLoading,
    perfilVinculado: !!vinculo?.perfil_id,
    isOwner,
  };
}
