import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { QaBateria, QaResultado } from "@/hooks/useQaRunner";

/**
 * Gera relatorios de uma bateria de testes em tres formatos: PDF, CSV e uma
 * janela imprimivel. Usa as libs que o projeto ja tem (jspdf, xlsx).
 *
 * Todos mostram TUDO: passou, falhou, sem rotina e erro.
 */

const SIT_LABEL: Record<string, string> = {
  passou: "Passou",
  falhou: "Falhou",
  erro: "Erro",
  nao_implementado: "Sem rotina",
};

function nomeArquivo(bateria: QaBateria, ext: string): string {
  const data = new Date(bateria.iniciada_em)
    .toLocaleString("pt-BR")
    .replace(/[/:]/g, "-")
    .replace(/[, ]+/g, "_");
  const mod = (bateria.modulo_path || "todos").split("/").pop();
  return `relatorio_qa_${mod}_${data}.${ext}`;
}

function ordenar(resultados: QaResultado[]): QaResultado[] {
  const ordem: Record<string, number> = { falhou: 0, erro: 1, passou: 2, nao_implementado: 3 };
  return [...resultados].sort(
    (a, b) => (ordem[a.situacao] - ordem[b.situacao]) || a.codigo.localeCompare(b.codigo),
  );
}

// ─────────────────────────────────────────────────────────
// PDF
// ─────────────────────────────────────────────────────────
export function gerarPDF(bateria: QaBateria, resultados: QaResultado[]) {
  const doc = new jsPDF();
  const quando = new Date(bateria.iniciada_em).toLocaleString("pt-BR");
  const mod = bateria.modulo_path === "todos" || !bateria.modulo_path
    ? "Todos os módulos"
    : bateria.modulo_path;

  // Cabecalho
  doc.setFontSize(16);
  doc.text("Relatório de Testes Automatizados", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Módulo: ${mod}`, 14, 26);
  doc.text(`Execução: ${quando}`, 14, 31);
  if (bateria.disparada_por_nome) doc.text(`Disparado por: ${bateria.disparada_por_nome}`, 14, 36);

  // Placar
  doc.setTextColor(0);
  doc.setFontSize(11);
  const placar = `${bateria.passou} passou · ${bateria.falhou} falhou · ${bateria.erro} erro · ${bateria.nao_implementado} sem rotina  (total ${bateria.total})`;
  doc.text(placar, 14, 45);

  // Tabela
  autoTable(doc, {
    startY: 50,
    head: [["Caso", "Situação", "Resultado"]],
    body: ordenar(resultados).map((r) => [
      r.codigo,
      SIT_LABEL[r.situacao] || r.situacao,
      r.obtido || "",
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 24 }, 2: { cellWidth: "auto" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        const s = ordenar(resultados)[data.row.index]?.situacao;
        if (s === "falhou") data.cell.styles.textColor = [185, 28, 28];
        else if (s === "erro") data.cell.styles.textColor = [194, 65, 12];
        else if (s === "passou") data.cell.styles.textColor = [21, 128, 61];
        else data.cell.styles.textColor = [100, 116, 139];
      }
    },
  });

  // Detalhe das falhas/erros (o que precisa de acao)
  const problemas = ordenar(resultados).filter((r) => r.situacao === "falhou" || r.situacao === "erro");
  if (problemas.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let y = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text("Detalhe do que precisa de atenção", 14, y);
    y += 6;
    doc.setFontSize(8);
    problemas.forEach((r) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setTextColor(0);
      doc.setFont(undefined, "bold");
      doc.text(`${r.codigo}`, 14, y); y += 4;
      doc.setFont(undefined, "normal");
      doc.setTextColor(80);
      if (r.passo_acao) { doc.text(`Passo: ${r.passo_acao}`, 16, y); y += 4; }
      if (r.esperado) { doc.text(`Esperado: ${r.esperado}`, 16, y); y += 4; }
      if (r.obtido) {
        const linhas = doc.splitTextToSize(`Obtido: ${r.obtido}`, 178);
        doc.text(linhas, 16, y); y += 4 * linhas.length;
      }
      if (r.erro_tecnico) {
        const linhas = doc.splitTextToSize(`Técnico: ${r.erro_tecnico}`, 178);
        doc.setTextColor(150); doc.text(linhas, 16, y); y += 4 * linhas.length;
      }
      y += 3;
    });
  }

  doc.save(nomeArquivo(bateria, "pdf"));
}

// ─────────────────────────────────────────────────────────
// CSV / planilha (xlsx gera um .csv real, abrivel no Excel)
// ─────────────────────────────────────────────────────────
export function gerarCSV(bateria: QaBateria, resultados: QaResultado[]) {
  const linhas = ordenar(resultados).map((r) => ({
    Caso: r.codigo,
    Situacao: SIT_LABEL[r.situacao] || r.situacao,
    Passo: r.passo_acao || "",
    Esperado: r.esperado || "",
    Obtido: r.obtido || "",
    Erro_tecnico: r.erro_tecnico || "",
    Duracao_ms: r.duracao_ms ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Resultados");
  XLSX.writeFile(wb, nomeArquivo(bateria, "csv"));
}

// ─────────────────────────────────────────────────────────
// Janela imprimivel (abre uma aba com HTML pronto para imprimir/salvar PDF)
// ─────────────────────────────────────────────────────────
export function abrirImprimivel(bateria: QaBateria, resultados: QaResultado[]) {
  const quando = new Date(bateria.iniciada_em).toLocaleString("pt-BR");
  const mod = bateria.modulo_path === "todos" || !bateria.modulo_path
    ? "Todos os módulos" : bateria.modulo_path;
  const cor: Record<string, string> = {
    passou: "#15803d", falhou: "#b91c1c", erro: "#c2410c", nao_implementado: "#64748b",
  };
  const linhas = ordenar(resultados).map((r) => `
    <tr>
      <td style="font-family:monospace;white-space:nowrap">${r.codigo}</td>
      <td style="color:${cor[r.situacao]};font-weight:600">${SIT_LABEL[r.situacao] || r.situacao}</td>
      <td>${(r.obtido || "").replace(/</g, "&lt;")}</td>
    </tr>`).join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Relatório QA — ${mod}</title>
    <style>
      body{font-family:system-ui,sans-serif;max-width:900px;margin:24px auto;padding:0 16px;color:#0f172a}
      h1{font-size:18px;margin:0 0 4px} .meta{color:#64748b;font-size:13px;margin-bottom:16px}
      .placar{font-size:14px;margin:12px 0 20px;padding:10px;background:#f1f5f9;border-radius:8px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top}
      th{background:#1e293b;color:#fff}
      @media print{th{background:#1e293b!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      .btn{margin:16px 0;padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px}
      @media print{.btn{display:none}}
    </style></head><body>
    <h1>Relatório de Testes Automatizados</h1>
    <div class="meta">Módulo: ${mod} · Execução: ${quando}${bateria.disparada_por_nome ? " · " + bateria.disparada_por_nome : ""}</div>
    <button class="btn" onclick="window.print()">Imprimir / Salvar PDF</button>
    <div class="placar"><strong>${bateria.passou}</strong> passou ·
      <strong style="color:#b91c1c">${bateria.falhou}</strong> falhou ·
      <strong style="color:#c2410c">${bateria.erro}</strong> erro ·
      <strong style="color:#64748b">${bateria.nao_implementado}</strong> sem rotina
      (total ${bateria.total})</div>
    <table><thead><tr><th>Caso</th><th>Situação</th><th>Resultado</th></tr></thead>
    <tbody>${linhas}</tbody></table>
    </body></html>`;

  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}
