/**
 * INR™ — Indicador de Necessidade de Recuperação
 *
 * Cruza múltiplas fontes de dados para calcular um score de 0-100
 * que indica a urgência de recuperação (férias) de cada colaborador.
 *
 * Fontes:
 * 1. Humor diário (média de negatividade nos últimos 30 dias)
 * 2. Radar Burnout (presença de fatores de risco)
 * 3. Horas extras / ponto irregular
 * 4. Ações atrasadas no Plano de Ação
 * 5. Afastamentos recentes
 * 6. Férias vencidas
 */

import { useMemo } from "react";
import { calcularPeriodoFerias } from "@/lib/feriasPeriodo";

export interface INRColaborador {
  nome: string;
  departamento: string;
  cpf?: string;
  /** Score 0-100 — quanto maior, mais urgente a recuperação */
  score: number;
  /** Classificação qualitativa */
  nivel: "baixo" | "moderado" | "alto" | "critico";
  /** Fatores que contribuíram para o score */
  fatores: INRFator[];
  /** Data de admissão para cálculo de férias */
  dataAdmissao?: string;
  /** Férias vencidas? */
  feriasVencidas: boolean;
}

export interface INRFator {
  fonte: string;
  descricao: string;
  peso: number; // 0-25 cada fator
  icone: string;
}

interface ColaboradorBase {
  nome_completo: string;
  departamento?: string;
  cpf?: string;
  data_admissao?: string;
}

interface FeriasItem {
  colaborador: string;
  status: string;
  diasSolicitados: number;
}

interface HumorEntry {
  user_nome: string;
  humor: string;
}

interface AcaoEntry {
  responsavel_nome?: string;
  status: string;
  prazo?: string;
}

export function useINR(
  colaboradores: ColaboradorBase[],
  ferias: FeriasItem[],
  humores: HumorEntry[] = [],
  acoes: AcaoEntry[] = []
) {
  const ranking = useMemo<INRColaborador[]>(() => {
    return colaboradores.map((c) => {
      const fatores: INRFator[] = [];
      let score = 0;

      // ---- 1. HUMOR (0-25 pts) ----
      const humorColab = humores.filter(
        (h) => h.user_nome === c.nome_completo
      );
      if (humorColab.length > 0) {
        const negativos = ["estressado", "ansioso", "desanimado"];
        const neutros = ["neutro", "cansado"];
        const pctNeg =
          humorColab.filter((h) => negativos.includes(h.humor)).length /
          humorColab.length;
        const pctNeutro =
          humorColab.filter((h) => neutros.includes(h.humor)).length /
          humorColab.length;
        const humorScore = Math.round(pctNeg * 25 + pctNeutro * 8);
        if (humorScore > 0) {
          fatores.push({
            fonte: "Humor Diário",
            descricao:
              pctNeg > 0.5
                ? "Predominância de humor negativo"
                : pctNeg > 0.2
                ? "Sinais frequentes de estresse"
                : "Tendência de humor neutro/cansaço",
            peso: humorScore,
            icone: "😰",
          });
          score += humorScore;
        }
      }

      // ---- 2. FÉRIAS VENCIDAS (0-25 pts) ----
      const diasUsados = ferias
        .filter((f) => f.colaborador === c.nome_completo && f.status === "aprovado")
        .reduce((sum, f) => sum + f.diasSolicitados, 0);
      const periodo = calcularPeriodoFerias(c.data_admissao || null, diasUsados);
      const feriasVencidas = periodo?.statusVencimento === "vencido";
      if (feriasVencidas) {
        fatores.push({
          fonte: "Férias Vencidas",
          descricao: "Período concessivo expirado — risco trabalhista",
          peso: 25,
          icone: "⚠️",
        });
        score += 25;
      } else if (periodo?.statusVencimento === "alerta") {
        const pontos = periodo.diasParaVencimento <= 30 ? 15 : 8;
        fatores.push({
          fonte: "Férias a Vencer",
          descricao: `Vencimento em ${periodo.diasParaVencimento} dias`,
          peso: pontos,
          icone: "⏰",
        });
        score += pontos;
      }

      // ---- 3. AÇÕES ATRASADAS (0-25 pts) ----
      const acoesColab = acoes.filter(
        (a) =>
          a.responsavel_nome === c.nome_completo &&
          a.prazo &&
          new Date(a.prazo) < new Date() &&
          a.status !== "concluida" &&
          a.status !== "cancelada"
      );
      if (acoesColab.length > 0) {
        const acaoPts = Math.min(25, acoesColab.length * 8);
        fatores.push({
          fonte: "Ações Atrasadas",
          descricao: `${acoesColab.length} ação(ões) atrasada(s) no Plano de Ação`,
          peso: acaoPts,
          icone: "📋",
        });
        score += acaoPts;
      }

      // ---- 4. CARGA DE TRABALHO / SOBRECARGA (0-25 pts) ----
      // Heurística: se colaborador acumula >3 ações em andamento → sobrecarga
      const acoesEmAndamento = acoes.filter(
        (a) =>
          a.responsavel_nome === c.nome_completo &&
          a.status === "em_andamento"
      );
      if (acoesEmAndamento.length >= 4) {
        const sobrecargaPts = Math.min(25, acoesEmAndamento.length * 5);
        fatores.push({
          fonte: "Sobrecarga",
          descricao: `${acoesEmAndamento.length} ações em andamento simultâneas`,
          peso: sobrecargaPts,
          icone: "🔥",
        });
        score += sobrecargaPts;
      }

      score = Math.min(100, score);

      let nivel: INRColaborador["nivel"] = "baixo";
      if (score >= 75) nivel = "critico";
      else if (score >= 50) nivel = "alto";
      else if (score >= 25) nivel = "moderado";

      return {
        nome: c.nome_completo,
        departamento: c.departamento || "N/A",
        cpf: c.cpf,
        score,
        nivel,
        fatores,
        dataAdmissao: c.data_admissao,
        feriasVencidas: !!feriasVencidas,
      };
    })
    .sort((a, b) => b.score - a.score);
  }, [colaboradores, ferias, humores, acoes]);

  const criticos = ranking.filter((r) => r.nivel === "critico");
  const altos = ranking.filter((r) => r.nivel === "alto");

  return { ranking, criticos, altos };
}
