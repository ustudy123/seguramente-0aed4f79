import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useTenant } from "@/hooks/useTenant";
import type { RadarDimensao } from "@/types/psicossocial";

interface RespostaRow {
  id: string;
  campanha_id: string;
  ghe_id_snapshot: string | null;
  ghe_nome_snapshot: string | null;
  indicadores: { radar?: RadarDimensao[]; IPS?: number } | null;
}

export interface ResultadoGHE {
  ghe_id: string | null;
  ghe_nome: string;
  count: number;
  radar: RadarDimensao[]; // média por subject
  ipsMedio: number | null;
  campanhas: number; // quantas campanhas contribuíram
}

/**
 * Agrega respostas psicossociais por GHE (ghe_id_snapshot).
 * Calcula radar médio (subject → média de value) para cada GHE.
 *
 * Quando `campanhaIds` é vazio/undefined, retorna sem dados.
 * O mínimo de 5 respondentes deve ser aplicado no consumidor.
 */
export function usePsicossocialResultadosGHE(campanhaIds: string[] | undefined) {
  const { tenantId } = useTenant();
  const idsKey = (campanhaIds ?? []).slice().sort().join(",");

  const query = useQuery({
    queryKey: ["psicossocial-respostas-por-ghe", tenantId, idsKey],
    queryFn: async (): Promise<RespostaRow[]> => {
      if (!tenantId || !campanhaIds || campanhaIds.length === 0) return [];
      const { data, error } = await fromTable("questionario_psicossocial_respostas")
        .select("id, campanha_id, ghe_id_snapshot, ghe_nome_snapshot, indicadores")
        .eq("tenant_id", tenantId)
        .in("campanha_id", campanhaIds)
        .not("concluido_em", "is", null);
      if (error) throw error;
      return (data ?? []) as unknown as RespostaRow[];
    },
    enabled: !!tenantId && !!campanhaIds && campanhaIds.length > 0,
    staleTime: 60_000,
  });

  const resultadosPorGHE = useMemo<ResultadoGHE[]>(() => {
    const rows = query.data ?? [];
    if (rows.length === 0) return [];

    // Agrupa por ghe_id_snapshot
    const grupos = new Map<string, {
      nome: string;
      count: number;
      radarAcc: Map<string, { soma: number; n: number }>;
      ipsList: number[];
      campanhas: Set<string>;
    }>();

    for (const r of rows) {
      const key = r.ghe_id_snapshot ?? "__sem_ghe__";
      const nome = r.ghe_nome_snapshot ?? "Sem GHE definido";
      if (!grupos.has(key)) {
        grupos.set(key, { nome, count: 0, radarAcc: new Map(), ipsList: [], campanhas: new Set() });
      }
      const g = grupos.get(key)!;
      g.count += 1;
      g.campanhas.add(r.campanha_id);
      const radar = (r.indicadores?.radar ?? []) as RadarDimensao[];
      for (const d of radar) {
        if (!d?.subject) continue;
        const value = Number(d.value);
        if (!Number.isFinite(value)) continue;
        const acc = g.radarAcc.get(d.subject) ?? { soma: 0, n: 0 };
        acc.soma += value;
        acc.n += 1;
        g.radarAcc.set(d.subject, acc);
      }
      const ips = Number(r.indicadores?.IPS);
      if (Number.isFinite(ips)) g.ipsList.push(ips);
    }

    return Array.from(grupos.entries()).map(([id, g]) => ({
      ghe_id: id === "__sem_ghe__" ? null : id,
      ghe_nome: g.nome,
      count: g.count,
      radar: Array.from(g.radarAcc.entries()).map(([subject, { soma, n }]) => ({
        subject,
        value: Math.round(soma / n),
        fullMark: 100,
      })),
      ipsMedio: g.ipsList.length > 0
        ? Math.round(g.ipsList.reduce((a, b) => a + b, 0) / g.ipsList.length)
        : null,
      campanhas: g.campanhas.size,
    }));
  }, [query.data]);

  return {
    resultadosPorGHE,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}
