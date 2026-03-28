/**
 * Motor de Cálculo: DSR (Descanso Semanal Remunerado) sobre Variáveis
 * CLT Art. 67 + Lei 605/49 + Súmula 172 TST
 *
 * Fórmula:
 *   DSR = (Total variáveis do mês / dias úteis) × domingos e feriados
 *
 * Variáveis que geram reflexo DSR:
 * - Horas extras (Súmula 172 TST)
 * - Adicional noturno (OJ-SDI1-97 TST)
 * - Comissões
 * - Gratificações variáveis
 */

export interface DSRInput {
  /** Valores variáveis que geram reflexo DSR */
  valoresVariaveis: {
    descricao: string;
    valor: number;
  }[];
  /** Dias úteis trabalhados no mês (excluindo DSR e feriados) */
  diasUteisMes: number;
  /** Domingos e feriados no mês */
  domingosFeriadosMes: number;
}

export interface DSRResult {
  totalVariaveis: number;
  diasUteis: number;
  domingosFeriados: number;
  valorDSR: number;
  detalhes: {
    descricao: string;
    valor: number;
    dsrProporcional: number;
  }[];
  fundamentacao: string;
}

/**
 * Retorna quantidade padrão de dias úteis e domingos/feriados para um mês
 * Pode ser usado quando não se tem o calendário exato
 */
export function diasPadraoMes(ano: number, mes: number, feriadosNoMes: number = 0): {
  diasUteis: number;
  domingosFeriados: number;
} {
  const diasNoMes = new Date(ano, mes, 0).getDate();
  let domingos = 0;

  for (let d = 1; d <= diasNoMes; d++) {
    const diaSemana = new Date(ano, mes - 1, d).getDay();
    if (diaSemana === 0) domingos++; // domingo
  }

  const domingosFeriados = domingos + feriadosNoMes;
  const diasUteis = diasNoMes - domingosFeriados;

  return { diasUteis, domingosFeriados };
}

/**
 * Calcula DSR sobre variáveis
 */
export function calcularDSR(input: DSRInput): DSRResult {
  const { valoresVariaveis, diasUteisMes, domingosFeriadosMes } = input;

  if (diasUteisMes <= 0 || domingosFeriadosMes <= 0) {
    return {
      totalVariaveis: 0,
      diasUteis: diasUteisMes,
      domingosFeriados: domingosFeriadosMes,
      valorDSR: 0,
      detalhes: [],
      fundamentacao: 'DSR não calculado: dias úteis ou domingos/feriados igual a zero.',
    };
  }

  const totalVariaveis = valoresVariaveis.reduce((s, v) => s + v.valor, 0);
  const fator = domingosFeriadosMes / diasUteisMes;

  const detalhes = valoresVariaveis.map(v => ({
    descricao: v.descricao,
    valor: v.valor,
    dsrProporcional: +(v.valor * fator).toFixed(2),
  }));

  const valorDSR = +(totalVariaveis * fator).toFixed(2);

  return {
    totalVariaveis: +totalVariaveis.toFixed(2),
    diasUteis: diasUteisMes,
    domingosFeriados: domingosFeriadosMes,
    valorDSR,
    detalhes,
    fundamentacao: `DSR conforme Lei 605/49 e Súmula 172 TST. `
      + `Total variáveis: R$ ${totalVariaveis.toFixed(2)} ÷ ${diasUteisMes} dias úteis × ${domingosFeriadosMes} DSR = R$ ${valorDSR.toFixed(2)}. `
      + `Variáveis incluídas: ${valoresVariaveis.map(v => v.descricao).join(', ')}.`,
  };
}
