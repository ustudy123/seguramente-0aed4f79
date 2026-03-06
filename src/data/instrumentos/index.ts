export * from './copsoq';
export * from './hse';
export * from './proart';
export * from './sipro';

import { COPSOQ_DIMENSOES, COPSOQ_TOTAL_PERGUNTAS } from './copsoq';
import { HSE_DIMENSOES, HSE_TOTAL_PERGUNTAS } from './hse';
import { PROART_DIMENSOES, PROART_TOTAL_PERGUNTAS } from './proart';
import { SIPRO_DIMENSOES, SIPRO_TOTAL_PERGUNTAS } from './sipro';
import type { DimensaoInstrumento } from './copsoq';

export type { DimensaoInstrumento };

/**
 * Calcular IPS (0-100) a partir das respostas de um instrumento
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

      let valorNormalizado: number;
      if (p.invertida) {
        valorNormalizado = raw;
      } else {
        valorNormalizado = 4 - raw;
      }

      for (let i = 0; i < peso; i++) {
        valoresDim.push(valorNormalizado);
      }
    }

    const mediaDim = valoresDim.length > 0
      ? valoresDim.reduce((a, b) => a + b, 0) / valoresDim.length
      : 2;

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
