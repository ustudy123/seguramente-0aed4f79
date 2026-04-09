import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { handleMutationError } from "@/lib/toastError";
import type { TrilhaQuizPergunta } from "@/types/trilha";

export function useTrilhaQuiz(moduloId?: string) {
  const { tenantId } = useAuth();
  const qc = useQueryClient();

  const { data: perguntas = [], isLoading } = useQuery({
    queryKey: ["trilha_quiz", moduloId],
    queryFn: async (): Promise<TrilhaQuizPergunta[]> => {
      if (!tenantId || !moduloId) return [];
      const { data, error } = await fromTable("trilha_quiz_perguntas")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("modulo_id", moduloId)
        .order("ordem") as { data: TrilhaQuizPergunta[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!moduloId,
  });

  const criarPerguntaMut = useMutation({
    mutationFn: async (input: {
      modulo_id: string;
      pergunta: string;
      opcoes: string[];
      resposta_correta: number;
      ordem: number;
    }) => {
      if (!tenantId) throw new Error("Sem contexto");
      const { data, error } = await fromTable("trilha_quiz_perguntas")
        .insert({ tenant_id: tenantId, ...input } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trilha_quiz", moduloId] });
      toast.success("Pergunta adicionada!");
    },
    onError: handleMutationError,
  });

  const atualizarPerguntaMut = useMutation({
    mutationFn: async ({ id, ...input }: Partial<TrilhaQuizPergunta> & { id: string }) => {
      const { error } = await fromTable("trilha_quiz_perguntas")
        .update(input as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trilha_quiz", moduloId] });
      toast.success("Pergunta atualizada!");
    },
    onError: handleMutationError,
  });

  const excluirPerguntaMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("trilha_quiz_perguntas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trilha_quiz", moduloId] });
      toast.success("Pergunta removida!");
    },
    onError: handleMutationError,
  });

  return {
    perguntas,
    isLoading,
    criarPergunta: criarPerguntaMut.mutateAsync,
    atualizarPergunta: atualizarPerguntaMut.mutateAsync,
    excluirPergunta: excluirPerguntaMut.mutateAsync,
    criando: criarPerguntaMut.isPending,
  };
}
