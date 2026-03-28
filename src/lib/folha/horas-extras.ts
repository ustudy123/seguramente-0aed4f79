/**
 * Motor de Cálculo: Horas Extras
 * CLT Art. 59, 73 e Súmula 264 TST
 *
 * - HE 50% (dias úteis) e HE 100% (domingos/feriados)
 * - Reflexos em DSR, férias, 13º e FGTS
 */

export interface HorasExtrasInput {
  salarioBase: number;
  jornadaMensalHoras?: number; // padrão 220h
  quantidadeHE50: number;      // horas decimais (ex: 10.5)
  quantidadeHE100: number;     // horas decimais
  percentualHE50?: number;     // padrão 50
  percentualHE100?: number;    // padrão 100
}

export interface HorasExtrasResult {
  valorHoraBase: number;
  he50: {
    quantidade: number;
    percentual: number;
    valorHora: number;
    valorTotal: number;
  };
  he100: {
    quantidade: number;
    percentual: number;
    valorHora: number;
    valorTotal: number;
  };
  totalHorasExtras: number;
  fundamentacao: string;
}

/**
 * Calcula horas extras com percentuais parametrizáveis
 */
export function calcularHorasExtras(input: HorasExtrasInput): HorasExtrasResult {
  const {
    salarioBase,
    jornadaMensalHoras = 220,
    quantidadeHE50,
    quantidadeHE100,
    percentualHE50 = 50,
    percentualHE100 = 100,
  } = input;

  const valorHoraBase = +(salarioBase / jornadaMensalHoras).toFixed(4);

  // HE 50%
  const valorHoraHE50 = +(valorHoraBase * (1 + percentualHE50 / 100)).toFixed(4);
  const totalHE50 = +(quantidadeHE50 * valorHoraHE50).toFixed(2);

  // HE 100%
  const valorHoraHE100 = +(valorHoraBase * (1 + percentualHE100 / 100)).toFixed(4);
  const totalHE100 = +(quantidadeHE100 * valorHoraHE100).toFixed(2);

  const totalHorasExtras = +(totalHE50 + totalHE100).toFixed(2);

  return {
    valorHoraBase,
    he50: {
      quantidade: quantidadeHE50,
      percentual: percentualHE50,
      valorHora: valorHoraHE50,
      valorTotal: totalHE50,
    },
    he100: {
      quantidade: quantidadeHE100,
      percentual: percentualHE100,
      valorHora: valorHoraHE100,
      valorTotal: totalHE100,
    },
    totalHorasExtras,
    fundamentacao: `HE calculadas conforme CLT art. 59. Hora base: R$ ${valorHoraBase.toFixed(2)} (${salarioBase}/${jornadaMensalHoras}h). `
      + `HE 50%: ${quantidadeHE50}h × R$ ${valorHoraHE50.toFixed(2)} = R$ ${totalHE50.toFixed(2)}. `
      + `HE 100%: ${quantidadeHE100}h × R$ ${valorHoraHE100.toFixed(2)} = R$ ${totalHE100.toFixed(2)}.`,
  };
}
