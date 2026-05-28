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
  setor_snapshot: string | null;
  cargo_snapshot: string | null;
  indicadores: { radar?: RadarDimensao[]; IPS?: number } | null;
}

interface RespostaRow {
  id: string;
  campanha_id: string;
  ghe_id_snapshot: string | null;
  ghe_nome_snapshot: string | null;
  setor_snapshot: string | null;
  cargo_snapshot: string | null;
  indicadores: { radar?: RadarDimensao[]; IPS?: number } | null;
}

interface CampanhaGheRow {
  id: string;
  ghe_ids: string[] | null;
}

interface GheRow {
  id: string;
  nome: string;
  codigo?: string | null;
}

interface GheCargoRow {
  ghe_id: string;
  cargo_id: string | null;
  departamento_id: string | null;
}

export interface EstratoGHE {
  nome: string;
  count: number;
  ipsMedio: number | null;
}

export interface ResultadoGHE {
  ghe_id: string | null;
  ghe_nome: string;
  ghe_codigo?: string | null;
  count: number;
  radar: RadarDimensao[];
  ipsMedio: number | null;
  campanhas: number;
  setores: EstratoGHE[];
  cargos: EstratoGHE[];
  composicaoSetores: string[];
  composicaoCargos: string[];
}

/**
 * Agrega respostas psicossociais por GHE.
 * Prioriza `ghe_id_snapshot` da resposta; quando ausente, usa o `ghe_ids`
 * da campanha (atribui a resposta a cada GHE vinculado à campanha).
 * Também carrega a composição cadastral do GHE (setores + cargos) via
 * `psicossocial_ghe_cargos` para exibir as informações básicas mesmo
 * quando os snapshots vierem vazios.
 */


export function usePsicossocialResultadosGHE(campanhaIds: string[] | undefined) {
  const { tenantId } = useTenant();
  const idsKey = (campanhaIds ?? []).slice().sort().join(",");

  const query = useQuery({
    queryKey: ["psicossocial-respostas-por-ghe-v2", tenantId, idsKey],
    queryFn: async () => {
      if (!tenantId || !campanhaIds || campanhaIds.length === 0) {
        return { respostas: [] as RespostaRow[], campanhasGhe: [] as CampanhaGheRow[], ghes: [] as GheRow[] };
      }

      const [respRes, campRes] = await Promise.all([
        fromTable("questionario_psicossocial_respostas")
          .select("id, campanha_id, ghe_id_snapshot, ghe_nome_snapshot, setor_snapshot, cargo_snapshot, indicadores")
          .eq("tenant_id", tenantId)
          .in("campanha_id", campanhaIds)
          .not("indicadores", "is", null),

        fromTable("questionario_psicossocial_campanhas")
          .select("id, ghe_ids")
          .eq("tenant_id", tenantId)
          .in("id", campanhaIds),
      ]);

      if (respRes.error) throw respRes.error;
      if (campRes.error) throw campRes.error;

      const campanhasGhe = (campRes.data ?? []) as unknown as CampanhaGheRow[];
      const allGheIds = Array.from(
        new Set(campanhasGhe.flatMap((c) => c.ghe_ids ?? []).filter(Boolean))
      );

      let ghes: GheRow[] = [];
      if (allGheIds.length > 0) {
        const { data: ghesData, error: ghesErr } = await fromTable("psicossocial_ghe")
          .select("id, nome")
          .in("id", allGheIds);
        if (ghesErr) throw ghesErr;
        ghes = (ghesData ?? []) as unknown as GheRow[];
      }

      return {
        respostas: (respRes.data ?? []) as unknown as RespostaRow[],
        campanhasGhe,
        ghes,
      };
    },
    enabled: !!tenantId && !!campanhaIds && campanhaIds.length > 0,
    staleTime: 60_000,
  });

  const resultadosPorGHE = useMemo<ResultadoGHE[]>(() => {
    const { respostas = [], campanhasGhe = [], ghes = [] } = query.data ?? {};
    if (respostas.length === 0) return [];

    const gheNomeMap = new Map(ghes.map((g) => [g.id, g.nome]));
    const campanhaGheMap = new Map(
      campanhasGhe.map((c) => [c.id, (c.ghe_ids ?? []).filter(Boolean)])
    );
    const grupos = new Map<string, {
      nome: string;
      count: number;
      radarAcc: Map<string, { soma: number; n: number }>;
      ipsList: number[];
      campanhas: Set<string>;
      setoresAcc: Map<string, { count: number; ipsList: number[] }>;
      cargosAcc: Map<string, { count: number; ipsList: number[] }>;
    }>();

    const addToGrupo = (key: string, nome: string, r: RespostaRow) => {
      if (!grupos.has(key)) {
        grupos.set(key, {
          nome, count: 0, radarAcc: new Map(), ipsList: [], campanhas: new Set(),
          setoresAcc: new Map(), cargosAcc: new Map(),
        });
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
      const ipsValid = Number.isFinite(ips);
      if (ipsValid) g.ipsList.push(ips);

      const setor = (r.setor_snapshot ?? "").trim() || "Não informado";
      const cargo = (r.cargo_snapshot ?? "").trim() || "Não informado";
      const sAcc = g.setoresAcc.get(setor) ?? { count: 0, ipsList: [] };
      sAcc.count += 1;
      if (ipsValid) sAcc.ipsList.push(ips);
      g.setoresAcc.set(setor, sAcc);
      const cAcc = g.cargosAcc.get(cargo) ?? { count: 0, ipsList: [] };
      cAcc.count += 1;
      if (ipsValid) cAcc.ipsList.push(ips);
      g.cargosAcc.set(cargo, cAcc);
    };

    for (const r of respostas) {
      if (r.ghe_id_snapshot) {
        addToGrupo(
          r.ghe_id_snapshot,
          r.ghe_nome_snapshot ?? gheNomeMap.get(r.ghe_id_snapshot) ?? "GHE",
          r
        );
        continue;
      }
      // Fallback: usa ghe_ids da campanha
      const ids = campanhaGheMap.get(r.campanha_id) ?? [];
      if (ids.length > 0) {
        for (const id of ids) {
          addToGrupo(id, gheNomeMap.get(id) ?? "GHE", r);
        }
      } else {
        addToGrupo("__sem_ghe__", "Sem GHE definido", r);
      }
    }

    const estratoFrom = (m: Map<string, { count: number; ipsList: number[] }>): EstratoGHE[] =>
      Array.from(m.entries())
        .map(([nome, v]) => ({
          nome,
          count: v.count,
          ipsMedio: v.ipsList.length > 0
            ? Math.round(v.ipsList.reduce((a, b) => a + b, 0) / v.ipsList.length)
            : null,
        }))
        .sort((a, b) => b.count - a.count);

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
      setores: estratoFrom(g.setoresAcc),
      cargos: estratoFrom(g.cargosAcc),
    }));
  }, [query.data]);


  return {
    resultadosPorGHE,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}
