import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import type {
  MetaAEM,
  MetaAEMInsert,
  MetaAcao,
  MetaAcaoInsert,
  MetaAcaoTempo,
  MetaHistorico,
  TempoTipo,
  AcaoStatus,
} from "@/types/mea";

export function useMetasErgonomicas(metaId?: string) {
  const { tenantId, user, profile } = useAuth();
  const queryClient = useQueryClient();

  // =============================================
  // AEM
  // =============================================

  const { data: aem, isLoading: isLoadingAem } = useQuery({
    queryKey: ["meta-aem", metaId],
    queryFn: async (): Promise<MetaAEM | null> => {
      if (!metaId || !tenantId) return null;
      const { data, error } = await supabase
        .from("meta_aem")
        .select("*")
        .eq("meta_id", metaId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data as MetaAEM | null;
    },
    enabled: !!metaId && !!tenantId,
  });

  const upsertAemMutation = useMutation({
    mutationFn: async (data: MetaAEMInsert) => {
      if (!tenantId) throw new Error("Tenant não encontrado");

      // Check if exists
      const { data: existing } = await supabase
        .from("meta_aem")
        .select("id")
        .eq("meta_id", data.meta_id)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("meta_aem")
          .update({
            ...data,
            preenchido_por: user?.id,
            preenchido_por_nome: profile?.nome_completo,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("meta_aem")
          .insert({
            ...data,
            tenant_id: tenantId,
            preenchido_por: user?.id,
            preenchido_por_nome: profile?.nome_completo,
          });
        if (error) throw error;
      }

      // Registrar histórico
      await supabase.from("meta_historico").insert({
        meta_id: data.meta_id,
        tenant_id: tenantId,
        tipo: existing ? "aem_revisada" : "aem_preenchida",
        descricao: existing ? "Análise Ergonômica atualizada" : "Análise Ergonômica preenchida",
        usuario_id: user?.id,
        usuario_nome: profile?.nome_completo,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-aem"] });
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      toast.success("Análise Ergonômica salva!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  // =============================================
  // AÇÕES
  // =============================================

  const { data: acoes = [], isLoading: isLoadingAcoes } = useQuery({
    queryKey: ["meta-acoes", metaId],
    queryFn: async (): Promise<MetaAcao[]> => {
      if (!metaId || !tenantId) return [];
      const { data, error } = await supabase
        .from("meta_acoes")
        .select("*")
        .eq("meta_id", metaId)
        .eq("tenant_id", tenantId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as MetaAcao[];
    },
    enabled: !!metaId && !!tenantId,
  });

  const createAcaoMutation = useMutation({
    mutationFn: async (data: MetaAcaoInsert) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const { error } = await supabase.from("meta_acoes").insert({
        ...data,
        tenant_id: tenantId,
      });
      if (error) throw error;

      await supabase.from("meta_historico").insert({
        meta_id: data.meta_id,
        tenant_id: tenantId,
        tipo: "acao_criada",
        descricao: `Ação criada: ${data.descricao}`,
        usuario_id: user?.id,
        usuario_nome: profile?.nome_completo,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-acoes"] });
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      toast.success("Ação criada!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const updateAcaoStatusMutation = useMutation({
    mutationFn: async ({ id, status, metaId: mId }: { id: string; status: AcaoStatus; metaId: string }) => {
      const { error } = await supabase
        .from("meta_acoes")
        .update({ status, progresso: status === "concluida" ? 100 : status === "em_andamento" ? 50 : 0 })
        .eq("id", id);
      if (error) throw error;

      await supabase.from("meta_historico").insert({
        meta_id: mId,
        tenant_id: tenantId!,
        tipo: "execucao",
        descricao: `Ação atualizada para: ${status}`,
        usuario_id: user?.id,
        usuario_nome: profile?.nome_completo,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-acoes"] });
      queryClient.invalidateQueries({ queryKey: ["metas"] });
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const deleteAcaoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meta_acoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-acoes"] });
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      toast.success("Ação excluída!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  // =============================================
  // TEMPO
  // =============================================

  const registrarTempoMutation = useMutation({
    mutationFn: async ({ acaoId, metaId: mId, tipo, observacao }: { acaoId: string; metaId: string; tipo: TempoTipo; observacao?: string }) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const { error } = await supabase.from("meta_acao_tempo").insert({
        acao_id: acaoId,
        meta_id: mId,
        tenant_id: tenantId,
        tipo,
        registrado_por: user?.id,
        registrado_por_nome: profile?.nome_completo,
        observacao,
      });
      if (error) throw error;

      // Update action status based on time event
      if (tipo === "inicio" || tipo === "retomada") {
        await supabase.from("meta_acoes").update({ status: "em_andamento" }).eq("id", acaoId);
      } else if (tipo === "encerramento") {
        await supabase.from("meta_acoes").update({ status: "concluida", progresso: 100 }).eq("id", acaoId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-acoes"] });
      queryClient.invalidateQueries({ queryKey: ["meta-tempo"] });
      queryClient.invalidateQueries({ queryKey: ["metas"] });
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const getTempoByAcao = async (acaoId: string): Promise<MetaAcaoTempo[]> => {
    const { data, error } = await supabase
      .from("meta_acao_tempo")
      .select("*")
      .eq("acao_id", acaoId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []) as MetaAcaoTempo[];
  };

  // =============================================
  // HISTÓRICO
  // =============================================

  const { data: historico = [], isLoading: isLoadingHistorico } = useQuery({
    queryKey: ["meta-historico", metaId],
    queryFn: async (): Promise<MetaHistorico[]> => {
      if (!metaId || !tenantId) return [];
      const { data, error } = await supabase
        .from("meta_historico")
        .select("*")
        .eq("meta_id", metaId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as MetaHistorico[];
    },
    enabled: !!metaId && !!tenantId,
  });

  return {
    // AEM
    aem,
    isLoadingAem,
    upsertAem: upsertAemMutation.mutateAsync,
    isSavingAem: upsertAemMutation.isPending,

    // Ações
    acoes,
    isLoadingAcoes,
    createAcao: createAcaoMutation.mutateAsync,
    updateAcaoStatus: updateAcaoStatusMutation.mutateAsync,
    deleteAcao: deleteAcaoMutation.mutateAsync,

    // Tempo
    registrarTempo: registrarTempoMutation.mutateAsync,
    getTempoByAcao,

    // Histórico
    historico,
    isLoadingHistorico,
  };
}
