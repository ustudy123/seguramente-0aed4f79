import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";
import type {
  MetaCompleta,
  MetaNivel,
  MetaCheckin,
  MetaEvidencia,
  MetaParticipante,
  MetaWorkflowLog,
  MetaConfiguracao,
  MetaIndicadorConfig,
  MetaWorkflowStatus,
} from "@/types/metas-module";

function normalizeParticipantes(participantes: Partial<MetaParticipante>[] = []): Partial<MetaParticipante>[] {
  const seen = new Set<string>();

  return participantes
    .filter((participante) => participante.participante_id && participante.participante_nome)
    .filter((participante) => {
      if (seen.has(participante.participante_id!)) return false;
      seen.add(participante.participante_id!);
      return true;
    })
    .map((participante) => ({
      participante_id: participante.participante_id,
      participante_nome: participante.participante_nome,
      papel: participante.papel || "co_responsavel",
      peso: typeof participante.peso === "number" ? participante.peso : 1,
    }));
}

export function useMetasModule(filtroNivel?: MetaNivel) {
  const { tenantId, user, profile } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const qc = useQueryClient();

  const syncParticipantes = async (metaId: string, participantes?: Partial<MetaParticipante>[]) => {
    if (!tenantId || participantes === undefined) return;

    const participantesNormalizados = normalizeParticipantes(participantes);

    const { error: deleteError } = await supabase
      .from("metas_participantes")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("meta_id", metaId);

    if (deleteError) throw deleteError;

    if (participantesNormalizados.length === 0) return;

    const { error: insertError } = await supabase.from("metas_participantes").insert(
      participantesNormalizados.map((participante) => ({
        tenant_id: tenantId,
        meta_id: metaId,
        participante_id: participante.participante_id!,
        participante_nome: participante.participante_nome!,
        papel: participante.papel || "co_responsavel",
        peso: typeof participante.peso === "number" ? participante.peso : 1,
      })),
    );

    if (insertError) throw insertError;
  };

  // =============================================
  // METAS
  // =============================================
  const { data: metas = [], isLoading } = useQuery({
    queryKey: ["metas-module", tenantId, empresaAtivaId, filtroNivel],
    queryFn: async (): Promise<MetaCompleta[]> => {
      if (!tenantId) return [];
      let q = supabase
        .from("metas")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (empresaAtivaId) q = q.eq("empresa_id", empresaAtivaId);
      if (filtroNivel) q = q.eq("nivel", filtroNivel);

      const { data, error } = await q;
      if (error) throw error;

      const metasData = (data || []) as unknown as MetaCompleta[];
      if (metasData.length === 0) return [];

      const { data: participantesData, error: participantesError } = await supabase
        .from("metas_participantes")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("meta_id", metasData.map((meta) => meta.id))
        .order("created_at", { ascending: true });

      if (participantesError) throw participantesError;

      const participantesByMeta = new Map<string, MetaParticipante[]>();
      for (const participante of (participantesData || []) as MetaParticipante[]) {
        const current = participantesByMeta.get(participante.meta_id) || [];
        current.push(participante);
        participantesByMeta.set(participante.meta_id, current);
      }

      return metasData.map((meta) => ({
        ...meta,
        compartilhada: meta.compartilhada ?? Boolean(participantesByMeta.get(meta.id)?.length),
        participantes: participantesByMeta.get(meta.id) || [],
      }));
    },
    enabled: !!tenantId,
  });

  // Criar meta
  const createMeta = useMutation({
    mutationFn: async (data: Partial<MetaCompleta>) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const participantes = normalizeParticipantes(data.participantes || []);
      const insertData = {
        ...data,
        compartilhada: data.compartilhada ?? participantes.length > 0,
        tenant_id: tenantId,
        empresa_id: empresaAtivaId || null,
        criado_por: user?.id,
        criado_por_nome: profile?.nome_completo,
      };
      delete (insertData as any).id;
      delete (insertData as any).created_at;
      delete (insertData as any).updated_at;
      delete (insertData as any).okrs;
      delete (insertData as any).checkins;
      delete (insertData as any).evidencias;
      delete (insertData as any).participantes;
      delete (insertData as any).meta_pai;
      delete (insertData as any).metas_filhas;

      const { data: newMeta, error } = await supabase
        .from("metas")
        .insert(insertData as any)
        .select()
        .single();
      if (error) throw error;

      await syncParticipantes(newMeta.id, participantes);

      // Registrar no workflow
      await supabase.from("metas_workflow_log").insert({
        tenant_id: tenantId,
        meta_id: newMeta.id,
        status_novo: "rascunho",
        acao: "criacao",
        usuario_id: user?.id,
        usuario_nome: profile?.nome_completo,
      });

      return newMeta;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["metas-module"] });
      toast.success("Meta criada com sucesso!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  // Atualizar meta
  const updateMeta = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<MetaCompleta>) => {
      const participantes = data.participantes;
      const updatePayload = {
        ...data,
        ...(Array.isArray(participantes)
          ? { compartilhada: data.compartilhada ?? participantes.length > 0 }
          : {}),
      };

      delete (updatePayload as any).participantes;
      delete (data as any).created_at;
      delete (data as any).updated_at;
      delete (data as any).okrs;
      delete (data as any).checkins;
      delete (data as any).evidencias;
      delete (updatePayload as any).created_at;
      delete (updatePayload as any).updated_at;
      delete (updatePayload as any).okrs;
      delete (updatePayload as any).checkins;
      delete (updatePayload as any).evidencias;
      delete (updatePayload as any).meta_pai;
      delete (updatePayload as any).metas_filhas;
      delete (updatePayload as any).tenant_id;

      const { error } = await supabase.from("metas").update(updatePayload as any).eq("id", id);
      if (error) throw error;

      if (participantes !== undefined) {
        await syncParticipantes(id, participantes);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["metas-module"] });
      toast.success("Meta atualizada!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  // Excluir meta
  const deleteMeta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("metas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["metas-module"] });
      toast.success("Meta excluída!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  // Alterar workflow status
  const alterarWorkflow = useMutation({
    mutationFn: async ({ id, novoStatus, justificativa }: { id: string; novoStatus: MetaWorkflowStatus; justificativa?: string }) => {
      const meta = metas.find(m => m.id === id);
      const { error: updErr } = await supabase
        .from("metas")
        .update({ workflow_status: novoStatus })
        .eq("id", id);
      if (updErr) throw updErr;

      await supabase.from("metas_workflow_log").insert({
        tenant_id: tenantId!,
        meta_id: id,
        status_anterior: meta?.workflow_status || "rascunho",
        status_novo: novoStatus,
        acao: "transicao",
        justificativa,
        usuario_id: user?.id,
        usuario_nome: profile?.nome_completo,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["metas-module"] });
      toast.success("Status atualizado!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  // =============================================
  // CHECK-INS
  // =============================================
  const criarCheckin = useMutation({
    mutationFn: async (data: { meta_id: string; valor_novo?: number; progresso_novo: number; observacao?: string; bloqueios?: string }) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const meta = metas.find(m => m.id === data.meta_id);

      await supabase.from("metas_checkins").insert({
        tenant_id: tenantId,
        meta_id: data.meta_id,
        valor_anterior: meta?.valor_atual,
        valor_novo: data.valor_novo,
        progresso_anterior: meta?.progresso,
        progresso_novo: data.progresso_novo,
        observacao: data.observacao,
        bloqueios: data.bloqueios,
        realizado_por: user?.id,
        realizado_por_nome: profile?.nome_completo,
      });

      // Atualizar meta
      await supabase.from("metas").update({
        valor_atual: data.valor_novo ?? meta?.valor_atual,
        progresso: data.progresso_novo,
        status: data.progresso_novo >= 100 ? "concluida" : data.progresso_novo > 0 ? "em_andamento" : "nao_iniciada",
      }).eq("id", data.meta_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["metas-module"] });
      toast.success("Check-in registrado!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  // =============================================
  // EVIDÊNCIAS
  // =============================================
  const criarEvidencia = useMutation({
    mutationFn: async (data: Partial<MetaEvidencia> & { meta_id: string }) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const { error } = await supabase.from("metas_evidencias").insert({
        ...data,
        tenant_id: tenantId,
        criado_por: user?.id,
        criado_por_nome: profile?.nome_completo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["metas-module"] });
      toast.success("Evidência adicionada!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  // =============================================
  // CONFIGURAÇÃO
  // =============================================
  const { data: configuracao } = useQuery({
    queryKey: ["metas-config", tenantId],
    queryFn: async (): Promise<MetaConfiguracao | null> => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("metas_configuracao")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data as MetaConfiguracao | null;
    },
    enabled: !!tenantId,
  });

  const salvarConfig = useMutation({
    mutationFn: async (data: Partial<MetaConfiguracao>) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const { data: existing } = await supabase
        .from("metas_configuracao")
        .select("id")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("metas_configuracao")
          .update(data as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("metas_configuracao")
          .insert({ ...data, tenant_id: tenantId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["metas-config"] });
      toast.success("Configuração salva!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  // =============================================
  // DESDOBRAMENTO COM IA
  // =============================================
  const desdobrarMeta = useMutation({
    mutationFn: async ({ metaId, nivelDestino }: { metaId: string; nivelDestino: MetaNivel }) => {
      const meta = metas.find(m => m.id === metaId);
      if (!meta) throw new Error("Meta não encontrada");

      const { data, error } = await supabase.functions.invoke("ai-metas", {
        body: {
          acao: "desdobrar",
          meta: { titulo: meta.titulo, descricao: meta.descricao, nivel: meta.nivel, objetivo_estrategico: meta.objetivo_estrategico },
          nivelDestino,
          tenantId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  // =============================================
  // ESTATÍSTICAS
  // =============================================
  const stats = {
    total: metas.length,
    ativas: metas.filter(m => m.workflow_status === "ativa").length,
    emAndamento: metas.filter(m => m.status === "em_andamento").length,
    concluidas: metas.filter(m => m.status === "concluida").length,
    atrasadas: metas.filter(m => m.status === "atrasada").length,
    emAprovacao: metas.filter(m => m.workflow_status === "em_aprovacao").length,
    progressoMedio: metas.length > 0
      ? Math.round(metas.reduce((a, m) => a + (m.progresso || 0), 0) / metas.length)
      : 0,
    porNivel: {
      estrategica: metas.filter(m => m.nivel === "estrategica").length,
      unidade: metas.filter(m => m.nivel === "unidade").length,
      setor: metas.filter(m => m.nivel === "setor").length,
      individual: metas.filter(m => m.nivel === "individual").length,
    },
    riscoAlto: metas.filter(m => m.risco_nivel === "alto" || m.risco_nivel === "critico").length,
  };

  return {
    metas,
    isLoading,
    createMeta: createMeta.mutateAsync,
    updateMeta: updateMeta.mutateAsync,
    deleteMeta: deleteMeta.mutateAsync,
    alterarWorkflow: alterarWorkflow.mutateAsync,
    criarCheckin: criarCheckin.mutateAsync,
    criarEvidencia: criarEvidencia.mutateAsync,
    desdobrarMeta: desdobrarMeta.mutateAsync,
    desdobramentoData: desdobrarMeta.data,
    isDesdobrando: desdobrarMeta.isPending,
    configuracao,
    salvarConfig: salvarConfig.mutateAsync,
    stats,
    isCreating: createMeta.isPending,
  };
}
