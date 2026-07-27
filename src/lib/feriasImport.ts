/**
 * Importação de saldos de férias — parser da planilha e gerador do modelo.
 *
 * A planilha de origem (folha) agrupa visualmente por colaborador: identificação
 * na primeira linha do grupo, períodos seguintes com essas células MESCLADAS
 * (vazias no arquivo). O parser precisa arrastar a identificação para as linhas
 * de baixo — senão metade dos períodos fica sem dono.
 *
 * O modelo que ESTE sistema gera é mais estrito: uma linha por período, sem
 * mescla, com CPF obrigatório (a origem casa por CPF, não por nome).
 */
import * as XLSX from "xlsx";

/** Colunas do modelo, na ordem em que saem no arquivo. */
export const COLUNAS_MODELO = [
  "CPF",
  "Nome",
  "Admissao",
  "Aquisitivo Inicio",
  "Aquisitivo Fim",
  "Faltas",
  "Dias Gozados",
] as const;

export interface LinhaFeriasImport {
  /** Índice da linha na planilha (1-based, como o Excel mostra). */
  linhaExcel: number;
  cpf: string;
  nome: string;
  admissao: string | null;        // ISO yyyy-mm-dd
  aquisitivoInicio: string | null;
  aquisitivoFim: string | null;
  faltas: number;
  diasGozados: number;
}

export interface ProblemaLinha {
  linhaExcel: number;
  campo: string;
  mensagem: string;
  gravidade: "erro" | "aviso";
}

export interface ResultadoParse {
  linhas: LinhaFeriasImport[];
  problemas: ProblemaLinha[];
}

// ── Normalizações ───────────────────────────────────────────────────────────

export function soDigitos(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

/** Converte célula de data (serial Excel, Date, ou texto BR/ISO) para ISO. */
export function toISODate(v: unknown): string | null {
  if (v == null || v === "") return null;

  // Serial numérico do Excel (dias desde 1899-12-30)
  if (typeof v === "number") {
    const d = XLSX.SSF ? XLSX.SSF.parse_date_code(v) : null;
    if (d && d.y) {
      return `${d.y.toString().padStart(4, "0")}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
    return null;
  }

  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }

  const s = String(v).trim();
  // dd/mm/yyyy ou dd-mm-yyyy
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const [, dd, mm, yy] = m;
    const ano = yy.length === 2 ? `20${yy}` : yy;
    return `${ano}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  // yyyy-mm-dd (com hora opcional)
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

/** Aceita "22,5", "22.5", "-" (vazio) → número. */
export function toNumero(v: unknown): number {
  if (v == null) return 0;
  const s = String(v).trim();
  if (s === "" || s === "-" || s === "–") return 0;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// ── Localização do cabeçalho ────────────────────────────────────────────────

const SINONIMOS: Record<string, keyof LinhaFeriasImport> = {
  cpf: "cpf",
  nome: "nome",
  empregado: "nome",
  colaborador: "nome",
  admissao: "admissao",
  "data admissao": "admissao",
  "aquisitivo inicio": "aquisitivoInicio",
  "inicio aquisitivo": "aquisitivoInicio",
  inicio: "aquisitivoInicio",
  "aquisitivo fim": "aquisitivoFim",
  "fim aquisitivo": "aquisitivoFim",
  fim: "aquisitivoFim",
  faltas: "faltas",
  "dias faltas": "faltas",
  "dias gozados": "diasGozados",
  gozados: "diasGozados",
  "dias goz": "diasGozados",
};

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Encontra a linha de cabeçalho e mapeia coluna→campo. A planilha de origem tem
 * o cabeçalho quebrado em duas linhas ("Data"/"admissão"); tentamos casar cada
 * linha candidata e, se necessário, concatenar com a de baixo.
 */
function localizarCabecalho(matriz: unknown[][]): {
  headerRow: number;
  mapa: Map<number, keyof LinhaFeriasImport>;
} | null {
  const limite = Math.min(matriz.length, 12);
  for (let i = 0; i < limite; i++) {
    const mapa = new Map<number, keyof LinhaFeriasImport>();
    for (let c = 0; c < matriz[i].length; c++) {
      // tenta a célula sozinha e concatenada com a de cima (cabeçalho em 2 linhas)
      const combinada = norm(`${matriz[i - 1]?.[c] ?? ""} ${matriz[i][c] ?? ""}`);
      const sozinha = norm(matriz[i][c]);
      const campo = SINONIMOS[sozinha] ?? SINONIMOS[combinada];
      if (campo && ![...mapa.values()].includes(campo)) mapa.set(c, campo);
    }
    // precisa ao menos de nome + um período para ser o cabeçalho
    if ([...mapa.values()].includes("nome") && [...mapa.values()].includes("aquisitivoInicio")) {
      return { headerRow: i, mapa };
    }
  }
  return null;
}

// ── Parse ───────────────────────────────────────────────────────────────────

export function parsePlanilhaFerias(buffer: ArrayBuffer): ResultadoParse {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });

  const cab = localizarCabecalho(matriz);
  if (!cab) {
    return {
      linhas: [],
      problemas: [
        {
          linhaExcel: 1,
          campo: "cabeçalho",
          mensagem:
            "Não encontrei o cabeçalho. Baixe o modelo e mantenha as colunas: " +
            COLUNAS_MODELO.join(", ") + ".",
          gravidade: "erro",
        },
      ],
    };
  }

  const linhas: LinhaFeriasImport[] = [];
  const problemas: ProblemaLinha[] = [];

  // Identificação corrente, arrastada por células mescladas.
  let cpfAtual = "";
  let nomeAtual = "";
  let admissaoAtual: string | null = null;

  const col = (row: unknown[], campo: keyof LinhaFeriasImport): unknown => {
    for (const [idx, c] of cab.mapa) if (c === campo) return row[idx];
    return null;
  };

  for (let i = cab.headerRow + 1; i < matriz.length; i++) {
    const row = matriz[i];
    if (!row || row.every(c => c == null || String(c).trim() === "")) continue;

    const linhaExcel = i + 1;

    const cpfLinha = soDigitos(col(row, "cpf"));
    const nomeLinha = String(col(row, "nome") ?? "").trim();
    const admissaoLinha = toISODate(col(row, "admissao"));

    // Célula preenchida troca o "corrente"; vazia herda (mescla).
    if (cpfLinha) cpfAtual = cpfLinha;
    if (nomeLinha) nomeAtual = nomeLinha;
    if (admissaoLinha) admissaoAtual = admissaoLinha;

    const aqIni = toISODate(col(row, "aquisitivoInicio"));
    const aqFim = toISODate(col(row, "aquisitivoFim"));

    // Linha sem período não é um registro — provavelmente separador.
    if (!aqIni && !aqFim) continue;

    const linha: LinhaFeriasImport = {
      linhaExcel,
      cpf: cpfAtual,
      nome: nomeAtual,
      admissao: admissaoAtual,
      aquisitivoInicio: aqIni,
      aquisitivoFim: aqFim,
      faltas: Math.round(toNumero(col(row, "faltas"))),
      diasGozados: toNumero(col(row, "diasGozados")),
    };
    linhas.push(linha);

    // Validações por linha
    if (!linha.cpf) {
      problemas.push({ linhaExcel, campo: "CPF", mensagem: "CPF ausente — não dá para casar o colaborador.", gravidade: "erro" });
    } else if (linha.cpf.length !== 11) {
      problemas.push({ linhaExcel, campo: "CPF", mensagem: `CPF com ${linha.cpf.length} dígitos (esperado 11).`, gravidade: "erro" });
    }
    if (!linha.nome) {
      problemas.push({ linhaExcel, campo: "Nome", mensagem: "Nome ausente.", gravidade: "aviso" });
    }
    if (!linha.admissao) {
      problemas.push({ linhaExcel, campo: "Admissao", mensagem: "Data de admissão ausente ou em formato não reconhecido.", gravidade: "erro" });
    }
    if (!aqIni || !aqFim) {
      problemas.push({ linhaExcel, campo: "Aquisitivo", mensagem: "Período aquisitivo incompleto (início e fim são obrigatórios).", gravidade: "erro" });
    } else if (aqFim < aqIni) {
      problemas.push({ linhaExcel, campo: "Aquisitivo", mensagem: "Fim do período anterior ao início.", gravidade: "erro" });
    }
    if (linha.diasGozados < 0 || linha.diasGozados > 30) {
      problemas.push({ linhaExcel, campo: "Dias Gozados", mensagem: `Dias gozados fora de 0–30 (${linha.diasGozados}).`, gravidade: "aviso" });
    }
  }

  // Períodos duplicados dentro da própria planilha (mesmo CPF + início).
  const vistos = new Map<string, number>();
  for (const l of linhas) {
    if (!l.cpf || !l.aquisitivoInicio) continue;
    const chave = `${l.cpf}|${l.aquisitivoInicio}`;
    if (vistos.has(chave)) {
      problemas.push({
        linhaExcel: l.linhaExcel,
        campo: "Aquisitivo Inicio",
        mensagem: `Período repetido na planilha (já aparece na linha ${vistos.get(chave)}).`,
        gravidade: "erro",
      });
    } else {
      vistos.set(chave, l.linhaExcel);
    }
  }

  return { linhas, problemas };
}

// ── Modelo para download ────────────────────────────────────────────────────

export function gerarModeloFerias(): Blob {
  const exemplo: (string)[][] = [
    [...COLUNAS_MODELO],
    ["123.456.789-09", "MARIA DA SILVA EXEMPLO", "10/07/2023", "10/07/2024", "09/07/2025", "0", "0"],
    ["987.654.321-00", "JOAO SOUZA EXEMPLO", "18/02/2026", "18/02/2026", "17/02/2027", "3", "10"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(exemplo);
  ws["!cols"] = [{ wch: 16 }, { wch: 30 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 8 }, { wch: 12 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Saldos de Ferias");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
