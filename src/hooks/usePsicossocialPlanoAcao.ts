/**
 * Plano de Ação PGR — Psicossocial.
 *
 * Persiste as ações 5W2H vinculadas a um fator de risco de um GHE. O nível de
 * GRO é gravado junto: se a campanha for reprocessada, o plano continua
 * refletindo o risco que existia quando a ação foi decidida, o que é o que
 * sustenta o documento como prova do monitoramento (NR-01).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";
import type { NivelGRO15 } from "@/lib/groPsicossocial15";

export interface AcaoPlanoPsicossocial {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  campanha_ids: string[];
  ghe_id: string | null;
  ghe_nome: string;
  fator_id: string;
  fator: string;
  nivel_gro: NivelGRO15;
  o_que: string;
  quem: string | null;
  onde: string | null;
  por_que: string | null;
  data_inicial: string | null;
  ate_quando: string | null;
  como: string | null;
  quanto: string | null;
  selecionada: boolean;
  origem: "ia" | "manual";
  created_at: string;
  updated_at: string;
}

export type NovaAcaoPlano = Omit<
  AcaoPlanoPsicossocial,
  "id" | "tenant_id" | "created_at" | "updated_at"
> & { empresa_id?: string | null };

export function usePsicossocialPlanoAcao(campanhaIds: string[]) {
  const { tenantId, user } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const queryClient = useQueryClient();

  const idsKey = [...campanhaIds].sort().join(",");
  const queryKey = ["psicossocial-plano-acao", tenantId, empresaAtivaId, idsKey];

  const { data: acoes = [], isLoading, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<AcaoPlanoPsicossocial[]> => {
      if (!tenantId || campanhaIds.length === 0) return [];

      let query = fromTable("psicossocial_plano_acao")
        .select("*")
        .eq("tenant_id", tenantId)
        .overlaps("campanha_ids", campanhaIds)
        .order("created_at", { ascending: true });

      if (empresaAtivaId) query = query.eq("empresa_id", empresaAtivaId);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AcaoPlanoPsicossocial[];
    },
    enabled: !!tenantId && campanhaIds.length > 0,
  });

  // ── Criar em lote (saída da IA) ────────────────────────────────────────────
  const criarLoteMutation = useMutation({
    mutationFn: async (novas: NovaAcaoPlano[]) => {
      if (!tenantId) throw new Error("Sem tenant");
      if (novas.length === 0) return [];

      const payload = novas.map(a => ({
        ...a,
        tenant_id: tenantId,
        empresa_id: a.empresa_id ?? empresaAtivaId ?? null,
        criado_por: user?.id ?? null,
      }));

      const { data, error } = await fromTable("psicossocial_plano_acao")
        .insert(payload)
        .select();

      if (error) throw error;
      return (data || []) as AcaoPlanoPsicossocial[];
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Erro ao salvar as ações";
      toast.error(msg);
    },
  });

  // ── Atualizar uma ação (edição inline) ─────────────────────────────────────
  const atualizarMutation = useMutation({
    mutationFn: async ({ id, campos }: { id: string; campos: Partial<AcaoPlanoPsicossocial> }) => {
      const { error } = await fromTable("psicossocial_plano_acao")
        .update(campos)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Erro ao atualizar a ação";
      toast.error(msg);
    },
  });

  const excluirMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("psicossocial_plano_acao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Ação removida");
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Erro ao remover a ação";
      toast.error(msg);
    },
  });

  /** Remove todas as ações de um GHE dentro do recorte — usado ao regerar pela IA. */
  const limparGheMutation = useMutation({
    mutationFn: async (gheId: string | null) => {
      if (!tenantId) throw new Error("Sem tenant");
      let q = fromTable("psicossocial_plano_acao")
        .delete()
        .eq("tenant_id", tenantId)
        .overlaps("campanha_ids", campanhaIds);
      q = gheId === null ? q.is("ghe_id", null) : q.eq("ghe_id", gheId);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    acoes,
    isLoading,
    refetch,
    criarLote: criarLoteMutation.mutateAsync,
    criandoLote: criarLoteMutation.isPending,
    atualizar: atualizarMutation.mutate,
    excluir: excluirMutation.mutate,
    limparGhe: limparGheMutation.mutateAsync,
  };
}
