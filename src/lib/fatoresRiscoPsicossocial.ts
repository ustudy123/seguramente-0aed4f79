/**
 * Converte o radar de dimensões de um GHE em fatores de risco com nível de GRO.
 *
 * Mesma metodologia do Inventário PGR: várias dimensões do instrumento podem
 * mapear para um único fator do catálogo (NR-01 / ISO 45003), então os scores
 * são consolidados por fator antes do cruzamento P x S.
 *
 * Probabilidade é variável (deriva do score); severidade é fixa por fator
 * (catálogo). O nível sai do cruzamento na matriz 4.3.
 */
import type { RadarDimensao } from "@/types/psicossocial";
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
import {
  resolverFatorPorSubject,
  CATEGORIA_LABELS,
} from "@/data/catalogoRiscosPsicossociais";

export interface FatorRiscoGHE {
  fatorId: string;
  fator: string;
  norma: string;
  descricao: string;
  categoriaLabel: string;
  dimensoes: string[];
  /** Score na escala do instrumento (protetiva ou de risco, conforme a origem). */
  scoreReal: number;
  /** Score convertido para escala de risco: alto = pior. */
  scoreRisco: number;
  probabilidadeLabel: string;
  severidadeLabel: string;
  nivelLabel: string;
  nivelKey: NivelGRO15;
}

function normativaDoSubject(subject: string) {
  const fator = resolverFatorPorSubject(subject);
  if (fator) {
    return {
      fator: fator.nome,
      norma: fator.baseNormativa.join(" / "),
      descricao: fator.descricao,
      categoriaLabel: CATEGORIA_LABELS[fator.categoria],
    };
  }
  return {
    fator: subject,
    norma: "NR-01 / ISO 45003",
    descricao:
      "Fator psicossocial não catalogado — avaliar enquadramento normativo manualmente.",
    categoriaLabel: "Não classificado",
  };
}

export function calcularFatoresRisco(
  radar: RadarDimensao[],
  opcoes: { isSipro: boolean; severidades?: Map<string, number> | null },
): FatorRiscoGHE[] {
  if (!radar || radar.length === 0) return [];

  const porFator = new Map<
    string,
    {
      dimensoes: Set<string>;
      soma: number;
      n: number;
      normativa: ReturnType<typeof normativaDoSubject>;
    }
  >();

  for (const dim of radar) {
    const normativa = normativaDoSubject(dim.subject);
    const chave = normativa.fator;
    const atual = porFator.get(chave) ?? {
      dimensoes: new Set<string>(),
      soma: 0,
      n: 0,
      normativa,
    };
    atual.dimensoes.add(dim.subject);
    atual.soma += dim.value;
    atual.n += 1;
    porFator.set(chave, atual);
  }

  const itens: FatorRiscoGHE[] = Array.from(porFator.entries()).map(([chave, agg]) => {
    const scoreReal = Math.round(agg.soma / agg.n);
    // Instrumentos não-SIPRO usam escala protetiva (alto = melhor); inverte.
    const scoreRisco = opcoes.isSipro ? scoreReal : 100 - scoreReal;
    const prob = scoreToProb15(scoreRisco);
    // O catálogo devolve number; a matriz exige 1-5. Clampa para não estourar.
    const sevBruta =
      opcoes.severidades?.get(normalizarNomeFator(agg.normativa.fator)) ??
      sevFallbackFromScore(scoreRisco);
    const sev = Math.min(5, Math.max(1, Math.round(sevBruta))) as Sev15;
    const nivel = nivelGRO15(prob, sev);

    return {
      fatorId: chave,
      fator: agg.normativa.fator,
      norma: agg.normativa.norma,
      descricao: agg.normativa.descricao,
      categoriaLabel: agg.normativa.categoriaLabel,
      dimensoes: Array.from(agg.dimensoes).sort(),
      scoreReal,
      scoreRisco,
      probabilidadeLabel: PROB15_LABELS[prob],
      severidadeLabel: getSeveridadeInfo(sev)?.label ?? String(sev),
      nivelLabel: NIVEL15_LABELS[nivel],
      nivelKey: nivel,
    };
  });

  return itens.sort(
    (a, b) => (NIVEL15_ORDEM[a.nivelKey] ?? 5) - (NIVEL15_ORDEM[b.nivelKey] ?? 5),
  );
}
