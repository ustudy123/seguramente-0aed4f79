import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuthContext } from "@/contexts/AuthContext";
import type { RadarDimensao } from "@/types/psicossocial";

interface RiscoEntrevista {
  risco_nome?: string;
  presente?: boolean;
  probabilidade?: number;
  severidade?: number;
}

interface EntrevistaRow {
  id: string;
  campanha_id: string;
  status: string;
  resumo_ia: { riscos?: RiscoEntrevista[] } | null;
}

export interface AggregadoEntrevistaCampanha {
  campanha_id: string;
  total_concluidas: number;
  ips_score: number | null;
  radar_data: RadarDimensao[];
}

/**
 * Agrega `psicossocial_entrevistas.resumo_ia` por campanha,
 * produzindo `ips_score` e `radar_data` compatíveis com as visualizações
 * dos questionários — permitindo que entrevistas guiadas apareçam nos
 * mesmos filtros e gráficos do hub de Resultados Psicossociais.
 */
export function useEntrevistasGuiadasAggregates(campanhaIds: string[] | undefined) {
  const { tenantId } = useAuthContext();
  const idsKey = (campanhaIds ?? []).slice().sort().join(",");

  const query = useQuery({
    queryKey: ["entrevistas-guiadas-aggregates", tenantId, idsKey],
    queryFn: async (): Promise<EntrevistaRow[]> => {
      if (!tenantId || !campanhaIds || campanhaIds.length === 0) return [];
      const { data, error } = await fromTable("psicossocial_entrevistas")
        .select("id, campanha_id, status, resumo_ia")
        .eq("tenant_id", tenantId)
        .in("campanha_id", campanhaIds)
        .eq("status", "concluida")
        .not("resumo_ia", "is", null);
      if (error) throw error;
      return (data ?? []) as unknown as EntrevistaRow[];
    },
    enabled: !!tenantId && !!campanhaIds && campanhaIds.length > 0,
    staleTime: 60_000,
  });

  const agregadosPorCampanha = useMemo<Map<string, AggregadoEntrevistaCampanha>>(() => {
    const rows = query.data ?? [];
    const porCampanha = new Map<string, EntrevistaRow[]>();
    for (const r of rows) {
      if (!porCampanha.has(r.campanha_id)) porCampanha.set(r.campanha_id, []);
      porCampanha.get(r.campanha_id)!.push(r);
    }

    const result = new Map<string, AggregadoEntrevistaCampanha>();
    for (const [campanhaId, entrevistas] of porCampanha) {
      const riscoAcc = new Map<string, { soma: number; n: number }>();
      for (const e of entrevistas) {
        const riscos = e.resumo_ia?.riscos ?? [];
        for (const r of riscos) {
          if (!r.risco_nome) continue;
          // Riscos AUSENTES também entram no agregado (NR-01 exige avaliar os 13
          // fatores, inclusive os sem evidência). O finalize grava P=1/S=1 para
          // ausentes → score baixo (4). Sem isso, campanhas saudáveis ficavam com
          // radar vazio, ips_score=null e o relatório era bloqueado.
          const probValue = Number(r.probabilidade) || (r.presente === false ? 1 : 0);
          const sevValue = Number(r.severidade) || (r.presente === false ? 1 : 0);
          
          // Mapeamento dinâmico: se a escala for 1-5, convertemos proporcionalmente para 0-100
          // prob (1-5) * sev (1-5) -> max 25. 25 * 4 = 100.
          // No entanto, para ser mais preciso com o inventário, vamos usar a média ponderada dos riscos.
          // Se prob=3 e sev=3 (Moderado), score = 3 * 3 * 4 = 36%
          const score = Math.min(100, Math.max(0, probValue * sevValue * 4));
          const acc = riscoAcc.get(r.risco_nome) ?? { soma: 0, n: 0 };
          acc.soma += score;
          acc.n += 1;
          riscoAcc.set(r.risco_nome, acc);
        }
      }

      const radar: RadarDimensao[] = Array.from(riscoAcc.entries()).map(([subject, { soma, n }]) => ({
        subject,
        value: Math.round(soma / n),
        fullMark: 100,
      }));

      const riscoMedio = radar.length > 0
        ? radar.reduce((a, b) => a + b.value, 0) / radar.length
        : 0;

      result.set(campanhaId, {
        campanha_id: campanhaId,
        total_concluidas: entrevistas.length,
        // ips_score = índice protetivo (alto = saudável) = 100 - risco médio
        ips_score: radar.length > 0 ? Math.round(100 - riscoMedio) : null,
        radar_data: radar,
      });
    }

    return result;
  }, [query.data]);

  return {
    agregadosPorCampanha,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}
