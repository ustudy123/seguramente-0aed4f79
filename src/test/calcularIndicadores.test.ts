import { describe, it, expect } from "vitest";
import { calcularIPSInstrumento, getDimensoesByInstrumento, COPSOQ_DIMENSOES, HSE_DIMENSOES } from "@/data/instrumentos";
import { calcularIPSClassificacao } from "@/types/psicossocial";
import { calcularIndicadores } from "@/hooks/usePsicossocial";

// ============================================================
// Testes unitários: cálculo IPS (Índice Psicossocial Seguramente)
// ============================================================

describe("calcularIPSClassificacao", () => {
  it("classifica >= 80 como saudavel", () => {
    expect(calcularIPSClassificacao(80)).toBe("saudavel");
    expect(calcularIPSClassificacao(100)).toBe("saudavel");
  });

  it("classifica 65-79 como estavel", () => {
    expect(calcularIPSClassificacao(65)).toBe("estavel");
    expect(calcularIPSClassificacao(79)).toBe("estavel");
  });

  it("classifica 50-64 como atencao", () => {
    expect(calcularIPSClassificacao(50)).toBe("atencao");
    expect(calcularIPSClassificacao(64)).toBe("atencao");
  });

  it("classifica 35-49 como risco", () => {
    expect(calcularIPSClassificacao(35)).toBe("risco");
    expect(calcularIPSClassificacao(49)).toBe("risco");
  });

  it("classifica < 35 como critico", () => {
    expect(calcularIPSClassificacao(0)).toBe("critico");
    expect(calcularIPSClassificacao(34)).toBe("critico");
  });
});

describe("getDimensoesByInstrumento", () => {
  it("retorna dimensões COPSOQ", () => {
    const dims = getDimensoesByInstrumento("copsoq");
    expect(dims).toBe(COPSOQ_DIMENSOES);
    expect(dims.length).toBeGreaterThan(0);
  });

  it("retorna dimensões HSE", () => {
    const dims = getDimensoesByInstrumento("hse");
    expect(dims).toBe(HSE_DIMENSOES);
    expect(dims.length).toBeGreaterThan(0);
  });

  it("retorna ambos sem duplicatas", () => {
    const dims = getDimensoesByInstrumento("ambos");
    expect(dims.length).toBe(COPSOQ_DIMENSOES.length + HSE_DIMENSOES.length);
  });
});

describe("calcularIPSInstrumento", () => {
  it("retorna IPS 100 quando todas respostas são ótimas", () => {
    const dimensoes = getDimensoesByInstrumento("copsoq");
    const respostas: Record<string, number> = {};

    // Para perguntas de risco: 0 = nunca acontece = melhor
    // Para perguntas protetoras (invertida): 4 = sempre acontece = melhor
    for (const dim of dimensoes) {
      for (const p of dim.perguntas) {
        respostas[p.id] = p.invertida ? 4 : 0;
      }
    }

    const { ips } = calcularIPSInstrumento(respostas, dimensoes);
    expect(ips).toBe(100);
  });

  it("retorna IPS 0 quando todas respostas são péssimas", () => {
    const dimensoes = getDimensoesByInstrumento("copsoq");
    const respostas: Record<string, number> = {};

    for (const dim of dimensoes) {
      for (const p of dim.perguntas) {
        respostas[p.id] = p.invertida ? 0 : 4;
      }
    }

    const { ips } = calcularIPSInstrumento(respostas, dimensoes);
    expect(ips).toBe(0);
  });

  it("retorna IPS ~50 para respostas neutras (valor 2)", () => {
    const dimensoes = getDimensoesByInstrumento("copsoq");
    const respostas: Record<string, number> = {};

    for (const dim of dimensoes) {
      for (const p of dim.perguntas) {
        respostas[p.id] = 2;
      }
    }

    const { ips } = calcularIPSInstrumento(respostas, dimensoes);
    expect(ips).toBe(50);
  });

  it("retorna porDimensao com score e nivel para cada dimensão", () => {
    const dimensoes = getDimensoesByInstrumento("copsoq");
    const respostas: Record<string, number> = {};

    for (const dim of dimensoes) {
      for (const p of dim.perguntas) {
        respostas[p.id] = 2;
      }
    }

    const { porDimensao } = calcularIPSInstrumento(respostas, dimensoes);

    for (const dim of dimensoes) {
      expect(porDimensao[dim.id]).toBeDefined();
      expect(porDimensao[dim.id].score).toBeGreaterThanOrEqual(0);
      expect(porDimensao[dim.id].score).toBeLessThanOrEqual(100);
      expect(["otimo", "bom", "atencao", "critico"]).toContain(porDimensao[dim.id].nivel);
      expect(["risco", "protetor"]).toContain(porDimensao[dim.id].tipo);
    }
  });

  it("funciona com HSE também", () => {
    const dimensoes = getDimensoesByInstrumento("hse");
    const respostas: Record<string, number> = {};

    for (const dim of dimensoes) {
      for (const p of dim.perguntas) {
        respostas[p.id] = p.invertida ? 4 : 0;
      }
    }

    const { ips } = calcularIPSInstrumento(respostas, dimensoes);
    expect(ips).toBe(100);
  });

  it("usa default neutro (2) para respostas faltantes", () => {
    const dimensoes = getDimensoesByInstrumento("copsoq");
    const respostas: Record<string, number> = {}; // Vazio

    const { ips } = calcularIPSInstrumento(respostas, dimensoes);
    expect(ips).toBe(50); // Default neutro
  });
});

describe("calcularIndicadores (wrapper)", () => {
  it("retorna IPS, classificação, detalhes e radar", () => {
    const dimensoes = getDimensoesByInstrumento("copsoq");
    const respostas: Record<string, number> = {};
    for (const dim of dimensoes) {
      for (const p of dim.perguntas) {
        respostas[p.id] = 2;
      }
    }

    const result = calcularIndicadores(respostas, "copsoq");
    
    expect(result.IPS).toBe(50);
    expect(result.IPS_classificacao).toBe("atencao");
    expect(result.detalhes.length).toBe(dimensoes.length);
    expect(result.radar.length).toBe(dimensoes.length);
    
    for (const d of result.detalhes) {
      expect(d.bloco).toBeTruthy();
      expect(["baixo", "moderado", "alto", "critico"]).toContain(d.nivel);
    }

    for (const r of result.radar) {
      expect(r.subject).toBeTruthy();
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.fullMark).toBe(100);
    }
  });

  it("funciona com instrumento HSE", () => {
    const dimensoes = getDimensoesByInstrumento("hse");
    const respostas: Record<string, number> = {};
    for (const dim of dimensoes) {
      for (const p of dim.perguntas) {
        respostas[p.id] = p.invertida ? 4 : 0;
      }
    }

    const result = calcularIndicadores(respostas, "hse");
    expect(result.IPS).toBe(100);
    expect(result.IPS_classificacao).toBe("saudavel");
  });
});
