/**
 * Relatório PDF — Plano de Ação PGR Psicossocial.
 *
 * Estrutura conforme especificação:
 *   1. Identificação da Avaliação
 *   2. Síntese Executiva (contagem por nível de GRO e prazos)
 *   3. Plano de Ação 5W2H — uma tabela por GHE
 *   4. Matriz 4.3 — Nível de GRO (probabilidade x severidade)
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  NIVEL15_TOKENS,
  NIVEL15_ORDEM,
  type NivelGRO15,
} from "@/lib/groPsicossocial15";
import { PRAZO_POR_NIVEL, NIVEIS_SINTESE, linhaSintese } from "@/lib/planoAcaoPrazos";
import type { AcaoPlanoPsicossocial } from "@/hooks/usePsicossocialPlanoAcao";

export interface CabecalhoRelatorio {
  campanha: string;
  instrumento: string;
  periodo: string;
  totalRespondentes: number;
  razaoSocial: string;
  cnpj: string;
  ipsGlobal: number | null;
}

export interface GrupoPlano {
  gheId: string | null;
  gheNome: string;
  /** Setores vinculados ao GHE no cadastro. */
  setores: string[];
  /** Cargos vinculados ao GHE no cadastro. */
  cargos: string[];
  acoes: AcaoPlanoPsicossocial[];
}

/** Contagem de fatores por nível, para a síntese executiva. */
export type ContagemNiveis = Record<NivelGRO15, number>;

const COR_NIVEL: Record<NivelGRO15, [number, number, number]> = {
  critico: [220, 38, 38],
  alto: [234, 88, 12],
  medio: [202, 138, 4],
  baixo: [37, 99, 235],
  trivial: [22, 163, 74],
};

const fmtData = (iso?: string | null) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR") : "—";

export function gerarPdfPlanoAcao(
  cabecalho: CabecalhoRelatorio,
  grupos: GrupoPlano[],
  contagem: ContagemNiveis,
): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const larguraUtil = doc.internal.pageSize.getWidth() - 28;

  // ── Título ────────────────────────────────────────────────────────────────
  doc.setFillColor(88, 28, 135);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("PLANO DE AÇÃO — RISCOS PSICOSSOCIAIS (PGR)", 14, 12);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("NR-01 · NR-17 · ISO 45001 · ISO 45003", 14, 18);
  doc.setTextColor(0, 0, 0);

  // ── 1. Identificação ──────────────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("1. IDENTIFICAÇÃO DA AVALIAÇÃO", 14, 32);

  autoTable(doc, {
    startY: 36,
    theme: "grid",
    body: [
      ["Campanha", cabecalho.campanha, "Razão Social", cabecalho.razaoSocial],
      ["Instrumento", cabecalho.instrumento, "CNPJ", cabecalho.cnpj],
      ["Período", cabecalho.periodo, "Data de Emissão", new Date().toLocaleDateString("pt-BR")],
      [
        "Total de Respondentes",
        String(cabecalho.totalRespondentes),
        "IPS Global",
        cabecalho.ipsGlobal !== null ? `${cabecalho.ipsGlobal} / 100` : "—",
      ],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [243, 244, 246], cellWidth: 42 },
      1: { cellWidth: (larguraUtil - 84) / 2 },
      2: { fontStyle: "bold", fillColor: [243, 244, 246], cellWidth: 42 },
      3: { cellWidth: (larguraUtil - 84) / 2 },
    },
    margin: { left: 14, right: 14 },
  });

  // ── 2. Síntese Executiva ──────────────────────────────────────────────────
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("2. SÍNTESE EXECUTIVA", 14, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  NIVEIS_SINTESE.forEach(nivel => {
    const qtd = contagem[nivel] ?? 0;
    const [r, g, b] = COR_NIVEL[nivel];
    doc.setFillColor(r, g, b);
    doc.circle(16, y - 1.2, 1.5, "F");
    doc.setTextColor(0, 0, 0);
    doc.text(linhaSintese(nivel, qtd, NIVEL15_TOKENS[nivel]), 21, y);
    y += 6;
  });

  // ── 3. Plano de Ação por GHE ──────────────────────────────────────────────
  doc.addPage();
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("3. PLANO DE AÇÃO POR GRUPO HOMOGÊNEO DE EXPOSIÇÃO", 14, 16);

  let primeiraTabela = true;
  grupos.forEach(grupo => {
    if (grupo.acoes.length === 0) return;

    // Espaço mínimo para o cabeçalho do GHE (nome + setores + cargos) mais o
    // cabeçalho da tabela. Sem isso o bloco pode ficar órfão no pé da página.
    const alturaCabecalho =
      10 + (grupo.setores.length > 0 ? 4 : 0) + (grupo.cargos.length > 0 ? 4 : 0);
    const limite = doc.internal.pageSize.getHeight() - (30 + alturaCabecalho);

    let yGhe: number;
    if (primeiraTabela) {
      yGhe = 24;
      primeiraTabela = false;
    } else {
      const proposto =
        (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
      if (proposto > limite) {
        // Antes o y não era reposicionado depois do addPage, e o cabeçalho do
        // GHE ia parar no rodapé de uma página em branco.
        doc.addPage();
        yGhe = 20;
      } else {
        yGhe = proposto;
      }
    }

    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.text(`GHE: ${grupo.gheNome}`, 14, yGhe);

    // Composição cadastral do GHE: setores e cargos abrangidos. Substitui as
    // contagens de respondentes/ações, que não pertencem ao plano de ação — o
    // que importa aqui é a quem a ação se aplica.
    let yComp = yGhe;
    const larguraUtil = doc.internal.pageSize.getWidth() - 28;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 90);

    for (const [rotulo, itens] of [
      ["Setores", grupo.setores],
      ["Cargos", grupo.cargos],
    ] as const) {
      if (itens.length === 0) continue;
      const linhas = doc.splitTextToSize(`${rotulo}: ${itens.join(", ")}`, larguraUtil);
      for (const linha of linhas) {
        yComp += 4;
        doc.text(linha, 14, yComp);
      }
    }

    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: yComp + 3,
      head: [[
        "Fator de risco", "O quê?", "Quem?", "Onde?", "Por quê?",
        "Data inicial", "Até quando", "Como?", "Quanto?", "Nível de GRO",
      ]],
      body: grupo.acoes.map(a => [
        a.fator,
        a.o_que,
        a.quem ?? "—",
        a.onde ?? "—",
        a.por_que ?? "—",
        fmtData(a.data_inicial),
        a.nivel_gro === "trivial" ? "Sem prazo" : fmtData(a.ate_quando),
        a.como ?? "—",
        a.quanto ?? "—",
        NIVEL15_TOKENS[a.nivel_gro],
      ]),
      styles: { fontSize: 6.5, cellPadding: 1.5, valign: "top", overflow: "linebreak" },
      headStyles: { fillColor: [88, 28, 135], textColor: 255, fontSize: 6.5, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 40 },
        2: { cellWidth: 26 },
        3: { cellWidth: 28 },
        4: { cellWidth: 38 },
        5: { cellWidth: 18, halign: "center" },
        6: { cellWidth: 18, halign: "center" },
        7: { cellWidth: 40 },
        8: { cellWidth: 24 },
        9: { cellWidth: 18, halign: "center", fontStyle: "bold" },
      },
      margin: { left: 14, right: 14 },
      didParseCell: data => {
        if (data.section === "body" && data.column.index === 9) {
          const chave = grupo.acoes[data.row.index]?.nivel_gro;
          if (chave) data.cell.styles.textColor = COR_NIVEL[chave];
        }
      },
    });
  });

  // ── 4. Matriz de Nível de GRO ─────────────────────────────────────────────
  doc.addPage();
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("4. NÍVEL DE GRO — PROBABILIDADE x SEVERIDADE", 14, 16);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    "A probabilidade deriva do score apurado nas respostas; a severidade é fixa por fator, conforme o Inventário de Risco.",
    14, 22,
  );

  const linhasMatriz: NivelGRO15[][] = [
    ["medio", "medio", "alto", "critico", "critico"],
    ["medio", "medio", "medio", "alto", "critico"],
    ["baixo", "baixo", "medio", "alto", "alto"],
    ["trivial", "baixo", "baixo", "medio", "alto"],
    ["trivial", "trivial", "baixo", "baixo", "medio"],
  ];
  const rotulosProb = ["5 - Quase Certa", "4 - Frequente", "3 - Possível", "2 - Remota", "1 - Improvável"];

  autoTable(doc, {
    startY: 28,
    head: [["Prob. \\ Sev.", "1 - Insig.", "2 - Pequena", "3 - Média", "4 - Grande", "5 - Catast."]],
    body: linhasMatriz.map((linha, i) => [
      rotulosProb[i],
      ...linha.map(n => NIVEL15_TOKENS[n]),
    ]),
    styles: { fontSize: 8, halign: "center", cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
    columnStyles: {
      0: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold", halign: "center", cellWidth: 34 },
    },
    margin: { left: 14, right: 14 },
    didParseCell: data => {
      if (data.section === "body" && data.column.index > 0) {
        const nivel = linhasMatriz[data.row.index][data.column.index - 1];
        data.cell.styles.textColor = COR_NIVEL[nivel];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // ── Rodapé em todas as páginas ────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(
      `${cabecalho.razaoSocial} · Plano de Ação Psicossocial · Emitido em ${new Date().toLocaleDateString("pt-BR")}`,
      14,
      doc.internal.pageSize.getHeight() - 8,
    );
    doc.text(
      `Página ${i} de ${total}`,
      doc.internal.pageSize.getWidth() - 14,
      doc.internal.pageSize.getHeight() - 8,
      { align: "right" },
    );
  }

  return doc;
}

/** Ordena grupos e ações pelo nível de risco (mais grave primeiro). */
export function ordenarAcoesPorRisco(acoes: AcaoPlanoPsicossocial[]): AcaoPlanoPsicossocial[] {
  return [...acoes].sort(
    (a, b) => (NIVEL15_ORDEM[a.nivel_gro] ?? 5) - (NIVEL15_ORDEM[b.nivel_gro] ?? 5),
  );
}

export { PRAZO_POR_NIVEL };
