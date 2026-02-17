import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface EntradaEstoqueData {
  epi_id: string;
  local_estoque_id: string;
  quantidade: number;
  subtipo: string;
  tamanho?: string;
  observacoes?: string;
}

export function useEntradaEstoque() {
  const { tenantId, user, profile } = useAuth();
  const queryClient = useQueryClient();

  const registrarEntradaMutation = useMutation({
    mutationFn: async (dados: EntradaEstoqueData) => {
      if (!tenantId) throw new Error("Tenant não identificado");

      // 1. Buscar estoque atual do EPI
      const { data: epiAtual, error: epiError } = await supabase
        .from("epis")
        .select("quantidade_estoque")
        .eq("id", dados.epi_id)
        .single();
      if (epiError) throw epiError;

      const qtdAnterior = epiAtual?.quantidade_estoque || 0;
      const qtdNova = qtdAnterior + dados.quantidade;

      // 2. Atualizar estoque global do EPI
      const { error: updateError } = await supabase
        .from("epis")
        .update({ quantidade_estoque: qtdNova })
        .eq("id", dados.epi_id);
      if (updateError) throw updateError;

      // 3. Upsert no estoque por local (epi_estoque_local)
      let queryEstoque = supabase
        .from("epi_estoque_local")
        .select("id, quantidade")
        .eq("epi_id", dados.epi_id)
        .eq("local_estoque_id", dados.local_estoque_id)
        .eq("tenant_id", tenantId);
      
      queryEstoque = queryEstoque.eq("tamanho", dados.tamanho || "");

      const { data: estoqueLocal } = await queryEstoque.maybeSingle();

      if (estoqueLocal) {
        await supabase
          .from("epi_estoque_local")
          .update({ quantidade: estoqueLocal.quantidade + dados.quantidade })
          .eq("id", estoqueLocal.id);
      } else {
        await supabase
          .from("epi_estoque_local")
          .insert({
            tenant_id: tenantId,
            epi_id: dados.epi_id,
            local_estoque_id: dados.local_estoque_id,
            quantidade: dados.quantidade,
            tamanho: dados.tamanho || "",
          });
      }

      // 4. Registrar movimentação com local e subtipo
      const subtipoLabels: Record<string, string> = {
        inventario_inicial: "Inventário Inicial",
        ajuste: "Ajuste de Estoque",
        doacao: "Doação",
        compra: "Compra (sem nota)",
      };

      const motivo = dados.observacoes
        ? `${subtipoLabels[dados.subtipo] || dados.subtipo}: ${dados.observacoes}`
        : subtipoLabels[dados.subtipo] || dados.subtipo;

      const { error: movError } = await supabase
        .from("epi_movimentacoes")
        .insert({
          tenant_id: tenantId,
          epi_id: dados.epi_id,
          tipo: "entrada",
          subtipo: dados.subtipo,
          local_estoque_id: dados.local_estoque_id,
          tamanho: dados.tamanho || "",
          quantidade: dados.quantidade,
          quantidade_anterior: qtdAnterior,
          quantidade_atual: qtdNova,
          motivo,
          realizado_por: user?.id,
          realizado_por_nome: profile?.nome_completo,
        });
      if (movError) throw movError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epis"] });
      queryClient.invalidateQueries({ queryKey: ["epi-movimentacoes"] });
      queryClient.invalidateQueries({ queryKey: ["epi-estoque-local"] });
      toast.success("Entrada de estoque registrada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao registrar entrada: " + error.message);
    },
  });

  return {
    registrarEntrada: registrarEntradaMutation.mutateAsync,
    registrando: registrarEntradaMutation.isPending,
  };
}
