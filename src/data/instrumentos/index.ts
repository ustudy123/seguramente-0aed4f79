export * from './copsoq';
export * from './copsoq2br';
export * from './hse';
export * from './proart';
export * from './sipro';

import { COPSOQ_DIMENSOES, COPSOQ_TOTAL_PERGUNTAS } from './copsoq';
import { COPSOQ2BR_DIMENSOES, COPSOQ2BR_TOTAL_PERGUNTAS } from './copsoq2br';
import { HSE_DIMENSOES, HSE_TOTAL_PERGUNTAS } from './hse';
import { PROART_DIMENSOES, PROART_TOTAL_PERGUNTAS } from './proart';
import { SIPRO_DIMENSOES, SIPRO_TOTAL_PERGUNTAS } from './sipro';
import type { DimensaoInstrumento } from './copsoq';

export type { DimensaoInstrumento };

// ─────────────────────────────────────────────────────────────────────────────
// Pesos por eixo — Modelo de compilação SIPRO (Total = 100%)
// ─────────────────────────────────────────────────────────────────────────────

/** Pesos para cálculo do IRP-S (Índice de Risco Psicossocial) — Total = 100% */
export const PESOS_IRPS: Record<string, number> = {
  sipro_demandas_quantitativas: 15,
  sipro_demandas_cognitivas: 15,
  sipro_demandas_emocionais: 10,
  sipro_autonomia_controle: 10,
  sipro_clareza_papeis: 10,
  sipro_reconhecimento_justica: 10,
  sipro_relacionamentos_suporte: 10,
  sipro_sentido_engajamento: 5,
  sipro_recuperacao_equilibrio: 10,
  sipro_sinais_precoces: 5,
};

/** Pesos para IBO-S (Burnout) — reforço em sobrecarga + recuperação + sinais */
export const PESOS_IBO: Record<string, number> = {
  sipro_demandas_quantitativas: 25,
  sipro_demandas_cognitivas: 20,
  sipro_demandas_emocionais: 20,
  sipro_recuperacao_equilibrio: 20,
  sipro_sinais_precoces: 10,
  sipro_autonomia_controle: 5,
};

/** Pesos para IBD-S (Boreout) — subcarga, monotonia, desengajamento */
export const PESOS_IBD: Record<string, number> = {
  sipro_sentido_engajamento: 30,
  sipro_autonomia_controle: 25,
  sipro_clareza_papeis: 15,
  sipro_reconhecimento_justica: 15,
  sipro_relacionamentos_suporte: 15,
};

/** Pesos para IREC-S (Recuperação) */
export const PESOS_IREC: Record<string, number> = {
  sipro_recuperacao_equilibrio: 60,
  sipro_demandas_quantitativas: 20,
  sipro_demandas_emocionais: 10,
  sipro_sinais_precoces: 10,
};

/** Pesos para ICOP-S (Clareza Organizacional de Papéis) */
export const PESOS_ICOP: Record<string, number> = {
  sipro_clareza_papeis: 40,
  sipro_reconhecimento_justica: 25,
  sipro_relacionamentos_suporte: 20,
  sipro_autonomia_controle: 15,
};

/** Pesos para INOT-S (Trabalho Noturno/CET) — ativado apenas quando bloco cet_noturno presente */
export const PESOS_INOT: Record<string, number> = {
  cet_noturno: 70,
  sipro_demandas_cognitivas: 15,
  sipro_recuperacao_equilibrio: 15,
};

/**
 * Calcula um índice derivado com base em pesos e scores por dimensão.
 * Retorna score 0-100 (ponderado).
 */
export function calcularIndicePonderado(
  porDimensao: Record<string, { score: number; valida?: boolean }>,
  pesos: Record<string, number>
): number {
  let somaWeighted = 0;
  let somaWeights = 0;

  for (const [dimId, peso] of Object.entries(pesos)) {
    const dim = porDimensao[dimId];
    if (dim && (dim.valida === undefined || dim.valida)) {
      somaWeighted += dim.score * peso;
      somaWeights += peso;
    }
  }

  if (somaWeights === 0) return 0;
  return Math.round(somaWeighted / somaWeights);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos do SIPRO
// ─────────────────────────────────────────────────────────────────────────────

export type NivelIRPS = 'saudavel' | 'estavel' | 'atencao' | 'risco' | 'critico';

export interface DimensaoIRPS {
  id: string;
  nome: string;
  tipo: 'risco' | 'protetor';
  grupo?: string;
  /** Score 0–100 orientado para risco (quanto maior, pior) */
  score: number;
  nivel: NivelIRPS;
  /** Média bruta original na escala 1-5 (antes da transformação) */
  mediaBruta: number;
  /** Desvio padrão dos itens respondidos */
  desvioPadrao: number;
  /** Quantidade de itens válidos / total */
  itensValidos: number;
  itensTotal: number;
  /** true se dimensão atingiu mínimo de 75% de itens respondidos */
  valida: boolean;
}

export interface ResultadoIRPS {
  /** IRP-S geral (0–100), onde maior = maior risco */
  irps: number;
  nivel: NivelIRPS;
  porDimensao: Record<string, DimensaoIRPS>;
  /** Desvio padrão entre as dimensões válidas */
  desvioPadraoGeral: number;
  /** Número de dimensões válidas */
  dimensoesValidas: number;
  dimensoesTotal: number;
  /** true se atingiu 80% de dimensões válidas para cálculo do índice geral */
  indiceValido: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers estatísticos
// ─────────────────────────────────────────────────────────────────────────────

function media(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

function desvioPadrao(valores: number[]): number {
  if (valores.length < 2) return 0;
  const m = media(valores);
  const variancia = valores.reduce((acc, v) => acc + (v - m) ** 2, 0) / valores.length;
  return Math.sqrt(variancia);
}

/**
 * Recodifica item protetor para direção de risco (escala 1-5).
 * Regra: valor_recodificado = 6 - valor_original
 * Protetor com resposta 5 (máxima proteção) → vira 1 (mínimo risco)
 * Protetor com resposta 1 (mínima proteção) → vira 5 (máximo risco)
 */
function recodificarItem(raw: number, invertida: boolean): number {
  // Escala original: 0..4 (5 pontos)
  // Regra SIPRO: escala 1..5
  const raw1to5 = raw + 1;
  return invertida ? 6 - raw1to5 : raw1to5;
}

/**
 * Transforma média bruta (escala 1-5) em score 0-100 orientado para risco.
 * Fórmula: ((média - 1) / 4) × 100
 */
function transformarScore(mediaBruta: number): number {
  return Math.round(((mediaBruta - 1) / 4) * 100);
}

function classificarNivelIRPS(score: number): NivelIRPS {
  if (score <= 20) return 'saudavel';
  if (score <= 35) return 'estavel';
  if (score <= 50) return 'atencao';
  if (score <= 65) return 'risco';
  return 'critico';
}

// ─────────────────────────────────────────────────────────────────────────────
// Cálculo principal do SIPRO — Modelo Estatístico V1
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula o IRP-S (Índice de Risco Psicossocial YourEyes) conforme
 * modelo estatístico documentado:
 *
 * Etapa 1: Coletar respostas na escala 1–5.
 * Etapa 2: Inverter itens protetores (6 - raw).
 * Etapa 3: Calcular média dos itens válidos por dimensão (≥75% respondidos).
 * Etapa 4: Transformar para 0–100 via ((média - 1) / 4) × 100.
 * Etapa 5: IRP-S = média das dimensões válidas (≥80% válidas para índice geral).
 * Etapa 6: Calcular dispersão (desvio padrão) por dimensão e global.
 *
 * Escala de resposta: 1=Nunca … 5=Sempre
 * Quanto maior o score, maior o risco psicossocial.
 *
 * Faixas de classificação:
 *   0–24  → Condição Favorável (baixo risco)
 *   25–49 → Atenção Leve
 *   50–74 → Risco Moderado
 *   75–100→ Risco Elevado
 */
export function calcularIRPS(
  respostas: Record<string, number>,
  dimensoes: DimensaoInstrumento[]
): ResultadoIRPS {
  const porDimensao: Record<string, DimensaoIRPS> = {};
  const scoresValidos: number[] = [];

  for (const dim of dimensoes) {
    const itensTotal = dim.perguntas.length;
    const valoresRecodificados: number[] = [];

    for (const p of dim.perguntas) {
      const raw = respostas[p.id];
      // Escala armazenada: 0..4 (0=Nunca … 4=Sempre). recodificarItem faz +1 e inverte se protetor.
      if (raw != null && raw >= 0 && raw <= 4) {
        valoresRecodificados.push(recodificarItem(raw, !!p.invertida));
      }
    }

    const itensValidos = valoresRecodificados.length;
    // Dimensão válida somente com ≥75% dos itens respondidos
    const valida = itensTotal > 0 && (itensValidos / itensTotal) >= 0.75;

    let score = 50; // padrão neutro quando inválido
    let mediaBruta = 3;
    let dp = 0;

    if (valida && itensValidos > 0) {
      mediaBruta = media(valoresRecodificados);
      dp = desvioPadrao(valoresRecodificados);
      score = transformarScore(mediaBruta);
    }

    const nivel = classificarNivelIRPS(score);

    porDimensao[dim.id] = {
      id: dim.id,
      nome: dim.nome,
      tipo: dim.tipo,
      grupo: dim.grupo,
      score,
      nivel,
      mediaBruta: Math.round(mediaBruta * 100) / 100,
      desvioPadrao: Math.round(dp * 100) / 100,
      itensValidos,
      itensTotal,
      valida,
    };

    if (valida) {
      scoresValidos.push(score);
    }
  }

  const dimensoesTotal = dimensoes.length;
  const dimensoesValidas = scoresValidos.length;
  // Índice geral válido somente com ≥80% das dimensões válidas
  const indiceValido = dimensoesTotal > 0 && (dimensoesValidas / dimensoesTotal) >= 0.80;

  const irps = indiceValido && scoresValidos.length > 0
    ? Math.round(media(scoresValidos))
    : 0;

  const dpGeral = desvioPadrao(scoresValidos);

  return {
    irps,
    nivel: classificarNivelIRPS(irps),
    porDimensao,
    desvioPadraoGeral: Math.round(dpGeral * 100) / 100,
    dimensoesValidas,
    dimensoesTotal,
    indiceValido,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cálculo IPS — instrumentos padrão (COPSOQ, HSE, PROART) — escala 0-4
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcular IPS (0-100) a partir das respostas de instrumentos padrão.
 * Escala 0-4: invertida=true → maior valor = melhor (protetor).
 */
export function calcularIPSInstrumento(
  respostas: Record<string, number>,
  dimensoes: DimensaoInstrumento[]
): {
  ips: number;
  porDimensao: Record<string, { score: number; nivel: 'otimo' | 'bom' | 'atencao' | 'critico'; tipo: 'risco' | 'protetor' }>;
} {
  const porDimensao: Record<string, { score: number; nivel: 'otimo' | 'bom' | 'atencao' | 'critico'; tipo: 'risco' | 'protetor' }> = {};
  const scores: number[] = [];

  for (const dim of dimensoes) {
    const valoresDim: number[] = [];

    for (const p of dim.perguntas) {
      const raw = respostas[p.id] ?? 2;
      const peso = p.peso ?? 1;

      // Escala 0-4: protetor (invertida=true) → maior resposta = melhor → manter raw
      // Risco (invertida=false) → maior resposta = pior → inverter: 4 - raw
      const valorNormalizado = p.invertida ? raw : 4 - raw;

      for (let i = 0; i < peso; i++) {
        valoresDim.push(valorNormalizado);
      }
    }

    const mediaDim = valoresDim.length > 0
      ? valoresDim.reduce((a, b) => a + b, 0) / valoresDim.length
      : 2;

    // IPS: quanto maior, melhor. Para fator protetor, raw alto = bom = score alto.
    // Para fator risco, (4-raw) alto = bom = score alto.
    const score100 = Math.round((mediaDim / 4) * 100);
    scores.push(score100);

    let nivel: 'otimo' | 'bom' | 'atencao' | 'critico';
    if (score100 >= 80) nivel = 'otimo';
    else if (score100 >= 65) nivel = 'bom';
    else if (score100 >= 50) nivel = 'atencao';
    else nivel = 'critico';

    porDimensao[dim.id] = { score: score100, nivel, tipo: dim.tipo };
  }

  const ips = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 50;

  return { ips, porDimensao };
}

export function getDimensoesByInstrumento(instrumento: 'copsoq' | 'hse' | 'proart' | 'sipro' | 'ambos'): DimensaoInstrumento[] {
  if (instrumento === 'copsoq') return COPSOQ_DIMENSOES;
  if (instrumento === 'hse') return HSE_DIMENSOES;
  if (instrumento === 'proart') return PROART_DIMENSOES;
  if (instrumento === 'sipro') return SIPRO_DIMENSOES;
  return [...COPSOQ_DIMENSOES, ...HSE_DIMENSOES, ...PROART_DIMENSOES, ...SIPRO_DIMENSOES];
}

export function getTotalPerguntasByInstrumento(instrumento: 'copsoq' | 'hse' | 'proart' | 'sipro' | 'ambos'): number {
  if (instrumento === 'copsoq') return COPSOQ_TOTAL_PERGUNTAS;
  if (instrumento === 'hse') return HSE_TOTAL_PERGUNTAS;
  if (instrumento === 'proart') return PROART_TOTAL_PERGUNTAS;
  if (instrumento === 'sipro') return SIPRO_TOTAL_PERGUNTAS;
  return COPSOQ_TOTAL_PERGUNTAS + HSE_TOTAL_PERGUNTAS + PROART_TOTAL_PERGUNTAS + SIPRO_TOTAL_PERGUNTAS;
}

/** Retorna label de classificação IRP-S em português */
export function getLabelNivelIRPS(nivel: NivelIRPS): string {
  const labels: Record<NivelIRPS, string> = {
    saudavel: 'Ambiente Saudável',
    estavel: 'Estável',
    atencao: 'Atenção',
    risco: 'Risco Psicossocial',
    critico: 'Risco Crítico',
  };
  return labels[nivel];
}

/** Retorna cor Tailwind para o nível IRP-S */
export function getCorNivelIRPS(nivel: NivelIRPS): string {
  const cores: Record<NivelIRPS, string> = {
    saudavel: 'text-emerald-600',
    estavel: 'text-blue-600',
    atencao: 'text-amber-600',
    risco: 'text-orange-600',
    critico: 'text-red-600',
  };
  return cores[nivel];
}

/** Retorna cor de fundo Tailwind para o nível IRP-S */
export function getBgNivelIRPS(nivel: NivelIRPS): string {
  const cores: Record<NivelIRPS, string> = {
    saudavel: 'bg-emerald-50 border-emerald-200',
    estavel: 'bg-blue-50 border-blue-200',
    atencao: 'bg-amber-50 border-amber-200',
    risco: 'bg-orange-50 border-orange-200',
    critico: 'bg-red-50 border-red-200',
  };
  return cores[nivel];
}
