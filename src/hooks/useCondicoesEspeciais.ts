import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface CondicaoEspecial {
  id: string;
  tenant_id: string;
  colaborador_id: string;
  colaborador_nome: string;
  cargo_id: string | null;
  insalubridade: boolean;
  insalubridade_grau: string | null;
  insalubridade_agente_nocivo: string | null;
  insalubridade_base_calculo: string | null;
  insalubridade_valor_calculado: number;
  periculosidade: boolean;
  periculosidade_tipo: string | null;
  periculosidade_valor_calculado: number;
  adicional_aplicado: string | null;
  adicional_valor_aplicado: number;
  fundamentacao_legal: string | null;
  aposentadoria_especial: boolean;
  aposentadoria_especial_anos: number | null;
  data_inicio_exposicao: string | null;
  origem: string;
  documento_referencia: string | null;
  ativo: boolean;
  data_inicio: string;
  data_fim: string | null;
  justificativa_alteracao: string | null;
  alterado_por: string | null;
  alterado_por_nome: string | null;
  created_at: string;
  updated_at: string;
}

export function useCondicoesEspeciais(colaboradorId?: string) {
  const { tenantId, user, profile } = useAuth();
  const queryClient = useQueryClient();

  const condicoesQuery = useQuery({
    queryKey: ["condicoes-especiais", tenantId, colaboradorId],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("colaborador_condicoes_especiais" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (colaboradorId) query = query.eq("colaborador_id", colaboradorId);
      const { data, error } = await query as { data: any[] | null; error: any };
      if (error) throw error;
      return (data || []) as CondicaoEspecial[];
    },
    enabled: !!tenantId,
  });

  const historicoQuery = useQuery({
    queryKey: ["condicoes-especiais-historico", tenantId, colaboradorId],
    queryFn: async () => {
      if (!tenantId || !colaboradorId) return [];
      const { data, error } = await supabase
        .from("condicoes_especiais_historico" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("colaborador_id", colaboradorId)
        .order("created_at", { ascending: false }) as { data: any[] | null; error: any };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!colaboradorId,
  });

  const salvarCondicaoMutation = useMutation({
    mutationFn: async (dados: Partial<CondicaoEspecial> & { colaborador_id: string; colaborador_nome: string }) => {
      if (!tenantId) throw new Error("Tenant não encontrado");

      // Se já existe uma condição ativa, desativa antes
      if (dados.colaborador_id) {
        const { data: existentes } = await supabase
          .from("colaborador_condicoes_especiais" as never)
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("colaborador_id", dados.colaborador_id)
          .eq("ativo", true) as { data: any[] | null };

        if (existentes && existentes.length > 0) {
          for (const ex of existentes) {
            await supabase
              .from("colaborador_condicoes_especiais" as never)
              .update({
                ativo: false,
                data_fim: new Date().toISOString().split("T")[0],
              } as never)
              .eq("id", ex.id);
          }
        }
      }

      const { data, error } = await supabase
        .from("colaborador_condicoes_especiais" as never)
        .insert({
          ...dados,
          tenant_id: tenantId,
          alterado_por: user?.id,
          alterado_por_nome: profile?.nome_completo || user?.email,
        } as never)
        .select()
        .single();
      if (error) throw error;

      // Registrar histórico
      await supabase
        .from("condicoes_especiais_historico" as never)
        .insert({
          tenant_id: tenantId,
          condicao_id: (data as any).id,
          colaborador_id: dados.colaborador_id,
          colaborador_nome: dados.colaborador_nome,
          acao: "criacao",
          dados_novos: dados,
          justificativa: dados.justificativa_alteracao,
          usuario_id: user?.id,
          usuario_nome: profile?.nome_completo || user?.email,
        } as never);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["condicoes-especiais"] });
      queryClient.invalidateQueries({ queryKey: ["condicoes-especiais-historico"] });
      toast.success("Condições especiais salvas com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    condicoes: condicoesQuery.data || [],
    isLoading: condicoesQuery.isLoading,
    historico: historicoQuery.data || [],
    salvarCondicao: salvarCondicaoMutation.mutateAsync,
    salvando: salvarCondicaoMutation.isPending,
  };
}
