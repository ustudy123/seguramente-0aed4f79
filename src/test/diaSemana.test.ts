import { describe, it, expect } from "vitest";
import {
  abreviacaoDiaSemana,
  ehDomingo,
  ehSabado,
  rotuloTipoDia,
  formatarHoraMinuto,
  dataLocalDeISO,
} from "@/lib/ponto/diaSemana";

// ============================================================
// Rotulagem de dias (RN14/RN15/RN16) e formato de horas (RN19)
// ============================================================

describe("abreviacaoDiaSemana (RN16)", () => {
  it("identifica os dias do print do chamado", () => {
    expect(abreviacaoDiaSemana("2026-06-20")).toBe("SAB");
    expect(abreviacaoDiaSemana("2026-06-21")).toBe("DOM");
  });

  it("cobre a semana inteira", () => {
    expect(abreviacaoDiaSemana("2026-06-22")).toBe("SEG");
    expect(abreviacaoDiaSemana("2026-06-23")).toBe("TER");
    expect(abreviacaoDiaSemana("2026-06-24")).toBe("QUA");
    expect(abreviacaoDiaSemana("2026-06-25")).toBe("QUI");
    expect(abreviacaoDiaSemana("2026-06-26")).toBe("SEX");
  });

  // new Date("2026-06-21") é meia-noite UTC: a oeste de Greenwich viraria
  // 20/06 e o rótulo sairia SAB em vez de DOM.
  it("não desloca o dia por fuso horário", () => {
    const dt = dataLocalDeISO("2026-06-21");
    expect(dt?.getDate()).toBe(21);
    expect(dt?.getMonth()).toBe(5);
    expect(abreviacaoDiaSemana("2026-06-21")).toBe("DOM");
  });

  it("aceita timestamp completo e devolve vazio para entrada inválida", () => {
    expect(abreviacaoDiaSemana("2026-06-27T10:30:00")).toBe("SAB");
    expect(abreviacaoDiaSemana("")).toBe("");
    expect(abreviacaoDiaSemana("data-ruim")).toBe("");
  });
});

describe("rotuloTipoDia (RN14/RN15)", () => {
  it("marca DSR no domingo", () => {
    expect(rotuloTipoDia("2026-06-21")).toBe("DSR");
  });

  it("NÃO marca DSR no sábado — natureza jurídica distinta", () => {
    expect(rotuloTipoDia("2026-06-20")).toBeNull();
  });

  it("não rotula sábado comum como Compensado", () => {
    expect(rotuloTipoDia("2026-06-20")).not.toBe("Compensado");
  });

  it("mantém Equalização no sábado marcado", () => {
    expect(rotuloTipoDia("2026-06-27", { equalizacao: true })).toBe("Equalização");
  });

  it("dias úteis não recebem rótulo de tipo", () => {
    expect(rotuloTipoDia("2026-06-24")).toBeNull();
  });

  it("equalização vence sobre o dia da semana", () => {
    expect(rotuloTipoDia("2026-06-21", { equalizacao: true })).toBe("Equalização");
  });
});

describe("ehSabado / ehDomingo", () => {
  it("distingue sábado de domingo", () => {
    expect(ehSabado("2026-06-20")).toBe(true);
    expect(ehDomingo("2026-06-20")).toBe(false);
    expect(ehDomingo("2026-06-21")).toBe(true);
    expect(ehSabado("2026-06-21")).toBe(false);
  });
});

describe("formatarHoraMinuto (RN19)", () => {
  it("preenche minutos de um dígito com zero à esquerda", () => {
    expect(formatarHoraMinuto(488)).toBe("8h 08min"); // o caso do print
  });

  it("mantém os valores que já estavam corretos", () => {
    expect(formatarHoraMinuto(574)).toBe("9h 34min");
    expect(formatarHoraMinuto(-30, { sinal: true })).toBe("-0h 30min");
  });

  it("prefixa o sinal quando pedido", () => {
    expect(formatarHoraMinuto(56, { sinal: true })).toBe("+0h 56min");
    expect(formatarHoraMinuto(-8, { sinal: true })).toBe("-0h 08min");
  });

  it("sem sinal, negativos ainda mostram o menos", () => {
    expect(formatarHoraMinuto(-8)).toBe("-0h 08min");
  });

  it("trata zero e entradas inválidas", () => {
    expect(formatarHoraMinuto(0)).toBe("0h 00min");
    expect(formatarHoraMinuto(NaN)).toBe("0h 00min");
  });
});
