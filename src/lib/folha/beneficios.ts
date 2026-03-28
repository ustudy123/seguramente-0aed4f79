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
