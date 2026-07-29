/**
 * Evidência NR-1 — férias como indicador de risco psicossocial (Fase 4).
 *
 * O DRF (seção 9) posiciona isto como o diferencial do YourEyes: ter SST, RH e
 * psicossocial na mesma base permite cruzar descanso efetivo com risco
 * organizacional e PRODUZIR EVIDÊNCIA para o inventário de riscos da NR-1
 * (Portaria MTE 1.419/2024, que incorporou fatores psicossociais).
 *
 * O cruzamento em si já existe no useINR (que combina férias vencidas,
 * sobrecarga, ações atrasadas, humor, afastamentos num score por colaborador).
 * O que faltava é a SAÍDA 9.2: um bloco estruturado, agregado por departamento,
 * que demonstre monitoramento e controle — não uma conveniência do DP, mas um
 * item de compliance.
 *
 * Esta lib não recalcula risco; consome o ranking do INR e o organiza como
 * evidência. Mantém a fonte única.
 */
import type { INRColaborador } from "@/hooks/useINR";

export interface EvidenciaDepartamento {
  departamento: string;
  totalColaboradores: number;
  /** Média do score de risco de recuperação (INR) da área. */
  scoreMedio: number;
  criticos: number;
  altos: number;
  comFeriasVencidas: number;
  /** Índice de descanso: % da área SEM férias vencidas. Menor = pior. */
  indiceDescanso: number;
  /** Classificação para o inventário. */
  nivelArea: "baixo" | "moderado" | "alto" | "critico";
  /** Nomes (primeiro nome) dos casos que puxam o risco, para a memória. */
  destaques: string[];
}

export interface EvidenciaNR1 {
  geradoEm: string;
  totalColaboradores: number;
  criticos: number;
  altos: number;
  comFeriasVencidas: number;
  indiceDescansoGeral: number;
  departamentos: EvidenciaDepartamento[];
  /** As correlações da seção 9.1 que os dados sustentam. */
  achados: string[];
}

function nivelPorScore(score: number): EvidenciaDepartamento["nivelArea"] {
  if (score >= 75) return "critico";
  if (score >= 50) return "alto";
  if (score >= 25) return "moderado";
  return "baixo";
}

/**
 * Monta a evidência a partir do ranking do INR. Agrega por departamento e
 * deriva os achados da seção 9.1 que os dados de fato sustentam (não inventa
 * correlação sem base).
 */
export function gerarEvidenciaNR1(ranking: INRColaborador[]): EvidenciaNR1 {
  const porDepto = new Map<string, INRColaborador[]>();
  for (const c of ranking) {
    const d = c.departamento || "Sem departamento";
    (porDepto.get(d) ?? porDepto.set(d, []).get(d)!).push(c);
  }

  const departamentos: EvidenciaDepartamento[] = [];
  for (const [departamento, lista] of porDepto) {
    const total = lista.length;
    const scoreMedio = Math.round(lista.reduce((s, c) => s + c.score, 0) / total);
    const criticos = lista.filter(c => c.nivel === "critico").length;
    const altos = lista.filter(c => c.nivel === "alto").length;
    const vencidas = lista.filter(c => c.feriasVencidas).length;
    const indiceDescanso = Math.round(((total - vencidas) / total) * 100);
    departamentos.push({
      departamento,
      totalColaboradores: total,
      scoreMedio,
      criticos,
      altos,
      comFeriasVencidas: vencidas,
      indiceDescanso,
      nivelArea: nivelPorScore(scoreMedio),
      destaques: lista
        .filter(c => c.nivel === "critico" || c.nivel === "alto")
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(c => c.nome.split(" ")[0]),
    });
  }
  departamentos.sort((a, b) => b.scoreMedio - a.scoreMedio);

  const total = ranking.length;
  const criticos = ranking.filter(c => c.nivel === "critico").length;
  const altos = ranking.filter(c => c.nivel === "alto").length;
  const vencidas = ranking.filter(c => c.feriasVencidas).length;

  // Achados — só os que os dados sustentam (seção 9.1).
  const achados: string[] = [];
  const comSobrecarga = ranking.filter(c =>
    c.feriasVencidas && c.fatores.some(f => f.fonte === "Sobrecarga" || f.fonte.includes("Horas")));
  if (comSobrecarga.length > 0) {
    achados.push(
      `${comSobrecarga.length} colaborador(es) acumulam férias vencidas E sobrecarga de trabalho — ` +
      `sinal de sobrecarga organizacional a registrar no inventário (NR-1).`,
    );
  }
  const deptoCritico = departamentos.filter(d => d.nivelArea === "critico" || d.nivelArea === "alto");
  if (deptoCritico.length > 0) {
    achados.push(
      `${deptoCritico.length} departamento(s) com índice de risco elevado: ` +
      `${deptoCritico.map(d => d.departamento).join(", ")}. Recomenda-se avaliação psicossocial dirigida à área.`,
    );
  }
  const baixoDescanso = departamentos.filter(d => d.indiceDescanso < 70);
  if (baixoDescanso.length > 0) {
    achados.push(
      `${baixoDescanso.length} área(s) com baixo índice de descanso efetivo (< 70%): ` +
      `${baixoDescanso.map(d => `${d.departamento} (${d.indiceDescanso}%)`).join(", ")}.`,
    );
  }
  if (achados.length === 0) {
    achados.push("Nenhum fator organizacional de risco elevado identificado no período. Manter monitoramento.");
  }

  return {
    geradoEm: new Date().toISOString(),
    totalColaboradores: total,
    criticos,
    altos,
    comFeriasVencidas: vencidas,
    indiceDescansoGeral: total > 0 ? Math.round(((total - vencidas) / total) * 100) : 100,
    departamentos,
    achados,
  };
}

export const NIVEL_LABEL: Record<EvidenciaDepartamento["nivelArea"], { label: string; cls: string }> = {
  baixo:    { label: "Baixo",    cls: "text-emerald-700 bg-emerald-100" },
  moderado: { label: "Moderado", cls: "text-blue-700 bg-blue-100" },
  alto:     { label: "Alto",     cls: "text-amber-700 bg-amber-100" },
  critico:  { label: "Crítico",  cls: "text-red-700 bg-red-100" },
};
