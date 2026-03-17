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

  // ── Inativar risco ─────────────────────────────────────────────────────────
  // GAP-E1: Bloquear arquivamento de riscos Crítico/Alto sem ação vinculada
  const inativarRisco = useMutation({
    mutationFn: async (id: string) => {
      // Buscar o risco para checar nível e ação vinculada
      const { data: risco, error: errRisco } = await (supabase as any)
        .from("gro_riscos")
        .select("nivel_risco, acao_id, titulo")
        .eq("id", id)
        .single();
      if (errRisco) throw errRisco;

      const nivelNaoToleravel = ['critico', 'alto'].includes(risco?.nivel_risco);
      if (nivelNaoToleravel && !risco?.acao_id) {
        throw new Error(
          `Risco "${risco?.titulo}" é de nível ${risco?.nivel_risco?.toUpperCase()} e não possui ação corretiva vinculada. ` +
          `Para arquivá-lo, vincule primeiro um Plano de Ação (NR-01 / ISO 45003).`
        );
      }

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
    onError: (e: any) => toast.error(e.message, { duration: 7000 }),
  });

  // ── Importar do módulo psicossocial (campanha encerrada) ──────────────────
  // Gera 1 risco GRO por dimensão crítica por situação de trabalho (NR-17)
  const importarDaCampanha = useMutation({
    mutationFn: async ({
      campanhaId,
      campanhaName,
      dimensoes,
      empresaId,
      isSipro,
      situacoes,
    }: {
      campanhaId: string;
      campanhaName: string;
      dimensoes: { subject: string; value: number }[];
      empresaId?: string | null;
      isSipro: boolean;
      situacoes?: { setorId: string; setorNome: string; funcaoId: string; funcaoNome: string }[];
    }) => {
      if (!tenantId) throw new Error("Tenant não identificado");

      // Bloquear se campanha não tem vínculo de setor/função
      if (!situacoes || situacoes.length === 0) {
        throw new Error(
          "Esta campanha não possui situações de trabalho (Setor+Função) vinculadas. " +
          "Para exportar ao GRO com conformidade NR-17, edite a campanha e adicione pelo menos uma situação de trabalho."
        );
      }

      const { scoreToProbabilidade, scoreToSeveridade } = await import("@/types/gro");

      // Dimensões que configuram risco (≥35 no score de risco)
      const dimensoesCriticas = dimensoes.filter(d => {
        const risco = isSipro ? d.value : 100 - d.value;
        return risco >= 35;
      });

      if (dimensoesCriticas.length === 0) return 0;

      // Para cada situação de trabalho + cada dimensão crítica = 1 risco GRO
      const riscos = situacoes.flatMap(sit =>
        dimensoesCriticas.map(d => ({
          tenant_id: tenantId,
          empresa_id: empresaId ?? empresaAtivaId ?? null,
          subtipo: 'psicossocial' as const,
          fonte: 'psicossocial' as const,
          titulo: `${d.subject} — ${sit.funcaoNome} (${sit.setorNome})`,
          descricao: `Risco psicossocial identificado na campanha "${campanhaName}". Dimensão: ${d.subject}. Score: ${d.value}%. Situação de trabalho: ${sit.funcaoNome} no setor ${sit.setorNome}.`,
          dimensao_psicossocial: d.subject,
          score_dimensao: d.value,
          probabilidade: scoreToProbabilidade(d.value, isSipro),
          severidade: scoreToSeveridade(d.value, isSipro),
          campanha_id: campanhaId,
          setor: sit.setorNome,
          cargo: sit.funcaoNome,
          base_normativa: ['NR-01', 'NR-17', 'ISO 45003'],
          status_gro: 'identificado' as const,
          ativo: true,
        }))
      );

      const { error } = await (supabase as any)
        .from("gro_riscos")
        .insert(riscos);
      if (error) throw error;
      return riscos.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(`${count} risco(s) psicossocial(is) importado(s) para o GRO com vínculo NR-17!`);
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
