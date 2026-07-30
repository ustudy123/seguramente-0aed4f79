import { describe, expect, it } from "vitest";
import { validarElegibilidadeGHE } from "@/lib/psicossocial-ghe";

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
        vinculos: 0,
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