import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fromTable } from "@/integrations/supabase/untypedClient";

export interface EntrevistaLink {
  id: string;
  token: string;
  modalidade: string;
  status: string;
  fase_atual: number;
  riscos_cobertos: number;
  total_riscos: number;
  colaborador_nome: string | null;
  created_at: string;
  iniciada_em: string | null;
  concluida_em: string | null;
}

export function useEntrevistasCampanha(campanhaId: string | null) {
  return useQuery({
    queryKey: ["psicossocial-entrevistas", campanhaId],
    enabled: !!campanhaId,
    queryFn: async () => {
      const { data, error } = await fromTable("psicossocial_entrevistas")
        .select(
          "id, token, modalidade, status, fase_atual, riscos_cobertos, total_riscos, colaborador_nome, created_at, iniciada_em, concluida_em"
        )
        .eq("campanha_id", campanhaId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any as EntrevistaLink[]) || [];
    },
  });
}

export function useCancelarEntrevista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; campanhaId: string }) => {
      const { error } = await fromTable("psicossocial_entrevistas")
        .update({ status: "cancelada" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success("Link cancelado");
      qc.invalidateQueries({ queryKey: ["psicossocial-entrevistas", vars.campanhaId] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao cancelar"),
  });
}

export function useExcluirEntrevista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; campanhaId: string }) => {
      const { error } = await fromTable("psicossocial_entrevistas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success("Link excluído");
      qc.invalidateQueries({ queryKey: ["psicossocial-entrevistas", vars.campanhaId] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao excluir"),
  });
}
