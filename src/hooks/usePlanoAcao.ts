import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";
import type {
  PlanoAcao,
  PlanoTarefa,
  PlanoHistorico,
  PlanoComentario,
  PlanoEvidencia,
  PlanoParticipante,
  PlanoAcaoStats,
  PlanoAcaoFilters,
  CreatePlanoAcaoDTO,
  UpdatePlanoAcaoDTO,
  CreatePlanoTarefaDTO,
  UpdatePlanoTarefaDTO,
  AcaoStatus,
  TarefaStatus,
} from "@/types/planoAcao";

export function usePlanoAcao(filters?: PlanoAcaoFilters) {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { tenantId } = useTenant();
  const { empresaAtivaId } = useEmpresaAtiva();

  // ===================== QUERIES =====================

  // Lista de ações
  const {
    data: acoes = [],
    isLoading: isLoadingAcoes,
    refetch: refetchAcoes,
  } = useQuery({
    queryKey: ["plano-acoes", tenantId, filters, empresaAtivaId],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from("plano_acoes")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("pontuacao_gut", { ascending: false })
        .order("prazo", { ascending: true, nullsFirst: false });

      if (empresaAtivaId) query = query.or(`empresa_id.eq.${empresaAtivaId},empresa_id.is.null`);
      if (filters?.status?.length) {
        query = query.in("status", filters.status as any);
      }
      if (filters?.prioridade?.length) {
        query = query.in("prioridade", filters.prioridade as any);
      }
      if (filters?.origem_modulo?.length) {
        query = query.in("origem_modulo", filters.origem_modulo);
      }
      if (filters?.responsavel_id) {
        query = query.ilike("responsavel_nome", `%${filters.responsavel_id}%`);
      }
      if (filters?.prazo_inicio) {
        query = query.gte("prazo", filters.prazo_inicio);
      }
      if (filters?.prazo_fim) {
        query = query.lte("prazo", filters.prazo_fim);
      }
      if (filters?.busca) {
        query = query.or(
          `titulo.ilike.%${filters.busca}%,codigo.ilike.%${filters.busca}%,descricao.ilike.%${filters.busca}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []) as PlanoAcao[];
    },
    enabled: !!tenantId,
  });

  // Ação individual com relacionamentos
  const useAcao = (acaoId: string | undefined) =>
    useQuery({
      queryKey: ["plano-acao", acaoId],
      queryFn: async () => {
        if (!acaoId) return null;

        const { data, error } = await supabase
          .from("plano_acoes")
          .select("*")
          .eq("id", acaoId)
          .single();

        if (error) throw error;
        return data as PlanoAcao;
      },
      enabled: !!acaoId,
    });

  // Tarefas de uma ação
  const useTarefas = (acaoId: string | undefined) =>
    useQuery({
      queryKey: ["plano-tarefas", acaoId],
      queryFn: async () => {
        if (!acaoId) return [];

        const { data, error } = await supabase
          .from("plano_tarefas")
          .select("*")
          .eq("acao_id", acaoId)
          .order("ordem", { ascending: true });

        if (error) throw error;
        return data as PlanoTarefa[];
      },
      enabled: !!acaoId,
    });

  // Histórico de uma ação
  const useHistorico = (acaoId: string | undefined) =>
    useQuery({
      queryKey: ["plano-historico", acaoId],
      queryFn: async () => {
        if (!acaoId) return [];

        const { data, error } = await supabase
          .from("plano_historico")
          .select("*")
          .eq("acao_id", acaoId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return data as PlanoHistorico[];
      },
      enabled: !!acaoId,
    });

  // Comentários de uma ação
  const useComentarios = (acaoId: string | undefined) =>
    useQuery({
      queryKey: ["plano-comentarios", acaoId],
      queryFn: async () => {
        if (!acaoId) return [];

        const { data, error } = await supabase
          .from("plano_comentarios")
          .select("*")
          .eq("acao_id", acaoId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        return data as PlanoComentario[];
      },
      enabled: !!acaoId,
    });

  // Evidências de uma ação
  const useEvidencias = (acaoId: string | undefined) =>
    useQuery({
      queryKey: ["plano-evidencias", acaoId],
      queryFn: async () => {
        if (!acaoId) return [];

        const { data, error } = await supabase
          .from("plano_evidencias")
          .select("*")
          .eq("acao_id", acaoId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return data as PlanoEvidencia[];
      },
      enabled: !!acaoId,
    });

  // Participantes de uma ação
  const useParticipantes = (acaoId: string | undefined) =>
    useQuery({
      queryKey: ["plano-participantes", acaoId],
      queryFn: async () => {
        if (!acaoId) return [];

        const { data, error } = await supabase
          .from("plano_participantes")
          .select("*")
          .eq("acao_id", acaoId);

        if (error) throw error;
        return data as PlanoParticipante[];
      },
      enabled: !!acaoId,
    });

  // Estatísticas
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["plano-acoes-stats", tenantId, empresaAtivaId],
    queryFn: async (): Promise<PlanoAcaoStats> => {
      if (!tenantId) {
        return { total: 0, pendentes: 0, em_andamento: 0, atrasadas: 0, concluidas: 0, por_origem: {}, por_prioridade: { baixo: 0, medio: 0, urgente: 0, imediato: 0 } };
      }

      let statsQuery = supabase
        .from("plano_acoes")
        .select("status, origem_modulo, prioridade, prazo")
        .eq("tenant_id", tenantId);

      if (empresaAtivaId) statsQuery = statsQuery.eq("empresa_id", empresaAtivaId);

      const { data, error } = await statsQuery;

      if (error) throw error;
      
      const finalData = data || [];

      const result: PlanoAcaoStats = {
        total: finalData.length,
        pendentes: finalData.filter((a) => a.status === "pendente").length,
        em_andamento: finalData.filter((a) => a.status === "em_andamento").length,
        atrasadas: finalData.filter((a) => a.prazo && new Date(a.prazo) < new Date() && a.status !== "concluida").length,
        concluidas: finalData.filter((a) => a.status === "concluida").length,
        por_origem: { manual: 0, ergonomia: 0, ouvidoria: 0, epi: 0, ponto: 0, humor: 0 },
        por_prioridade: { baixo: 0, medio: 0, urgente: 0, imediato: 0 },
      };

      finalData.forEach((a) => {
        if (a.origem_modulo && result.por_origem[a.origem_modulo as keyof typeof result.por_origem] !== undefined) {
          result.por_origem[a.origem_modulo as keyof typeof result.por_origem]++;
        }
        if (a.prioridade && result.por_prioridade[a.prioridade as keyof typeof result.por_prioridade] !== undefined) {
          result.por_prioridade[a.prioridade as keyof typeof result.por_prioridade]++;
        }
      });

      return result;
    },
    enabled: !!tenantId,
  });

  // Minhas ações (inbox)
  const { data: minhasAcoes = [], isLoading: isLoadingMinhasAcoes } = useQuery({
    queryKey: ["plano-minhas-acoes", tenantId, user?.id, empresaAtivaId],
    queryFn: async () => {
      if (!tenantId || !user?.id) return [];

      // Ações onde sou responsável
      let respQuery = supabase
        .from("plano_acoes")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("responsavel_id", user.id)
        .neq("status", "concluida")
        .order("pontuacao_gut", { ascending: false });

      if (empresaAtivaId) respQuery = respQuery.eq("empresa_id", empresaAtivaId);

      const { data: responsavel, error: errResp } = await respQuery;

      if (errResp) throw errResp;

      // Ações onde sou participante
      const { data: participante, error: errPart } = await supabase
        .from("plano_participantes")
        .select("acao_id")
        .eq("tenant_id", tenantId)
        .eq("usuario_id", user.id);

      if (errPart) throw errPart;

      const participanteIds = participante?.map((p) => p.acao_id) || [];

      if (participanteIds.length > 0) {
        let partQuery = supabase
          .from("plano_acoes")
          .select("*")
          .in("id", participanteIds)
          .neq("status", "concluida");

        if (empresaAtivaId) partQuery = partQuery.eq("empresa_id", empresaAtivaId);

        const { data: acoesParticipante, error: errAcoes } = await partQuery;

        if (errAcoes) throw errAcoes;

        // Merge sem duplicatas
        const merged = [...(responsavel || [])];
        acoesParticipante?.forEach((a) => {
          if (!merged.find((m) => m.id === a.id)) {
            merged.push(a);
          }
        });
        
        return merged as PlanoAcao[];
      }

      return (responsavel || []) as PlanoAcao[];
    },
    enabled: !!tenantId && !!user?.id,
  });

  // ===================== MUTATIONS =====================

  // Criar ação
  const createAcaoMutation = useMutation({
    mutationFn: async (data: CreatePlanoAcaoDTO) => {
      if (!tenantId) throw new Error("Tenant não encontrado");

      const userName = profile?.nome_completo || user?.email || "Usuário";

      const { data: created, error } = await supabase
        .from("plano_acoes")
        .insert({
          ...data,
          tenant_id: tenantId,
          empresa_id: empresaAtivaId || null,
          codigo: "",
          criado_por: user?.id,
          criado_por_nome: userName,
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar histórico
      await supabase.from("plano_historico").insert({
        tenant_id: tenantId,
        acao_id: created.id,
        tipo_evento: "criacao",
        descricao: `Ação "${created.titulo}" criada`,
        usuario_id: user?.id,
        usuario_nome: userName,
      });

      return created as PlanoAcao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-acoes"] });
      queryClient.invalidateQueries({ queryKey: ["plano-acoes-stats"] });
      queryClient.invalidateQueries({ queryKey: ["plano-minhas-acoes"] });
      toast.success("Ação criada com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao criar ação:", error);
      toast.error("Erro ao criar ação");
    },
  });

  // Atualizar ação
  const updateAcaoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdatePlanoAcaoDTO }) => {
      const userName = profile?.nome_completo || user?.email || "Usuário";
      
      const { data: updated, error } = await supabase
        .from("plano_acoes")
        .update(data as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Registrar histórico
      await (supabase.from("plano_historico") as any).insert({
        tenant_id: tenantId,
        acao_id: id,
        tipo_evento: "edicao",
        descricao: `Ação atualizada`,
        dados_novos: data as Record<string, unknown>,
        usuario_id: user?.id,
        usuario_nome: userName,
      });

      return updated as PlanoAcao;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["plano-acoes"] });
      queryClient.invalidateQueries({ queryKey: ["plano-acao", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["plano-acoes-stats"] });
      toast.success("Ação atualizada!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar ação:", error);
      toast.error("Erro ao atualizar ação");
    },
  });

  // Deletar ação
  const deleteAcaoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plano_acoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-acoes"] });
      queryClient.invalidateQueries({ queryKey: ["plano-acoes-stats"] });
      toast.success("Ação excluída!");
    },
    onError: (error) => {
      console.error("Erro ao excluir ação:", error);
      toast.error("Erro ao excluir ação");
    },
  });

  // Criar tarefa
  const createTarefaMutation = useMutation({
    mutationFn: async (data: CreatePlanoTarefaDTO) => {
      if (!tenantId) throw new Error("Tenant não encontrado");

      const userName = profile?.nome_completo || user?.email || "Usuário";

      const { data: created, error } = await supabase
        .from("plano_tarefas")
        .insert({
          ...data,
          tenant_id: tenantId,
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar histórico
      await supabase.from("plano_historico").insert({
        tenant_id: tenantId,
        acao_id: data.acao_id,
        tarefa_id: created.id,
        tipo_evento: "criacao",
        descricao: `Tarefa "${created.titulo}" adicionada`,
        usuario_id: user?.id,
        usuario_nome: userName,
      });

      return created as PlanoTarefa;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["plano-tarefas", variables.acao_id] });
      queryClient.invalidateQueries({ queryKey: ["plano-acao", variables.acao_id] });
      queryClient.invalidateQueries({ queryKey: ["plano-historico", variables.acao_id] });
      toast.success("Tarefa adicionada!");
    },
    onError: (error) => {
      console.error("Erro ao criar tarefa:", error);
      toast.error("Erro ao criar tarefa");
    },
  });

  // Atualizar tarefa
  const updateTarefaMutation = useMutation({
    mutationFn: async ({ id, acaoId, data }: { id: string; acaoId: string; data: UpdatePlanoTarefaDTO }) => {
      const userName = profile?.nome_completo || user?.email || "Usuário";
      
      const updateData: Record<string, unknown> = { ...data };
      
      // Se está sendo concluída, registrar quem concluiu
      if (data.status === "concluida") {
        updateData.data_conclusao = new Date().toISOString();
        updateData.concluida_por = user?.id;
        updateData.concluida_por_nome = userName;
      }

      const { data: updated, error } = await supabase
        .from("plano_tarefas")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Registrar histórico se status mudou
      if (data.status) {
        await supabase.from("plano_historico").insert({
          tenant_id: tenantId,
          acao_id: acaoId,
          tarefa_id: id,
          tipo_evento: data.status === "concluida" ? "tarefa_concluida" : "status_alterado",
          descricao: data.status === "concluida" 
            ? `Tarefa "${updated.titulo}" concluída` 
            : `Status da tarefa "${updated.titulo}" alterado para ${data.status}`,
          usuario_id: user?.id,
          usuario_nome: userName,
        });
      }

      return updated as PlanoTarefa;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["plano-tarefas", variables.acaoId] });
      queryClient.invalidateQueries({ queryKey: ["plano-acao", variables.acaoId] });
      queryClient.invalidateQueries({ queryKey: ["plano-acoes"] });
      queryClient.invalidateQueries({ queryKey: ["plano-historico", variables.acaoId] });
      toast.success("Tarefa atualizada!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar tarefa:", error);
      toast.error("Erro ao atualizar tarefa");
    },
  });

  // Deletar tarefa
  const deleteTarefaMutation = useMutation({
    mutationFn: async ({ id, acaoId }: { id: string; acaoId: string }) => {
      const { error } = await supabase.from("plano_tarefas").delete().eq("id", id);
      if (error) throw error;
      return { acaoId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["plano-tarefas", data.acaoId] });
      queryClient.invalidateQueries({ queryKey: ["plano-acao", data.acaoId] });
      toast.success("Tarefa removida!");
    },
    onError: (error) => {
      console.error("Erro ao excluir tarefa:", error);
      toast.error("Erro ao excluir tarefa");
    },
  });

  // Adicionar comentário
  const createComentarioMutation = useMutation({
    mutationFn: async ({ acaoId, conteudo, tarefaId }: { acaoId: string; conteudo: string; tarefaId?: string }) => {
      if (!tenantId || !user?.id) throw new Error("Usuário não autenticado");

      const userName = profile?.nome_completo || user.email || "Usuário";

      const { data: created, error } = await supabase
        .from("plano_comentarios")
        .insert({
          tenant_id: tenantId,
          acao_id: acaoId,
          tarefa_id: tarefaId,
          conteudo,
          autor_id: user.id,
          autor_nome: userName,
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar histórico
      await supabase.from("plano_historico").insert({
        tenant_id: tenantId,
        acao_id: acaoId,
        tarefa_id: tarefaId,
        tipo_evento: "comentario",
        descricao: `Comentário adicionado`,
        usuario_id: user.id,
        usuario_nome: userName,
      });

      return created as PlanoComentario;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["plano-comentarios", variables.acaoId] });
      queryClient.invalidateQueries({ queryKey: ["plano-historico", variables.acaoId] });
      toast.success("Comentário adicionado!");
    },
    onError: (error) => {
      console.error("Erro ao adicionar comentário:", error);
      toast.error("Erro ao adicionar comentário");
    },
  });

  return {
    // Queries
    acoes,
    isLoadingAcoes,
    refetchAcoes,
    stats,
    isLoadingStats,
    minhasAcoes,
    isLoadingMinhasAcoes,
    
    // Hooks para uso individual
    useAcao,
    useTarefas,
    useHistorico,
    useComentarios,
    useEvidencias,
    useParticipantes,
    
    // Mutations
    createAcao: createAcaoMutation.mutateAsync,
    isCreatingAcao: createAcaoMutation.isPending,
    updateAcao: updateAcaoMutation.mutateAsync,
    isUpdatingAcao: updateAcaoMutation.isPending,
    deleteAcao: deleteAcaoMutation.mutateAsync,
    isDeletingAcao: deleteAcaoMutation.isPending,
    
    createTarefa: createTarefaMutation.mutateAsync,
    isCreatingTarefa: createTarefaMutation.isPending,
    updateTarefa: updateTarefaMutation.mutateAsync,
    isUpdatingTarefa: updateTarefaMutation.isPending,
    deleteTarefa: deleteTarefaMutation.mutateAsync,
    isDeletingTarefa: deleteTarefaMutation.isPending,
    
    createComentario: createComentarioMutation.mutateAsync,
    isCreatingComentario: createComentarioMutation.isPending,
  };
}
