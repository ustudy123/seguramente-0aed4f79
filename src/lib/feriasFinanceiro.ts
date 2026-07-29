/**
 * Cálculo financeiro de férias — ESTIMATIVA parametrizável (Fase 2, A-05).
 *
 * DECISÃO DE ESCOPO (deliberada): isto é uma estimativa gerencial, não um
 * fechamento contábil-fiscal. A seção 7.4 do DRF envolve STF Tema 985, Simples
 * por anexo e FAP no RAT — território de motor de folha tributária, onde o
 * próprio documento reconhece que "muitos sistemas erram". Entregar isso como
 * número contábil fechado, sem validação de um contador sobre os dados reais da
 * empresa, seria criar passivo. Então:
 *   • A taxa de encargos é PARAMETRIZÁVEL por empresa (não hardcoded).
 *   • Todo resultado é rotulado como estimativa na UI.
 *   • A memória de cálculo é exposta para conferência contábil.
 *
 * Reaproveita o motor de folha existente (calcularINSS / calcularIRRF) para o
 * líquido do desembolso, e o motor de férias da Fase 1
 * (ferias_periodos_aquisitivos) para dias de direito e saldo reais.
 *
 * Referências das fórmulas: seção 7.2 (provisão por competência, NBC TG 25 /
 * CPC 25), 7.3 (desembolso por caixa, art. 145) e 7.1 (passivo em dobro,
 * art. 137 — férias gozadas após o limite concessivo).
 */
import {
  calcularINSS,
  calcularIRRF,
  TABELA_INSS_2025,
  TETO_INSS_2025,
  TABELA_IRRF_2025,
  DEDUCAO_DEPENDENTE_IRRF_2025,
} from "@/lib/folha/calculos";

/** Composição da taxa de encargos, parametrizável por empresa (seção 7.4). */
export interface EncargosConfig {
  /** Contribuição patronal (INSS patronal). Padrão 20%. */
  inssPatronal: number;
  /** RAT ajustado pelo FAP. Padrão 2%. */
  ratFap: number;
  /** Terceiros (Sistema S, salário-educação...). Até 5,8%. */
  terceiros: number;
  /** FGTS. Padrão 8%. */
  fgts: number;
  /**
   * Simples Nacional (Anexos I, II, III, V) dispensa a contribuição patronal e
   * terceiros; Anexo IV recolhe. Quando true, zera inssPatronal e terceiros no
   * cálculo, mantendo FGTS.
   */
  simplesDispensaPatronal: boolean;
}

export const ENCARGOS_PADRAO: EncargosConfig = {
  inssPatronal: 20,
  ratFap: 2,
  terceiros: 5.8,
  fgts: 8,
  simplesDispensaPatronal: false,
};

/** Fração total de encargos aplicada sobre a base (ex.: 0.358 = 35,8%). */
export function taxaEncargos(cfg: EncargosConfig): number {
  const patronal = cfg.simplesDispensaPatronal ? 0 : cfg.inssPatronal;
  const terceiros = cfg.simplesDispensaPatronal ? 0 : cfg.terceiros;
  return (patronal + cfg.ratFap + terceiros + cfg.fgts) / 100;
}

// ── Provisão por competência (seção 7.2) ────────────────────────────────────

export interface ProvisaoColaborador {
  cpf: string;
  nome: string;
  remuneracaoMensal: number;
  diasDireitoAcumulados: number;
  /** (Rem/30) × dias × (1 + 1/3) — sem encargos. */
  baseFerias: number;
  /** base × (1 + 1/3). */
  comTerco: number;
  /** valor dos encargos sobre (férias + terço). */
  encargos: number;
  /** Provisão total: comTerco × (1 + taxaEncargos). */
  total: number;
}

/**
 * Provisão de férias por colaborador (competência).
 *
 * Provisão = (Rem ÷ 30) × Dias de direito acumulados × (1 + 1/3) × (1 + encargos)
 *
 * "Dias de direito acumulados" = saldo em aberto de todos os períodos (a Fase 1
 * já calcula isso em dias_saldo, considerando art. 130 / avos). O DRF cita
 * "2,5/mês + períodos anteriores"; usar o saldo real do motor é mais preciso e
 * evita divergir da tela de Saldos.
 */
export function provisaoColaborador(params: {
  cpf: string;
  nome: string;
  remuneracaoMensal: number;
  diasDireitoAcumulados: number;
  encargos: EncargosConfig;
}): ProvisaoColaborador {
  const { cpf, nome, remuneracaoMensal, diasDireitoAcumulados, encargos } = params;
  const baseFerias = (remuneracaoMensal / 30) * diasDireitoAcumulados;
  const comTerco = baseFerias * (1 + 1 / 3);
  const valorEncargos = comTerco * taxaEncargos(encargos);
  return {
    cpf,
    nome,
    remuneracaoMensal,
    diasDireitoAcumulados,
    baseFerias: round2(baseFerias),
    comTerco: round2(comTerco),
    encargos: round2(valorEncargos),
    total: round2(comTerco + valorEncargos),
  };
}

// ── Desembolso projetado (seção 7.3) ────────────────────────────────────────

export interface DesembolsoPeriodo {
  cpf: string;
  nome: string;
  dataInicio: string;
  dataFim: string;
  diasGozados: number;
  abonoDias: number;
  bruto: number;
  inss: number;
  irrf: number;
  liquido: number;
  /** Mês (yyyy-mm) da data de PAGAMENTO — 2 dias antes do início (art. 145). */
  mesCaixa: string;
}

/**
 * Desembolso de um período de férias, alocado no mês do PAGAMENTO (art. 145:
 * até 2 dias antes do início), não no mês de início. É a distinção que a seção
 * 7.3 destaca e que empurra parte do caixa para o mês anterior.
 *
 * Bruto = (Rem/30) × dias gozados + 1/3 + abono e terço do abono
 * Líquido = Bruto − INSS − IRRF (tributados em separado das demais parcelas)
 */
export function desembolsoPeriodo(params: {
  cpf: string;
  nome: string;
  remuneracaoMensal: number;
  dataInicio: string;
  dataFim: string;
  diasGozados: number;
  abonoDias?: number;
  dependentes?: number;
}): DesembolsoPeriodo {
  const {
    cpf, nome, remuneracaoMensal, dataInicio, dataFim,
    diasGozados, abonoDias = 0, dependentes = 0,
  } = params;

  const valorDia = remuneracaoMensal / 30;
  const brutoFerias = valorDia * diasGozados * (1 + 1 / 3);
  // Abono pecuniário: isento de INSS e IR (Lei 8.212/91; Súmula 386 STJ).
  const brutoAbono = valorDia * abonoDias * (1 + 1 / 3);
  const bruto = brutoFerias + brutoAbono;

  // Tributos incidem só sobre a parte de férias gozadas (abono é isento).
  const inss = calcularINSS(brutoFerias, TABELA_INSS_2025, TETO_INSS_2025).valor;
  const baseIrrf = Math.max(0, brutoFerias - inss);
  const irrf = calcularIRRF(baseIrrf, dependentes, TABELA_IRRF_2025, DEDUCAO_DEPENDENTE_IRRF_2025).valor;

  return {
    cpf, nome, dataInicio, dataFim, diasGozados, abonoDias,
    bruto: round2(bruto),
    inss: round2(inss),
    irrf: round2(irrf),
    liquido: round2(bruto - inss - irrf),
    mesCaixa: mesDoPagamento(dataInicio),
  };
}

/** Agrupa desembolsos por mês de caixa (yyyy-mm) para o fluxo de 12 meses. */
export function fluxoDesembolso12Meses(
  periodos: DesembolsoPeriodo[],
): { mes: string; bruto: number; liquido: number; pessoas: number }[] {
  const map = new Map<string, { bruto: number; liquido: number; cpfs: Set<string> }>();
  for (const p of periodos) {
    const cur = map.get(p.mesCaixa) ?? { bruto: 0, liquido: 0, cpfs: new Set() };
    cur.bruto += p.bruto;
    cur.liquido += p.liquido;
    cur.cpfs.add(p.cpf);
    map.set(p.mesCaixa, cur);
  }
  return Array.from(map.entries())
    .map(([mes, v]) => ({ mes, bruto: round2(v.bruto), liquido: round2(v.liquido), pessoas: v.cpfs.size }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
}

// ── Passivo em dobro (art. 137, seção 7.1) ──────────────────────────────────

export interface PassivoDobroItem {
  cpf: string;
  nome: string;
  aquisitivoFim: string;
  limiteConcessivo: string;
  diasVencidos: number;
  valorSimples: number;
  /** Adicional exigível: mesmo valor de novo (a "dobra"). */
  valorDobra: number;
}

/**
 * Passivo em dobro: férias não concedidas dentro do limite concessivo (12 meses
 * após o fim do aquisitivo) são devidas em dobro (art. 137). Quantifica o custo
 * da inércia — a seção 7.1 chama de "o argumento que destrava o projeto".
 *
 * Aqui é o valor ADICIONAL (a dobra), sobre férias já vencidas na data de ref.
 */
export function passivoDobro(params: {
  cpf: string;
  nome: string;
  remuneracaoMensal: number;
  aquisitivoFim: string;
  diasSaldo: number;
  encargos: EncargosConfig;
  dataReferencia?: Date;
}): PassivoDobroItem | null {
  const { cpf, nome, remuneracaoMensal, aquisitivoFim, diasSaldo, encargos } = params;
  const ref = params.dataReferencia ?? new Date();

  const limite = new Date(aquisitivoFim + "T12:00:00");
  limite.setMonth(limite.getMonth() + 12);

  // Só há dobra se o limite já passou e ainda há saldo.
  if (ref <= limite || diasSaldo <= 0) return null;

  const base = (remuneracaoMensal / 30) * diasSaldo * (1 + 1 / 3);
  const comEncargos = base * (1 + taxaEncargos(encargos));
  return {
    cpf, nome,
    aquisitivoFim,
    limiteConcessivo: limite.toISOString().slice(0, 10),
    diasVencidos: diasSaldo,
    valorSimples: round2(comEncargos),
    valorDobra: round2(comEncargos), // a dobra é igual ao simples
  };
}

// ── Auxiliares ──────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Mês (yyyy-mm) do pagamento: 2 dias corridos antes do início (art. 145). */
function mesDoPagamento(dataInicio: string): string {
  const d = new Date(dataInicio + "T12:00:00");
  d.setDate(d.getDate() - 2);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
