import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface TransferenciaData {
  epi_id: string;
  local_origem_id: string;
  local_destino_id: string;
  quantidade: number;
  tamanho?: string;
  observacoes?: string;
}

export function useTransferenciaEstoque() {
  const { tenantId, user, profile } = useAuth();
  const queryClient = useQueryClient();

  const transferirMutation = useMutation({
    mutationFn: async (dados: TransferenciaData) => {
      if (!tenantId) throw new Error("Tenant não identificado");

      // 1. Buscar saldo no local de origem
      let queryOrigem = supabase
        .from("epi_estoque_local")
        .select("id, quantidade")
        .eq("epi_id", dados.epi_id)
        .eq("local_estoque_id", dados.local_origem_id)
        .eq("tenant_id", tenantId);
      
      queryOrigem = queryOrigem.eq("tamanho", dados.tamanho || "");

      const { data: estoqueOrigem, error: origemError } = await queryOrigem.maybeSingle();

      const saldoOrigem = estoqueOrigem?.quantidade || 0;
      if (saldoOrigem < dados.quantidade) {
        throw new Error(`Saldo insuficiente no local de origem (disponível: ${saldoOrigem})`);
      }

      // 2. Diminuir no local de origem
      await supabase
        .from("epi_estoque_local")
        .update({ quantidade: saldoOrigem - dados.quantidade })
        .eq("id", estoqueOrigem!.id);

      // 3. Upsert no local de destino
      let queryDestino = supabase
        .from("epi_estoque_local")
        .select("id, quantidade")
        .eq("epi_id", dados.epi_id)
        .eq("local_estoque_id", dados.local_destino_id)
        .eq("tenant_id", tenantId);
      
      queryDestino = queryDestino.eq("tamanho", dados.tamanho || "");

      const { data: estoqueDestino } = await queryDestino.maybeSingle();

      if (estoqueDestino) {
        await supabase
          .from("epi_estoque_local")
          .update({ quantidade: estoqueDestino.quantidade + dados.quantidade })
          .eq("id", estoqueDestino.id);
      } else {
        await supabase
          .from("epi_estoque_local")
          .insert({
            tenant_id: tenantId,
            epi_id: dados.epi_id,
            local_estoque_id: dados.local_destino_id,
            quantidade: dados.quantidade,
            tamanho: dados.tamanho || "",
          });
      }

      // 4. Buscar estoque global (não muda, mas serve para registrar movimentação)
      const { data: epiAtual } = await supabase
        .from("epis")
        .select("quantidade_estoque")
        .eq("id", dados.epi_id)
        .single();

      const qtdGlobal = epiAtual?.quantidade_estoque || 0;

      // 5. Registrar movimentação de transferência
      const motivo = dados.observacoes
        ? `Transferência entre locais: ${dados.observacoes}`
        : "Transferência entre locais";

      const { error: movError } = await supabase
        .from("epi_movimentacoes")
        .insert({
          tenant_id: tenantId,
          epi_id: dados.epi_id,
          tipo: "transferencia",
          subtipo: "transferencia",
          local_estoque_id: dados.local_destino_id,
          tamanho: dados.tamanho || "",
          quantidade: dados.quantidade,
          quantidade_anterior: qtdGlobal,
          quantidade_atual: qtdGlobal, // estoque global não muda
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
      toast.success("Transferência realizada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro na transferência: " + error.message);
    },
  });

  return {
    transferir: transferirMutation.mutateAsync,
    transferindo: transferirMutation.isPending,
  };
}
