/**
 * Hook para gerenciar a entidade unificada de riscos GRO.
 * Suporta riscos Físicos (Ergonômicos) e Psicossociais num único inventário.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";
import type { GRORisco, NovoGRORisco, GRONivelRisco } from "@/types/gro";

export function useGRORiscos() {
  const { tenantId } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const queryClient = useQueryClient();

  const queryKey = ["gro-riscos", tenantId, empresaAtivaId];

  // ── Listar riscos ──────────────────────────────────────────────────────────
  const { data: riscos = [], isLoading, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<GRORisco[]> => {
      if (!tenantId) return [];
      let query = (supabase as any)
        .from("gro_riscos")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .order("created_at", { ascending: false });

      if (empresaAtivaId) {
        query = query.eq("empresa_id", empresaAtivaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as GRORisco[];
    },
    enabled: !!tenantId,
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total: riscos.length,
    criticos: riscos.filter(r => r.nivel_risco === 'critico').length,
    altos: riscos.filter(r => r.nivel_risco === 'alto').length,
    medios: riscos.filter(r => r.nivel_risco === 'medio').length,
    baixos: riscos.filter(r => r.nivel_risco === 'baixo').length,
    fisicos: riscos.filter(r => r.subtipo === 'fisico').length,
    psicossociais: riscos.filter(r => r.subtipo === 'psicossocial').length,
    naoToleraveis: riscos.filter(r => ['alto', 'critico'].includes(r.nivel_risco)).length,
  };

  // ── Criar risco ────────────────────────────────────────────────────────────
  const criarRisco = useMutation({
    mutationFn: async (dados: NovoGRORisco): Promise<GRORisco> => {
      if (!tenantId) throw new Error("Tenant não identificado");
      const { data, error } = await (supabase as any)
        .from("gro_riscos")
        .insert({
          ...dados,
          tenant_id: tenantId,
          empresa_id: dados.empresa_id ?? empresaAtivaId ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as GRORisco;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Risco registrado no GRO!");
    },
    onError: (e: any) => toast.error(`Erro ao registrar risco: ${e.message}`),
  });

  // ── Atualizar status GRO ───────────────────────────────────────────────────
  const atualizarStatusGRO = useMutation({
    mutationFn: async ({ id, status_gro }: { id: string; status_gro: GRORisco['status_gro'] }) => {
      const { error } = await (supabase as any)
        .from("gro_riscos")
        .update({ status_gro })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Status GRO atualizado!");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  // ── Vincular ação ─────────────────────────────────────────────────────────
  const vincularAcao = useMutation({
    mutationFn: async ({ id, acao_id }: { id: string; acao_id: string }) => {
      const { error } = await (supabase as any)
        .from("gro_riscos")
        .update({ acao_id, status_gro: 'avaliado' })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  // ── Inativar risco ────────────────────────────────────────────────────────
  const inativarRisco = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("gro_riscos")
        .update({ ativo: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Risco arquivado.");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  // ── Importar do módulo psicossocial (campanha encerrada) ──────────────────
  const importarDaCampanha = useMutation({
    mutationFn: async ({
      campanhaId,
      campanhaName,
      dimensoes,
      empresaId,
      isSipro,
    }: {
      campanhaId: string;
      campanhaName: string;
      dimensoes: { subject: string; value: number }[];
      empresaId?: string | null;
      isSipro: boolean;
    }) => {
      if (!tenantId) throw new Error("Tenant não identificado");

      const { scoreToProbabilidade, scoreToSeveridade } = await import("@/types/gro");

      const riscosDimensoes = dimensoes
        .filter(d => {
          const risco = isSipro ? d.value : 100 - d.value;
          return risco >= 35; // só importa riscos moderados ou acima
        })
        .map(d => ({
          tenant_id: tenantId,
          empresa_id: empresaId ?? empresaAtivaId ?? null,
          subtipo: 'psicossocial' as const,
          fonte: 'psicossocial' as const,
          titulo: `Risco Psicossocial — ${d.subject}`,
          descricao: `Risco identificado na campanha "${campanhaName}". Dimensão: ${d.subject}. Score: ${d.value}%.`,
          dimensao_psicossocial: d.subject,
          score_dimensao: d.value,
          probabilidade: scoreToProbabilidade(d.value, isSipro),
          severidade: scoreToSeveridade(d.value, isSipro),
          campanha_id: campanhaId,
          base_normativa: ['NR-01', 'ISO 45003'],
          status_gro: 'identificado' as const,
          ativo: true,
        }));

      if (riscosDimensoes.length === 0) return 0;

      const { error } = await (supabase as any)
        .from("gro_riscos")
        .insert(riscosDimensoes);
      if (error) throw error;
      return riscosDimensoes.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(`${count} risco(s) psicossocial(is) importado(s) para o GRO!`);
    },
    onError: (e: any) => toast.error(`Erro ao importar riscos: ${e.message}`),
  });

  return {
    riscos,
    isLoading,
    stats,
    refetch,
    criarRisco,
    atualizarStatusGRO,
    vincularAcao,
    inativarRisco,
    importarDaCampanha,
  };
}
