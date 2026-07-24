/**
 * Prazos de tratamento por nível de GRO.
 *
 * Fonte única da seção "2. Síntese Executiva" do relatório de Plano de Ação.
 * O prazo define o campo "Até quando" do 5W2H: a data limite é sempre
 * `data_inicial + prazoDias`, contada a partir do encerramento da campanha
 * que originou o diagnóstico.
 *
 * TRIVIAL não tem prazo — a NR-01 admite risco desprezível sem ação corretiva,
 * exigindo apenas o registro documental do monitoramento.
 */
import type { NivelGRO15 } from "@/lib/groPsicossocial15";

export interface PrazoGRO {
  dias: number | null;
  /** Texto da síntese executiva, exatamente como sai no relatório. */
  acao: string;
  rotuloPrazo: string;
}

export const PRAZO_POR_NIVEL: Record<NivelGRO15, PrazoGRO> = {
  critico: {
    dias: 30,
    acao: "Intervenção imediata necessária",
    rotuloPrazo: "prazo: até 30 dias",
  },
  alto: {
    dias: 60,
    acao: "Ação preventiva prioritária",
    rotuloPrazo: "prazo: até 60 dias",
  },
  medio: {
    dias: 90,
    acao: "Monitoramento e melhorias contínuas",
    rotuloPrazo: "prazo: até 90 dias",
  },
  baixo: {
    dias: 180,
    acao: "Manter vigilância",
    rotuloPrazo: "prazo: até 180 dias",
  },
  trivial: {
    dias: null,
    acao: "Risco desprezível; manter registro documental",
    rotuloPrazo: "sem prazo definido",
  },
};

/** Ordem de apresentação na síntese executiva (mais grave primeiro). */
export const NIVEIS_SINTESE: NivelGRO15[] = ["critico", "alto", "medio", "baixo", "trivial"];

/**
 * Data limite da ação: início + prazo do nível.
 * Retorna null para TRIVIAL, que não tem prazo.
 */
export function calcularAteQuando(dataInicial: Date, nivel: NivelGRO15): Date | null {
  const prazo = PRAZO_POR_NIVEL[nivel].dias;
  if (prazo === null) return null;
  const d = new Date(dataInicial);
  d.setDate(d.getDate() + prazo);
  return d;
}

/** Frase completa da síntese, ex.: "3 dimensão(ões) em nível ALTO — ..." */
export function linhaSintese(nivel: NivelGRO15, quantidade: number, token: string): string {
  const p = PRAZO_POR_NIVEL[nivel];
  const sufixo = p.dias === null ? p.acao : `${p.acao} (${p.rotuloPrazo})`;
  return `${quantidade} dimensão(ões) em nível ${token} — ${sufixo}`;
}
