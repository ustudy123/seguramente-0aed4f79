/**
 * Motor de regras legais da Programação de Férias (Fase 3B).
 *
 * Avalia uma linha programada (P1/P2/P3, abono) contra as regras da CLT e
 * devolve as violações. Cada violação tem um comportamento (seção 5 do DRF):
 *   • bloqueio    — impede salvar
 *   • alerta      — salva, mas exige ciência (e sinaliza)
 *   • informativo — só informa
 *
 * 3B-1 (aqui): regras cujo dado já existe no sistema. As três que dependem de
 * estrutura nova — feriados por unidade (art. 134 §3º), vínculo familiar
 * (art. 136), afastamento (art. 133) — entram na 3B-2 e são declaradas como
 * "pendentes de configuração" para não darem falso-OK.
 *
 * A avaliação roda no momento da PROGRAMAÇÃO, não só na aprovação (exigência
 * explícita da seção 5).
 */

export type ComportamentoRegra = "bloqueio" | "alerta" | "informativo";

export interface ViolacaoRegra {
  regra: string;
  baseLegal: string;
  comportamento: ComportamentoRegra;
  mensagem: string;
}

export interface SubPeriodoEntrada {
  inicio: string | null;
  fim: string | null;
  dias: number | null;
}

export interface EntradaProgramacao {
  aquisitivoFim: string;
  saldo: number;
  p1: SubPeriodoEntrada;
  p2: SubPeriodoEntrada;
  p3: SubPeriodoEntrada;
  abonoVender: boolean;
  abonoDias: number;
  /** Limite concessivo do período (art. 134 caput). */
  limiteConcessivo: Date;
  hoje?: Date;
}

const dias = (s: SubPeriodoEntrada) => s.dias ?? 0;
const usados = (e: EntradaProgramacao) =>
  [e.p1, e.p2, e.p3].filter(s => (s.dias ?? 0) > 0);

/** Data (meia-noite local) de uma string ISO. */
function d(iso: string): Date {
  return new Date(iso + "T12:00:00");
}

/**
 * Avalia as regras da 3B-1. Retorna todas as violações encontradas; a UI decide
 * o que bloqueia (qualquer 'bloqueio') e o que só alerta.
 */
export function avaliarRegrasProgramacao(e: EntradaProgramacao): ViolacaoRegra[] {
  const v: ViolacaoRegra[] = [];
  const hoje = e.hoje ?? new Date();
  const subs = usados(e);
  const totalDias = subs.reduce((s, x) => s + dias(x), 0);
  const totalComAbono = totalDias + (e.abonoVender ? e.abonoDias : 0);

  // ── Art. 134 §1º — fracionamento ──────────────────────────────────────────
  if (subs.length > 3) {
    v.push({
      regra: "Fracionamento máximo de 3 períodos",
      baseLegal: "CLT art. 134, §1º",
      comportamento: "bloqueio",
      mensagem: "As férias podem ser fracionadas em no máximo 3 períodos.",
    });
  }
  if (subs.length > 1) {
    const temLongo = subs.some(s => dias(s) >= 14);
    if (!temLongo) {
      v.push({
        regra: "Um período ≥ 14 dias",
        baseLegal: "CLT art. 134, §1º",
        comportamento: "bloqueio",
        mensagem: "Ao fracionar, um dos períodos deve ter no mínimo 14 dias corridos.",
      });
    }
    const temCurto = subs.some(s => dias(s) < 5);
    if (temCurto) {
      v.push({
        regra: "Nenhum período < 5 dias",
        baseLegal: "CLT art. 134, §1º",
        comportamento: "bloqueio",
        mensagem: "Nenhum período de férias pode ser inferior a 5 dias corridos.",
      });
    }
  } else if (subs.length === 1 && dias(subs[0]) < 5) {
    v.push({
      regra: "Período mínimo de 5 dias",
      baseLegal: "CLT art. 134, §1º",
      comportamento: "bloqueio",
      mensagem: "O período de férias não pode ser inferior a 5 dias corridos.",
    });
  }

  // ── Saldo — não pode programar mais do que tem direito ─────────────────────
  if (totalComAbono > e.saldo) {
    v.push({
      regra: "Programação excede o saldo",
      baseLegal: "CLT art. 130",
      comportamento: "bloqueio",
      mensagem: `Total programado (${totalComAbono}d) excede o saldo de ${e.saldo}d.`,
    });
  }

  // ── Art. 143 §1º — abono pecuniário ≤ 1/3 ──────────────────────────────────
  if (e.abonoVender) {
    // 1/3 do direito. Saldo é proxy do direito do período em aberto.
    const maxAbono = Math.floor(e.saldo / 3);
    if (e.abonoDias > maxAbono || e.abonoDias > 10) {
      v.push({
        regra: "Abono limitado a 1/3",
        baseLegal: "CLT art. 143, §1º",
        comportamento: "bloqueio",
        mensagem: `O abono não pode passar de 1/3 do período (máx. ${Math.min(maxAbono, 10)} dias).`,
      });
    }
  }

  // ── Art. 134 caput — concessão dentro do limite concessivo ─────────────────
  // Qualquer sub-período que comece após o limite = fora do prazo.
  for (const s of subs) {
    if (!s.inicio) continue;
    if (d(s.inicio) > e.limiteConcessivo) {
      v.push({
        regra: "Concessão fora do limite",
        baseLegal: "CLT art. 134, caput",
        comportamento: "bloqueio",
        mensagem: `Início ${d(s.inicio).toLocaleDateString("pt-BR")} ultrapassa o limite concessivo (${e.limiteConcessivo.toLocaleDateString("pt-BR")}). Requer justificativa de diretoria.`,
      });
      break;
    }
  }

  // ── Art. 137 — período já vencido gera dobra (informativo) ─────────────────
  if (hoje > e.limiteConcessivo && e.saldo > 0) {
    v.push({
      regra: "Período vencido — pagamento em dobro",
      baseLegal: "CLT art. 137",
      comportamento: "informativo",
      mensagem: `Este período já ultrapassou o limite concessivo (${e.limiteConcessivo.toLocaleDateString("pt-BR")}). As férias serão devidas em dobro.`,
    });
  }

  // ── Art. 135 — aviso 30 dias antes ─────────────────────────────────────────
  // Se o início mais próximo está a menos de 30 dias, o aviso não cabe no prazo.
  const inicios = subs.map(s => s.inicio).filter(Boolean) as string[];
  if (inicios.length > 0) {
    const maisProximo = inicios.map(d).sort((a, b) => a.getTime() - b.getTime())[0];
    const diasAteInicio = Math.ceil((maisProximo.getTime() - hoje.getTime()) / 86400000);
    if (diasAteInicio >= 0 && diasAteInicio < 30) {
      v.push({
        regra: "Aviso com 30 dias de antecedência",
        baseLegal: "CLT art. 135",
        comportamento: "alerta",
        mensagem: `Início em ${diasAteInicio} dias — abaixo dos 30 dias de aviso. Emita o aviso o quanto antes.`,
      });
    }
  }

  // ── Art. 145 — pagamento até 2 dias antes ──────────────────────────────────
  // Informativo na programação: a obrigação de caixa vence em D-2.
  if (inicios.length > 0) {
    const maisProximo = inicios.map(d).sort((a, b) => a.getTime() - b.getTime())[0];
    const pagamento = new Date(maisProximo);
    pagamento.setDate(pagamento.getDate() - 2);
    if (pagamento >= hoje) {
      v.push({
        regra: "Pagamento até 2 dias antes",
        baseLegal: "CLT art. 145",
        comportamento: "informativo",
        mensagem: `Pagamento deve ocorrer até ${pagamento.toLocaleDateString("pt-BR")} (2 dias antes do início).`,
      });
    }
  }

  return v;
}

/** Há alguma violação que impede salvar? */
export function temBloqueio(violacoes: ViolacaoRegra[]): boolean {
  return violacoes.some(x => x.comportamento === "bloqueio");
}

/** Regras da 3B-2 (dependem de estrutura ainda não construída). Declaradas para
 *  a UI mostrar que existem, mas ainda não são avaliadas — evita falso-OK. */
export const REGRAS_PENDENTES_3B2: { regra: string; baseLegal: string; motivo: string }[] = [
  {
    regra: "Não iniciar 2 dias antes de feriado/DSR",
    baseLegal: "CLT art. 134, §3º",
    motivo: "Requer calendário de feriados por unidade.",
  },
  {
    regra: "Familiares no mesmo período",
    baseLegal: "CLT art. 136, §1º",
    motivo: "Requer cadastro de vínculo familiar.",
  },
  {
    regra: "Reinício do aquisitivo por afastamento",
    baseLegal: "CLT art. 133",
    motivo: "Requer integração com o módulo de Afastamentos.",
  },
];
