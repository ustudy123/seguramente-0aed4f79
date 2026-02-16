import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface TrilhaAtribuicao {
  id: string;
  tenant_id: string;
  trilha_id: string;
  tipo_alvo: string;
  alvo_id: string | null;
  alvo_nome: string | null;
  created_at: string;
  // joined
  trilha_nome?: string;
}

export function useTrilhaAtribuicoes(trilhaId?: string) {
  const { tenantId } = useAuth();
  const qc = useQueryClient();

  const { data: atribuicoes = [], isLoading } = useQuery({
    queryKey: ["trilha_atribuicoes", tenantId, trilhaId],
    queryFn: async (): Promise<TrilhaAtribuicao[]> => {
      if (!tenantId) return [];
      let query = supabase
        .from("trilha_atribuicoes" as never)
        .select("*, trilha:trilhas(nome)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (trilhaId) {
        query = query.eq("trilha_id", trilhaId);
      }
      const { data, error } = await query as { data: any[] | null; error: Error | null };
      if (error) throw error;
      return (data || []).map((d) => {
        const trilhaData = Array.isArray(d.trilha) ? d.trilha[0] : d.trilha;
        return { ...d, trilha_nome: trilhaData?.nome || "" };
      });
    },
    enabled: !!tenantId,
  });

  const atribuirMut = useMutation({
    mutationFn: async (input: {
      trilha_id: string;
      tipo_alvo: string;
      alvo_id: string | null;
      alvo_nome: string | null;
    }) => {
      if (!tenantId) throw new Error("Sem contexto");
      const { data, error } = await supabase
        .from("trilha_atribuicoes" as never)
        .insert({ tenant_id: tenantId, ...input } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trilha_atribuicoes"] });
      toast.success("Trilha atribuída com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removerMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trilha_atribuicoes" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trilha_atribuicoes"] });
      toast.success("Atribuição removida!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    atribuicoes,
    isLoading,
    atribuir: atribuirMut.mutateAsync,
    remover: removerMut.mutateAsync,
    atribuindo: atribuirMut.isPending,
  };
}
