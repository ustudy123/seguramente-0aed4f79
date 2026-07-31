import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface EqualizacaoEscala {
  escala_id: string;
  escala_nome: string;
  total_equalizacao_min: number;
  dias_uteis_efetivos: number;
  qtd_feriados: number;
  /** Memória de cálculo completa (RN10): dias úteis brutos, feriados
   *  deduzidos, carga semanal real, déficit diário, observações. */
  memoria: Record<string, any>;
}

/**
 * Equalização mensal (fechar 44h) por escala ativa do tenant, calculada
 * pela função SQL ponto_equalizacao_competencia_tenant (RN01–RN04 + RN10).
 * Disponível desde o dia 1 do mês, antes de qualquer sábado trabalhado.
 */
export function usePontoEqualizacao(competencia: string) {
  const { tenantId } = useAuth();

  return useQuery({
    queryKey: ["ponto-equalizacao", tenantId, competencia],
    queryFn: async (): Promise<EqualizacaoEscala[]> => {
      if (!tenantId || !competencia) return [];
      const { data, error } = await (supabase.rpc as any)(
        "ponto_equalizacao_competencia_tenant",
        { p_tenant_id: tenantId, p_competencia: competencia }
      );
      if (error) throw error;
      return (data || []) as EqualizacaoEscala[];
    },
    enabled: !!tenantId && !!competencia,
  });
}
