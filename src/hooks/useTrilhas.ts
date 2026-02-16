import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import type { Trilha, TrilhaModulo, TrilhaQuizPergunta } from "@/types/trilha";

export function useTrilhas() {
  const { tenantId, user, profile } = useAuth();
  const qc = useQueryClient();

  const { data: trilhas = [], isLoading } = useQuery({
    queryKey: ["trilhas", tenantId],
    queryFn: async (): Promise<Trilha[]> => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("trilhas" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }) as { data: Trilha[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const criarTrilhaMut = useMutation({
    mutationFn: async (input: Partial<Trilha> & { nome: string }) => {
      if (!tenantId) throw new Error("Sem contexto");
      const { data, error } = await supabase
        .from("trilhas" as never)
        .insert({
          tenant_id: tenantId,
          criado_por: user?.id,
          criado_por_nome: profile?.nome_completo || user?.email,
          ...input,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trilhas"] });
      toast.success("Trilha criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizarTrilhaMut = useMutation({
    mutationFn: async ({ id, ...input }: Partial<Trilha> & { id: string }) => {
      const { error } = await supabase
        .from("trilhas" as never)
        .update(input as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trilhas"] });
      toast.success("Trilha atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirTrilhaMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trilhas" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trilhas"] });
      toast.success("Trilha removida!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    trilhas,
    isLoading,
    criarTrilha: criarTrilhaMut.mutateAsync,
    atualizarTrilha: atualizarTrilhaMut.mutateAsync,
    excluirTrilha: excluirTrilhaMut.mutateAsync,
    criando: criarTrilhaMut.isPending,
  };
}

export function useTrilhaModulos(trilhaId?: string) {
  const { tenantId } = useAuth();
  const qc = useQueryClient();

  const { data: modulos = [], isLoading } = useQuery({
    queryKey: ["trilha_modulos", trilhaId],
    queryFn: async (): Promise<TrilhaModulo[]> => {
      if (!tenantId || !trilhaId) return [];
      const { data, error } = await supabase
        .from("trilha_modulos" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("trilha_id", trilhaId)
        .order("ordem") as { data: TrilhaModulo[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!trilhaId,
  });

  const criarModuloMut = useMutation({
    mutationFn: async (input: Partial<TrilhaModulo> & { titulo: string }) => {
      if (!tenantId || !trilhaId) throw new Error("Sem contexto");
      const { data, error } = await supabase
        .from("trilha_modulos" as never)
        .insert({ tenant_id: tenantId, trilha_id: trilhaId, ...input } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trilha_modulos", trilhaId] });
      qc.invalidateQueries({ queryKey: ["trilhas"] });
      toast.success("Módulo adicionado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizarModuloMut = useMutation({
    mutationFn: async ({ id, ...input }: Partial<TrilhaModulo> & { id: string }) => {
      const { error } = await supabase
        .from("trilha_modulos" as never)
        .update(input as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trilha_modulos", trilhaId] });
      toast.success("Módulo atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirModuloMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trilha_modulos" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trilha_modulos", trilhaId] });
      qc.invalidateQueries({ queryKey: ["trilhas"] });
      toast.success("Módulo removido!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    modulos,
    isLoading,
    criarModulo: criarModuloMut.mutateAsync,
    atualizarModulo: atualizarModuloMut.mutateAsync,
    excluirModulo: excluirModuloMut.mutateAsync,
    criando: criarModuloMut.isPending,
  };
}
