import { describe, it, expect } from "vitest";
import {
  calcularCoberturaJornada,
  formatarMinutosCurto,
  LIMITE_EXTRA_DIARIO_MIN,
} from "@/lib/ponto/alertasDia";

// ============================================================
// Alertas do dia no Espelho de Ponto — casos reais de produção
// ============================================================

describe("calcularCoberturaJornada — cobertura por atestado", () => {
  // Kailaine, 30/06/2026: atestado 7h26 (446min) + trabalho 07:38–08:50
  // (72min) fecham a jornada de 8h38 (518min). O espelho acusava
  // "Saída antecipada de 3h10" — não deve mais acusar.
  it("considera a jornada coberta quando atestado + trabalho fecham o dia", () => {
    const r = calcularCoberturaJornada({
      jornadaPrevistaMin: 518,
      atestadoMin: 446,
      totalMin: 72,
    });
    expect(r.jornadaCoberta).toBe(true);
    expect(r.excedeLimiteDiario).toBe(false);
  });

  it("não considera coberta quando ainda falta jornada além da tolerância", () => {
    const r = calcularCoberturaJornada({
      jornadaPrevistaMin: 518,
      atestadoMin: 240,
      totalMin: 72,
    });
    expect(r.jornadaCoberta).toBe(false);
  });

  it("aceita pequena diferença de borda dentro da tolerância", () => {
    const r = calcularCoberturaJornada({
      jornadaPrevistaMin: 518,
      atestadoMin: 446,
      totalMin: 68, // 4 min a menos que o remanescente
    });
    expect(r.jornadaCoberta).toBe(true);
  });

  it("dia sem atestado que cumpre a jornada também conta como coberto", () => {
    const r = calcularCoberturaJornada({
      jornadaPrevistaMin: 518,
      atestadoMin: 0,
      totalMin: 518,
    });
    expect(r.jornadaCoberta).toBe(true);
  });

  it("saída antecipada real (sem atestado) segue não coberta", () => {
    const r = calcularCoberturaJornada({
      jornadaPrevistaMin: 518,
      atestadoMin: 0,
      totalMin: 68,
    });
    expect(r.jornadaCoberta).toBe(false);
  });
});

describe("calcularCoberturaJornada — teto diário (RN17)", () => {
  // Jaqueline, 08/06/2026: 10h53 (653min) contra jornada 8h38 (518min).
  // Teto legal = 518 + 120 = 638min (10h38) => excedente de 15min.
  it("sinaliza excesso quando o total passa da jornada + 2h", () => {
    const r = calcularCoberturaJornada({
      jornadaPrevistaMin: 518,
      atestadoMin: 0,
      totalMin: 653,
    });
    expect(r.excedeLimiteDiario).toBe(true);
    expect(r.excedenteLimiteMin).toBe(15);
  });

  it("não sinaliza no limite exato do teto", () => {
    const r = calcularCoberturaJornada({
      jornadaPrevistaMin: 518,
      atestadoMin: 0,
      totalMin: 518 + LIMITE_EXTRA_DIARIO_MIN,
    });
    expect(r.excedeLimiteDiario).toBe(false);
    expect(r.excedenteLimiteMin).toBe(0);
  });

  it("hora extra dentro do limite não é irregularidade", () => {
    const r = calcularCoberturaJornada({
      jornadaPrevistaMin: 518,
      atestadoMin: 0,
      totalMin: 578, // 1h extra
    });
    expect(r.excedeLimiteDiario).toBe(false);
  });
});

describe("calcularCoberturaJornada — jornada desconhecida", () => {
  it("não afirma cobertura nem excesso sem jornada da escala", () => {
    const r = calcularCoberturaJornada({
      jornadaPrevistaMin: 0,
      atestadoMin: 446,
      totalMin: 900,
    });
    expect(r.jornadaCoberta).toBe(false);
    expect(r.excedeLimiteDiario).toBe(false);
  });
});

describe("formatarMinutosCurto", () => {
  it("formata minutos abaixo de uma hora", () => {
    expect(formatarMinutosCurto(15)).toBe("15min");
  });
  it("formata horas com minutos em dois dígitos", () => {
    expect(formatarMinutosCurto(190)).toBe("3h10");
    expect(formatarMinutosCurto(125)).toBe("2h05");
  });
});
