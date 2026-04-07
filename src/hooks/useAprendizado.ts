import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { handleMutationError } from "@/lib/toastError";
import type {
  FuncaoAtividade,
  FuncaoResponsabilidade,
  FuncaoConteudo,
  FuncaoFerramenta,
  FuncaoCompetencia,
  FuncaoCompetenciaRecurso,
  FuncaoEpiVinculacao,
  FuncaoEpiConteudo,
  FuncaoEpiQuestionario,
  FuncaoTreinamentoEvidencia,
  FuncaoConfig,
} from "@/types/aprendizado";

export function useAprendizado(cargoId?: string) {
  const { tenantId } = useAuth();
  const qc = useQueryClient();

  // ===== ATIVIDADES =====
  const { data: atividades = [], isLoading: loadingAtividades } = useQuery({
    queryKey: ["funcao_atividades", cargoId],
    queryFn: async (): Promise<FuncaoAtividade[]> => {
      if (!tenantId || !cargoId) return [];
      const { data, error } = await supabase
        .from("funcao_atividades" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("cargo_id", cargoId)
        .order("created_at") as { data: FuncaoAtividade[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!cargoId,
  });

  const criarAtividadeMut = useMutation({
    mutationFn: async (input: Partial<FuncaoAtividade> & { nome: string }) => {
      if (!tenantId || !cargoId) throw new Error("Sem contexto");
      const { data, error } = await supabase
        .from("funcao_atividades" as never)
        .insert({ tenant_id: tenantId, cargo_id: cargoId, ...input } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funcao_atividades", cargoId] });
      toast.success("Atividade criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizarAtividadeMut = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FuncaoAtividade> & { id: string }) => {
      const { error } = await supabase
        .from("funcao_atividades" as never)
        .update(updates as never)
        .eq("id", id);
      if (error) throw error;

      // Se a descrição mudou, marcar POP vinculado como "desatualizado"
      if (updates.descricao !== undefined) {
        const { data: pops } = await supabase
          .from("funcao_pops" as never)
          .select("id, status")
          .eq("atividade_id", id)
          .neq("status", "desatualizado") as { data: Array<{ id: string; status: string }> | null };

        if (pops && pops.length > 0) {
          for (const pop of pops) {
            await supabase
              .from("funcao_pops" as never)
              .update({ status: "desatualizado" } as never)
              .eq("id", pop.id);
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funcao_atividades", cargoId] });
      qc.invalidateQueries({ queryKey: ["funcao_pops", cargoId] });
      toast.success("Atividade atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirAtividadeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funcao_atividades" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funcao_atividades", cargoId] });
      toast.success("Atividade removida!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ===== RESPONSABILIDADES =====
  const { data: responsabilidades = [] } = useQuery({
    queryKey: ["funcao_responsabilidades", cargoId],
    queryFn: async (): Promise<FuncaoResponsabilidade[]> => {
      if (!tenantId || !cargoId) return [];
      const atividadeIds = atividades.map((a) => a.id);
      if (atividadeIds.length === 0) return [];
      const { data, error } = await supabase
        .from("funcao_responsabilidades" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .in("atividade_id", atividadeIds) as { data: FuncaoResponsabilidade[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && atividades.length > 0,
  });

  const salvarResponsabilidadeMut = useMutation({
    mutationFn: async (input: { atividade_id: string; responsavel_direto?: string; interfaces?: string; consequencia_erro?: string }) => {
      if (!tenantId) throw new Error("Sem contexto");
      const existing = responsabilidades.find((r) => r.atividade_id === input.atividade_id);
      if (existing) {
        const { error } = await supabase
          .from("funcao_responsabilidades" as never)
          .update({ ...input } as never)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("funcao_responsabilidades" as never)
          .insert({ tenant_id: tenantId, ...input } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funcao_responsabilidades", cargoId] });
      toast.success("Responsabilidades salvas!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ===== CONTEÚDOS =====
  const { data: conteudos = [] } = useQuery({
    queryKey: ["funcao_conteudos", cargoId],
    queryFn: async (): Promise<FuncaoConteudo[]> => {
      if (!tenantId || !cargoId) return [];
      const atividadeIds = atividades.map((a) => a.id);
      if (atividadeIds.length === 0) return [];
      const { data, error } = await supabase
        .from("funcao_conteudos" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .in("atividade_id", atividadeIds) as { data: FuncaoConteudo[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && atividades.length > 0,
  });

  const criarConteudoMut = useMutation({
    mutationFn: async (input: { atividade_id: string; tipo: string; titulo: string; url: string; descricao?: string }) => {
      if (!tenantId) throw new Error("Sem contexto");
      const { error } = await supabase
        .from("funcao_conteudos" as never)
        .insert({ tenant_id: tenantId, ...input } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funcao_conteudos", cargoId] });
      toast.success("Conteúdo adicionado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirConteudoMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funcao_conteudos" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funcao_conteudos", cargoId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // ===== FERRAMENTAS =====
  const { data: ferramentas = [] } = useQuery({
    queryKey: ["funcao_ferramentas", cargoId],
    queryFn: async (): Promise<FuncaoFerramenta[]> => {
      if (!tenantId || !cargoId) return [];
      const atividadeIds = atividades.map((a) => a.id);
      if (atividadeIds.length === 0) return [];
      const { data, error } = await supabase
        .from("funcao_ferramentas" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .in("atividade_id", atividadeIds) as { data: FuncaoFerramenta[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && atividades.length > 0,
  });

  const criarFerramentaMut = useMutation({
    mutationFn: async (input: { atividade_id: string; nome: string; tipo: string; url_manual?: string; descricao?: string }) => {
      if (!tenantId) throw new Error("Sem contexto");
      const { error } = await supabase
        .from("funcao_ferramentas" as never)
        .insert({ tenant_id: tenantId, ...input } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funcao_ferramentas", cargoId] });
      toast.success("Ferramenta adicionada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirFerramentaMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funcao_ferramentas" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funcao_ferramentas", cargoId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // ===== COMPETÊNCIAS =====
  const { data: competencias = [], isLoading: loadingCompetencias } = useQuery({
    queryKey: ["funcao_competencias", cargoId],
    queryFn: async (): Promise<FuncaoCompetencia[]> => {
      if (!tenantId || !cargoId) return [];
      const { data, error } = await supabase
        .from("funcao_competencias" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("cargo_id", cargoId)
        .order("tipo") as { data: FuncaoCompetencia[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!cargoId,
  });

  const criarCompetenciaMut = useMutation({
    mutationFn: async (input: { nome: string; tipo: string; descricao?: string }) => {
      if (!tenantId || !cargoId) throw new Error("Sem contexto");
      const { error } = await supabase
        .from("funcao_competencias" as never)
        .insert({ tenant_id: tenantId, cargo_id: cargoId, ...input } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funcao_competencias", cargoId] });
      toast.success("Competência adicionada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizarCompetenciaMut = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; nome?: string; tipo?: string; descricao?: string }) => {
      const { error } = await supabase
        .from("funcao_competencias" as never)
        .update(updates as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funcao_competencias", cargoId] });
      toast.success("Competência atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirCompetenciaMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funcao_competencias" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funcao_competencias", cargoId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // ===== COMPETÊNCIA RECURSOS =====
  const { data: competenciaRecursos = [] } = useQuery({
    queryKey: ["funcao_competencia_recursos", cargoId],
    queryFn: async (): Promise<FuncaoCompetenciaRecurso[]> => {
      if (!tenantId || competencias.length === 0) return [];
      const ids = competencias.map((c) => c.id);
      const { data, error } = await supabase
        .from("funcao_competencia_recursos" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .in("competencia_id", ids) as { data: FuncaoCompetenciaRecurso[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && competencias.length > 0,
  });

  const criarCompetenciaRecursoMut = useMutation({
    mutationFn: async (input: { competencia_id: string; tipo: string; titulo: string; url: string; descricao?: string }) => {
      if (!tenantId) throw new Error("Sem contexto");
      const { error } = await supabase
        .from("funcao_competencia_recursos" as never)
        .insert({ tenant_id: tenantId, ...input } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funcao_competencia_recursos", cargoId] });
      toast.success("Recurso adicionado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirCompetenciaRecursoMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funcao_competencia_recursos" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funcao_competencia_recursos", cargoId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // ===== EPI VINCULAÇÕES =====
  const { data: epiVinculacoes = [], isLoading: loadingEpis } = useQuery({
    queryKey: ["funcao_epi_vinculacoes", cargoId],
    queryFn: async (): Promise<FuncaoEpiVinculacao[]> => {
      if (!tenantId || !cargoId) return [];
      const { data, error } = await supabase
        .from("funcao_epi_vinculacoes" as never)
        .select("*, epi_tipos(nome, categoria)")
        .eq("tenant_id", tenantId)
        .eq("cargo_id", cargoId) as { data: any[] | null; error: Error | null };
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        epi_tipo_nome: d.epi_tipos?.nome,
        epi_tipo_categoria: d.epi_tipos?.categoria,
      }));
    },
    enabled: !!tenantId && !!cargoId,
  });

  const criarEpiVinculacaoMut = useMutation({
    mutationFn: async (input: { epi_tipo_id: string; obrigatoriedade: string }) => {
      if (!tenantId || !cargoId) throw new Error("Sem contexto");
      const { error } = await supabase
        .from("funcao_epi_vinculacoes" as never)
        .insert({ tenant_id: tenantId, cargo_id: cargoId, ...input } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funcao_epi_vinculacoes", cargoId] });
      toast.success("EPI vinculado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirEpiVinculacaoMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funcao_epi_vinculacoes" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funcao_epi_vinculacoes", cargoId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // ===== EPI CONTEÚDOS =====
  const { data: epiConteudos = [] } = useQuery({
    queryKey: ["funcao_epi_conteudos", cargoId],
    queryFn: async (): Promise<FuncaoEpiConteudo[]> => {
      if (!tenantId || epiVinculacoes.length === 0) return [];
      const ids = epiVinculacoes.map((v) => v.id);
      const { data, error } = await supabase
        .from("funcao_epi_conteudos" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .in("vinculacao_id", ids) as { data: FuncaoEpiConteudo[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && epiVinculacoes.length > 0,
  });

  const criarEpiConteudoMut = useMutation({
    mutationFn: async (input: { vinculacao_id: string; tipo: string; titulo: string; url: string; descricao?: string }) => {
      if (!tenantId) throw new Error("Sem contexto");
      const { error } = await supabase
        .from("funcao_epi_conteudos" as never)
        .insert({ tenant_id: tenantId, ...input } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funcao_epi_conteudos", cargoId] });
      toast.success("Conteúdo de EPI adicionado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirEpiConteudoMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funcao_epi_conteudos" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funcao_epi_conteudos", cargoId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // ===== EPI QUESTIONÁRIOS =====
  const { data: epiQuestionarios = [] } = useQuery({
    queryKey: ["funcao_epi_questionarios", cargoId],
    queryFn: async (): Promise<FuncaoEpiQuestionario[]> => {
      if (!tenantId || epiVinculacoes.length === 0) return [];
      const ids = epiVinculacoes.map((v) => v.id);
      const { data, error } = await supabase
        .from("funcao_epi_questionarios" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .in("vinculacao_id", ids)
        .order("ordem") as { data: FuncaoEpiQuestionario[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && epiVinculacoes.length > 0,
  });

  const criarEpiQuestionarioMut = useMutation({
    mutationFn: async (input: { vinculacao_id: string; pergunta: string; opcoes: string[]; resposta_correta: number; ordem?: number }) => {
      if (!tenantId) throw new Error("Sem contexto");
      const { error } = await supabase
        .from("funcao_epi_questionarios" as never)
        .insert({ tenant_id: tenantId, ...input } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funcao_epi_questionarios", cargoId] });
      toast.success("Pergunta adicionada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirEpiQuestionarioMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funcao_epi_questionarios" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funcao_epi_questionarios", cargoId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // ===== EVIDÊNCIAS =====
  const { data: evidencias = [] } = useQuery({
    queryKey: ["funcao_treinamento_evidencias", cargoId],
    queryFn: async (): Promise<FuncaoTreinamentoEvidencia[]> => {
      if (!tenantId || !cargoId) return [];
      const { data, error } = await supabase
        .from("funcao_treinamento_evidencias" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("cargo_id", cargoId)
        .order("created_at", { ascending: false }) as { data: FuncaoTreinamentoEvidencia[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!cargoId,
  });

  // ===== CONFIG =====
  const { data: config } = useQuery({
    queryKey: ["funcao_config", tenantId],
    queryFn: async (): Promise<FuncaoConfig | null> => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("funcao_config" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle() as { data: FuncaoConfig | null; error: Error | null };
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const salvarConfigMut = useMutation({
    mutationFn: async (input: Partial<FuncaoConfig>) => {
      if (!tenantId) throw new Error("Sem contexto");
      if (config) {
        const { error } = await supabase
          .from("funcao_config" as never)
          .update(input as never)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("funcao_config" as never)
          .insert({ tenant_id: tenantId, ...input } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funcao_config", tenantId] });
      toast.success("Configuração salva!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ===== TREINAMENTOS GERAIS DA FUNÇÃO =====
  const { data: treinamentos = [], isLoading: loadingTreinamentos } = useQuery({
    queryKey: ["funcao_treinamentos", cargoId],
    queryFn: async () => {
      if (!tenantId || !cargoId) return [];
      const { data, error } = await supabase
        .from("funcao_treinamentos" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("cargo_id", cargoId)
        .order("created_at") as { data: any[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!cargoId,
  });

  const criarTreinamentoMut = useMutation({
    mutationFn: async (input: { titulo: string; tipo: string; url: string; descricao?: string; obrigatorio?: boolean; carga_horaria_min?: number }) => {
      if (!tenantId || !cargoId) throw new Error("Sem contexto");
      const { error } = await supabase
        .from("funcao_treinamentos" as never)
        .insert({ tenant_id: tenantId, cargo_id: cargoId, ...input } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funcao_treinamentos", cargoId] });
      toast.success("Treinamento adicionado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirTreinamentoMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("funcao_treinamentos" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funcao_treinamentos", cargoId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    atividades,
    loadingAtividades,
    criarAtividade: criarAtividadeMut.mutateAsync,
    atualizarAtividade: atualizarAtividadeMut.mutateAsync,
    atualizandoAtividade: atualizarAtividadeMut.isPending,
    excluirAtividade: excluirAtividadeMut.mutateAsync,
    criandoAtividade: criarAtividadeMut.isPending,

    responsabilidades,
    salvarResponsabilidade: salvarResponsabilidadeMut.mutateAsync,

    conteudos,
    criarConteudo: criarConteudoMut.mutateAsync,
    excluirConteudo: excluirConteudoMut.mutateAsync,

    ferramentas,
    criarFerramenta: criarFerramentaMut.mutateAsync,
    excluirFerramenta: excluirFerramentaMut.mutateAsync,

    competencias,
    loadingCompetencias,
    criarCompetencia: criarCompetenciaMut.mutateAsync,
    atualizarCompetencia: atualizarCompetenciaMut.mutateAsync,
    excluirCompetencia: excluirCompetenciaMut.mutateAsync,

    competenciaRecursos,
    criarCompetenciaRecurso: criarCompetenciaRecursoMut.mutateAsync,
    excluirCompetenciaRecurso: excluirCompetenciaRecursoMut.mutateAsync,

    epiVinculacoes,
    loadingEpis,
    criarEpiVinculacao: criarEpiVinculacaoMut.mutateAsync,
    excluirEpiVinculacao: excluirEpiVinculacaoMut.mutateAsync,

    epiConteudos,
    criarEpiConteudo: criarEpiConteudoMut.mutateAsync,
    excluirEpiConteudo: excluirEpiConteudoMut.mutateAsync,

    epiQuestionarios,
    criarEpiQuestionario: criarEpiQuestionarioMut.mutateAsync,
    excluirEpiQuestionario: excluirEpiQuestionarioMut.mutateAsync,

    evidencias,

    treinamentos,
    loadingTreinamentos,
    criarTreinamento: criarTreinamentoMut.mutateAsync,
    excluirTreinamento: excluirTreinamentoMut.mutateAsync,

    config,
    salvarConfig: salvarConfigMut.mutateAsync,
  };
}
