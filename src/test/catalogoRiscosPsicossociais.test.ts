import { describe, it, expect } from "vitest";
import {
  CATALOGO_RISCOS_PSICOSSOCIAIS,
  resolverFatorPorSubject,
} from "@/data/catalogoRiscosPsicossociais";
import { SIPRO_DIMENSOES } from "@/data/instrumentos/sipro";
import { COPSOQ2BR_DIMENSOES } from "@/data/instrumentos/copsoq2br";
import { COPSOQ_DIMENSOES } from "@/data/instrumentos/copsoq";
import { HSE_DIMENSOES } from "@/data/instrumentos/hse";
import { PROART_DIMENSOES } from "@/data/instrumentos/proart";

/** Mapeamentos que NÃO podem regredir (antes caíam no fator errado). */
const ESPERADOS: Record<string, string> = {
  Burnout: "excesso-demandas",
  "Burnout / Esgotamento": "excesso-demandas",
  "Sinais Precoces": "excesso-demandas",
  "Sinais Precoces de Saúde": "excesso-demandas",
  "Recuperação e Equilíbrio": "excesso-demandas",
  "Equilíbrio Trabalho-Vida": "excesso-demandas",
  "Equilíbrio Trabalho–Vida": "excesso-demandas",
  "Ameaças e Violência": "eventos-violentos",
  "Assédio e Comportamentos Ofensivos": "assedio",
  "Justiça Organizacional": "baixa-justica",
  "Relacionamentos e Suporte": "mas-relacoes",
  "Suporte da Liderança": "falta-suporte",
  "Suporte dos Colegas": "falta-suporte",
  "Clareza de Papéis": "baixa-clareza-papel",
  "Conflito de Papéis": "baixa-clareza-papel",
  Previsibilidade: "ma-gestao-mudancas",
  "Demandas Quantitativas e Ritmo": "excesso-demandas",
  "Reconhecimento e Justiça": "baixas-recompensas",
  "Reconhecimento e Recompensas": "baixas-recompensas",
  "Satisfação no Trabalho": "baixas-recompensas",
  "Autonomia e Controle": "baixo-controle",
  "Influência e Desenvolvimento": "baixo-controle",
  "Sentido do Trabalho": "baixa-demanda",
};

const TODAS_DIMENSOES = [
  ...SIPRO_DIMENSOES,
  ...COPSOQ2BR_DIMENSOES,
  ...COPSOQ_DIMENSOES,
  ...HSE_DIMENSOES,
  ...PROART_DIMENSOES,
];

describe("catálogo de riscos psicossociais", () => {
  it("mantém os 13 fatores padrão NR-01/ISO 45003", () => {
    expect(CATALOGO_RISCOS_PSICOSSOCIAIS).toHaveLength(13);
  });

  it("resolve dimensões críticas para o fator correto", () => {
    for (const [subject, esperado] of Object.entries(ESPERADOS)) {
      expect(
        resolverFatorPorSubject(subject)?.id,
        `subject "${subject}"`
      ).toBe(esperado);
    }
  });

  it("não confunde desfechos de esgotamento com violência", () => {
    expect(resolverFatorPorSubject("Burnout")?.id).not.toBe("eventos-violentos");
    expect(resolverFatorPorSubject("Recuperação e Equilíbrio")?.id).not.toBe(
      "trabalho-remoto-isolado"
    );
  });

  it("não resolve fatores por fragmentos genéricos", () => {
    expect(resolverFatorPorSubject("Qualidade das")).toBeNull();
    expect(resolverFatorPorSubject("Suporte da")).toBeNull();
    expect(resolverFatorPorSubject("")).toBeNull();
  });

  it("resolve nomes dos próprios fatores do catálogo", () => {
    for (const f of CATALOGO_RISCOS_PSICOSSOCIAIS) {
      expect(resolverFatorPorSubject(f.nome)?.id, f.nome).toBe(f.id);
    }
  });

  it("toda dimensão de instrumento resolve para algum fator", () => {
    const semMatch = TODAS_DIMENSOES.filter(
      (d) => !resolverFatorPorSubject(d.nome)
    ).map((d) => d.nome);
    expect(semMatch).toEqual([]);
  });
});
