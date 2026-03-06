import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestionarioResponder } from "@/components/avaliacoes/psicossocial/QuestionarioResponder";
import { COPSOQ_DIMENSOES } from "@/data/instrumentos/copsoq";
import { HSE_DIMENSOES } from "@/data/instrumentos/hse";

describe("QuestionarioResponder", () => {
  const defaultProps = {
    instrumento: "copsoq" as const,
    respostas: {} as Record<string, number>,
    onRespostaChange: vi.fn(),
    onConcluir: vi.fn(),
    nomeCampanha: "Campanha Teste",
  };

  it("renderiza o nome da campanha", () => {
    render(<QuestionarioResponder {...defaultProps} />);
    expect(screen.getByText("Campanha Teste")).toBeInTheDocument();
  });

  it("mostra contagem de questões para COPSOQ", () => {
    render(<QuestionarioResponder {...defaultProps} />);
    const total = COPSOQ_DIMENSOES.reduce((acc, d) => acc + d.perguntas.length, 0);
    expect(screen.getByText(`0 de ${total} questões respondidas`)).toBeInTheDocument();
  });

  it("mostra contagem de questões para HSE", () => {
    render(<QuestionarioResponder {...defaultProps} instrumento="hse" />);
    const total = HSE_DIMENSOES.reduce((acc, d) => acc + d.perguntas.length, 0);
    expect(screen.getByText(`0 de ${total} questões respondidas`)).toBeInTheDocument();
  });

  it("renderiza a primeira dimensão COPSOQ", () => {
    render(<QuestionarioResponder {...defaultProps} />);
    expect(screen.getByText(COPSOQ_DIMENSOES[0].nome)).toBeInTheDocument();
  });

  it("renderiza perguntas da dimensão atual", () => {
    render(<QuestionarioResponder {...defaultProps} />);
    const primeiraPergunta = COPSOQ_DIMENSOES[0].perguntas[0];
    expect(screen.getByText(primeiraPergunta.texto)).toBeInTheDocument();
  });

  it("mostra pills de navegação por dimensão", () => {
    render(<QuestionarioResponder {...defaultProps} />);
    // Deve ter botões numerados para cada dimensão
    const pills = screen.getAllByRole("button").filter(b => /^\d+$/.test(b.textContent?.trim() || ""));
    expect(pills.length).toBe(COPSOQ_DIMENSOES.length);
  });

  it("chama onRespostaChange ao clicar numa opção", () => {
    const onRespostaChange = vi.fn();
    render(<QuestionarioResponder {...defaultProps} onRespostaChange={onRespostaChange} />);

    // Clicar em "Nunca" (primeiro botão de escala)
    const nuncaButtons = screen.getAllByText("Nunca");
    fireEvent.click(nuncaButtons[0]);

    expect(onRespostaChange).toHaveBeenCalledWith(
      COPSOQ_DIMENSOES[0].perguntas[0].id,
      0
    );
  });

  it("botão Próxima desabilitado quando respostas incompletas", () => {
    render(<QuestionarioResponder {...defaultProps} />);
    const proximaBtn = screen.getByText("Próxima");
    expect(proximaBtn).toBeDisabled();
  });

  it("botão Próxima habilitado quando todas questões da dimensão respondidas", () => {
    const respostas: Record<string, number> = {};
    COPSOQ_DIMENSOES[0].perguntas.forEach(p => {
      respostas[p.id] = 2;
    });

    render(<QuestionarioResponder {...defaultProps} respostas={respostas} />);
    const proximaBtn = screen.getByText("Próxima");
    expect(proximaBtn).not.toBeDisabled();
  });

  it("botão Anterior desabilitado na primeira dimensão", () => {
    render(<QuestionarioResponder {...defaultProps} />);
    const anteriorBtn = screen.getByText("Anterior");
    expect(anteriorBtn).toBeDisabled();
  });

  it("Enviar Respostas aparece na última dimensão e desabilitado sem todas respostas", () => {
    // Responder todas as dimensões exceto a última
    const respostas: Record<string, number> = {};
    COPSOQ_DIMENSOES.forEach((dim, i) => {
      if (i < COPSOQ_DIMENSOES.length - 1) {
        dim.perguntas.forEach(p => { respostas[p.id] = 2; });
      }
    });

    // Navegar para a última dimensão clicando na pill
    render(<QuestionarioResponder {...defaultProps} respostas={respostas} />);

    const lastPill = screen.getAllByRole("button").filter(b => 
      b.textContent?.trim() === String(COPSOQ_DIMENSOES.length)
    )[0];
    fireEvent.click(lastPill);

    const enviarBtn = screen.getByText("Enviar Respostas");
    expect(enviarBtn).toBeDisabled();
  });

  it("Enviar Respostas habilitado e chama onConcluir quando todas respondidas", () => {
    const respostas: Record<string, number> = {};
    COPSOQ_DIMENSOES.forEach(dim => {
      dim.perguntas.forEach(p => { respostas[p.id] = 2; });
    });

    const onConcluir = vi.fn();
    render(<QuestionarioResponder {...defaultProps} respostas={respostas} onConcluir={onConcluir} />);

    // Navegar para última dimensão
    const lastPill = screen.getAllByRole("button").filter(b =>
      b.textContent?.trim() === String(COPSOQ_DIMENSOES.length)
    )[0];
    fireEvent.click(lastPill);

    const enviarBtn = screen.getByText("Enviar Respostas");
    expect(enviarBtn).not.toBeDisabled();
    fireEvent.click(enviarBtn);
    expect(onConcluir).toHaveBeenCalled();
  });

  it("mostra aviso de anonimato", () => {
    render(<QuestionarioResponder {...defaultProps} />);
    expect(screen.getByText(/respostas são anônimas/i)).toBeInTheDocument();
  });

  it("mostra indicador de fator protetor/risco", () => {
    render(<QuestionarioResponder {...defaultProps} />);
    const tipo = COPSOQ_DIMENSOES[0].tipo;
    const label = tipo === "risco" ? "Fator de Risco" : "Fator Protetor";
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("atualiza progresso visual com respostas parciais", () => {
    const respostas: Record<string, number> = {};
    // Responder 2 de N perguntas da primeira dimensão
    respostas[COPSOQ_DIMENSOES[0].perguntas[0].id] = 1;
    respostas[COPSOQ_DIMENSOES[0].perguntas[1].id] = 3;

    const total = COPSOQ_DIMENSOES.reduce((acc, d) => acc + d.perguntas.length, 0);
    render(<QuestionarioResponder {...defaultProps} respostas={respostas} />);
    expect(screen.getByText(`2 de ${total} questões respondidas`)).toBeInTheDocument();
  });
});
