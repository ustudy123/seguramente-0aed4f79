/**
 * Motor de Cálculo: Insalubridade, Periculosidade e Prevalência
 * Conforme CLT art. 192, 193 e art. 193 §2º
 */

// Salário mínimo 2025
export const SALARIO_MINIMO_2025 = 1518.00;

export interface ConfigInsalubridade {
  ativa: boolean;
  grau: 'minimo' | 'medio' | 'maximo';
  agenteNocivo?: string;
  baseCalculo: 'salario_minimo' | 'piso_convencional';
  valorBaseCustom?: number; // usado quando baseCalculo = piso_convencional
}

export interface ConfigPericulosidade {
  ativa: boolean;
  tipo?: string;
}

export interface ConfigAposentadoriaEspecial {
  ativa: boolean;
  anos?: 15 | 20 | 25;
  dataInicioExposicao?: string;
}

export interface ResultadoAdicionais {
  insalubridade: {
    ativa: boolean;
    grau?: string;
    percentual: number;
    baseCalculo: number;
    valor: number;
  };
  periculosidade: {
    ativa: boolean;
    percentual: number;
    baseCalculo: number;
    valor: number;
  };
  adicionalAplicado: 'insalubridade' | 'periculosidade' | 'nenhum';
  valorAplicado: number;
  fundamentacaoLegal: string;
  aposentadoriaEspecial: {
    ativa: boolean;
    anos?: number;
  };
}

const PERCENTUAIS_INSALUBRIDADE: Record<string, number> = {
  minimo: 10,
  medio: 20,
  maximo: 40,
};

/**
 * Calcula insalubridade e periculosidade com regra de prevalência CLT art. 193 §2º
 */
export function calcularAdicionais(params: {
  salarioBase: number;
  insalubridade?: ConfigInsalubridade;
  periculosidade?: ConfigPericulosidade;
  aposentadoriaEspecial?: ConfigAposentadoriaEspecial;
  salarioMinimo?: number;
}): ResultadoAdicionais {
  const {
    salarioBase,
    insalubridade,
    periculosidade,
    aposentadoriaEspecial,
    salarioMinimo = SALARIO_MINIMO_2025,
  } = params;

  // Calcular insalubridade
  let valorInsalubridade = 0;
  let percentualInsalubridade = 0;
  let baseInsalubridade = 0;

  if (insalubridade?.ativa && insalubridade.grau) {
    percentualInsalubridade = PERCENTUAIS_INSALUBRIDADE[insalubridade.grau] || 0;
    baseInsalubridade = insalubridade.baseCalculo === 'piso_convencional' && insalubridade.valorBaseCustom
      ? insalubridade.valorBaseCustom
      : salarioMinimo;
    valorInsalubridade = +(baseInsalubridade * percentualInsalubridade / 100).toFixed(2);
  }

  // Calcular periculosidade (30% sobre salário base)
  let valorPericulosidade = 0;
  const percentualPericulosidade = 30;

  if (periculosidade?.ativa) {
    valorPericulosidade = +(salarioBase * percentualPericulosidade / 100).toFixed(2);
  }

  // Regra de prevalência: art. 193, §2º da CLT
  let adicionalAplicado: 'insalubridade' | 'periculosidade' | 'nenhum' = 'nenhum';
  let valorAplicado = 0;
  let fundamentacaoLegal = '';

  if (insalubridade?.ativa && periculosidade?.ativa) {
    // Ambos ativos: aplica o mais vantajoso
    if (valorPericulosidade >= valorInsalubridade) {
      adicionalAplicado = 'periculosidade';
      valorAplicado = valorPericulosidade;
      fundamentacaoLegal = `Colaborador enquadrado tecnicamente em insalubridade (R$ ${valorInsalubridade.toFixed(2)}) e periculosidade (R$ ${valorPericulosidade.toFixed(2)}). Aplicado adicional de periculosidade por ser mais vantajoso, conforme art. 193, §2º da CLT. Vedada a cumulatividade.`;
    } else {
      adicionalAplicado = 'insalubridade';
      valorAplicado = valorInsalubridade;
      fundamentacaoLegal = `Colaborador enquadrado tecnicamente em insalubridade (R$ ${valorInsalubridade.toFixed(2)}) e periculosidade (R$ ${valorPericulosidade.toFixed(2)}). Aplicado adicional de insalubridade por ser mais vantajoso, conforme art. 193, §2º da CLT. Vedada a cumulatividade.`;
    }
  } else if (insalubridade?.ativa) {
    adicionalAplicado = 'insalubridade';
    valorAplicado = valorInsalubridade;
    fundamentacaoLegal = `Adicional de insalubridade grau ${insalubridade.grau} (${percentualInsalubridade}%), conforme NR-15 e art. 192 da CLT.`;
  } else if (periculosidade?.ativa) {
    adicionalAplicado = 'periculosidade';
    valorAplicado = valorPericulosidade;
    fundamentacaoLegal = `Adicional de periculosidade (30%), conforme NR-16 e art. 193 da CLT.`;
  }

  return {
    insalubridade: {
      ativa: insalubridade?.ativa || false,
      grau: insalubridade?.grau,
      percentual: percentualInsalubridade,
      baseCalculo: baseInsalubridade,
      valor: valorInsalubridade,
    },
    periculosidade: {
      ativa: periculosidade?.ativa || false,
      percentual: percentualPericulosidade,
      baseCalculo: salarioBase,
      valor: valorPericulosidade,
    },
    adicionalAplicado,
    valorAplicado,
    fundamentacaoLegal,
    aposentadoriaEspecial: {
      ativa: aposentadoriaEspecial?.ativa || false,
      anos: aposentadoriaEspecial?.anos,
    },
  };
}

/**
 * Gera o provento variável para inclusão na folha mensal
 */
export function gerarProventoAdicional(resultado: ResultadoAdicionais): {
  descricao: string;
  valor: number;
  incide_inss: boolean;
  incide_irrf: boolean;
  incide_fgts: boolean;
} | null {
  if (resultado.adicionalAplicado === 'nenhum' || resultado.valorAplicado === 0) {
    return null;
  }

  const descricao = resultado.adicionalAplicado === 'insalubridade'
    ? `Adicional de Insalubridade (${resultado.insalubridade.percentual}%)`
    : `Adicional de Periculosidade (30%)`;

  return {
    descricao,
    valor: resultado.valorAplicado,
    incide_inss: true,
    incide_irrf: true,
    incide_fgts: true,
  };
}
