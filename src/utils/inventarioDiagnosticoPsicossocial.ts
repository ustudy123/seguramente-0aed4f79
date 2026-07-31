/**
 * Constrói o inventário de fatores de risco psicossociais de UMA campanha,
 * com a MESMA metodologia do Relatório de Diagnóstico Psicossocial
 * (aba Inventário PGR): dimensões do instrumento → fatores do catálogo
 * NR-01/ISO 45003, probabilidade pelo score, severidade fixa do catálogo
 * e nível pela matriz GRO (P × S).
 *
 * Não depende de exportação ao GRO — lê direto do radar_data da campanha.
 */
import type { CampanhaPsicossocial, RadarDimensao } from "@/types/psicossocial";
import { isEntrevistaInstrumento, getMinimoRespostas } from "@/types/psicossocial";
import {
  scoreToProb15,
  sevFallbackFromScore,
  nivelGRO15,
  normalizarNomeFator,
  PROB15_LABELS,
  NIVEL15_LABELS,
  NIVEL15_ORDEM,
  type NivelGRO15,
  type Sev15,
} from "@/lib/groPsicossocial15";
import { getSeveridadeInfo } from "@/lib/psicossocial-severidade";
import { resolverFatorPorSubject } from "@/data/catalogoRiscosPsicossociais";

export interface ItemDiagnosticoPsicossocial {
  fator: string;
  dimensoes: string[];
  norma: string;
  scoreReal: number;
  probabilidadeLabel: string;
  severidadeLabel: string;
  nivelLabel: string;
  nivelKey: NivelGRO15;
}

/** Campanha tem diagnóstico liberado (radar + mínimo de respostas)? */
export function campanhaTemDiagnostico(campanha: CampanhaPsicossocial): boolean {
  return (
    campanha.ips_score != null &&
    (campanha.total_respostas || 0) >= getMinimoRespostas(campanha) &&
    Array.isArray(campanha.radar_data) &&
    campanha.radar_data.length > 0
  );
}

export function construirInventarioDiagnostico(
  campanha: CampanhaPsicossocial,
  sevCatalogo?: Map<string, Sev15> | null
): ItemDiagnosticoPsicossocial[] {
  if (!campanhaTemDiagnostico(campanha)) return [];

  const isSipro =
    campanha.instrumento === "sipro" ||
    isEntrevistaInstrumento(campanha.tipo_instrumento);
  const radar = campanha.radar_data as RadarDimensao[];

  // Reagrupa as dimensões do instrumento por fator do catálogo (média simples
  // dentro da campanha — mesmo resultado da média ponderada com peso único).
  type Agg = { dimensoes: Set<string>; soma: number; n: number; norma: string; fator: string };
  const porFator: Record<string, Agg> = {};

  for (const dim of radar) {
    const cat = resolverFatorPorSubject(dim.subject);
    const fatorNome = cat?.nome ?? dim.subject;
    const norma = cat?.baseNormativa.join(" / ") ?? "NR-01 / ISO 45003";
    if (!porFator[fatorNome]) {
      porFator[fatorNome] = { dimensoes: new Set(), soma: 0, n: 0, norma, fator: fatorNome };
    }
    porFator[fatorNome].dimensoes.add(dim.subject);
    porFator[fatorNome].soma += dim.value;
    porFator[fatorNome].n += 1;
  }

  const itens = Object.values(porFator).map((agg) => {
    const scoreReal = Math.round(agg.soma / agg.n);
    // Instrumentos não-SIPRO usam escala protetiva — converte para risco.
    const scoreRisco = isSipro ? scoreReal : 100 - scoreReal;
    const prob = scoreToProb15(scoreRisco);
    const sev =
      sevCatalogo?.get(normalizarNomeFator(agg.fator)) ?? sevFallbackFromScore(scoreRisco);
    const nivel = nivelGRO15(prob, sev);

    return {
      fator: agg.fator,
      dimensoes: Array.from(agg.dimensoes).sort(),
      norma: agg.norma,
      scoreReal,
      probabilidadeLabel: PROB15_LABELS[prob],
      severidadeLabel: getSeveridadeInfo(sev)?.label ?? String(sev),
      nivelLabel: NIVEL15_LABELS[nivel],
      nivelKey: nivel,
    };
  });

  return itens.sort(
    (a, b) => (NIVEL15_ORDEM[a.nivelKey] ?? 5) - (NIVEL15_ORDEM[b.nivelKey] ?? 5)
  );
}
