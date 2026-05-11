import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";
import type { 
  ItemNR17, 
  ErgonomiaEvidencia, 
  ErgonomiaRisco, 
  ErgonomiaAcao,
  ErgonomiaMaturidade,
  ErgonomiaStatus,
  ErgonomiaCategoria,
  ITENS_NR17_PADRAO
} from "@/types/ergonomia";

export function useErgonomia() {
  const { tenantId } = useTenant();
  const { empresaAtivaId } = useEmpresaAtiva();
  const queryClient = useQueryClient();

  // Buscar itens NR-17
  const { data: itensNR17 = [], isLoading: isLoadingItens, refetch: refetchItens } = useQuery({
    queryKey: ["ergonomia-itens-nr17", tenantId, empresaAtivaId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      let query = supabase
        .from("ergonomia_itens_nr17")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("codigo", { ascending: true });

      if (empresaAtivaId) query = query.or(`empresa_id.eq.${empresaAtivaId},empresa_id.is.null`);

      const { data, error } = await query;
      if (error) throw error;
      return data as ItemNR17[];
    },
    enabled: !!tenantId,
  });

  // Buscar riscos
  const { data: riscos = [], isLoading: isLoadingRiscos } = useQuery({
    queryKey: ["ergonomia-riscos", tenantId, empresaAtivaId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      let query = supabase
        .from("ergonomia_riscos")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .order("created_at", { ascending: false });

      if (empresaAtivaId) query = query.eq("empresa_id", empresaAtivaId);

      const { data, error } = await query;
      if (error) throw error;
      return data as ErgonomiaRisco[];
    },
    enabled: !!tenantId,
  });

  // Buscar ações
  const { data: acoes = [], isLoading: isLoadingAcoes } = useQuery({
    queryKey: ["ergonomia-acoes", tenantId, empresaAtivaId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      let query = supabase
        .from("ergonomia_acoes")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (empresaAtivaId) query = query.eq("empresa_id", empresaAtivaId);

      const { data, error } = await query;
      if (error) throw error;
      return data as ErgonomiaAcao[];
    },
    enabled: !!tenantId,
  });

  // Buscar evidências por item
  const getEvidenciasByItem = async (itemId: string): Promise<ErgonomiaEvidencia[]> => {
    const { data, error } = await supabase
      .from("ergonomia_evidencias")
      .select("*")
      .eq("item_nr17_id", itemId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as ErgonomiaEvidencia[];
  };

  // Mutation para criar item NR-17
  const createItemMutation = useMutation({
    mutationFn: async (item: Omit<ItemNR17, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => {
      if (!tenantId) throw new Error("Tenant não identificado");
      
      const { data, error } = await supabase
        .from("ergonomia_itens_nr17")
        .insert({ ...item, tenant_id: tenantId, empresa_id: empresaAtivaId || null })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ergonomia-itens-nr17"] });
      toast.success("Item NR-17 cadastrado com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao cadastrar item:", error);
      toast.error("Erro ao cadastrar item NR-17");
    },
  });

  // Mutation para atualizar status do item
  const updateItemStatusMutation = useMutation({
    mutationFn: async ({ id, status, observacoes }: { id: string; status: ErgonomiaStatus; observacoes?: string }) => {
      const { data, error } = await supabase
        .from("ergonomia_itens_nr17")
        .update({ 
          status, 
          observacoes,
          data_avaliacao: new Date().toISOString() 
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ergonomia-itens-nr17"] });
      toast.success("Status atualizado!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    },
  });

  // Mutation para inicializar itens padrão
  const initializeItensMutation = useMutation({
    mutationFn: async (itensPadrao: typeof ITENS_NR17_PADRAO) => {
      if (!tenantId) throw new Error("Tenant não identificado");
      
      const itensComTenant = itensPadrao.map(item => ({
        ...item,
        tenant_id: tenantId,
        empresa_id: empresaAtivaId || null,
      }));

      // Busca códigos já existentes para este tenant para evitar conflito de unique key
      const { data: existentes, error: errExist } = await supabase
        .from("ergonomia_itens_nr17")
        .select("codigo")
        .eq("tenant_id", tenantId);

      if (errExist) throw errExist;

      const codigosExistentes = new Set((existentes || []).map((e: any) => e.codigo));
      const itensNovos = itensComTenant.filter((i: any) => !codigosExistentes.has(i.codigo));

      if (itensNovos.length === 0) {
        return { inserted: 0, skipped: itensComTenant.length };
      }

      const { data, error } = await supabase
        .from("ergonomia_itens_nr17")
        .insert(itensNovos)
        .select();

      if (error) throw error;
      return { inserted: data?.length || 0, skipped: itensComTenant.length - (data?.length || 0) };
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["ergonomia-itens-nr17"] });
      if (res?.inserted === 0) {
        toast.info("Itens NR-17 já estavam inicializados.");
      } else if (res?.skipped > 0) {
        toast.success(`${res.inserted} itens criados (${res.skipped} já existiam).`);
      } else {
        toast.success("Itens NR-17 inicializados com sucesso!");
      }
    },
    onError: (error) => {
      console.error("Erro ao inicializar itens:", error);
      toast.error("Erro ao inicializar itens NR-17");
    },
  });

  // Mutation para criar risco
  const createRiscoMutation = useMutation({
    mutationFn: async (risco: Omit<ErgonomiaRisco, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => {
      if (!tenantId) throw new Error("Tenant não identificado");
      
      const { data, error } = await supabase
        .from("ergonomia_riscos")
        .insert({ ...risco, tenant_id: tenantId, empresa_id: empresaAtivaId || null })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ergonomia-riscos"] });
      toast.success("Risco cadastrado com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao cadastrar risco:", error);
      toast.error("Erro ao cadastrar risco");
    },
  });

  // Mutation para criar ação
  const createAcaoMutation = useMutation({
    mutationFn: async (acao: Omit<ErgonomiaAcao, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => {
      if (!tenantId) throw new Error("Tenant não identificado");
      
      const { data, error } = await supabase
        .from("ergonomia_acoes")
        .insert({ ...acao, tenant_id: tenantId, empresa_id: empresaAtivaId || null })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ergonomia-acoes"] });
      toast.success("Ação cadastrada com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao cadastrar ação:", error);
      toast.error("Erro ao cadastrar ação");
    },
  });

  // Mutation para atualizar status da ação
  const updateAcaoStatusMutation = useMutation({
    mutationFn: async ({ id, status, data_conclusao }: { id: string; status: ErgonomiaAcao['status']; data_conclusao?: string }) => {
      const updateData: any = { status };
      
      if (status === 'em_andamento' && !data_conclusao) {
        updateData.data_inicio = new Date().toISOString().split('T')[0];
      }
      
      if (status === 'concluida') {
        updateData.data_conclusao = new Date().toISOString().split('T')[0];
      }
      
      const { data, error } = await supabase
        .from("ergonomia_acoes")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ergonomia-acoes"] });
      toast.success("Status da ação atualizado!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status da ação");
    },
  });

  // Mutation para atualizar risco
  const updateRiscoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { data, error } = await supabase
        .from("ergonomia_riscos")
        .update({ ativo })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ergonomia-riscos"] });
      toast.success("Risco atualizado!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar risco:", error);
      toast.error("Erro ao atualizar risco");
    },
  });

  // Estatísticas de conformidade
  const estatisticas = {
    total: itensNR17.length,
    atendidos: itensNR17.filter(i => i.status === 'atendido').length,
    parciais: itensNR17.filter(i => i.status === 'parcial').length,
    naoAtendidos: itensNR17.filter(i => i.status === 'nao_atendido').length,
    naoAplicaveis: itensNR17.filter(i => i.status === 'nao_aplicavel').length,
    riscosCriticos: riscos.filter(r => r.severidade === 'critico').length,
    riscosAltos: riscos.filter(r => r.severidade === 'alto').length,
    acoesPendentes: acoes.filter(a => a.status === 'pendente').length,
    acoesEmAndamento: acoes.filter(a => a.status === 'em_andamento').length,
  };

  // Calcular percentual de conformidade
  const percentualConformidade = estatisticas.total > 0
    ? Math.round(((estatisticas.atendidos + estatisticas.parciais * 0.5) / (estatisticas.total - estatisticas.naoAplicaveis)) * 100)
    : 0;

  // Calcular nível de maturidade
  const calcularMaturidade = (): ErgonomiaMaturidade['nivel'] | null => {
    if (estatisticas.total === 0) return null;
    if (percentualConformidade < 20) return 'reativo';
    if (percentualConformidade < 40) return 'corretivo';
    if (percentualConformidade < 60) return 'preventivo';
    if (percentualConformidade < 80) return 'estrategico';
    return 'cultura_saudavel';
  };

  // Agrupar itens por categoria
  const itensPorCategoria = itensNR17.reduce((acc, item) => {
    if (!acc[item.categoria]) {
      acc[item.categoria] = [];
    }
    acc[item.categoria].push(item);
    return acc;
  }, {} as Record<ErgonomiaCategoria, ItemNR17[]>);

  return {
    // Data
    itensNR17,
    riscos,
    acoes,
    itensPorCategoria,
    estatisticas,
    percentualConformidade,
    nivelMaturidade: calcularMaturidade(),
    
    // Loading states
    isLoading: isLoadingItens || isLoadingRiscos || isLoadingAcoes,
    isLoadingItens,
    isLoadingRiscos,
    isLoadingAcoes,
    
    // Functions
    getEvidenciasByItem,
    refetchItens,
    
    // Mutations
    createItem: createItemMutation.mutateAsync,
    updateItemStatus: updateItemStatusMutation.mutateAsync,
    initializeItens: initializeItensMutation.mutateAsync,
    createRisco: createRiscoMutation.mutateAsync,
    updateRisco: updateRiscoMutation.mutateAsync,
    createAcao: createAcaoMutation.mutateAsync,
    updateAcaoStatus: updateAcaoStatusMutation.mutateAsync,
    
    // Mutation states
    isCreatingItem: createItemMutation.isPending,
    isUpdatingStatus: updateItemStatusMutation.isPending,
    isInitializing: initializeItensMutation.isPending,
    isCreatingRisco: createRiscoMutation.isPending,
    isCreatingAcao: createAcaoMutation.isPending,
    isUpdatingAcaoStatus: updateAcaoStatusMutation.isPending,
  };
}
