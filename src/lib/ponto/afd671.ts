/**
 * AFD — Arquivo Fonte de Dados (Portaria MTP 671/2021, Anexo I — REP-P).
 *
 * Layout POSICIONAL de campos fixos, sem separadores, encerrando cada registro
 * com CRLF. Campos alfanuméricos são alinhados à esquerda e preenchidos com
 * espaços à direita; campos numéricos são alinhados à direita e preenchidos
 * com zeros à esquerda. Datas/horas dos registros 2..7 usam ISO 8601 com fuso
 * (AAAA-MM-DDThh:mm:ss-0300), conforme a Portaria.
 *
 * Registros gerados:
 *  1 — Cabeçalho do arquivo
 *  2 — Inclusão/alteração de empregador
 *  5 — Inclusão/alteração/exclusão de empregado
 *  7 — Marcação de ponto do REP-P (com hash SHA-256 do registro)
 *  9 — Trailer (totalizadores por tipo)
 *
 * O NSR (Número Sequencial de Registro) é atribuído de forma determinística
 * pela ordem cronológica das marcações — o AFD é reprodutível para a mesma
 * competência.
 */

export type AfdEmpregador = {
  /** Somente dígitos. 14 = CNPJ, 11 = CPF. */
  documento: string;
  razaoSocial: string;
  /** CEI/CAEPF/CNO, somente dígitos (opcional). */
  cei?: string | null;
  /** Local de prestação de serviço (endereço), registro tipo 2. */
  localPrestacao?: string | null;
};

export type AfdEmpregado = {
  cpf: string;
  nome: string;
  /** I = inclusão, A = alteração, E = exclusão. */
  operacao?: "I" | "A" | "E";
};

export type AfdMarcacao = {
  /** AAAA-MM-DD */
  data: string;
  /** HH:MM[:SS] */
  hora: string;
  cpf: string;
  /** Hash já persistido da marcação, quando existir. */
  hash?: string | null;
};

export type AfdParams = {
  empregador: AfdEmpregador;
  empregados: AfdEmpregado[];
  marcacoes: AfdMarcacao[];
  /** AAAA-MM-DD */
  dataInicial: string;
  /** AAAA-MM-DD */
  dataFinal: string;
  /** Identificador do REP-P (17 posições). */
  identificadorRep?: string;
  desenvolvedor?: { documento: string };
  geradoEm?: Date;
};

const CRLF = "\r\n";

const digitos = (v?: string | null) => (v || "").replace(/\D/g, "");

/** Campo alfanumérico: esquerda, espaços à direita, truncado no tamanho. */
export const alfa = (v: string | null | undefined, tam: number) =>
  (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().slice(0, tam).padEnd(tam, " ");

/** Campo numérico: direita, zeros à esquerda, truncado pelos dígitos finais. */
export const num = (v: string | number | null | undefined, tam: number) => {
  const d = typeof v === "number" ? String(Math.trunc(v)) : digitos(v);
  return d.slice(-tam).padStart(tam, "0");
};

/** Data/hora ISO 8601 com fuso, 24 posições — exigência da Portaria 671. */
export const iso8601 = (d: Date): string => {
  const p = (n: number, s = 2) => String(n).padStart(s, "0");
  const off = -d.getTimezoneOffset();
  const sinal = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` +
    `${sinal}${p(Math.floor(abs / 60))}${p(abs % 60)}`
  );
};

const isoDeDataHora = (data: string, hora: string, ref: Date): string => {
  const [a, m, dd] = data.split("-").map(Number);
  const [hh, mi, ss] = (hora || "00:00:00").split(":").map(Number);
  const d = new Date(a, (m || 1) - 1, dd || 1, hh || 0, mi || 0, ss || 0);
  // Preserva o fuso do momento da marcação (horário de verão etc.).
  void ref;
  return iso8601(d);
};

const ddmmaaaa = (isoDate: string) => {
  const [a, m, d] = (isoDate || "").split("-");
  return `${d || "01"}${m || "01"}${a || "0000"}`;
};

const tipoIdent = (doc: string) => (digitos(doc).length === 11 ? "2" : "1");

async function sha256Hex(texto: string): Promise<string> {
  const buf = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Monta o conteúdo textual do AFD no layout posicional da Portaria 671.
 * Retorna também os totalizadores para conferência do RH.
 */
export async function gerarAFD671(params: AfdParams): Promise<{
  conteudo: string;
  totais: { empregador: number; empregados: number; marcacoes: number; registros: number };
}> {
  const geradoEm = params.geradoEm ?? new Date();
  const emp = params.empregador;
  const docEmpregador = digitos(emp.documento);
  const docDesenvolvedor = digitos(params.desenvolvedor?.documento) || "0".repeat(14);
  const identificadorRep = alfa(params.identificadorRep || "YOUREYES REP-P", 17);

  const linhas: string[] = [];

  // ── Registro tipo 1 — Cabeçalho (NSR fixo 000000000) ───────────────────
  linhas.push(
    num(0, 9) +
      "1" +
      tipoIdent(docEmpregador) +
      num(docEmpregador, 14) +
      num(emp.cei, 12) +
      alfa(emp.razaoSocial, 150) +
      tipoIdent(docDesenvolvedor) +
      num(docDesenvolvedor, 14) +
      identificadorRep +
      ddmmaaaa(params.dataInicial) +
      ddmmaaaa(params.dataFinal) +
      alfa(iso8601(geradoEm), 24),
  );

  let nsr = 0;
  const proximoNsr = () => num(++nsr, 9);

  // ── Registro tipo 2 — Empregador ───────────────────────────────────────
  linhas.push(
    proximoNsr() +
      "2" +
      alfa(iso8601(geradoEm), 24) +
      tipoIdent(docEmpregador) +
      num(docEmpregador, 14) +
      num(emp.cei, 12) +
      alfa(emp.razaoSocial, 150) +
      alfa(emp.localPrestacao, 100),
  );
  const totalTipo2 = 1;

  // ── Registro tipo 5 — Empregados ───────────────────────────────────────
  const empregadosValidos = params.empregados.filter((e) => digitos(e.cpf).length === 11);
  for (const e of empregadosValidos) {
    linhas.push(
      proximoNsr() +
        "5" +
        alfa(iso8601(geradoEm), 24) +
        (e.operacao || "I") +
        num(e.cpf, 11) +
        alfa(e.nome, 52),
    );
  }

  // ── Registro tipo 7 — Marcações do REP-P (com hash SHA-256) ────────────
  const ordenadas = [...params.marcacoes].sort((a, b) =>
    `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`),
  );
  for (const m of ordenadas) {
    const nsrAtual = proximoNsr();
    const corpo = nsrAtual + "7" + alfa(isoDeDataHora(m.data, m.hora, geradoEm), 24) + num(m.cpf, 11);
    const hashBase = digitos(m.hash || "").length || (m.hash || "").length ? String(m.hash) : await sha256Hex(corpo);
    linhas.push(corpo + alfa(hashBase.replace(/[^0-9a-fA-F]/g, ""), 64));
  }

  // ── Registro tipo 9 — Trailer (NSR fixo 999999999) ─────────────────────
  linhas.push(
    "999999999" +
      "9" +
      num(totalTipo2, 9) + // tipo 2
      num(0, 9) + // tipo 3 (marcações REP-C)
      num(0, 9) + // tipo 4 (ajuste de relógio)
      num(empregadosValidos.length, 9) + // tipo 5
      num(0, 9) + // tipo 6 (eventos sensíveis)
      num(ordenadas.length, 9), // tipo 7
  );

  return {
    conteudo: linhas.join(CRLF) + CRLF,
    totais: {
      empregador: totalTipo2,
      empregados: empregadosValidos.length,
      marcacoes: ordenadas.length,
      registros: linhas.length,
    },
  };
}
