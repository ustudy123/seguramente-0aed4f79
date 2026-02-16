/**
 * Cálculos de período aquisitivo e concessivo de férias (CLT)
 *
 * Período aquisitivo: 12 meses de trabalho
 * Período concessivo: 12 meses seguintes para conceder as férias
 */

export interface PeriodoFerias {
  /** Início do período aquisitivo atual */
  inicioAquisitivo: Date;
  /** Fim do período aquisitivo atual */
  fimAquisitivo: Date;
  /** Fim do período concessivo (deadline para conceder) */
  fimConcessivo: Date;
  /** Dias restantes até o vencimento do concessivo */
  diasParaVencimento: number;
  /** Label formatado do período aquisitivo */
  periodoAquisitivoLabel: string;
  /** Label formatado do vencimento */
  vencimentoLabel: string;
  /** Status do vencimento */
  statusVencimento: "ok" | "alerta" | "vencido";
}

/**
 * Calcula o período aquisitivo atual de um colaborador.
 * Cada ciclo de 12 meses a partir da admissão gera um período aquisitivo.
 * O concessivo são os 12 meses seguintes.
 */
export function calcularPeriodoFerias(
  dataAdmissao: string | null,
  diasFeriasUsados: number = 0
): PeriodoFerias | null {
  if (!dataAdmissao) return null;

  const admissao = new Date(dataAdmissao + "T12:00:00");
  if (isNaN(admissao.getTime())) return null;

  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);

  // Calcular quantos ciclos completos já se passaram
  let ciclo = 0;
  let inicioAquisitivo = new Date(admissao);
  let fimAquisitivo = new Date(admissao);
  fimAquisitivo.setFullYear(fimAquisitivo.getFullYear() + 1);
  fimAquisitivo.setDate(fimAquisitivo.getDate() - 1);

  // Avançar para o período aquisitivo mais recente (que já completou ou está em curso)
  while (true) {
    const proximoInicio = new Date(inicioAquisitivo);
    proximoInicio.setFullYear(proximoInicio.getFullYear() + 1);
    
    if (proximoInicio > hoje) break;
    
    // Verificar se o período anterior não teve férias usadas — se sim, é o que importa
    // Para simplificação, avançamos ao período mais recente que ainda não venceu
    inicioAquisitivo = proximoInicio;
    fimAquisitivo = new Date(proximoInicio);
    fimAquisitivo.setFullYear(fimAquisitivo.getFullYear() + 1);
    fimAquisitivo.setDate(fimAquisitivo.getDate() - 1);
    ciclo++;
  }

  // Se o colaborador tem menos de 12 meses, mostrar período em curso
  if (ciclo === 0) {
    // Período aquisitivo em andamento, ainda não completou
    const fimConcessivo = new Date(fimAquisitivo);
    fimConcessivo.setFullYear(fimConcessivo.getFullYear() + 1);

    const diasParaVencimento = Math.ceil(
      (fimConcessivo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      inicioAquisitivo,
      fimAquisitivo,
      fimConcessivo,
      diasParaVencimento,
      periodoAquisitivoLabel: formatPeriodo(inicioAquisitivo, fimAquisitivo),
      vencimentoLabel: formatDate(fimConcessivo),
      statusVencimento: "ok",
    };
  }

  // Período concessivo: 12 meses após o fim do aquisitivo
  const fimConcessivo = new Date(fimAquisitivo);
  fimConcessivo.setFullYear(fimConcessivo.getFullYear() + 1);

  const diasParaVencimento = Math.ceil(
    (fimConcessivo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
  );

  let statusVencimento: "ok" | "alerta" | "vencido" = "ok";
  if (diasParaVencimento <= 0) {
    statusVencimento = "vencido";
  } else if (diasParaVencimento <= 90) {
    statusVencimento = "alerta";
  }

  return {
    inicioAquisitivo,
    fimAquisitivo,
    fimConcessivo,
    diasParaVencimento,
    periodoAquisitivoLabel: formatPeriodo(inicioAquisitivo, fimAquisitivo),
    vencimentoLabel: formatDate(fimConcessivo),
    statusVencimento,
  };
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatPeriodo(inicio: Date, fim: Date): string {
  const fmtShort = (d: Date) =>
    d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  return `${fmtShort(inicio)} — ${fmtShort(fim)}`;
}

/**
 * Valida fracionamento de férias conforme CLT (Art. 134 §1°)
 * - Máximo 3 períodos
 * - Um deles não pode ser inferior a 14 dias
 * - Nenhum pode ser inferior a 5 dias
 */
export function validarFracionamentoCLT(
  diasSolicitados: number,
  fracionamentosAnteriores: number[] = []
): { valido: boolean; erro?: string } {
  // Validação do período atual
  if (diasSolicitados < 5) {
    return { valido: false, erro: "O período de férias não pode ser inferior a 5 dias corridos (Art. 134, §1° CLT)." };
  }

  const todosperiodos = [...fracionamentosAnteriores, diasSolicitados];

  if (todosperiodos.length > 3) {
    return { valido: false, erro: "As férias podem ser fracionadas em no máximo 3 períodos (Art. 134, §1° CLT)." };
  }

  // Pelo menos um período ≥ 14 dias
  const temPeriodoLongo = todosperiodos.some((d) => d >= 14);
  if (!temPeriodoLongo && todosperiodos.length > 1) {
    return { valido: false, erro: "Pelo menos um dos períodos deve ter no mínimo 14 dias corridos (Art. 134, §1° CLT)." };
  }

  // Nenhum pode ser < 5
  const temPeriodoCurto = todosperiodos.some((d) => d < 5);
  if (temPeriodoCurto) {
    return { valido: false, erro: "Nenhum período de férias pode ser inferior a 5 dias corridos (Art. 134, §1° CLT)." };
  }

  return { valido: true };
}
