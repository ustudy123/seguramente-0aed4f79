import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
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
      const { data, error } = await fromTable("funcao_atividades")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("cargo_id", cargoId)
        .order("created_at") as { data: FuncaoAtividade[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!cargoId,
  });

  // Normalização de enums (frequencia/complexidade/classificacao). A IA de
  // importação devolve texto livre ("Crítica", "Quinzenal", "Muito alta");
  // as colunas são ENUMs do Postgres. Sem isto, um valor fora do enum faz o
  // INSERT falhar — e no lote tudo-ou-nada, uma linha derruba todas.
  const semAcento = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const normFrequencia = (v?: string): string => {
    const k = semAcento(v || "");
    if (["diaria", "diario", "diariamente"].includes(k)) return "diaria";
    if (["semanal", "semanalmente"].includes(k)) return "semanal";
    if (["mensal", "mensalmente", "quinzenal", "bimestral", "trimestral"].includes(k)) return "mensal";
    if (["eventual", "esporadica", "esporadico", "ocasional", "quando necessario", "sob demanda"].includes(k)) return "eventual";
    return ["diaria", "semanal", "mensal", "eventual"].includes(k) ? k : "diaria";
  };
  const normComplexidade = (v?: string): string => {
    const k = semAcento(v || "");
    if (["baixa", "baixo", "simples", "facil"].includes(k)) return "baixa";
    if (["alta", "alto", "muito alta", "muito alto", "complexa", "complexo", "dificil"].includes(k)) return "alta";
    if (["media", "medio", "moderada", "moderado", "intermediaria"].includes(k)) return "media";
    return ["baixa", "media", "alta"].includes(k) ? k : "media";
  };
  const normClassificacao = (v?: string): string => {
    const k = semAcento(v || "");
    if (["rotineira", "rotina", "rotineiro", "operacional"].includes(k)) return "rotineira";
    if (["critica", "critico", "essencial", "estrategica", "estrategico", "importante"].includes(k)) return "critica";
    if (["excepcional", "excecao", "extraordinaria", "extraordinario", "rara", "raro"].includes(k)) return "excepcional";
    return ["rotineira", "critica", "excepcional"].includes(k) ? k : "rotineira";
  };

  const criarAtividadeMut = useMutation({
    mutationFn: async (input: Partial<FuncaoAtividade> & { nome: string }) => {
      if (!tenantId || !cargoId) throw new Error("Sem contexto");
      const { frequencia, complexidade, classificacao, ...resto } = input;
      const { data, error } = await fromTable("funcao_atividades")
        .insert({
          tenant_id: tenantId,
          cargo_id: cargoId,
          ...resto,
          ...(frequencia !== undefined ? { frequencia: normFrequencia(frequencia as any) } : {}),
          ...(complexidade !== undefined ? { complexidade: normComplexidade(complexidade as any) } : {}),
          ...(classificacao !== undefined ? { classificacao: normClassificacao(classificacao as any) } : {}),
        } as any)
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

  // Importação em lote: um único INSERT com todas as atividades.
  // Antes, importar N atividades fazia N chamadas em série (for + await
  // criarAtividade), N refetch e N toasts — lento, e qualquer falha no meio
  // derrubava o restante ("Erro ao importar atividades" com 28+, ok com 4).
  //
  // frequencia/complexidade/classificacao são ENUMS do Postgres (valores
  // fixos). A IA extrai esses campos como texto e às vezes devolve algo fora
  // do enum — "Crítica" (com acento/maiúscula), "Quinzenal", "Muito alta" —
  // e o INSERT rejeita a linha. Como o lote é tudo-ou-nada, UMA linha
  // invalida derrubava as 21. Por isso normalizamos antes de gravar
  // (normFrequencia/normComplexidade/normClassificacao, no topo do hook).
  const criarAtividadesLoteMut = useMutation({
    mutationFn: async (itens: Array<Partial<FuncaoAtividade> & { nome: string }>) => {
      if (!tenantId || !cargoId) throw new Error("Sem contexto");
      if (!itens.length) return [];
      const linhas = itens.map((it) => ({
        tenant_id: tenantId,
        cargo_id: cargoId,
        nome: it.nome,
        descricao: (it as any).descricao ?? null,
        frequencia: normFrequencia(it.frequencia as any),
        complexidade: normComplexidade(it.complexidade as any),
        classificacao: normClassificacao(it.classificacao as any),
      }));
      const { data, error } = await fromTable("funcao_atividades")
        .insert(linhas as any)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["funcao_atividades", cargoId] });
      const n = Array.isArray(data) ? data.length : 0;
      toast.success(`${n} atividade(s) importada(s) com sucesso!`);
    },
    onError: (e: Error) => toast.error("Erro ao importar atividades: " + e.message),
  });

  const atualizarAtividadeMut = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FuncaoAtividade> & { id: string }) => {
      const { error } = await fromTable("funcao_atividades")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;

      // Se a descrição mudou, marcar POP vinculado como "desatualizado"
      if (updates.descricao !== undefined) {
        const { data: pops } = await fromTable("funcao_pops")
          .select("id, status")
          .eq("atividade_id", id)
          .neq("status", "desatualizado") as { data: Array<{ id: string; status: string }> | null };

        if (pops && pops.length > 0) {
          for (const pop of pops) {
            await fromTable("funcao_pops")
              .update({ status: "desatualizado" } as any)
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
      const { error } = await fromTable("funcao_atividades").delete().eq("id", id);
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
      const { data, error } = await fromTable("funcao_responsabilidades")
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
        const { error } = await fromTable("funcao_responsabilidades")
          .update({ ...input } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await fromTable("funcao_responsabilidades")
          .insert({ tenant_id: tenantId, ...input } as any);
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
      const { data, error } = await fromTable("funcao_conteudos")
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
      const { error } = await fromTable("funcao_conteudos")
        .insert({ tenant_id: tenantId, ...input } as any);
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
      const { error } = await fromTable("funcao_conteudos").delete().eq("id", id);
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
      const { data, error } = await fromTable("funcao_ferramentas")
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
      const { error } = await fromTable("funcao_ferramentas")
        .insert({ tenant_id: tenantId, ...input } as any);
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
      const { error } = await fromTable("funcao_ferramentas").delete().eq("id", id);
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
      const { data, error } = await fromTable("funcao_competencias")
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
      const { error } = await fromTable("funcao_competencias")
        .insert({ tenant_id: tenantId, cargo_id: cargoId, ...input } as any);
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
      const { error } = await fromTable("funcao_competencias")
        .update(updates as any)
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
      const { error } = await fromTable("funcao_competencias").delete().eq("id", id);
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
      const { data, error } = await fromTable("funcao_competencia_recursos")
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
      const { error } = await fromTable("funcao_competencia_recursos")
        .insert({ tenant_id: tenantId, ...input } as any);
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
      const { error } = await fromTable("funcao_competencia_recursos").delete().eq("id", id);
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
      const { data, error } = await fromTable("funcao_epi_vinculacoes")
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
      const { error } = await fromTable("funcao_epi_vinculacoes")
        .insert({ tenant_id: tenantId, cargo_id: cargoId, ...input } as any);
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
      const { error } = await fromTable("funcao_epi_vinculacoes").delete().eq("id", id);
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
      const { data, error } = await fromTable("funcao_epi_conteudos")
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
      const { error } = await fromTable("funcao_epi_conteudos")
        .insert({ tenant_id: tenantId, ...input } as any);
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
      const { error } = await fromTable("funcao_epi_conteudos").delete().eq("id", id);
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
      const { data, error } = await fromTable("funcao_epi_questionarios")
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
      const { error } = await fromTable("funcao_epi_questionarios")
        .insert({ tenant_id: tenantId, ...input } as any);
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
      const { error } = await fromTable("funcao_epi_questionarios").delete().eq("id", id);
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
      const { data, error } = await fromTable("funcao_treinamento_evidencias")
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
      const { data, error } = await fromTable("funcao_config")
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
        const { error } = await fromTable("funcao_config")
          .update(input as any)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await fromTable("funcao_config")
          .insert({ tenant_id: tenantId, ...input } as any);
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
      const { data, error } = await fromTable("funcao_treinamentos")
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
      const { error } = await fromTable("funcao_treinamentos")
        .insert({ tenant_id: tenantId, cargo_id: cargoId, ...input } as any);
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
      const { error } = await fromTable("funcao_treinamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funcao_treinamentos", cargoId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    atividades,
    loadingAtividades,
    criarAtividade: criarAtividadeMut.mutateAsync,
    criarAtividadesLote: criarAtividadesLoteMut.mutateAsync,
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
