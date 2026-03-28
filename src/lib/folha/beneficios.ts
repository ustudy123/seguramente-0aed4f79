/**
 * Motor de Cálculo: Benefícios (VT, VA/VR, Plano Saúde, Flexíveis)
 * CLT Art. 458, Lei 7.418/85 (VT), PAT (VA/VR)
 *
 * Classificação:
 * - Remuneratórios (integram salário): compõem base INSS/FGTS/Férias/13º
 * - Indenizatórios (não integram): sem incidência
 */

export type NaturezaBeneficio = 'remuneratorio' | 'indenizatorio';

export interface BeneficioConfig {
  tipo: string;
  descricao: string;
  natureza: NaturezaBeneficio;
  /** Valor total concedido pela empresa */
  valorEmpresa: number;
  /** Percentual máximo de desconto do colaborador (ex: 6% para VT) */
  percentualDesconto?: number;
  /** Valor fixo de desconto (alternativa ao percentual) */
  valorDescontoFixo?: number;
  /** Registrado no PAT? (para VA/VR) */
  registroPAT?: boolean;
  /** Necessita autorização do empregado? */
  requerAutorizacao?: boolean;
}

export interface BeneficioCalculado {
  tipo: string;
  descricao: string;
  natureza: NaturezaBeneficio;
  valorEmpresa: number;
  valorDesconto: number;
  valorLiquidoBeneficio: number;
  incide_inss: boolean;
  incide_irrf: boolean;
  incide_fgts: boolean;
  fundamentacao: string;
}

export interface ResultadoBeneficios {
  beneficios: BeneficioCalculado[];
  totalDescontos: number;
  totalCustoEmpresa: number;
  proventosRemuneratorios: { descricao: string; valor: number; incide_inss: boolean; incide_irrf: boolean; incide_fgts: boolean }[];
  descontosFolha: { descricao: string; valor: number }[];
  alertas: string[];
}

/**
 * Calcula Vale Transporte conforme Lei 7.418/85
 * Desconto máximo: 6% do salário base
 */
export function calcularValeTransporte(
  salarioBase: number,
  valorVT: number,
  percentualDesconto: number = 6
): { valorDesconto: number; valorEmpresa: number; fundamentacao: string } {
  const descontoMaximo = +(salarioBase * percentualDesconto / 100).toFixed(2);
  const valorDesconto = Math.min(descontoMaximo, valorVT);

  return {
    valorDesconto,
    valorEmpresa: +(valorVT - valorDesconto).toFixed(2),
    fundamentacao: `VT conforme Lei 7.418/85. Desconto: ${percentualDesconto}% do salário (R$ ${descontoMaximo.toFixed(2)}), limitado ao valor do benefício (R$ ${valorVT.toFixed(2)}).`,
  };
}

/**
 * Calcula todos os benefícios e separa em proventos/descontos para a folha
 */
export function calcularBeneficios(
  salarioBase: number,
  beneficios: BeneficioConfig[]
): ResultadoBeneficios {
  const resultado: BeneficioCalculado[] = [];
  const proventosRemuneratorios: ResultadoBeneficios['proventosRemuneratorios'] = [];
  const descontosFolha: ResultadoBeneficios['descontosFolha'] = [];
  const alertas: string[] = [];
  let totalDescontos = 0;
  let totalCustoEmpresa = 0;

  for (const b of beneficios) {
    let valorDesconto = 0;
    let fundamentacao = '';
    let incide_inss = false;
    let incide_irrf = false;
    let incide_fgts = false;

    // Calcular desconto
    if (b.tipo === 'vale_transporte') {
      const vt = calcularValeTransporte(salarioBase, b.valorEmpresa, b.percentualDesconto ?? 6);
      valorDesconto = vt.valorDesconto;
      fundamentacao = vt.fundamentacao;
      // VT é indenizatório por lei
      incide_inss = false;
      incide_irrf = false;
      incide_fgts = false;
    } else if (b.tipo === 'vale_alimentacao' || b.tipo === 'vale_refeicao') {
      // Se PAT → indenizatório; senão pode ter natureza salarial
      if (b.registroPAT) {
        incide_inss = false;
        incide_irrf = false;
        incide_fgts = false;
        fundamentacao = `${b.descricao} concedido via PAT — natureza indenizatória (CLT art. 458, §2º).`;
      } else {
        incide_inss = true;
        incide_irrf = true;
        incide_fgts = true;
        fundamentacao = `${b.descricao} sem registro PAT — natureza salarial, integra base de INSS/IRRF/FGTS.`;
        alertas.push(`⚠️ ${b.descricao} sem PAT: pode ter natureza salarial. Recomenda-se registro no PAT.`);
      }
      valorDesconto = b.valorDescontoFixo ?? 0;
    } else if (b.tipo === 'plano_saude') {
      incide_inss = false;
      incide_irrf = false;
      incide_fgts = false;
      valorDesconto = b.valorDescontoFixo ?? 0;
      fundamentacao = `Plano de saúde — desconto autorizado pelo empregado. Natureza indenizatória.`;
      if (b.requerAutorizacao) {
        fundamentacao += ' Autorização registrada.';
      }
    } else {
      // Benefício genérico
      incide_inss = b.natureza === 'remuneratorio';
      incide_irrf = b.natureza === 'remuneratorio';
      incide_fgts = b.natureza === 'remuneratorio';
      valorDesconto = b.valorDescontoFixo ?? 0;
      fundamentacao = `${b.descricao} — natureza ${b.natureza}.`;
    }

    const valorLiquidoBeneficio = +(b.valorEmpresa - valorDesconto).toFixed(2);
    totalDescontos += valorDesconto;
    totalCustoEmpresa += b.valorEmpresa;

    const calc: BeneficioCalculado = {
      tipo: b.tipo,
      descricao: b.descricao,
      natureza: b.natureza,
      valorEmpresa: b.valorEmpresa,
      valorDesconto,
      valorLiquidoBeneficio,
      incide_inss,
      incide_irrf,
      incide_fgts,
      fundamentacao,
    };

    resultado.push(calc);

    // Se remuneratório, adiciona como provento
    if (incide_inss || incide_irrf || incide_fgts) {
      proventosRemuneratorios.push({
        descricao: b.descricao,
        valor: b.valorEmpresa,
        incide_inss,
        incide_irrf,
        incide_fgts,
      });
    }

    // Desconto na folha
    if (valorDesconto > 0) {
      descontosFolha.push({
        descricao: `Desc. ${b.descricao}`,
        valor: valorDesconto,
      });
    }
  }

  return {
    beneficios: resultado,
    totalDescontos: +totalDescontos.toFixed(2),
    totalCustoEmpresa: +totalCustoEmpresa.toFixed(2),
    proventosRemuneratorios,
    descontosFolha,
    alertas,
  };
}

// ===================== BENEFÍCIOS FLEXÍVEIS =====================

export interface BeneficioFlexConfig {
  /** Saldo total mensal concedido ao colaborador */
  saldoMensal: number;
  /** Categorias disponíveis para distribuição */
  categorias: {
    tipo: string;
    descricao: string;
    natureza: NaturezaBeneficio;
    /** Limite máximo por categoria (opcional) */
    limiteMaximo?: number;
    /** Se registrado no PAT (para alimentação) */
    registroPAT?: boolean;
  }[];
  /** Distribuição escolhida pelo colaborador */
  distribuicao: {
    tipo: string;
    valor: number;
  }[];
}

export interface ResultadoBeneficioFlex {
  distribuicao: {
    tipo: string;
    descricao: string;
    valor: number;
    natureza: NaturezaBeneficio;
    incide_inss: boolean;
    incide_irrf: boolean;
    incide_fgts: boolean;
  }[];
  saldoUtilizado: number;
  saldoRestante: number;
  totalRemuneratorio: number;
  totalIndenizatorio: number;
  alertas: string[];
  fundamentacao: string;
}

/**
 * Calcula benefícios flexíveis com saldo distribuível
 * Respeita natureza jurídica de cada categoria (CLT art. 458 §2º)
 */
export function calcularBeneficiosFlex(config: BeneficioFlexConfig): ResultadoBeneficioFlex {
  const { saldoMensal, categorias, distribuicao } = config;
  const alertas: string[] = [];
  const resultado: ResultadoBeneficioFlex['distribuicao'] = [];
  let saldoUtilizado = 0;
  let totalRemuneratorio = 0;
  let totalIndenizatorio = 0;

  for (const dist of distribuicao) {
    const cat = categorias.find(c => c.tipo === dist.tipo);
    if (!cat) {
      alertas.push(`Categoria "${dist.tipo}" não encontrada nas categorias disponíveis.`);
      continue;
    }

    // Verificar limite da categoria
    if (cat.limiteMaximo && dist.valor > cat.limiteMaximo) {
      alertas.push(`Valor R$ ${dist.valor.toFixed(2)} excede limite de R$ ${cat.limiteMaximo.toFixed(2)} para ${cat.descricao}.`);
      continue;
    }

    // Verificar se não excede saldo
    if (saldoUtilizado + dist.valor > saldoMensal) {
      alertas.push(`Distribuição excede saldo mensal de R$ ${saldoMensal.toFixed(2)}.`);
      break;
    }

    const isIndenizatorio = cat.natureza === 'indenizatorio';
    const incide = !isIndenizatorio;

    resultado.push({
      tipo: dist.tipo,
      descricao: cat.descricao,
      valor: dist.valor,
      natureza: cat.natureza,
      incide_inss: incide,
      incide_irrf: incide,
      incide_fgts: incide,
    });

    saldoUtilizado += dist.valor;
    if (incide) {
      totalRemuneratorio += dist.valor;
    } else {
      totalIndenizatorio += dist.valor;
    }
  }

  return {
    distribuicao: resultado,
    saldoUtilizado: +saldoUtilizado.toFixed(2),
    saldoRestante: +(saldoMensal - saldoUtilizado).toFixed(2),
    totalRemuneratorio: +totalRemuneratorio.toFixed(2),
    totalIndenizatorio: +totalIndenizatorio.toFixed(2),
    alertas,
    fundamentacao: `Benefício flexível — saldo mensal R$ ${saldoMensal.toFixed(2)}. `
      + `Utilizado: R$ ${saldoUtilizado.toFixed(2)}. `
      + `Remuneratório (integra base): R$ ${totalRemuneratorio.toFixed(2)}. `
      + `Indenizatório (não integra): R$ ${totalIndenizatorio.toFixed(2)}. `
      + `CLT art. 458 §2º — parcelas não salariais quando concedidas como ferramenta de trabalho ou em conformidade com PAT.`,
  };
}
