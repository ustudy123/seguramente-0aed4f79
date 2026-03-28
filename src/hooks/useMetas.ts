import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";
import type {
  Meta,
  MetaInsert,
  MetaUpdate,
  MetaOkr,
  MetaOkrInsert,
  MetaOkrUpdate,
  OkrCheckin,
  OkrCheckinInsert,
  MetaStatus,
  MetaPeriodo,
  OkrTipo,
} from "@/types/avaliacao";

export function useMetas() {
  const { tenantId, user, profile } = useAuth();
  const queryClient = useQueryClient();

  // =============================================
  // METAS
  // =============================================

  const { data: metas = [], isLoading: isLoadingMetas } = useQuery({
    queryKey: ["metas", tenantId],
    queryFn: async (): Promise<Meta[]> => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from("metas")
        .select(`
          *,
          okrs:meta_okrs(*)
        `)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(m => ({
        ...m,
        periodo: m.periodo as MetaPeriodo,
        status: m.status as MetaStatus,
        okrs: (m.okrs || []).map((okr: Record<string, unknown>) => ({
          ...okr,
          tipo: okr.tipo as OkrTipo,
          status: okr.status as MetaStatus,
        })) as MetaOkr[],
      }));
    },
    enabled: !!tenantId,
  });

  const createMetaMutation = useMutation({
    mutationFn: async (data: MetaInsert) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      
      const insertData: Record<string, unknown> = {
          colaborador_id: data.colaborador_id,
          colaborador_nome: data.colaborador_nome,
          departamento_id: data.departamento_id,
          departamento_nome: data.departamento_nome,
          titulo: data.titulo,
          descricao: data.descricao,
          tipo: data.tipo,
          periodo: data.periodo,
          ano: data.ano,
          trimestre: data.trimestre,
          data_inicio: data.data_inicio,
          data_fim: data.data_fim,
          peso: data.peso,
          vinculo_ciclo_id: data.vinculo_ciclo_id,
          tenant_id: tenantId,
          criado_por: user?.id,
          criado_por_nome: profile?.nome_completo,
        };

      // MEA fields
      const meaFields = ['categoria_meta', 'origem_meta', 'premiacao_tipo', 'premiacao_descricao', 'premiacao_valor'];
      for (const f of meaFields) {
        if ((data as any)[f] !== undefined) {
          insertData[f] = (data as any)[f];
        }
      }

      const { data: newMeta, error } = await supabase
        .from("metas")
        .insert(insertData as any)
        .select()
        .single();
      
      if (error) throw error;
      return newMeta;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      toast.success("Meta criada com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao criar meta: ${error.message}`);
    },
  });

  const updateMetaMutation = useMutation({
    mutationFn: async ({ id, ...data }: MetaUpdate & { id: string }) => {
      const { error } = await supabase
        .from("metas")
        .update(data)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      toast.success("Meta atualizada!");
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar meta: ${error.message}`);
    },
  });

  const deleteMetaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("metas")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      toast.success("Meta excluída!");
    },
    onError: (error) => {
      toast.error(`Erro ao excluir meta: ${error.message}`);
    },
  });

  // =============================================
  // OKRs
  // =============================================

  const createOkrMutation = useMutation({
    mutationFn: async (data: MetaOkrInsert) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      
      const { error } = await supabase
        .from("meta_okrs")
        .insert({
          meta_id: data.meta_id,
          key_result: data.key_result,
          descricao: data.descricao,
          tipo: data.tipo,
          valor_inicial: data.valor_inicial,
          valor_atual: data.valor_atual,
          valor_alvo: data.valor_alvo,
          unidade: data.unidade,
          responsavel_id: data.responsavel_id,
          responsavel_nome: data.responsavel_nome,
          tenant_id: tenantId,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      toast.success("Resultado-Chave adicionado!");
    },
    onError: (error) => {
      toast.error(`Erro ao adicionar Resultado-Chave: ${error.message}`);
    },
  });

  const updateOkrMutation = useMutation({
    mutationFn: async ({ id, ...data }: MetaOkrUpdate & { id: string }) => {
      const { error } = await supabase
        .from("meta_okrs")
        .update(data)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      toast.success("Resultado-Chave atualizado!");
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar Resultado-Chave: ${error.message}`);
    },
  });

  const deleteOkrMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("meta_okrs")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      toast.success("Resultado-Chave excluído!");
    },
    onError: (error) => {
      toast.error(`Erro ao excluir Resultado-Chave: ${error.message}`);
    },
  });

  // =============================================
  // CHECK-INS
  // =============================================

  const createCheckinMutation = useMutation({
    mutationFn: async (data: OkrCheckinInsert) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      
      // Criar check-in
      const { error: checkinError } = await supabase
        .from("okr_checkins")
        .insert({
          okr_id: data.okr_id,
          valor_anterior: data.valor_anterior,
          valor_novo: data.valor_novo,
          observacao: data.observacao,
          tenant_id: tenantId,
          realizado_por: user?.id,
          realizado_por_nome: profile?.nome_completo,
        });
      
      if (checkinError) throw checkinError;
      
      // Atualizar valor atual do OKR
      const { data: okr, error: okrFetchError } = await supabase
        .from("meta_okrs")
        .select("valor_alvo, valor_inicial")
        .eq("id", data.okr_id)
        .single();
      
      if (okrFetchError) throw okrFetchError;
      
      // Calcular progresso
      const range = okr.valor_alvo - (okr.valor_inicial || 0);
      const progress = range > 0 
        ? Math.round(((data.valor_novo - (okr.valor_inicial || 0)) / range) * 100)
        : 0;
      
      const { error: okrUpdateError } = await supabase
        .from("meta_okrs")
        .update({
          valor_atual: data.valor_novo,
          progresso: Math.min(100, Math.max(0, progress)),
          status: progress >= 100 ? "concluida" : "em_andamento",
        })
        .eq("id", data.okr_id);
      
      if (okrUpdateError) throw okrUpdateError;
      
      // Recalcular progresso da meta
      await recalcularProgressoMeta(data.okr_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      toast.success("Check-in registrado!");
    },
    onError: (error) => {
      toast.error(`Erro ao registrar check-in: ${error.message}`);
    },
  });

  const recalcularProgressoMeta = async (okrId: string) => {
    // Buscar meta do OKR
    const { data: okr, error: okrError } = await supabase
      .from("meta_okrs")
      .select("meta_id")
      .eq("id", okrId)
      .single();
    
    if (okrError || !okr) return;
    
    // Buscar todos os OKRs da meta
    const { data: okrs, error: okrsError } = await supabase
      .from("meta_okrs")
      .select("progresso")
      .eq("meta_id", okr.meta_id);
    
    if (okrsError || !okrs || okrs.length === 0) return;
    
    // Calcular média de progresso
    const avgProgress = Math.round(
      okrs.reduce((acc, curr) => acc + (curr.progresso || 0), 0) / okrs.length
    );
    
    // Atualizar meta
    await supabase
      .from("metas")
      .update({
        progresso: avgProgress,
        status: avgProgress >= 100 ? "concluida" : avgProgress > 0 ? "em_andamento" : "nao_iniciada",
      })
      .eq("id", okr.meta_id);
  };

  const getCheckinsByOkr = async (okrId: string): Promise<OkrCheckin[]> => {
    const { data, error } = await supabase
      .from("okr_checkins")
      .select("*")
      .eq("okr_id", okrId)
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return (data || []) as OkrCheckin[];
  };

  // =============================================
  // ESTATÍSTICAS
  // =============================================

  const metasAtivas = metas.filter(m => m.status === "em_andamento").length;
  const metasConcluidas = metas.filter(m => m.status === "concluida").length;
  const metasAtrasadas = metas.filter(m => m.status === "atrasada").length;
  const progressoMedio = metas.length > 0
    ? Math.round(metas.reduce((acc, m) => acc + (m.progresso || 0), 0) / metas.length)
    : 0;

  // Metas por período
  const metasPorPeriodo = metas.reduce((acc, meta) => {
    const key = `${meta.periodo}-${meta.ano}${meta.trimestre ? `-Q${meta.trimestre}` : ""}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(meta);
    return acc;
  }, {} as Record<string, Meta[]>);

  return {
    // Metas
    metas,
    isLoadingMetas,
    createMeta: createMetaMutation.mutateAsync,
    updateMeta: updateMetaMutation.mutateAsync,
    deleteMeta: deleteMetaMutation.mutateAsync,
    isCreatingMeta: createMetaMutation.isPending,
    
    // OKRs
    createOkr: createOkrMutation.mutateAsync,
    updateOkr: updateOkrMutation.mutateAsync,
    deleteOkr: deleteOkrMutation.mutateAsync,
    
    // Check-ins
    createCheckin: createCheckinMutation.mutateAsync,
    getCheckinsByOkr,
    isCreatingCheckin: createCheckinMutation.isPending,
    
    // Estatísticas
    metasAtivas,
    metasConcluidas,
    metasAtrasadas,
    progressoMedio,
    metasPorPeriodo,
  };
}
