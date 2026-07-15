import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { handleMutationError } from "@/lib/toastError";
import { montarArvore } from "@/types/qa";
import type { QaModulo, QaCasoTeste } from "@/types/qa";

/**
 * Diretório de documentação de testes (superadmin).
 * Tabelas globais, sem tenant: é infraestrutura de QA do produto.
 */
export function useQaDocs(moduloId?: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: modulos = [], isLoading: carregandoArvore } = useQuery({
    queryKey: ["qa_modulos"],
    queryFn: async () => {
      const { data, error } = await fromTable("qa_modulos")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as QaModulo[];
    },
  });

  const arvore = montarArvore(modulos);

  const { data: casos = [], isLoading: carregandoCasos } = useQuery({
    queryKey: ["qa_casos", moduloId],
    enabled: !!moduloId,
    queryFn: async () => {
      const { data, error } = await fromTable("qa_casos_teste")
        .select("*")
        .eq("modulo_id", moduloId)
        .order("codigo", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as QaCasoTeste[];
    },
  });

  /** Contagem de casos por módulo, para exibir na árvore. */
  const { data: contagem = {} } = useQuery({
    queryKey: ["qa_casos_contagem"],
    queryFn: async () => {
      const { data, error } = await fromTable("qa_casos_teste").select("modulo_id");
      if (error) throw error;
      const mapa: Record<string, number> = {};
      (data || []).forEach((r: { modulo_id: string }) => {
        mapa[r.modulo_id] = (mapa[r.modulo_id] || 0) + 1;
      });
      return mapa;
    },
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["qa_casos"] });
    qc.invalidateQueries({ queryKey: ["qa_casos_contagem"] });
  };

  const salvarCasoMut = useMutation({
    mutationFn: async (caso: Partial<QaCasoTeste> & { modulo_id: string; titulo: string }) => {
      const payload = { ...caso, created_by: caso.created_by ?? user?.id ?? null };
      if (caso.id) {
        const { id, created_at, updated_at, ...resto } = payload as Record<string, unknown> & { id: string };
        const { error } = await fromTable("qa_casos_teste").update(resto).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await fromTable("qa_casos_teste").insert(payload).select("id").single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: (_, vars) => {
      invalidar();
      toast.success(vars.id ? "Caso de teste salvo." : "Caso de teste criado.");
    },
    onError: handleMutationError,
  });

  const excluirCasoMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("qa_casos_teste").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast.success("Caso de teste excluído.");
    },
    onError: handleMutationError,
  });

  return {
    arvore,
    modulos,
    casos,
    contagem,
    carregandoArvore,
    carregandoCasos,
    salvarCaso: salvarCasoMut.mutateAsync,
    salvando: salvarCasoMut.isPending,
    excluirCaso: excluirCasoMut.mutateAsync,
  };
}
