/**
 * Motor de Integração Fiscal: eSocial, DCTFWeb e FGTS Digital
 * Eventos S-1200 (Remuneração), S-1210 (Pagamentos)
 *
 * Gera estruturas de dados prontas para envio ao eSocial
 * (a transmissão XML/SOAP é feita via edge function separada)
 */

export interface EventoS1200 {
  /** Identificação do evento */
  id: string;
  /** Tipo de ambiente: 1=Produção, 2=Homologação */
  tpAmb: 1 | 2;
  /** Período de apuração (YYYY-MM) */
  perApur: string;
  /** CPF do trabalhador */
  cpfTrab: string;
  /** Matrícula */
  matricula?: string;
  /** Categoria do trabalhador (tabela 01 eSocial) */
  codCateg: number;
  /** Rubricas (verbas) */
  dmDev: DmDev[];
  /** Info complementar */
  infoComplCont?: {
    codCBO: string;
    natAtividade: number;
  };
}

export interface DmDev {
  /** Identificador da demonstrativa */
  ideDmDev: string;
  /** Código de incidência tributária */
  codIncCP: number;     // 1-16 conforme tabela eSocial
  codIncIRRF: number;   // 1-14
  codIncFGTS: number;   // 1-5
  /** Itens da remuneração */
  itensRemun: ItemRemun[];
}

export interface ItemRemun {
  /** Código da rubrica (Tabela 03 eSocial) */
  codRubr: string;
  /** Identificador da rubrica do empregador */
  ideTabRubr: string;
  /** Quantidade (horas, dias, etc.) */
  qtdRubr?: number;
  /** Fator para cálculo */
  fatorRubr?: number;
  /** Valor da rubrica */
  vrRubr: number;
  /** Natureza: 1=Provento, 2=Desconto, 3=Informativa */
  natRubr: 1 | 2 | 3;
}

export interface EventoS1210 {
  id: string;
  tpAmb: 1 | 2;
  perApur: string;
  cpfTrab: string;
  dtPgto: string;            // data do pagamento
  tpPgto: number;            // 1=Folha mensal, 2=Férias, 3=13º, etc.
  indResBr: 'S' | 'N';      // residente no Brasil
  valorLiquido: number;
  infoPgto: {
    ideDmDev: string;
    vrLiq: number;
  }[];
}

// ===================== MAPEAMENTO DE RUBRICAS =====================

/** Mapeamento padrão de verbas para códigos eSocial (Tabela 03 simplificada) */
export const RUBRICAS_ESOCIAL: Record<string, { codRubr: string; natRubr: 1 | 2 | 3; codIncCP: number; codIncIRRF: number; codIncFGTS: number }> = {
  'salario_base':         { codRubr: '1000', natRubr: 1, codIncCP: 11, codIncIRRF: 11, codIncFGTS: 11 },
  'he_50':                { codRubr: '1020', natRubr: 1, codIncCP: 11, codIncIRRF: 11, codIncFGTS: 11 },
  'he_100':               { codRubr: '1021', natRubr: 1, codIncCP: 11, codIncIRRF: 11, codIncFGTS: 11 },
  'adicional_noturno':    { codRubr: '1040', natRubr: 1, codIncCP: 11, codIncIRRF: 11, codIncFGTS: 11 },
  'dsr_variaveis':        { codRubr: '1060', natRubr: 1, codIncCP: 11, codIncIRRF: 11, codIncFGTS: 11 },
  'insalubridade':        { codRubr: '1080', natRubr: 1, codIncCP: 11, codIncIRRF: 11, codIncFGTS: 11 },
  'periculosidade':       { codRubr: '1081', natRubr: 1, codIncCP: 11, codIncIRRF: 11, codIncFGTS: 11 },
  'comissoes':            { codRubr: '1100', natRubr: 1, codIncCP: 11, codIncIRRF: 11, codIncFGTS: 11 },
  'ferias_gozadas':       { codRubr: '1200', natRubr: 1, codIncCP: 11, codIncIRRF: 11, codIncFGTS: 11 },
  'terco_ferias':         { codRubr: '1201', natRubr: 1, codIncCP: 11, codIncIRRF: 11, codIncFGTS: 11 },
  '13_salario':           { codRubr: '1300', natRubr: 1, codIncCP: 11, codIncIRRF: 11, codIncFGTS: 11 },
  'desc_inss':            { codRubr: '9201', natRubr: 2, codIncCP: 31, codIncIRRF: 91, codIncFGTS: 91 },
  'desc_irrf':            { codRubr: '9202', natRubr: 2, codIncCP: 91, codIncIRRF: 31, codIncFGTS: 91 },
  'desc_vt':              { codRubr: '9210', natRubr: 2, codIncCP: 91, codIncIRRF: 91, codIncFGTS: 91 },
  'desc_plano_saude':     { codRubr: '9220', natRubr: 2, codIncCP: 91, codIncIRRF: 91, codIncFGTS: 91 },
  'pensao_alimenticia':   { codRubr: '9230', natRubr: 2, codIncCP: 91, codIncIRRF: 31, codIncFGTS: 91 },
};

// ===================== GERAÇÃO DE EVENTOS =====================

/**
 * Gera evento S-1200 (Remuneração) a partir dos dados da folha calculada
 */
export function gerarEventoS1200(params: {
  competencia: string;
  cpf: string;
  matricula?: string;
  codCateg?: number;
  proventos: { descricao: string; tipo: string; valor: number; quantidade?: number }[];
  descontos: { descricao: string; tipo: string; valor: number }[];
  tpAmb?: 1 | 2;
}): EventoS1200 {
  const { competencia, cpf, matricula, codCateg = 101, proventos, descontos, tpAmb = 2 } = params;

  const itensRemun: ItemRemun[] = [];

  // Proventos
  for (const p of proventos) {
    const rubrica = RUBRICAS_ESOCIAL[p.tipo] || RUBRICAS_ESOCIAL['salario_base'];
    itensRemun.push({
      codRubr: rubrica.codRubr,
      ideTabRubr: 'TAB01',
      qtdRubr: p.quantidade,
      vrRubr: p.valor,
      natRubr: 1,
    });
  }

  // Descontos
  for (const d of descontos) {
    const rubrica = RUBRICAS_ESOCIAL[d.tipo] || { codRubr: '9999', natRubr: 2 as const, codIncCP: 91, codIncIRRF: 91, codIncFGTS: 91 };
    itensRemun.push({
      codRubr: rubrica.codRubr,
      ideTabRubr: 'TAB01',
      vrRubr: d.valor,
      natRubr: 2,
    });
  }

  const ideDmDev = `DMD-${competencia}-${cpf.replace(/\D/g, '').slice(-4)}`;

  return {
    id: `S1200-${competencia}-${cpf.replace(/\D/g, '')}`,
    tpAmb,
    perApur: competencia,
    cpfTrab: cpf.replace(/\D/g, ''),
    matricula,
    codCateg,
    dmDev: [{
      ideDmDev,
      codIncCP: 11,
      codIncIRRF: 11,
      codIncFGTS: 11,
      itensRemun,
    }],
  };
}

/**
 * Gera evento S-1210 (Pagamentos) a partir da folha
 */
export function gerarEventoS1210(params: {
  competencia: string;
  cpf: string;
  dataPagamento: string;
  valorLiquido: number;
  tipoPagamento?: number;
  tpAmb?: 1 | 2;
}): EventoS1210 {
  const { competencia, cpf, dataPagamento, valorLiquido, tipoPagamento = 1, tpAmb = 2 } = params;
  const ideDmDev = `DMD-${competencia}-${cpf.replace(/\D/g, '').slice(-4)}`;

  return {
    id: `S1210-${competencia}-${cpf.replace(/\D/g, '')}`,
    tpAmb,
    perApur: competencia,
    cpfTrab: cpf.replace(/\D/g, ''),
    dtPgto: dataPagamento,
    tpPgto: tipoPagamento,
    indResBr: 'S',
    valorLiquido,
    infoPgto: [{
      ideDmDev,
      vrLiq: valorLiquido,
    }],
  };
}

// ===================== DCTFWeb =====================

export interface DCTFWebResumo {
  competencia: string;
  totalColaboradores: number;
  totalRemuneracao: number;
  inss_empregados: number;
  inss_patronal: number;  // 20% sobre folha
  rat: number;             // RAT (1% a 3%)
  terceiros: number;       // Terceiros (ex: 5.8% Sistema S)
  totalContribuicoes: number;
  status: 'pendente' | 'apurado' | 'transmitido';
}

/**
 * Gera resumo DCTFWeb para apuração de tributos
 */
export function gerarResumoDCTFWeb(params: {
  competencia: string;
  totalColaboradores: number;
  totalRemuneracao: number;
  totalINSSEmpregados: number;
  aliquotaINSSPatronal?: number;
  aliquotaRAT?: number;
  aliquotaTerceiros?: number;
}): DCTFWebResumo {
  const {
    competencia,
    totalColaboradores,
    totalRemuneracao,
    totalINSSEmpregados,
    aliquotaINSSPatronal = 20,
    aliquotaRAT = 2,
    aliquotaTerceiros = 5.8,
  } = params;

  const inssPatronal = +(totalRemuneracao * aliquotaINSSPatronal / 100).toFixed(2);
  const rat = +(totalRemuneracao * aliquotaRAT / 100).toFixed(2);
  const terceiros = +(totalRemuneracao * aliquotaTerceiros / 100).toFixed(2);
  const totalContribuicoes = +(totalINSSEmpregados + inssPatronal + rat + terceiros).toFixed(2);

  return {
    competencia,
    totalColaboradores,
    totalRemuneracao: +totalRemuneracao.toFixed(2),
    inss_empregados: totalINSSEmpregados,
    inss_patronal: inssPatronal,
    rat,
    terceiros,
    totalContribuicoes,
    status: 'apurado',
  };
}

// ===================== FGTS DIGITAL =====================

export interface FGTSDigitalResumo {
  competencia: string;
  totalColaboradores: number;
  baseCalculo: number;
  aliquotaMedia: number;
  valorTotal: number;
  guias: {
    cpf: string;
    nome: string;
    base: number;
    aliquota: number;
    valor: number;
  }[];
  status: 'pendente' | 'apurado' | 'recolhido';
}

/**
 * Gera resumo FGTS Digital (apuração mensal vinculada à folha)
 */
export function gerarResumoFGTSDigital(params: {
  competencia: string;
  colaboradores: {
    cpf: string;
    nome: string;
    remuneracao: number;
    aliquotaFGTS: number;
  }[];
}): FGTSDigitalResumo {
  const { competencia, colaboradores } = params;

  const guias = colaboradores.map(c => ({
    cpf: c.cpf,
    nome: c.nome,
    base: +c.remuneracao.toFixed(2),
    aliquota: c.aliquotaFGTS,
    valor: +(c.remuneracao * c.aliquotaFGTS / 100).toFixed(2),
  }));

  const totalBase = guias.reduce((s, g) => s + g.base, 0);
  const totalValor = guias.reduce((s, g) => s + g.valor, 0);
  const aliquotaMedia = totalBase > 0 ? +(totalValor / totalBase * 100).toFixed(2) : 0;

  return {
    competencia,
    totalColaboradores: colaboradores.length,
    baseCalculo: +totalBase.toFixed(2),
    aliquotaMedia,
    valorTotal: +totalValor.toFixed(2),
    guias,
    status: 'apurado',
  };
}
