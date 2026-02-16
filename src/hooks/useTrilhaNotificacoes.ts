import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface TrilhaNotificacao {
  id: string;
  tenant_id: string;
  colaborador_id: string;
  colaborador_nome: string;
  trilha_id: string;
  trilha_nome: string;
  tipo: "prazo_proximo" | "prazo_vencido" | "abandono" | "lembrete_retorno";
  titulo: string;
  descricao: string | null;
  lida: boolean;
  created_at: string;
}

export function useTrilhaNotificacoes() {
  const { tenantId, user } = useAuth();
  const qc = useQueryClient();
  const colaboradorId = user?.id;

  const { data: notificacoes = [], isLoading } = useQuery({
    queryKey: ["trilha_notificacoes", colaboradorId],
    queryFn: async (): Promise<TrilhaNotificacao[]> => {
      if (!colaboradorId) return [];
      const { data, error } = await supabase
        .from("trilha_notificacoes" as never)
        .select("*")
        .eq("colaborador_id", colaboradorId)
        .order("created_at", { ascending: false })
        .limit(50) as { data: TrilhaNotificacao[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!colaboradorId,
  });

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  const marcarLidaMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("trilha_notificacoes" as never)
        .update({ lida: true } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trilha_notificacoes"] }),
  });

  const marcarTodasLidasMut = useMutation({
    mutationFn: async () => {
      if (!colaboradorId) return;
      const { error } = await supabase
        .from("trilha_notificacoes" as never)
        .update({ lida: true } as never)
        .eq("colaborador_id", colaboradorId)
        .eq("lida", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trilha_notificacoes"] }),
  });

  return {
    notificacoes,
    naoLidas,
    isLoading,
    marcarLida: marcarLidaMut.mutateAsync,
    marcarTodasLidas: marcarTodasLidasMut.mutateAsync,
  };
}
