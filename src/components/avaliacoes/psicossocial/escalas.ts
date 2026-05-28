export interface EscalaOpcao {
  valor: number;
  label: string;
  emoji: string;
  intensidade: number;
}

export const ESCALA_RISCO: EscalaOpcao[] = [
  { valor: 0, label: 'Nunca',          emoji: '😄', intensidade: 0 },
  { valor: 1, label: 'Raramente',      emoji: '🙂', intensidade: 1 },
  { valor: 2, label: 'Às vezes',       emoji: '😐', intensidade: 2 },
  { valor: 3, label: 'Frequentemente', emoji: '😟', intensidade: 3 },
  { valor: 4, label: 'Sempre',         emoji: '😣', intensidade: 4 },
];

export const ESCALA_PROTETOR: EscalaOpcao[] = [
  { valor: 0, label: 'Nunca',          emoji: '😣', intensidade: 4 },
  { valor: 1, label: 'Raramente',      emoji: '😟', intensidade: 3 },
  { valor: 2, label: 'Às vezes',       emoji: '😐', intensidade: 2 },
  { valor: 3, label: 'Frequentemente', emoji: '🙂', intensidade: 1 },
  { valor: 4, label: 'Sempre',         emoji: '😄', intensidade: 0 },
];

export const ESCALA_SAUDE: EscalaOpcao[] = [
  { valor: 0, label: 'Excelente',  emoji: '😄', intensidade: 0 },
  { valor: 1, label: 'Muito boa',  emoji: '🙂', intensidade: 1 },
  { valor: 2, label: 'Boa',        emoji: '😐', intensidade: 2 },
  { valor: 3, label: 'Razoável',   emoji: '😟', intensidade: 3 },
  { valor: 4, label: 'Ruim',       emoji: '😣', intensidade: 4 },
];

export const ESCALA_SATISFACAO: EscalaOpcao[] = [
  { valor: 0, label: 'Muito insatisfeito', emoji: '😣', intensidade: 4 },
  { valor: 1, label: 'Insatisfeito',       emoji: '😟', intensidade: 3 },
  { valor: 2, label: 'Neutro',             emoji: '😐', intensidade: 2 },
  { valor: 3, label: 'Satisfeito',         emoji: '🙂', intensidade: 1 },
  { valor: 4, label: 'Muito satisfeito',   emoji: '😄', intensidade: 0 },
];

const ESCALAS_CUSTOMIZADAS: Record<string, EscalaOpcao[]> = {
  c2br_13: ESCALA_SATISFACAO,
  c2br_17: ESCALA_SAUDE,
};

export function getEscalaPergunta(perguntaId: string, invertida?: boolean): EscalaOpcao[] {
  return ESCALAS_CUSTOMIZADAS[perguntaId] ?? (invertida ? ESCALA_PROTETOR : ESCALA_RISCO);
}

export function getEscalaOpcao(perguntaId: string, invertida: boolean | undefined, valor: number) {
  return getEscalaPergunta(perguntaId, invertida).find((opcao) => opcao.valor === valor);
}