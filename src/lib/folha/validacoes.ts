/**
 * Motor de Validação Legal da Folha de Pagamento
 * CLT Art. 76, 462, 649 + Reforma Trabalhista
 *
 * Validações:
 * - Salário mínimo (R$ 1.518,00 em 2025)
 * - Limite de descontos (não pode comprometer salário mínimo, salvo exceções legais)
 * - Pensão alimentícia (desconto obrigatório judicial)
 * - Piso convencional (CCT/ACT)
 */

import { SALARIO_MINIMO_2025 } from './adicionais';

export interface ValidacaoAlerta {
  tipo: 'erro' | 'aviso' | 'info';
  codigo: string;
  mensagem: string;
  fundamentacao: string;
  bloqueante: boolean;
}

export interface PensaoAlimenticia {
  beneficiario: string;
  tipo: 'percentual' | 'valor_fixo';
  valor: number;          // percentual (ex: 30) ou valor fixo
  baseCalculo: 'liquido' | 'bruto';
  numeroOficio?: string;
  varaOrigem?: string;
}

export interface ConfigCCT {
  sindicato: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  pisoSalarial?: number;
  adicionalHE50?: number;   // ex: 60 (60% ao invés de 50%)
  adicionalHE100?: number;
  adicionalNoturno?: number; // ex: 25 (25% ao invés de 20%)
  beneficiosObrigatorios?: { tipo: string; descricao: string; valorMinimo: number }[];
}

// ===================== VALIDAÇÕES =====================

/**
 * Valida salário base contra o mínimo legal e piso convencional
 */
export function validarSalarioMinimo(
  salarioBase: number,
  jornadaMensalHoras: number = 220,
  pisoConvencional?: number,
  salarioMinimo: number = SALARIO_MINIMO_2025
): ValidacaoAlerta[] {
  const alertas: ValidacaoAlerta[] = [];

  // Proporcionalizar para jornadas parciais
  const minimoProporcion = +(salarioMinimo * jornadaMensalHoras / 220).toFixed(2);

  if (salarioBase < minimoProporcion) {
    alertas.push({
      tipo: 'erro',
      codigo: 'SAL_ABAIXO_MINIMO',
      mensagem: `Salário R$ ${salarioBase.toFixed(2)} está abaixo do mínimo proporcional R$ ${minimoProporcion.toFixed(2)} (${jornadaMensalHoras}h/mês).`,
      fundamentacao: 'CLT art. 76 — nenhum empregado pode receber salário inferior ao mínimo.',
      bloqueante: true,
    });
  }

  if (pisoConvencional && salarioBase < pisoConvencional) {
    alertas.push({
      tipo: 'erro',
      codigo: 'SAL_ABAIXO_PISO',
      mensagem: `Salário R$ ${salarioBase.toFixed(2)} está abaixo do piso convencional R$ ${pisoConvencional.toFixed(2)}.`,
      fundamentacao: 'CLT art. 611-A — convenção coletiva prevalece quando mais benéfica.',
      bloqueante: true,
    });
  }

  return alertas;
}

/**
 * Valida limite de descontos — não pode comprometer salário mínimo
 * Exceções: pensão alimentícia, INSS, IRRF
 */
export function validarLimiteDescontos(
  salarioBase: number,
  totalDescontos: number,
  descontosExcetuados: number = 0, // pensão, INSS, IRRF
  salarioMinimo: number = SALARIO_MINIMO_2025
): ValidacaoAlerta[] {
  const alertas: ValidacaoAlerta[] = [];
  const descontosEfetivos = totalDescontos - descontosExcetuados;
  const liquidoAposDescontos = salarioBase - descontosEfetivos;

  if (liquidoAposDescontos < salarioMinimo && descontosEfetivos > 0) {
    alertas.push({
      tipo: 'aviso',
      codigo: 'DESC_COMPROMETE_MINIMO',
      mensagem: `Descontos facultativos (R$ ${descontosEfetivos.toFixed(2)}) comprometem o salário abaixo do mínimo (R$ ${salarioMinimo.toFixed(2)}). Líquido após descontos: R$ ${liquidoAposDescontos.toFixed(2)}.`,
      fundamentacao: 'CLT art. 462 — descontos facultativos não podem comprometer o mínimo necessário à subsistência.',
      bloqueante: false,
    });
  }

  // Desconto total > 70% do bruto (regra prudencial)
  const percentualDesconto = (totalDescontos / salarioBase) * 100;
  if (percentualDesconto > 70) {
    alertas.push({
      tipo: 'aviso',
      codigo: 'DESC_ACIMA_70PCT',
      mensagem: `Total de descontos representa ${percentualDesconto.toFixed(1)}% do salário bruto.`,
      fundamentacao: 'Boa prática: descontos totais não devem ultrapassar 70% da remuneração bruta.',
      bloqueante: false,
    });
  }

  return alertas;
}

// ===================== PENSÃO ALIMENTÍCIA =====================

/**
 * Calcula pensão alimentícia conforme ofício judicial
 */
export function calcularPensaoAlimenticia(
  pensoes: PensaoAlimenticia[],
  salarioBruto: number,
  salarioLiquido: number
): {
  descontos: { descricao: string; valor: number; beneficiario: string }[];
  totalPensao: number;
  fundamentacao: string;
} {
  const descontos: { descricao: string; valor: number; beneficiario: string }[] = [];
  let totalPensao = 0;

  for (const p of pensoes) {
    let valor = 0;
    const base = p.baseCalculo === 'liquido' ? salarioLiquido : salarioBruto;

    if (p.tipo === 'percentual') {
      valor = +(base * p.valor / 100).toFixed(2);
    } else {
      valor = +p.valor.toFixed(2);
    }

    descontos.push({
      descricao: `Pensão Alimentícia - ${p.beneficiario}`,
      valor,
      beneficiario: p.beneficiario,
    });
    totalPensao += valor;
  }

  return {
    descontos,
    totalPensao: +totalPensao.toFixed(2),
    fundamentacao: `Pensão alimentícia conforme determinação judicial. ${pensoes.map(p =>
      `${p.beneficiario}: ${p.tipo === 'percentual' ? p.valor + '% s/' + p.baseCalculo : 'R$ ' + p.valor.toFixed(2)}`
      + (p.numeroOficio ? ` (Ofício ${p.numeroOficio})` : '')
    ).join('; ')}.`,
  };
}

// ===================== CCT / CONVENÇÃO COLETIVA =====================

/**
 * Aplica regras de CCT sobre os parâmetros da folha
 * Retorna parâmetros ajustados conforme convenção
 */
export function aplicarCCT(
  cct: ConfigCCT,
  params: {
    salarioBase: number;
    percentualHE50: number;
    percentualHE100: number;
    percentualNoturno: number;
  }
): {
  parametrosAjustados: typeof params;
  alertas: ValidacaoAlerta[];
  ajustesAplicados: string[];
} {
  const ajustados = { ...params };
  const alertas: ValidacaoAlerta[] = [];
  const ajustes: string[] = [];

  // Piso
  if (cct.pisoSalarial && params.salarioBase < cct.pisoSalarial) {
    alertas.push({
      tipo: 'erro',
      codigo: 'CCT_PISO',
      mensagem: `Salário R$ ${params.salarioBase.toFixed(2)} abaixo do piso CCT ${cct.sindicato}: R$ ${cct.pisoSalarial.toFixed(2)}.`,
      fundamentacao: `CCT ${cct.sindicato} (${cct.vigenciaInicio} a ${cct.vigenciaFim}).`,
      bloqueante: true,
    });
  }

  // HE 50%
  if (cct.adicionalHE50 && cct.adicionalHE50 > params.percentualHE50) {
    ajustados.percentualHE50 = cct.adicionalHE50;
    ajustes.push(`HE 50% ajustado para ${cct.adicionalHE50}% (CCT ${cct.sindicato})`);
  }

  // HE 100%
  if (cct.adicionalHE100 && cct.adicionalHE100 > params.percentualHE100) {
    ajustados.percentualHE100 = cct.adicionalHE100;
    ajustes.push(`HE 100% ajustado para ${cct.adicionalHE100}% (CCT ${cct.sindicato})`);
  }

  // Noturno
  if (cct.adicionalNoturno && cct.adicionalNoturno > params.percentualNoturno) {
    ajustados.percentualNoturno = cct.adicionalNoturno;
    ajustes.push(`Adicional Noturno ajustado para ${cct.adicionalNoturno}% (CCT ${cct.sindicato})`);
  }

  return {
    parametrosAjustados: ajustados,
    alertas,
    ajustesAplicados: ajustes,
  };
}

/**
 * Executa todas as validações legais da folha de uma vez
 */
export function validarFolhaCompleta(params: {
  salarioBase: number;
  totalDescontos: number;
  descontosLegais: number; // INSS + IRRF + pensão
  jornadaMensalHoras?: number;
  pisoConvencional?: number;
  cct?: ConfigCCT;
}): ValidacaoAlerta[] {
  const {
    salarioBase,
    totalDescontos,
    descontosLegais,
    jornadaMensalHoras = 220,
    pisoConvencional,
    cct,
  } = params;

  const alertas: ValidacaoAlerta[] = [];

  // 1. Salário mínimo
  alertas.push(...validarSalarioMinimo(salarioBase, jornadaMensalHoras, pisoConvencional));

  // 2. Limite de descontos
  alertas.push(...validarLimiteDescontos(salarioBase, totalDescontos, descontosLegais));

  // 3. CCT piso
  if (cct?.pisoSalarial && salarioBase < cct.pisoSalarial) {
    alertas.push({
      tipo: 'erro',
      codigo: 'CCT_PISO_VIOLADO',
      mensagem: `Salário abaixo do piso CCT ${cct.sindicato} (R$ ${cct.pisoSalarial.toFixed(2)}).`,
      fundamentacao: `Convenção Coletiva ${cct.sindicato}, vigência ${cct.vigenciaInicio} a ${cct.vigenciaFim}.`,
      bloqueante: true,
    });
  }

  return alertas;
}
