import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";
import type {
  AvaliacaoTemplate,
  AvaliacaoTemplateInsert,
  AvaliacaoCiclo,
  AvaliacaoCicloInsert,
  AvaliacaoResposta,
  AvaliacaoRespostaInsert,
  AvaliacaoRespostaUpdate,
  AvaliacaoFeedbackInsert,
  Avaliacao9Box,
  Avaliacao9BoxInsert,
  Config360,
  NotasCriterios,
  Categoria,
  Criterio,
  EscalaLabel,
} from "@/types/avaliacao";
import type { Json } from "@/integrations/supabase/types";

export function useAvaliacoes() {
  const { tenantId, user, profile } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const queryClient = useQueryClient();

  // =============================================
  // TEMPLATES
  // =============================================

  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["avaliacao-templates", tenantId],
    queryFn: async (): Promise<AvaliacaoTemplate[]> => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from("avaliacao_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("nome");
      
      if (error) throw error;
      
      return (data || []).map(t => ({
        ...t,
        categorias: (t.categorias as unknown as Categoria[]) || [],
        criterios: (t.criterios as unknown as Criterio[]) || [],
        escala_labels: (t.escala_labels as unknown as EscalaLabel[]) || undefined,
      }));
    },
    enabled: !!tenantId,
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: AvaliacaoTemplateInsert) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      
      const { error } = await supabase
        .from("avaliacao_templates")
        .insert({
          nome: data.nome,
          descricao: data.descricao,
          tipo: data.tipo,
          categorias: (data.categorias || []) as unknown as Json,
          criterios: (data.criterios || []) as unknown as Json,
          escala_min: data.escala_min,
          escala_max: data.escala_max,
          escala_labels: data.escala_labels as unknown as Json,
          permite_comentarios: data.permite_comentarios,
          ativo: data.ativo,
          tenant_id: tenantId,
          criado_por: user?.id,
          criado_por_nome: profile?.nome_completo,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avaliacao-templates"] });
      toast.success("Template criado com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao criar template: ${error.message}`);
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, ...data }: AvaliacaoTemplateInsert & { id: string }) => {
      const { error } = await supabase
        .from("avaliacao_templates")
        .update({
          nome: data.nome,
          descricao: data.descricao,
          tipo: data.tipo,
          categorias: (data.categorias || []) as unknown as Json,
          criterios: (data.criterios || []) as unknown as Json,
          escala_min: data.escala_min,
          escala_max: data.escala_max,
          escala_labels: data.escala_labels as unknown as Json,
          permite_comentarios: data.permite_comentarios,
          ativo: data.ativo,
        })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avaliacao-templates"] });
      toast.success("Template atualizado!");
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar template: ${error.message}`);
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("avaliacao_templates")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avaliacao-templates"] });
      toast.success("Template excluído!");
    },
    onError: (error) => {
      toast.error(`Erro ao excluir template: ${error.message}`);
    },
  });

  // =============================================
  // CICLOS
  // =============================================

  const { data: ciclos = [], isLoading: isLoadingCiclos } = useQuery({
    queryKey: ["avaliacao-ciclos", tenantId, empresaAtivaId],
    queryFn: async (): Promise<AvaliacaoCiclo[]> => {
      if (!tenantId) return [];
      
      let query = supabase
        .from("avaliacao_ciclos")
        .select(`
          *,
          template:avaliacao_templates(id, nome, tipo)
        `)
        .eq("tenant_id", tenantId);

      if (empresaAtivaId) {
        query = query.eq("empresa_id", empresaAtivaId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(c => ({
        ...c,
        config_360: (c.config_360 as unknown as Config360) || { auto: true, gestor: true, pares: 0, subordinados: false, cliente_interno: false },
        template: c.template as unknown as AvaliacaoTemplate,
      }));
    },
    enabled: !!tenantId,
  });

  const createCicloMutation = useMutation({
    mutationFn: async (data: AvaliacaoCicloInsert) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      
      const { error } = await supabase
        .from("avaliacao_ciclos")
        .insert({
          template_id: data.template_id,
          nome: data.nome,
          descricao: data.descricao,
          status: data.status,
          data_inicio: data.data_inicio,
          data_fim: data.data_fim,
          config_360: (data.config_360 || { auto: true, gestor: true, pares: 0, subordinados: false }) as unknown as Json,
          departamentos_ids: data.departamentos_ids,
          tenant_id: tenantId,
          empresa_id: empresaAtivaId || null,
          criado_por: user?.id,
          criado_por_nome: profile?.nome_completo,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avaliacao-ciclos"] });
      toast.success("Ciclo criado com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao criar ciclo: ${error.message}`);
    },
  });

  const updateCicloMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<AvaliacaoCicloInsert> & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      
      if (data.template_id !== undefined) updateData.template_id = data.template_id;
      if (data.nome !== undefined) updateData.nome = data.nome;
      if (data.descricao !== undefined) updateData.descricao = data.descricao;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.data_inicio !== undefined) updateData.data_inicio = data.data_inicio;
      if (data.data_fim !== undefined) updateData.data_fim = data.data_fim;
      if (data.config_360 !== undefined) updateData.config_360 = data.config_360 as unknown as Json;
      if (data.departamentos_ids !== undefined) updateData.departamentos_ids = data.departamentos_ids;
      
      const { error } = await supabase
        .from("avaliacao_ciclos")
        .update(updateData)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avaliacao-ciclos"] });
      toast.success("Ciclo atualizado!");
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar ciclo: ${error.message}`);
    },
  });

  const deleteCicloMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("avaliacao_ciclos")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avaliacao-ciclos"] });
      toast.success("Ciclo excluído!");
    },
    onError: (error) => {
      toast.error(`Erro ao excluir ciclo: ${error.message}`);
    },
  });

  // =============================================
  // RESPOSTAS
  // =============================================

  const { data: minhasAvaliacoes = [], isLoading: isLoadingMinhasAvaliacoes } = useQuery({
    queryKey: ["minhas-avaliacoes", tenantId, user?.id],
    queryFn: async (): Promise<AvaliacaoResposta[]> => {
      if (!tenantId || !user?.id) return [];
      
      const { data, error } = await supabase
        .from("avaliacao_respostas")
        .select(`
          *,
          ciclo:avaliacao_ciclos(id, nome, data_fim, status, template:avaliacao_templates(id, nome, tipo, criterios, categorias, escala_min, escala_max, escala_labels))
        `)
        .eq("tenant_id", tenantId)
        .eq("avaliador_id", user.id)
        .in("status", ["pendente", "em_andamento"])
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(r => ({
        ...r,
        notas_criterios: (r.notas_criterios as unknown as NotasCriterios) || {},
        ciclo: r.ciclo as unknown as AvaliacaoCiclo,
      }));
    },
    enabled: !!tenantId && !!user?.id,
  });

  const getRespostasByCiclo = async (cicloId: string): Promise<AvaliacaoResposta[]> => {
    const { data, error } = await supabase
      .from("avaliacao_respostas")
      .select("*")
      .eq("ciclo_id", cicloId)
      .order("avaliado_nome");
    
    if (error) throw error;
    
    return (data || []).map(r => ({
      ...r,
      notas_criterios: (r.notas_criterios as unknown as NotasCriterios) || {},
    }));
  };

  const createRespostaMutation = useMutation({
    mutationFn: async (data: AvaliacaoRespostaInsert) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      
      const { error } = await supabase
        .from("avaliacao_respostas")
        .insert({
          ciclo_id: data.ciclo_id,
          avaliado_id: data.avaliado_id,
          avaliado_nome: data.avaliado_nome,
          avaliador_id: data.avaliador_id || user?.id,
          avaliador_nome: data.avaliador_nome || profile?.nome_completo,
          tipo_avaliador: data.tipo_avaliador,
          status: data.status,
          notas_criterios: (data.notas_criterios || {}) as unknown as Json,
          nota_geral: data.nota_geral,
          comentario_geral: data.comentario_geral,
          pontos_fortes: data.pontos_fortes,
          areas_desenvolvimento: data.areas_desenvolvimento,
          tenant_id: tenantId,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avaliacao-respostas"] });
      queryClient.invalidateQueries({ queryKey: ["minhas-avaliacoes"] });
    },
  });

  const updateRespostaMutation = useMutation({
    mutationFn: async ({ id, ...data }: AvaliacaoRespostaUpdate & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      
      if (data.status !== undefined) updateData.status = data.status;
      if (data.notas_criterios !== undefined) updateData.notas_criterios = data.notas_criterios as unknown as Json;
      if (data.nota_geral !== undefined) updateData.nota_geral = data.nota_geral;
      if (data.comentario_geral !== undefined) updateData.comentario_geral = data.comentario_geral;
      if (data.pontos_fortes !== undefined) updateData.pontos_fortes = data.pontos_fortes;
      if (data.areas_desenvolvimento !== undefined) updateData.areas_desenvolvimento = data.areas_desenvolvimento;
      if (data.data_inicio !== undefined) updateData.data_inicio = data.data_inicio;
      if (data.data_conclusao !== undefined) updateData.data_conclusao = data.data_conclusao;
      
      const { error } = await supabase
        .from("avaliacao_respostas")
        .update(updateData)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avaliacao-respostas"] });
      queryClient.invalidateQueries({ queryKey: ["minhas-avaliacoes"] });
      toast.success("Avaliação salva!");
    },
    onError: (error) => {
      toast.error(`Erro ao salvar avaliação: ${error.message}`);
    },
  });

  const submitRespostaMutation = useMutation({
    mutationFn: async ({ id, ...data }: AvaliacaoRespostaUpdate & { id: string }) => {
      const { error } = await supabase
        .from("avaliacao_respostas")
        .update({
          notas_criterios: (data.notas_criterios || {}) as unknown as Json,
          nota_geral: data.nota_geral,
          comentario_geral: data.comentario_geral,
          pontos_fortes: data.pontos_fortes,
          areas_desenvolvimento: data.areas_desenvolvimento,
          status: "concluida",
          data_conclusao: new Date().toISOString(),
        })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avaliacao-respostas"] });
      queryClient.invalidateQueries({ queryKey: ["minhas-avaliacoes"] });
      toast.success("Avaliação enviada com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao enviar avaliação: ${error.message}`);
    },
  });

  // =============================================
  // FEEDBACKS
  // =============================================

  const createFeedbackMutation = useMutation({
    mutationFn: async (data: AvaliacaoFeedbackInsert) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      
      const { error } = await supabase
        .from("avaliacao_feedbacks")
        .insert({
          resposta_id: data.resposta_id,
          categoria: data.categoria,
          criterio: data.criterio,
          feedback: data.feedback,
          tenant_id: tenantId,
        });
      
      if (error) throw error;
    },
  });

  // =============================================
  // 9-BOX
  // =============================================

  const { data: nineBoxData = [], isLoading: isLoadingNineBox } = useQuery({
    queryKey: ["avaliacao-9box", tenantId],
    queryFn: async (): Promise<Avaliacao9Box[]> => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from("avaliacao_9box")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("data_avaliacao", { ascending: false });
      
      if (error) throw error;
      return (data || []) as Avaliacao9Box[];
    },
    enabled: !!tenantId,
  });

  const create9BoxMutation = useMutation({
    mutationFn: async (data: Avaliacao9BoxInsert) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      
      const { error } = await supabase
        .from("avaliacao_9box")
        .insert({
          ciclo_id: data.ciclo_id,
          colaborador_id: data.colaborador_id,
          colaborador_nome: data.colaborador_nome,
          desempenho: data.desempenho,
          potencial: data.potencial,
          quadrante: data.quadrante,
          justificativa: data.justificativa,
          tenant_id: tenantId,
          avaliador_id: user?.id,
          avaliador_nome: profile?.nome_completo,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avaliacao-9box"] });
      toast.success("Posicionamento 9-Box salvo!");
    },
    onError: (error) => {
      toast.error(`Erro ao salvar 9-Box: ${error.message}`);
    },
  });

  const update9BoxMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Avaliacao9BoxInsert> & { id: string }) => {
      const { error } = await supabase
        .from("avaliacao_9box")
        .update(data)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avaliacao-9box"] });
      toast.success("Posicionamento atualizado!");
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar 9-Box: ${error.message}`);
    },
  });

  // =============================================
  // ESTATÍSTICAS
  // =============================================

  const ciclosAtivos = ciclos.filter(c => c.status === "ativo").length;
  const avaliacoesPendentes = minhasAvaliacoes.length;
  const taxaConclusao = ciclos.length > 0
    ? Math.round((ciclos.filter(c => c.status === "encerrado").length / ciclos.length) * 100)
    : 0;

  return {
    // Templates
    templates,
    isLoadingTemplates,
    createTemplate: createTemplateMutation.mutateAsync,
    updateTemplate: updateTemplateMutation.mutateAsync,
    deleteTemplate: deleteTemplateMutation.mutateAsync,
    isCreatingTemplate: createTemplateMutation.isPending,
    
    // Ciclos
    ciclos,
    isLoadingCiclos,
    createCiclo: createCicloMutation.mutateAsync,
    updateCiclo: updateCicloMutation.mutateAsync,
    deleteCiclo: deleteCicloMutation.mutateAsync,
    isCreatingCiclo: createCicloMutation.isPending,
    
    // Respostas
    minhasAvaliacoes,
    isLoadingMinhasAvaliacoes,
    getRespostasByCiclo,
    createResposta: createRespostaMutation.mutateAsync,
    updateResposta: updateRespostaMutation.mutateAsync,
    submitResposta: submitRespostaMutation.mutateAsync,
    isSubmittingResposta: submitRespostaMutation.isPending,
    
    // Feedbacks
    createFeedback: createFeedbackMutation.mutateAsync,
    
    // 9-Box
    nineBoxData,
    isLoadingNineBox,
    create9Box: create9BoxMutation.mutateAsync,
    update9Box: update9BoxMutation.mutateAsync,
    
    // Estatísticas
    ciclosAtivos,
    avaliacoesPendentes,
    taxaConclusao,
  };
}
