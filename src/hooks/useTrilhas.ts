import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";
import { handleMutationError } from "@/lib/toastError";
import type { Trilha, TrilhaModulo, TrilhaQuizPergunta } from "@/types/trilha";

export function useTrilhas() {
  const { tenantId, user, profile } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const qc = useQueryClient();

  const { data: trilhas = [], isLoading } = useQuery({
    queryKey: ["trilhas", tenantId, empresaAtivaId],
    queryFn: async (): Promise<Trilha[]> => {
      if (!tenantId) return [];
      let query = supabase
        .from("trilhas" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (empresaAtivaId) query = query.eq("empresa_id", empresaAtivaId) as any;
      const { data, error } = await query as { data: Trilha[] | null; error: Error | null };
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
          empresa_id: empresaAtivaId || null,
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
    onError: handleMutationError,
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
    onError: handleMutationError,
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
    onError: handleMutationError,
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
      if (!trilhaId) return [];
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("trilha_modulos" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("trilha_id", trilhaId)
        .order("ordem") as { data: TrilhaModulo[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!trilhaId,
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
    onError: handleMutationError,
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
    onError: handleMutationError,
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
    onError: handleMutationError,
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
