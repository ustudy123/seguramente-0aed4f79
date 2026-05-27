import { useQuery } from "@tanstack/react-query";
import { fromTable } from "@/integrations/supabase/untypedClient";

export interface EvidenciaEntrevista {
  id: string;
  entrevista_id: string;
  risco_nome: string;
  presente: boolean;
  probabilidade: number | null;
  severidade: number | null;
  nivel_risco: string | null;
  justificativa: string | null;
  trechos_anonimizados: string[];
}

export interface EvidenciaAgrupada {
  risco_nome: string;
  count: number;
  p_max: number;
  s_max: number;
  nivel: string;
  evidencias: EvidenciaEntrevista[];
}

/**
 * Busca evidências qualitativas das entrevistas guiadas para as campanhas dadas
 * e agrupa por nome do risco.
 */
export function useEvidenciasEntrevista(campanhaIds: string[]) {
  return useQuery({
    queryKey: ["psicossocial-evidencias-entrevista", campanhaIds.sort().join(",")],
    enabled: campanhaIds.length > 0,
    queryFn: async (): Promise<EvidenciaAgrupada[]> => {
      const { data, error } = await fromTable("psicossocial_entrevistas_evidencias")
        .select(
          "id, entrevista_id, risco_nome, presente, probabilidade, severidade, nivel_risco, justificativa, trechos_anonimizados"
        )
        .in("campanha_id", campanhaIds)
        .eq("presente", true);
      if (error) throw error;
      const rows = (data ?? []) as unknown as EvidenciaEntrevista[];

      const mapa = new Map<string, EvidenciaAgrupada>();
      for (const ev of rows) {
        const key = (ev.risco_nome || "Risco não identificado").trim();
        const atual = mapa.get(key) ?? {
          risco_nome: key,
          count: 0,
          p_max: 0,
          s_max: 0,
          nivel: "baixo",
          evidencias: [],
        };
        atual.count += 1;
        atual.p_max = Math.max(atual.p_max, ev.probabilidade ?? 0);
        atual.s_max = Math.max(atual.s_max, ev.severidade ?? 0);
        atual.evidencias.push(ev);
        const score = atual.p_max * atual.s_max;
        atual.nivel = score >= 15 ? "critico" : score >= 8 ? "alto" : score >= 4 ? "medio" : "baixo";
        mapa.set(key, atual);
      }

      return Array.from(mapa.values()).sort(
        (a, b) => b.p_max * b.s_max - a.p_max * a.s_max,
      );
    },
  });
}
