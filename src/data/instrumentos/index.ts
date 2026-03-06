export * from './copsoq';
export * from './hse';

import { COPSOQ_DIMENSOES, COPSOQ_TOTAL_PERGUNTAS } from './copsoq';
import { HSE_DIMENSOES, HSE_TOTAL_PERGUNTAS } from './hse';
import type { DimensaoInstrumento } from './copsoq';

export type { DimensaoInstrumento };

/**
 * Calcular IPS (0-100) a partir das respostas de um instrumento
 * 
 * Lógica:
 * - Dimensões de RISCO: quanto maior a resposta, pior → inverte para cálculo
 * - Dimensões PROTETORAS: quanto maior a resposta, melhor → usa direto (já marcadas invertida=true no nível da pergunta)
 * - Escala raw 0-4 → normalizada 0-100
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
      const raw = respostas[p.id] ?? 2; // Default neutro
      const peso = p.peso ?? 1;

      // Se a pergunta é protetora (invertida), não inverte (maior = melhor já na escala)
      // Se é de risco, inverte (4 - valor) para que 0=melhor
      let valorNormalizado: number;
      if (p.invertida) {
        // Protetor: 4 = melhor → mantém
        valorNormalizado = raw;
      } else {
        // Risco: 0 = melhor, 4 = pior → inverte
        valorNormalizado = 4 - raw;
      }

      // Aplicar peso
      for (let i = 0; i < peso; i++) {
        valoresDim.push(valorNormalizado);
      }
    }

    const mediaDim = valoresDim.length > 0
      ? valoresDim.reduce((a, b) => a + b, 0) / valoresDim.length
      : 2;

    // Converter para 0-100
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

export function getDimensoesByInstrumento(instrumento: 'copsoq' | 'hse' | 'ambos'): DimensaoInstrumento[] {
  if (instrumento === 'copsoq') return COPSOQ_DIMENSOES;
  if (instrumento === 'hse') return HSE_DIMENSOES;
  // Ambos: sem duplicatas de dimensões similares
  return [...COPSOQ_DIMENSOES, ...HSE_DIMENSOES];
}

export function getTotalPerguntasByInstrumento(instrumento: 'copsoq' | 'hse' | 'ambos'): number {
  if (instrumento === 'copsoq') return COPSOQ_TOTAL_PERGUNTAS;
  if (instrumento === 'hse') return HSE_TOTAL_PERGUNTAS;
  return COPSOQ_TOTAL_PERGUNTAS + HSE_TOTAL_PERGUNTAS;
}
