import { describe, it, expect } from "vitest";
import jsPDF from "jspdf";
import { desenharCartaoPonto } from "@/lib/ponto/cartaoPonto";

const dia = (d: string, extra: Record<string, unknown> = {}) => ({
  dia: d, trabalhado_min: 480, jornada_min: 480, saldo_min: 0,
  protegido: false, equalizacao: false, excedente_retido_min: 0,
  marcacoes: [{ hora: "08:00", origem: "O" as const }, { hora: "17:00", origem: "O" as const }],
  ...extra,
});

describe("cartão de ponto — intervalo pré-assinalado", () => {
  it("desenha sem erro com e sem declaração", () => {
    const doc = new jsPDF();
    desenharCartaoPonto(doc, {
      incluirBanco: false,
      empregador: { razaoSocial: "Empresa Staging LTDA" },
      empregado: { nome: "Fulano de Teste", cpf: "900.000.001-53", admissao: null },
      competencia: "2026-08",
      dias: [
        dia("2026-08-03"),
        dia("2026-08-04", { intervalo_origem: "pre_assinalado", intervalo_pre_assinalado_min: 60 }),
        dia("2026-08-05", { intervalo_origem: "marcado" }),
      ],
    } as never);
    expect(doc.output("datauristring").length).toBeGreaterThan(1000);
  });
});
