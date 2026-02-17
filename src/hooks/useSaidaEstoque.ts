import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface SaidaEstoqueData {
  epi_id: string;
  local_estoque_id: string;
  quantidade: number;
  subtipo: string;
  tamanho?: string;
  observacoes?: string;
}

export function useSaidaEstoque() {
  const { tenantId, user, profile } = useAuth();
  const queryClient = useQueryClient();

  const registrarSaidaMutation = useMutation({
    mutationFn: async (dados: SaidaEstoqueData) => {
      if (!tenantId) throw new Error("Tenant não identificado");

      // 1. Validar saldo no local
      let queryLocal = supabase
        .from("epi_estoque_local")
        .select("id, quantidade")
        .eq("epi_id", dados.epi_id)
        .eq("local_estoque_id", dados.local_estoque_id)
        .eq("tenant_id", tenantId);
      
      if (dados.tamanho) {
        queryLocal = queryLocal.eq("tamanho", dados.tamanho);
      } else {
        queryLocal = queryLocal.is("tamanho", null);
      }

      const { data: estoqueLocal, error: localError } = await queryLocal.maybeSingle();

      const saldoLocal = estoqueLocal?.quantidade || 0;
      if (saldoLocal < dados.quantidade) {
        throw new Error(`Saldo insuficiente neste local (disponível: ${saldoLocal})`);
      }

      // 2. Buscar estoque global
      const { data: epiAtual, error: epiError } = await supabase
        .from("epis")
        .select("quantidade_estoque")
        .eq("id", dados.epi_id)
        .single();
      if (epiError) throw epiError;

      const qtdAnterior = epiAtual?.quantidade_estoque || 0;
      const qtdNova = qtdAnterior - dados.quantidade;

      // 3. Atualizar estoque global
      const { error: updateError } = await supabase
        .from("epis")
        .update({ quantidade_estoque: qtdNova })
        .eq("id", dados.epi_id);
      if (updateError) throw updateError;

      // 4. Atualizar estoque local
      await supabase
        .from("epi_estoque_local")
        .update({ quantidade: saldoLocal - dados.quantidade })
        .eq("id", estoqueLocal!.id);

      // 5. Registrar movimentação
      const subtipoLabels: Record<string, string> = {
        descarte: "Descarte",
        perda: "Perda/Extravio",
        dano: "Dano/Avaria",
        vencimento: "Vencimento",
        correcao: "Correção de Estoque",
        outro: "Outro",
      };

      const motivo = dados.observacoes
        ? `${subtipoLabels[dados.subtipo] || dados.subtipo}: ${dados.observacoes}`
        : subtipoLabels[dados.subtipo] || dados.subtipo;

      const { error: movError } = await supabase
        .from("epi_movimentacoes")
        .insert({
          tenant_id: tenantId,
          epi_id: dados.epi_id,
          tipo: "saida",
          subtipo: dados.subtipo,
          local_estoque_id: dados.local_estoque_id,
          tamanho: dados.tamanho || null,
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
      toast.success("Saída de estoque registrada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao registrar saída: " + error.message);
    },
  });

  return {
    registrarSaida: registrarSaidaMutation.mutateAsync,
    registrandoSaida: registrarSaidaMutation.isPending,
  };
}
