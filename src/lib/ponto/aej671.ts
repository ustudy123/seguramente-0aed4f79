/**
 * AEJ — Arquivo Eletrônico de Jornada (Portaria MTP 671/2021).
 *
 * Layout POSICIONAL de campos fixos, sem separadores, um registro por linha
 * terminada em CRLF. Alfanuméricos alinhados à esquerda (espaços à direita),
 * numéricos alinhados à direita (zeros à esquerda). Data/hora dos registros
 * de movimento em ISO 8601 com fuso (AAAA-MM-DDThh:mm:ss-0300).
 *
 * Registros:
 *  1 — Cabeçalho (empregador, período, geração)
 *  2 — Inclusão/alteração de empregador
 *  3 — Empregado (CPF + nome)
 *  4 — Horário contratual (código, entrada, intervalos, saída, carga diária)
 *  5 — Vínculo empregado × horário contratual (vigência)
 *  6 — Marcações do dia (com origem: O=original do REP, A=ajuste aprovado)
 *  7 — Ausências/ocorrências justificadas do dia (falta, atestado, abono)
 *  9 — Trailer com totalizadores por tipo
 *
 * O AEJ é a jornada APURADA: somente marcações originais do REP e ajustes
 * já APROVADOS pelo RH entram no arquivo — solicitações pendentes ou
 * rejeitadas ficam de fora, preservando a rastreabilidade legal.
 */

import { alfa, num, iso8601 } from "./afd671";

export type AejEmpregador = {
  documento: string;
  razaoSocial: string;
  cei?: string | null;
  localPrestacao?: string | null;
};

export type AejEmpregado = { cpf: string; nome: string };

export type AejHorario = {
  /** Código interno do horário contratual (escala). */
  codigo: string;
  descricao: string;
  /** HH:MM */
  entrada?: string | null;
  /** HH:MM */
  saidaIntervalo?: string | null;
  /** HH:MM */
  retornoIntervalo?: string | null;
  /** HH:MM */
  saida?: string | null;
  /** Carga diária contratada em minutos. */
  cargaDiariaMinutos?: number | null;
};

export type AejVinculo = {
  cpf: string;
  codigoHorario: string;
  /** AAAA-MM-DD */
  dataInicio: string;
  /** AAAA-MM-DD (vazio = vigente) */
  dataFim?: string | null;
};

export type AejMarcacao = {
  cpf: string;
  /** AAAA-MM-DD */
  data: string;
  /** HH:MM[:SS] */
  hora: string;
  /** O = original do REP, A = ajuste aprovado pelo RH. */
  origem: "O" | "A";
  /** Motivo/justificativa do ajuste (obrigatório quando origem = A). */
  justificativa?: string | null;
};

export type AejOcorrencia = {
  cpf: string;
  /** AAAA-MM-DD */
  data: string;
  /** Código curto da ocorrência (FALTA, ATESTADO, ABONO, FERIAS...). */
  codigo: string;
  /** Minutos abonados/justificados no dia. */
  minutos?: number | null;
  descricao?: string | null;
};

export type AejParams = {
  empregador: AejEmpregador;
  empregados: AejEmpregado[];
  horarios: AejHorario[];
  vinculos: AejVinculo[];
  marcacoes: AejMarcacao[];
  ocorrencias?: AejOcorrencia[];
  /** AAAA-MM-DD */
  dataInicial: string;
  /** AAAA-MM-DD */
  dataFinal: string;
  geradoEm?: Date;
};

const CRLF = "\r\n";
const digitos = (v?: string | null) => (v || "").replace(/\D/g, "");
const tipoIdent = (doc: string) => (digitos(doc).length === 11 ? "2" : "1");
const ddmmaaaa = (isoDate?: string | null) => {
  const [a, m, d] = (isoDate || "").split("-");
  return isoDate ? `${d || "01"}${m || "01"}${a || "0000"}` : "        ";
};
/** HHMM posicional; vazio vira espaços para não inventar horário contratual. */
const hhmm = (v?: string | null) => {
  const d = digitos(v).slice(0, 4);
  return d.length === 4 ? d : "    ";
};
const isoDeDataHora = (data: string, hora: string) => {
  const [a, m, dd] = data.split("-").map(Number);
  const [hh, mi, ss] = (hora || "00:00:00").split(":").map(Number);
  return iso8601(new Date(a, (m || 1) - 1, dd || 1, hh || 0, mi || 0, ss || 0));
};

export function gerarAEJ671(params: AejParams): {
  conteudo: string;
  totais: {
    empregados: number;
    horarios: number;
    vinculos: number;
    marcacoes: number;
    ajustes: number;
    ocorrencias: number;
    registros: number;
  };
} {
  const geradoEm = params.geradoEm ?? new Date();
  const emp = params.empregador;
  const doc = digitos(emp.documento);
  const carimbo = alfa(iso8601(geradoEm), 24);

  const linhas: string[] = [];

  // ── Tipo 1 — Cabeçalho ─────────────────────────────────────────────────
  linhas.push(
    num(0, 9) +
      "1" +
      tipoIdent(doc) +
      num(doc, 14) +
      num(emp.cei, 12) +
      alfa(emp.razaoSocial, 150) +
      ddmmaaaa(params.dataInicial) +
      ddmmaaaa(params.dataFinal) +
      carimbo,
  );

  let nsr = 0;
  const proximo = () => num(++nsr, 9);

  // ── Tipo 2 — Empregador ────────────────────────────────────────────────
  linhas.push(
    proximo() +
      "2" +
      carimbo +
      tipoIdent(doc) +
      num(doc, 14) +
      num(emp.cei, 12) +
      alfa(emp.razaoSocial, 150) +
      alfa(emp.localPrestacao, 100),
  );

  // ── Tipo 3 — Empregados ────────────────────────────────────────────────
  const empregados = params.empregados.filter((e) => digitos(e.cpf).length === 11);
  for (const e of empregados) {
    linhas.push(proximo() + "3" + carimbo + num(e.cpf, 11) + alfa(e.nome, 52));
  }

  // ── Tipo 4 — Horários contratuais ──────────────────────────────────────
  for (const h of params.horarios) {
    linhas.push(
      proximo() +
        "4" +
        carimbo +
        alfa(h.codigo, 12) +
        alfa(h.descricao, 60) +
        hhmm(h.entrada) +
        hhmm(h.saidaIntervalo) +
        hhmm(h.retornoIntervalo) +
        hhmm(h.saida) +
        num(Math.max(0, Math.round(h.cargaDiariaMinutos || 0)), 5),
    );
  }

  // ── Tipo 5 — Vínculo empregado × horário ───────────────────────────────
  for (const v of params.vinculos) {
    linhas.push(
      proximo() +
        "5" +
        carimbo +
        num(v.cpf, 11) +
        alfa(v.codigoHorario, 12) +
        ddmmaaaa(v.dataInicio) +
        ddmmaaaa(v.dataFim || null),
    );
  }

  // ── Tipo 6 — Marcações apuradas (original + ajuste aprovado) ───────────
  const marcacoes = [...params.marcacoes].sort((a, b) =>
    `${a.cpf}${a.data}${a.hora}`.localeCompare(`${b.cpf}${b.data}${b.hora}`),
  );
  for (const m of marcacoes) {
    linhas.push(
      proximo() +
        "6" +
        alfa(isoDeDataHora(m.data, m.hora), 24) +
        num(m.cpf, 11) +
        m.origem +
        alfa(m.origem === "A" ? m.justificativa || "AJUSTE APROVADO PELO RH" : "", 100),
    );
  }

  // ── Tipo 7 — Ocorrências/ausências justificadas ────────────────────────
  const ocorrencias = params.ocorrencias || [];
  for (const o of ocorrencias) {
    linhas.push(
      proximo() +
        "7" +
        carimbo +
        num(o.cpf, 11) +
        ddmmaaaa(o.data) +
        alfa(o.codigo, 12) +
        num(Math.max(0, Math.round(o.minutos || 0)), 5) +
        alfa(o.descricao, 100),
    );
  }

  // ── Tipo 9 — Trailer ───────────────────────────────────────────────────
  linhas.push(
    "999999999" +
      "9" +
      num(1, 9) + // tipo 2
      num(empregados.length, 9) + // tipo 3
      num(params.horarios.length, 9) + // tipo 4
      num(params.vinculos.length, 9) + // tipo 5
      num(marcacoes.length, 9) + // tipo 6
      num(ocorrencias.length, 9), // tipo 7
  );

  return {
    conteudo: linhas.join(CRLF) + CRLF,
    totais: {
      empregados: empregados.length,
      horarios: params.horarios.length,
      vinculos: params.vinculos.length,
      marcacoes: marcacoes.length,
      ajustes: marcacoes.filter((m) => m.origem === "A").length,
      ocorrencias: ocorrencias.length,
      registros: linhas.length,
    },
  };
}
