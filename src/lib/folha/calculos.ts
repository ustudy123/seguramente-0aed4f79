/**
 * Motor de Cálculo da Folha de Pagamento
 * Implementa regras CLT para INSS, IRRF, FGTS, Férias, 13º e Rescisão
 */

// ===================== TIPOS =====================

export interface FaixaINSS {
  de: number;
  ate: number;
  aliquota: number;
}

export interface FaixaIRRF {
  de: number;
  ate: number;
  aliquota: number;
  deducao: number;
}

export interface TabelaINSS {
  id: string;
  faixas: FaixaINSS[];
  teto: number;
  vigencia_inicio: string;
}

export interface TabelaIRRF {
  id: string;
  faixas: FaixaIRRF[];
  deducao_por_dependente: number;
  vigencia_inicio: string;
}

export interface VinculoConfig {
  tipo_vinculo: string;
  inss_empregado: boolean;
  fgts: boolean;
  aliquota_fgts: number;
  multa_fgts_dispensa: number;
  direito_13: boolean;
  direito_ferias: boolean;
  direito_aviso_previo: boolean;
}

export interface ResultadoCalculo {
  base_inss: number;
  valor_inss: number;
  base_irrf: number;
  valor_irrf: number;
  base_fgts: number;
  valor_fgts: number;
  total_proventos: number;
  total_descontos: number;
  total_liquido: number;
  detalhes: Record<string, any>;
}

// ===================== TABELAS PADRÃO 2025 =====================

export const TABELA_INSS_2025: FaixaINSS[] = [
  { de: 0, ate: 1518.00, aliquota: 7.5 },
  { de: 1518.01, ate: 2793.88, aliquota: 9 },
  { de: 2793.89, ate: 4190.83, aliquota: 12 },
  { de: 4190.84, ate: 8157.41, aliquota: 14 },
];

export const TETO_INSS_2025 = 8157.41;

export const TABELA_IRRF_2025: FaixaIRRF[] = [
  { de: 0, ate: 2259.20, aliquota: 0, deducao: 0 },
  { de: 2259.21, ate: 2826.65, aliquota: 7.5, deducao: 169.44 },
  { de: 2826.66, ate: 3751.05, aliquota: 15, deducao: 381.44 },
  { de: 3751.06, ate: 4664.68, aliquota: 22.5, deducao: 662.77 },
  { de: 4664.69, ate: 999999999, aliquota: 27.5, deducao: 896.00 },
];

export const DEDUCAO_DEPENDENTE_IRRF_2025 = 189.59;

// ===================== MATRIZ PADRÃO DE ENCARGOS =====================

export const MATRIZ_VINCULOS_PADRAO: VinculoConfig[] = [
  { tipo_vinculo: "CLT_PRAZO_INDETERMINADO", inss_empregado: true, fgts: true, aliquota_fgts: 8, multa_fgts_dispensa: 40, direito_13: true, direito_ferias: true, direito_aviso_previo: true },
  { tipo_vinculo: "CLT_EXPERIENCIA", inss_empregado: true, fgts: true, aliquota_fgts: 8, multa_fgts_dispensa: 40, direito_13: true, direito_ferias: true, direito_aviso_previo: false },
  { tipo_vinculo: "CLT_INTERMITENTE", inss_empregado: true, fgts: true, aliquota_fgts: 8, multa_fgts_dispensa: 40, direito_13: true, direito_ferias: true, direito_aviso_previo: true },
  { tipo_vinculo: "CLT_TEMPO_PARCIAL", inss_empregado: true, fgts: true, aliquota_fgts: 8, multa_fgts_dispensa: 40, direito_13: true, direito_ferias: true, direito_aviso_previo: true },
  { tipo_vinculo: "APRENDIZ", inss_empregado: true, fgts: true, aliquota_fgts: 2, multa_fgts_dispensa: 0, direito_13: true, direito_ferias: true, direito_aviso_previo: false },
  { tipo_vinculo: "ESTAGIO", inss_empregado: false, fgts: false, aliquota_fgts: 0, multa_fgts_dispensa: 0, direito_13: false, direito_ferias: false, direito_aviso_previo: false },
  { tipo_vinculo: "TEMPORARIO_LEI6019", inss_empregado: true, fgts: true, aliquota_fgts: 8, multa_fgts_dispensa: 0, direito_13: true, direito_ferias: true, direito_aviso_previo: false },
  { tipo_vinculo: "PJ", inss_empregado: false, fgts: false, aliquota_fgts: 0, multa_fgts_dispensa: 0, direito_13: false, direito_ferias: false, direito_aviso_previo: false },
];

// ===================== FUNÇÕES DE CÁLCULO =====================

/**
 * Calcula INSS progressivo (faixa a faixa)
 */
export function calcularINSS(
  base: number,
  faixas: FaixaINSS[] = TABELA_INSS_2025,
  teto: number = TETO_INSS_2025
): { valor: number; baseEfetiva: number; detalhes: { faixa: string; aliquota: number; valor: number }[] } {
  const baseEfetiva = Math.min(base, teto);
  let valorTotal = 0;
  const detalhes: { faixa: string; aliquota: number; valor: number }[] = [];

  for (const faixa of faixas) {
    if (baseEfetiva <= 0) break;
    if (baseEfetiva < faixa.de) break;

    const limiteInferior = faixa.de;
    const limiteSuperior = Math.min(faixa.ate, baseEfetiva);
    const baseNaFaixa = limiteSuperior - limiteInferior + (faixa.de === 0 ? 0 : 0);
    const baseCalc = Math.min(baseEfetiva, faixa.ate) - (faixa.de > 0 ? faixa.de - 0.01 : 0);
    
    if (baseCalc <= 0) continue;
    
    const faixaBase = Math.min(baseEfetiva, faixa.ate) - Math.max(0, faixa.de - 0.01);
    if (faixaBase <= 0) continue;

    const valorFaixa = +(faixaBase * faixa.aliquota / 100).toFixed(2);
    valorTotal += valorFaixa;
    detalhes.push({
      faixa: `R$ ${faixa.de.toFixed(2)} a R$ ${faixa.ate.toFixed(2)}`,
      aliquota: faixa.aliquota,
      valor: valorFaixa,
    });
  }

  return { valor: +valorTotal.toFixed(2), baseEfetiva, detalhes };
}

/**
 * Calcula IRRF
 */
export function calcularIRRF(
  baseIRRF: number,
  dependentes: number = 0,
  faixas: FaixaIRRF[] = TABELA_IRRF_2025,
  deducaoDependente: number = DEDUCAO_DEPENDENTE_IRRF_2025
): { valor: number; baseEfetiva: number; faixa: string; aliquota: number } {
  const deducaoDep = dependentes * deducaoDependente;
  const baseEfetiva = baseIRRF - deducaoDep;

  if (baseEfetiva <= 0) return { valor: 0, baseEfetiva: 0, faixa: "Isento", aliquota: 0 };

  for (const faixa of faixas) {
    if (baseEfetiva >= faixa.de && baseEfetiva <= faixa.ate) {
      const valor = Math.max(0, +(baseEfetiva * faixa.aliquota / 100 - faixa.deducao).toFixed(2));
      return {
        valor,
        baseEfetiva,
        faixa: `R$ ${faixa.de.toFixed(2)} a R$ ${faixa.ate.toFixed(2)}`,
        aliquota: faixa.aliquota,
      };
    }
  }

  return { valor: 0, baseEfetiva, faixa: "Isento", aliquota: 0 };
}

/**
 * Calcula FGTS
 */
export function calcularFGTS(base: number, aliquota: number = 8): number {
  return +(base * aliquota / 100).toFixed(2);
}

/**
 * Calcula folha mensal completa para um colaborador
 */
export function calcularFolhaMensal(params: {
  salarioBase: number;
  proventosVariaveis?: { descricao: string; valor: number; incide_inss?: boolean; incide_irrf?: boolean; incide_fgts?: boolean }[];
  descontosExtras?: { descricao: string; valor: number }[];
  dependentesIRRF?: number;
  vinculoConfig?: VinculoConfig;
  tabelaINSS?: FaixaINSS[];
  tetoINSS?: number;
  tabelaIRRF?: FaixaIRRF[];
  deducaoDependente?: number;
}): ResultadoCalculo {
  const {
    salarioBase,
    proventosVariaveis = [],
    descontosExtras = [],
    dependentesIRRF = 0,
    vinculoConfig,
    tabelaINSS = TABELA_INSS_2025,
    tetoINSS = TETO_INSS_2025,
    tabelaIRRF = TABELA_IRRF_2025,
    deducaoDependente = DEDUCAO_DEPENDENTE_IRRF_2025,
  } = params;

  // 1. Total de proventos
  const totalProventosVar = proventosVariaveis.reduce((s, p) => s + p.valor, 0);
  const totalProventos = salarioBase + totalProventosVar;

  // 2. Base INSS (proventos que incidem)
  let baseINSS = salarioBase;
  proventosVariaveis.forEach(p => {
    if (p.incide_inss !== false) baseINSS += p.valor;
  });

  // 3. Calcular INSS
  let valorINSS = 0;
  let inssDetalhes: any = {};
  if (!vinculoConfig || vinculoConfig.inss_empregado) {
    const resultINSS = calcularINSS(baseINSS, tabelaINSS, tetoINSS);
    valorINSS = resultINSS.valor;
    inssDetalhes = resultINSS;
  }

  // 4. Base FGTS
  let baseFGTS = salarioBase;
  proventosVariaveis.forEach(p => {
    if (p.incide_fgts !== false) baseFGTS += p.valor;
  });

  // 5. Calcular FGTS
  const aliquotaFGTS = vinculoConfig?.aliquota_fgts ?? 8;
  const valorFGTS = (!vinculoConfig || vinculoConfig.fgts) ? calcularFGTS(baseFGTS, aliquotaFGTS) : 0;

  // 6. Base IRRF = total proventos - INSS
  let baseIRRF = salarioBase - valorINSS;
  proventosVariaveis.forEach(p => {
    if (p.incide_irrf !== false) baseIRRF += p.valor;
  });

  // 7. Calcular IRRF
  const resultIRRF = calcularIRRF(baseIRRF, dependentesIRRF, tabelaIRRF, deducaoDependente);
  const valorIRRF = resultIRRF.valor;

  // 8. Total descontos
  const totalDescontosExtras = descontosExtras.reduce((s, d) => s + d.valor, 0);
  const totalDescontos = valorINSS + valorIRRF + totalDescontosExtras;

  // 9. Líquido
  const totalLiquido = +(totalProventos - totalDescontos).toFixed(2);

  return {
    base_inss: +baseINSS.toFixed(2),
    valor_inss: valorINSS,
    base_irrf: +baseIRRF.toFixed(2),
    valor_irrf: valorIRRF,
    base_fgts: +baseFGTS.toFixed(2),
    valor_fgts: valorFGTS,
    total_proventos: +totalProventos.toFixed(2),
    total_descontos: +totalDescontos.toFixed(2),
    total_liquido: totalLiquido,
    detalhes: {
      inss: inssDetalhes,
      irrf: resultIRRF,
      fgts: { base: baseFGTS, aliquota: aliquotaFGTS, valor: valorFGTS },
      proventos: [{ descricao: "Salário Base", valor: salarioBase }, ...proventosVariaveis],
      descontos: [
        { descricao: "INSS", valor: valorINSS },
        { descricao: "IRRF", valor: valorIRRF },
        ...descontosExtras,
      ],
    },
  };
}

/**
 * Calcula férias
 */
export function calcularFerias(params: {
  remuneracaoBase: number;
  mediaVariaveis?: number;
  diasGozo: number;
  diasAbono?: number;
  emDobro?: boolean;
  vinculoConfig?: VinculoConfig;
  dependentesIRRF?: number;
}): {
  valor_ferias: number;
  valor_terco: number;
  valor_abono: number;
  valor_abono_terco: number;
  base_inss: number;
  valor_inss: number;
  base_irrf: number;
  valor_irrf: number;
  base_fgts: number;
  valor_fgts: number;
  total_bruto: number;
  total_descontos: number;
  total_liquido: number;
} {
  const { remuneracaoBase, mediaVariaveis = 0, diasGozo, diasAbono = 0, emDobro = false, vinculoConfig, dependentesIRRF = 0 } = params;
  const remTotal = remuneracaoBase + mediaVariaveis;
  const multiplicador = emDobro ? 2 : 1;

  // Valor das férias gozadas
  const valorFerias = +((remTotal / 30) * diasGozo * multiplicador).toFixed(2);
  const valorTerco = +(valorFerias / 3).toFixed(2);

  // Abono pecuniário
  const valorAbono = diasAbono > 0 ? +((remTotal / 30) * diasAbono).toFixed(2) : 0;
  const valorAbonoTerco = diasAbono > 0 ? +(valorAbono / 3).toFixed(2) : 0;

  const totalBruto = +(valorFerias + valorTerco + valorAbono + valorAbonoTerco).toFixed(2);

  // INSS: incide sobre férias gozadas (sem 1/3 segundo jurisprudência mais recente)
  const baseINSS = valorFerias;
  const { valor: valorINSS } = (!vinculoConfig || vinculoConfig.inss_empregado)
    ? calcularINSS(baseINSS)
    : { valor: 0 };

  // IRRF: incide sobre férias + 1/3 + abono (base separada)
  const baseIRRF = valorFerias + valorTerco + valorAbono + valorAbonoTerco - valorINSS;
  const { valor: valorIRRF } = calcularIRRF(baseIRRF, dependentesIRRF);

  // FGTS: sobre férias gozadas
  const baseFGTS = valorFerias;
  const aliqFGTS = vinculoConfig?.aliquota_fgts ?? 8;
  const valorFGTS = (!vinculoConfig || vinculoConfig.fgts) ? calcularFGTS(baseFGTS, aliqFGTS) : 0;

  const totalDescontos = +(valorINSS + valorIRRF).toFixed(2);
  const totalLiquido = +(totalBruto - totalDescontos).toFixed(2);

  return {
    valor_ferias: valorFerias,
    valor_terco: valorTerco,
    valor_abono: valorAbono,
    valor_abono_terco: valorAbonoTerco,
    base_inss: +baseINSS.toFixed(2),
    valor_inss: valorINSS,
    base_irrf: +baseIRRF.toFixed(2),
    valor_irrf: valorIRRF,
    base_fgts: +baseFGTS.toFixed(2),
    valor_fgts: valorFGTS,
    total_bruto: totalBruto,
    total_descontos: totalDescontos,
    total_liquido: totalLiquido,
  };
}

/**
 * Calcula 13º salário (1ª ou 2ª parcela)
 */
export function calcular13(params: {
  remuneracaoBase: number;
  mediaVariaveis?: number;
  mesesTrabalhados: number;
  parcela: 1 | 2;
  valorPrimeiraParcela?: number;
  vinculoConfig?: VinculoConfig;
  dependentesIRRF?: number;
}): {
  valor_bruto: number;
  valor_primeira_parcela: number;
  base_inss: number;
  valor_inss: number;
  base_irrf: number;
  valor_irrf: number;
  base_fgts: number;
  valor_fgts: number;
  total_descontos: number;
  total_liquido: number;
} {
  const { remuneracaoBase, mediaVariaveis = 0, mesesTrabalhados, parcela, valorPrimeiraParcela = 0, vinculoConfig, dependentesIRRF = 0 } = params;
  const remTotal = remuneracaoBase + mediaVariaveis;
  const valorBruto = +((remTotal * mesesTrabalhados) / 12).toFixed(2);

  if (parcela === 1) {
    // 1ª parcela: 50% sem descontos
    const valor1a = +(valorBruto / 2).toFixed(2);
    const aliqFGTS = vinculoConfig?.aliquota_fgts ?? 8;
    const valorFGTS = (!vinculoConfig || vinculoConfig.fgts) ? calcularFGTS(valor1a, aliqFGTS) : 0;
    return {
      valor_bruto: valorBruto,
      valor_primeira_parcela: valor1a,
      base_inss: 0, valor_inss: 0,
      base_irrf: 0, valor_irrf: 0,
      base_fgts: valor1a, valor_fgts: valorFGTS,
      total_descontos: 0,
      total_liquido: valor1a,
    };
  }

  // 2ª parcela: valor total - 1ª parcela, com INSS/IRRF
  const baseINSS = valorBruto;
  const { valor: valorINSS } = (!vinculoConfig || vinculoConfig.inss_empregado)
    ? calcularINSS(baseINSS)
    : { valor: 0 };

  const baseIRRF = valorBruto - valorINSS;
  const { valor: valorIRRF } = calcularIRRF(baseIRRF, dependentesIRRF);

  const aliqFGTS = vinculoConfig?.aliquota_fgts ?? 8;
  const baseFGTS = valorBruto - (valorPrimeiraParcela || valorBruto / 2);
  const valorFGTS = (!vinculoConfig || vinculoConfig.fgts) ? calcularFGTS(baseFGTS, aliqFGTS) : 0;

  const totalDescontos = +(valorINSS + valorIRRF + (valorPrimeiraParcela || valorBruto / 2)).toFixed(2);
  const totalLiquido = +(valorBruto - totalDescontos).toFixed(2);

  return {
    valor_bruto: valorBruto,
    valor_primeira_parcela: valorPrimeiraParcela || +(valorBruto / 2).toFixed(2),
    base_inss: +baseINSS.toFixed(2),
    valor_inss: valorINSS,
    base_irrf: +baseIRRF.toFixed(2),
    valor_irrf: valorIRRF,
    base_fgts: +baseFGTS.toFixed(2),
    valor_fgts: valorFGTS,
    total_descontos: +totalDescontos.toFixed(2),
    total_liquido: totalLiquido,
  };
}

/**
 * Calcula rescisão
 */
export function calcularRescisao(params: {
  salarioBase: number;
  dataAdmissao: string;
  dataDesligamento: string;
  tipoRescisao: string;
  tipoVinculo?: string;
  vinculoConfig?: VinculoConfig;
  avisoTipo?: string;
  diasAvisoPrevio?: number;
  feriasPeriodosVencidos?: number;
  dependentesIRRF?: number;
}): { [key: string]: any } {
  const {
    salarioBase, dataAdmissao, dataDesligamento, tipoRescisao,
    vinculoConfig, avisoTipo = "indenizado", diasAvisoPrevio = 30,
    feriasPeriodosVencidos = 0, dependentesIRRF = 0,
  } = params;

  const admissao = new Date(dataAdmissao);
  const desligamento = new Date(dataDesligamento);
  const diasMes = new Date(desligamento.getFullYear(), desligamento.getMonth() + 1, 0).getDate();
  const diaDeslig = desligamento.getDate();

  // Saldo de salário
  const saldoSalario = +((salarioBase / diasMes) * diaDeslig).toFixed(2);

  // Tempo de serviço em meses
  const diffMs = desligamento.getTime() - admissao.getTime();
  const mesesTrabalhados = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  const anosTrabalhados = Math.floor(mesesTrabalhados / 12);

  // Aviso prévio
  let avisoPrevioValor = 0;
  const temDireitoAviso = vinculoConfig?.direito_aviso_previo ?? true;
  const dispSemJusta = ["DISPENSA_SEM_JUSTA_CAUSA", "RESCISAO_INDIRETA"].includes(tipoRescisao);
  const acordo484A = tipoRescisao === "ACORDO_484A";

  if (temDireitoAviso && avisoTipo === "indenizado" && (dispSemJusta || acordo484A)) {
    const diasAviso = Math.min(90, 30 + anosTrabalhados * 3);
    avisoPrevioValor = +((salarioBase / 30) * diasAviso * (acordo484A ? 0.5 : 1)).toFixed(2);
  }

  // 13º proporcional
  const meses13 = desligamento.getMonth() + 1; // meses no ano
  const direito13 = vinculoConfig?.direito_13 ?? true;
  const decimo13Prop = direito13 && tipoRescisao !== "DISPENSA_COM_JUSTA_CAUSA"
    ? +((salarioBase * meses13) / 12).toFixed(2)
    : 0;

  // Férias proporcionais
  const direitoFerias = vinculoConfig?.direito_ferias ?? true;
  const mesesFerias = mesesTrabalhados % 12;
  const feriasProporcionais = direitoFerias && tipoRescisao !== "DISPENSA_COM_JUSTA_CAUSA"
    ? +((salarioBase / 12) * mesesFerias).toFixed(2)
    : 0;

  // Férias vencidas
  const feriasVencidas = +(feriasPeriodosVencidos * salarioBase).toFixed(2);

  // 1/3 de férias
  const tercoFerias = +((feriasProporcionais + feriasVencidas) / 3).toFixed(2);

  // Total bruto
  const totalBruto = +(saldoSalario + avisoPrevioValor + decimo13Prop + feriasProporcionais + feriasVencidas + tercoFerias).toFixed(2);

  // INSS (sobre saldo + aviso)
  const baseINSS = saldoSalario + (avisoTipo === "trabalhado" ? 0 : 0);
  const { valor: valorINSS } = (!vinculoConfig || vinculoConfig.inss_empregado)
    ? calcularINSS(baseINSS)
    : { valor: 0 };

  // IRRF
  const baseIRRF = totalBruto - feriasProporcionais - feriasVencidas - tercoFerias - valorINSS;
  const { valor: valorIRRF } = calcularIRRF(Math.max(0, baseIRRF), dependentesIRRF);

  // FGTS
  const baseFGTS = saldoSalario + avisoPrevioValor + decimo13Prop;
  const aliqFGTS = vinculoConfig?.aliquota_fgts ?? 8;
  const valorFGTS = (!vinculoConfig || vinculoConfig.fgts) ? calcularFGTS(baseFGTS, aliqFGTS) : 0;

  // Multa FGTS (estimativa simplificada)
  const aliqMulta = acordo484A ? 20 : (vinculoConfig?.multa_fgts_dispensa ?? 40);
  const multaFGTS = dispSemJusta || acordo484A
    ? +(baseFGTS * mesesTrabalhados * (aliqFGTS / 100) * (aliqMulta / 100)).toFixed(2)
    : 0;

  const totalDescontos = +(valorINSS + valorIRRF).toFixed(2);
  const totalLiquido = +(totalBruto - totalDescontos).toFixed(2);

  return {
    saldo_salario: saldoSalario,
    dias_saldo: diaDeslig,
    aviso_previo_valor: avisoPrevioValor,
    ferias_vencidas: feriasVencidas,
    ferias_proporcionais: feriasProporcionais,
    terco_ferias: tercoFerias,
    decimo_terceiro_proporcional: decimo13Prop,
    base_inss: +baseINSS.toFixed(2),
    valor_inss: valorINSS,
    base_irrf: +baseIRRF.toFixed(2),
    valor_irrf: valorIRRF,
    base_fgts: +baseFGTS.toFixed(2),
    valor_fgts: valorFGTS,
    multa_fgts: multaFGTS,
    total_bruto: totalBruto,
    total_descontos: totalDescontos,
    total_liquido: totalLiquido,
    detalhes: {
      meses_trabalhados: mesesTrabalhados,
      anos_trabalhados: anosTrabalhados,
      dias_aviso_previo: diasAvisoPrevio,
      tipo_rescisao: tipoRescisao,
      aviso_tipo: avisoTipo,
      aliquota_multa_fgts: aliqMulta,
    },
  };
}

/**
 * Calcula provisão mensal
 */
export function calcularProvisao(params: {
  remuneracaoBase: number;
  tipo: "ferias" | "13_salario";
  aliquotaFGTS?: number;
}): {
  valor_provisao: number;
  valor_terco: number;
  encargos_fgts: number;
  valor_total: number;
} {
  const { remuneracaoBase, tipo, aliquotaFGTS = 8 } = params;
  const valorProvisao = +(remuneracaoBase / 12).toFixed(2);
  const valorTerco = tipo === "ferias" ? +(valorProvisao / 3).toFixed(2) : 0;
  const base = valorProvisao + valorTerco;
  const encargosFGTS = +(base * aliquotaFGTS / 100).toFixed(2);

  return {
    valor_provisao: valorProvisao,
    valor_terco: valorTerco,
    encargos_fgts: encargosFGTS,
    valor_total: +(valorProvisao + valorTerco + encargosFGTS).toFixed(2),
  };
}

// Re-export adicionais engine
export { calcularAdicionais, gerarProventoAdicional, SALARIO_MINIMO_2025 } from "./adicionais";
export type { ConfigInsalubridade, ConfigPericulosidade, ConfigAposentadoriaEspecial, ResultadoAdicionais } from "./adicionais";
