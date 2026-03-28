/**
 * Motor de Cálculo: Adicional Noturno
 * CLT Art. 73 — Trabalho entre 22h e 5h (urbano)
 *
 * - Adicional mínimo 20% sobre hora diurna
 * - Hora noturna reduzida: 52min30s = 7/8 da hora normal
 * - Prorrogação: horas após 5h em continuidade ao turno noturno
 *   também recebem adicional (Súmula 60 TST, II)
 */

export interface AdicionalNoturnoInput {
  salarioBase: number;
  jornadaMensalHoras?: number;       // padrão 220h
  horasNoturnasTrabalhadas: number;   // horas-relógio (ex: 7h efetivas)
  percentualAdicional?: number;       // padrão 20%
  aplicarHoraReduzida?: boolean;      // padrão true (urbano)
  horasProrrogacao?: number;          // horas após 5h em continuidade
}

export interface AdicionalNoturnoResult {
  valorHoraDiurna: number;
  valorHoraNoturna: number;
  horasRelogio: number;
  horasConvertidas: number;          // horas-relógio → horas fictas (÷ 52:30)
  horasExcedentesNoturnas: number;   // diferença horas convertidas - relógio
  valorAdicional: number;
  valorProrrogacao: number;
  totalAdicionalNoturno: number;
  fundamentacao: string;
}

/**
 * Converte horas-relógio noturnas em horas fictas (52:30 → 60min)
 * Fator: 60/52.5 = 8/7 ≈ 1.142857
 */
export function converterHoraNoturna(horasRelogio: number): number {
  return +(horasRelogio * (60 / 52.5)).toFixed(4);
}

/**
 * Calcula adicional noturno com hora reduzida
 */
export function calcularAdicionalNoturno(input: AdicionalNoturnoInput): AdicionalNoturnoResult {
  const {
    salarioBase,
    jornadaMensalHoras = 220,
    horasNoturnasTrabalhadas,
    percentualAdicional = 20,
    aplicarHoraReduzida = true,
    horasProrrogacao = 0,
  } = input;

  const valorHoraDiurna = +(salarioBase / jornadaMensalHoras).toFixed(4);

  // Hora noturna com adicional
  const valorHoraNoturna = +(valorHoraDiurna * (1 + percentualAdicional / 100)).toFixed(4);

  // Conversão hora reduzida (urbano: 52:30 = 7/8 hora)
  const horasConvertidas = aplicarHoraReduzida
    ? converterHoraNoturna(horasNoturnasTrabalhadas)
    : horasNoturnasTrabalhadas;

  // Horas excedentes geradas pela redução (serão pagas como extras noturnas se ultrapassar jornada)
  const horasExcedentesNoturnas = +(horasConvertidas - horasNoturnasTrabalhadas).toFixed(4);

  // Valor do adicional = diferença entre hora noturna e diurna × horas convertidas
  const valorAdicional = +(horasConvertidas * (valorHoraNoturna - valorHoraDiurna)).toFixed(2);

  // Prorrogação (Súmula 60 TST, II)
  const valorProrrogacao = +(horasProrrogacao * (valorHoraNoturna - valorHoraDiurna)).toFixed(2);

  const totalAdicionalNoturno = +(valorAdicional + valorProrrogacao).toFixed(2);

  return {
    valorHoraDiurna,
    valorHoraNoturna,
    horasRelogio: horasNoturnasTrabalhadas,
    horasConvertidas,
    horasExcedentesNoturnas,
    valorAdicional,
    valorProrrogacao,
    totalAdicionalNoturno,
    fundamentacao: `Adicional noturno conforme CLT art. 73. `
      + `Hora diurna: R$ ${valorHoraDiurna.toFixed(2)}. `
      + `Hora noturna (+${percentualAdicional}%): R$ ${valorHoraNoturna.toFixed(2)}. `
      + `${horasNoturnasTrabalhadas}h relógio → ${horasConvertidas.toFixed(2)}h fictas (fator 60/52,5). `
      + `Adicional: R$ ${valorAdicional.toFixed(2)}`
      + (horasProrrogacao > 0 ? ` + Prorrogação ${horasProrrogacao}h: R$ ${valorProrrogacao.toFixed(2)}` : '')
      + `. Total: R$ ${totalAdicionalNoturno.toFixed(2)}.`,
  };
}
