import { describe, expect, it } from "vitest";
import { validarElegibilidadeGHE } from "@/lib/psicossocial-ghe";
import { calcularContagemParticipacaoCampanha } from "@/hooks/usePsicossocial";

describe("validarElegibilidadeGHE", () => {
  it("permite remover todos os vínculos de um GHE existente antes da exclusão", () => {
    expect(
      validarElegibilidadeGHE({
        isEdicao: true,
        vinculos: 0,
        elegiveis: 0,
        baseRespondentes: 0,
        ausenciasJustificadas: 0,
      }),
    ).toBeNull();
  });

  it("mantém o mínimo de elegíveis para novos GHEs", () => {
    expect(
      validarElegibilidadeGHE({
        isEdicao: false,
        vinculos: 1,
        elegiveis: 0,
        baseRespondentes: 0,
        ausenciasJustificadas: 0,
      }),
    ).toContain("mínimo permitido é 5");
  });

  it("mantém a proteção quando um GHE possui vínculos insuficientes", () => {
    expect(
      validarElegibilidadeGHE({
        isEdicao: true,
        vinculos: 1,
        elegiveis: 4,
        baseRespondentes: 4,
        ausenciasJustificadas: 0,
      }),
    ).toContain("apenas 4");
  });
});
describe("empresas abaixo do mínimo", () => {
  it("libera a criação de GHE quando a empresa tem menos de 5 elegíveis", () => {
    expect(
      validarElegibilidadeGHE({
        isEdicao: false,
        vinculos: 2,
        elegiveis: 3,
        baseRespondentes: 3,
        ausenciasJustificadas: 0,
        totalElegiveisEmpresa: 3,
      }),
    ).toBeNull();
  });

  it("mantém a regra quando a empresa tem 5 ou mais elegíveis", () => {
    expect(
      validarElegibilidadeGHE({
        isEdicao: false,
        vinculos: 2,
        elegiveis: 3,
        baseRespondentes: 3,
        ausenciasJustificadas: 0,
        totalElegiveisEmpresa: 12,
      }),
    ).toContain("mínimo permitido é 5");
  });
});

describe("contagem de entrevistas após vincular GHE", () => {
  it("preserva entrevistas guiadas concluídas como respostas", () => {
    expect(calcularContagemParticipacaoCampanha({
      temGHE: true,
      isEntrevistaGuiada: true,
      elegiveisGHE: 2,
      totalConvites: 0,
      totalParticipacoes: 0,
      totalRespostas: 0,
      totalEntrevistas: 2,
      colaboradoresAtivos: 2,
      concluidosConvites: 0,
      respondidosParticipacoes: 0,
      entrevistasConcluidas: 1,
    })).toEqual({ concluidos: 1, total: 2 });
  });

  it("não altera a contagem de questionários vinculados a GHE", () => {
    expect(calcularContagemParticipacaoCampanha({
      temGHE: true,
      isEntrevistaGuiada: false,
      elegiveisGHE: 8,
      totalConvites: 0,
      totalParticipacoes: 0,
      totalRespostas: 5,
      totalEntrevistas: 0,
      colaboradoresAtivos: 8,
      concluidosConvites: 0,
      respondidosParticipacoes: 0,
      entrevistasConcluidas: 0,
    })).toEqual({ concluidos: 5, total: 8 });
  });
});
