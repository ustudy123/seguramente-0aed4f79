import jsPDF from "jspdf";
import QRCode from "qrcode";

const s = (t: string): string =>
  (t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, " ");

export interface EntrevistaColaboradorPdfItem {
  nome: string;
  cpf?: string | null;
  cargo?: string | null;
  link: string;
}

interface Params {
  empresaNome: string;
  empresaCnpj: string;
  campanhaNome: string;
  itens: EntrevistaColaboradorPdfItem[];
}

/**
 * Gera um PDF da campanha de entrevista guiada com 1 bloco por colaborador,
 * contendo nome, CPF, link individual e QR Code (2 por página A4).
 */
export async function gerarLinksEntrevistaColaboradores(params: Params): Promise<void> {
  const { empresaNome, empresaCnpj, campanhaNome, itens } = params;

  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 15;
  const marginTop = 28;
  const marginBottom = 18;
  const contentW = pageW - marginX * 2;

  const drawHeader = () => {
    doc.setFillColor(88, 28, 135);
    doc.rect(0, 0, pageW, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("YourEyes - Entrevista Guiada Psicossocial", marginX, 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(s(`Campanha: ${campanhaNome}`), marginX, 14.5);
    doc.setFontSize(7);
    doc.text("NR-01 | LGPD | ISO 45003", pageW - marginX, 14.5, { align: "right" });
    doc.setTextColor(30, 30, 30);
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageH - 12, pageW - marginX, pageH - 12);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(s(empresaNome), marginX, pageH - 6);
    doc.text(`Pag. ${pageNum} / ${totalPages}`, pageW - marginX, pageH - 6, { align: "right" });
    doc.setTextColor(30, 30, 30);
  };

  // Cabeçalho geral - capa
  drawHeader();
  let y = marginTop;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(30, 30, 30);
  doc.text(s("Links Individuais de Entrevista Guiada"), pageW / 2, y, { align: "center" });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  const intro = doc.splitTextToSize(
    s(
      `Este documento contem ${itens.length} link(s) individual(is) para a entrevista guiada psicossocial da campanha "${campanhaNome}". Cada colaborador tem um link unico e nominal. Entregue de forma confidencial, por meios oficiais da empresa. As respostas sao tratadas conforme a LGPD e o anonimato analitico e preservado nos relatorios consolidados.`
    ),
    contentW
  ) as string[];
  intro.forEach((ln) => {
    doc.text(ln, marginX, y);
    y += 5;
  });
  y += 4;

  // Card identificação
  doc.setFillColor(245, 240, 255);
  doc.setDrawColor(88, 28, 135);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, y, contentW, 22, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(88, 28, 135);
  doc.text("EMPRESA", marginX + 4, y + 6);
  doc.setTextColor(35, 35, 35);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(s(empresaNome), marginX + 4, y + 12);
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(s(`CNPJ: ${empresaCnpj || "Nao informado"}`), marginX + 4, y + 18);

  // Bloco por colaborador (2 por página)
  const blocoH = 118; // mm
  const blocoGap = 6;
  let cursorY = pageH; // força nova página no primeiro item

  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];

    if (cursorY + blocoH > pageH - marginBottom) {
      doc.addPage();
      drawHeader();
      cursorY = marginTop;
    }

    // Caixa
    doc.setFillColor(252, 250, 255);
    doc.setDrawColor(88, 28, 135);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, cursorY, contentW, blocoH, 2, 2, "FD");

    // Lado esquerdo: dados + link
    const leftX = marginX + 5;
    let ly = cursorY + 9;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(88, 28, 135);
    doc.text(s(item.nome).slice(0, 60), leftX, ly);
    ly += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    if (item.cargo) {
      doc.text(s(item.cargo).slice(0, 60), leftX, ly);
      ly += 4.5;
    }
    if (item.cpf) {
      doc.text(s(`CPF: ${item.cpf}`), leftX, ly);
      ly += 4.5;
    }
    ly += 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(35, 35, 35);
    doc.text("Link individual:", leftX, ly);
    ly += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 64, 175);
    const linkLines = doc.splitTextToSize(item.link, contentW - 70) as string[];
    linkLines.slice(0, 4).forEach((ln) => {
      doc.textWithLink(ln, leftX, ly, { url: item.link });
      ly += 4.2;
    });
    ly += 3;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(s("Acesse pelo celular ou aponte o QR Code ao lado."), leftX, ly);
    ly += 4;
    doc.text(s("Link nominal - nao compartilhe."), leftX, ly);

    // QR Code direita
    const qrSize = 52;
    const qrX = pageW - marginX - qrSize - 6;
    const qrY = cursorY + (blocoH - qrSize) / 2;
    const qrData = await QRCode.toDataURL(item.link, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    doc.setFillColor(255, 255, 255);
    doc.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, "F");
    doc.addImage(qrData, "PNG", qrX, qrY, qrSize, qrSize);

    cursorY += blocoH + blocoGap;
  }

  const total = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(i, total);
  }

  const safeEmp = (empresaNome || "empresa").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  const safeCamp = campanhaNome.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
  doc.save(`Entrevistas_${safeEmp}_${safeCamp}.pdf`);
}
