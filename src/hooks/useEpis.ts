import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import type {
  EpiTipo,
  EpiTipoInsert,
  Epi,
  EpiInsert,
  EpiUpdate,
  EpiEntrega,
  EpiEntregaInsert,
  EpiEntregaUpdate,
  EpiMovimentacao,
  EpiCompleto,
  EpiStatus,
  EntregaStatus,
} from "@/types/epi";
import { TIPOS_EPI_PADRAO } from "@/types/epi";

export function useEpis() {
  const { tenantId, user, profile } = useAuth();
  const queryClient = useQueryClient();

  // ==================== QUERIES ====================

  // Buscar tipos de EPI (cria tipos padrão se não existirem)
  const tiposQuery = useQuery({
    queryKey: ["epi-tipos", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from("epi_tipos")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("nome");
      if (error) throw error;
      
      // Se não houver tipos, criar os tipos padrão
      if (data.length === 0) {
        const tiposPadrao = TIPOS_EPI_PADRAO.map(tipo => ({
          ...tipo,
          tenant_id: tenantId,
        }));
        
        const { data: novosTipos, error: insertError } = await supabase
          .from("epi_tipos")
          .insert(tiposPadrao)
          .select();
        
        if (insertError) {
          console.error("Erro ao criar tipos padrão:", insertError);
          return data as EpiTipo[];
        }
        
        return novosTipos as EpiTipo[];
      }
      
      return data as EpiTipo[];
    },
    enabled: !!tenantId,
  });

  // Buscar EPIs com tipo
  const episQuery = useQuery({
    queryKey: ["epis", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("epis")
        .select(`
          *,
          tipo:epi_tipos(*)
        `)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EpiCompleto[];
    },
    enabled: !!tenantId,
  });

  // Buscar entregas
  const entregasQuery = useQuery({
    queryKey: ["epi-entregas", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("epi_entregas")
        .select(`
          *,
          epi:epis(*, tipo:epi_tipos(*))
        `)
        .eq("tenant_id", tenantId)
        .order("data_entrega", { ascending: false });
      if (error) throw error;
      return data as (EpiEntrega & { epi: EpiCompleto })[];
    },
    enabled: !!tenantId,
  });

  // Buscar movimentações
  const movimentacoesQuery = useQuery({
    queryKey: ["epi-movimentacoes", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("epi_movimentacoes")
        .select(`
          *,
          epi:epis(*, tipo:epi_tipos(*))
        `)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as (EpiMovimentacao & { epi: EpiCompleto })[];
    },
    enabled: !!tenantId,
  });

  // ==================== MUTATIONS - TIPOS ====================

  const criarTipoMutation = useMutation({
    mutationFn: async (dados: Omit<EpiTipoInsert, "tenant_id"> & { estoque_inicial?: number | null }) => {
      if (!tenantId) throw new Error("Tenant não identificado");
      
      // Separar estoque_inicial dos dados do tipo
      const { estoque_inicial, ...dadosTipo } = dados;
      
      const { data, error } = await supabase
        .from("epi_tipos")
        .insert({ ...dadosTipo, tenant_id: tenantId })
        .select()
        .single();
      if (error) throw error;
      
      // Se informou estoque inicial, criar automaticamente um EPI no estoque
      const quantidadeInicial = estoque_inicial ?? 100;
      if (quantidadeInicial > 0) {
        const { data: novoEpi, error: epiError } = await supabase
          .from("epis")
          .insert({
            tenant_id: tenantId,
            tipo_id: data.id,
            quantidade_estoque: quantidadeInicial,
            quantidade_minima: dados.estoque_minimo ?? 5,
            status: "disponivel",
          })
          .select()
          .single();
        
        if (epiError) {
          console.error("Erro ao criar EPI inicial:", epiError);
        } else {
          // Registrar movimentação de entrada inicial
          await supabase.from("epi_movimentacoes").insert({
            tenant_id: tenantId,
            epi_id: novoEpi.id,
            tipo: "entrada",
            quantidade: quantidadeInicial,
            quantidade_anterior: 0,
            quantidade_atual: quantidadeInicial,
            motivo: "Cadastro inicial do tipo de EPI",
            realizado_por: user?.id,
            realizado_por_nome: profile?.nome_completo,
          });
        }
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epi-tipos"] });
      queryClient.invalidateQueries({ queryKey: ["epis"] });
      queryClient.invalidateQueries({ queryKey: ["epi-movimentacoes"] });
      toast.success("Tipo de EPI criado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar tipo de EPI: " + error.message);
    },
  });

  // ==================== MUTATIONS - EPIS ====================

  const criarEpiMutation = useMutation({
    mutationFn: async (dados: Omit<EpiInsert, "tenant_id">) => {
      if (!tenantId) throw new Error("Tenant não identificado");
      const { data, error } = await supabase
        .from("epis")
        .insert({ ...dados, tenant_id: tenantId })
        .select(`*, tipo:epi_tipos(*)`)
        .single();
      if (error) throw error;

      // Registrar movimentação de entrada inicial
      if (dados.quantidade_estoque && dados.quantidade_estoque > 0) {
        await supabase.from("epi_movimentacoes").insert({
          tenant_id: tenantId,
          epi_id: data.id,
          tipo: "entrada",
          quantidade: dados.quantidade_estoque,
          quantidade_anterior: 0,
          quantidade_atual: dados.quantidade_estoque,
          motivo: "Cadastro inicial",
          realizado_por: user?.id,
          realizado_por_nome: profile?.nome_completo,
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epis"] });
      queryClient.invalidateQueries({ queryKey: ["epi-movimentacoes"] });
      toast.success("EPI cadastrado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar EPI: " + error.message);
    },
  });

  const atualizarEpiMutation = useMutation({
    mutationFn: async ({ id, ...dados }: EpiUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("epis")
        .update(dados)
        .eq("id", id)
        .select(`*, tipo:epi_tipos(*)`)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epis"] });
      toast.success("EPI atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar EPI: " + error.message);
    },
  });

  const excluirEpiMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("epis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epis"] });
      toast.success("EPI excluído com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir EPI: " + error.message);
    },
  });

  // Ajustar estoque manualmente
  const ajustarEstoqueMutation = useMutation({
    mutationFn: async ({
      epiId,
      novaQuantidade,
      motivo,
    }: {
      epiId: string;
      novaQuantidade: number;
      motivo: string;
    }) => {
      if (!tenantId) throw new Error("Tenant não identificado");

      // Buscar quantidade atual
      const { data: epiAtual } = await supabase
        .from("epis")
        .select("quantidade_estoque")
        .eq("id", epiId)
        .single();

      const quantidadeAnterior = epiAtual?.quantidade_estoque || 0;
      const diferenca = novaQuantidade - quantidadeAnterior;

      // Atualizar estoque
      const { error } = await supabase
        .from("epis")
        .update({ quantidade_estoque: novaQuantidade })
        .eq("id", epiId);
      if (error) throw error;

      // Registrar movimentação
      await supabase.from("epi_movimentacoes").insert({
        tenant_id: tenantId,
        epi_id: epiId,
        tipo: diferenca > 0 ? "entrada" : "ajuste",
        quantidade: Math.abs(diferenca),
        quantidade_anterior: quantidadeAnterior,
        quantidade_atual: novaQuantidade,
        motivo,
        realizado_por: user?.id,
        realizado_por_nome: profile?.nome_completo,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epis"] });
      queryClient.invalidateQueries({ queryKey: ["epi-movimentacoes"] });
      toast.success("Estoque ajustado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao ajustar estoque: " + error.message);
    },
  });

  // ==================== MUTATIONS - ENTREGAS ====================

  const registrarEntregaMutation = useMutation({
    mutationFn: async (dados: Omit<EpiEntregaInsert, "tenant_id"> & { foto?: File }) => {
      if (!tenantId) throw new Error("Tenant não identificado");

      // Verificar estoque disponível
      const { data: epi } = await supabase
        .from("epis")
        .select("quantidade_estoque, tipo:epi_tipos(nome)")
        .eq("id", dados.epi_id)
        .single();

      if (!epi || epi.quantidade_estoque < (dados.quantidade || 1)) {
        throw new Error("Estoque insuficiente para esta entrega");
      }

      // Upload da foto se existir
      let fotoUrl: string | undefined;
      if (dados.foto) {
        const fileExt = dados.foto.name.split('.').pop();
        const fileName = `${tenantId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('epi-fotos')
          .upload(fileName, dados.foto);
        
        if (uploadError) {
          console.error('Erro no upload da foto:', uploadError);
          throw new Error("Erro ao fazer upload da foto");
        }
        
        const { data: urlData } = supabase.storage
          .from('epi-fotos')
          .getPublicUrl(fileName);
        
        fotoUrl = urlData.publicUrl;
      }

      // Remover a foto do objeto antes de inserir
      const { foto, ...dadosSemFoto } = dados;

      const { data, error } = await supabase
        .from("epi_entregas")
        .insert({
          ...dadosSemFoto,
          tenant_id: tenantId,
          entregue_por: user?.id,
          entregue_por_nome: profile?.nome_completo,
          foto_entrega_url: fotoUrl,
        })
        .select(`*, epi:epis(*, tipo:epi_tipos(*))`)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epi-entregas"] });
      queryClient.invalidateQueries({ queryKey: ["epis"] });
      queryClient.invalidateQueries({ queryKey: ["epi-movimentacoes"] });
      toast.success("Entrega registrada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao registrar entrega: " + error.message);
    },
  });

  const atualizarEntregaMutation = useMutation({
    mutationFn: async ({ id, ...dados }: EpiEntregaUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("epi_entregas")
        .update(dados)
        .eq("id", id)
        .select(`*, epi:epis(*, tipo:epi_tipos(*))`)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epi-entregas"] });
      queryClient.invalidateQueries({ queryKey: ["epis"] });
      queryClient.invalidateQueries({ queryKey: ["epi-movimentacoes"] });
      toast.success("Entrega atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar entrega: " + error.message);
    },
  });

  const registrarDevolucaoMutation = useMutation({
    mutationFn: async ({
      entregaId,
      observacoes,
    }: {
      entregaId: string;
      observacoes?: string;
    }) => {
      const { data, error } = await supabase
        .from("epi_entregas")
        .update({
          status: "devolvido" as EntregaStatus,
          data_devolucao_efetiva: new Date().toISOString(),
          observacoes,
        })
        .eq("id", entregaId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epi-entregas"] });
      queryClient.invalidateQueries({ queryKey: ["epis"] });
      queryClient.invalidateQueries({ queryKey: ["epi-movimentacoes"] });
      toast.success("Devolução registrada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao registrar devolução: " + error.message);
    },
  });

  // ==================== ESTATÍSTICAS ====================

  const stats = {
    totalEpis: episQuery.data?.length || 0,
    totalTipos: tiposQuery.data?.length || 0,
    entregasAtivas: entregasQuery.data?.filter((e) => e.status === "ativa").length || 0,
    estoqueBaixo:
      episQuery.data?.filter((e) => e.quantidade_estoque <= e.quantidade_minima).length || 0,
    episVencidos:
      episQuery.data?.filter(
        (e) => e.data_validade && new Date(e.data_validade) < new Date()
      ).length || 0,
    totalEstoque: episQuery.data?.reduce((sum, e) => sum + e.quantidade_estoque, 0) || 0,
  };

  return {
    // Queries
    tipos: tiposQuery.data || [],
    tiposLoading: tiposQuery.isLoading,
    epis: episQuery.data || [],
    episLoading: episQuery.isLoading,
    entregas: entregasQuery.data || [],
    entregasLoading: entregasQuery.isLoading,
    movimentacoes: movimentacoesQuery.data || [],
    movimentacoesLoading: movimentacoesQuery.isLoading,

    // Estatísticas
    stats,

    // Mutations - Tipos
    criarTipo: criarTipoMutation.mutateAsync,
    criandoTipo: criarTipoMutation.isPending,

    // Mutations - EPIs
    criarEpi: criarEpiMutation.mutateAsync,
    criandoEpi: criarEpiMutation.isPending,
    atualizarEpi: atualizarEpiMutation.mutateAsync,
    atualizandoEpi: atualizarEpiMutation.isPending,
    excluirEpi: excluirEpiMutation.mutateAsync,
    excluindoEpi: excluirEpiMutation.isPending,
    ajustarEstoque: ajustarEstoqueMutation.mutateAsync,
    ajustandoEstoque: ajustarEstoqueMutation.isPending,

    // Mutations - Entregas
    registrarEntrega: registrarEntregaMutation.mutateAsync,
    registrandoEntrega: registrarEntregaMutation.isPending,
    atualizarEntrega: atualizarEntregaMutation.mutateAsync,
    atualizandoEntrega: atualizarEntregaMutation.isPending,
    registrarDevolucao: registrarDevolucaoMutation.mutateAsync,
    registrandoDevolucao: registrarDevolucaoMutation.isPending,

    // Refetch
    refetchAll: () => {
      queryClient.invalidateQueries({ queryKey: ["epis"] });
      queryClient.invalidateQueries({ queryKey: ["epi-tipos"] });
      queryClient.invalidateQueries({ queryKey: ["epi-entregas"] });
      queryClient.invalidateQueries({ queryKey: ["epi-movimentacoes"] });
    },
  };
}
