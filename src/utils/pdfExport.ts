import { jsPDF } from "jspdf";

function sanitize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, (match) => {
    const map: Record<string, string> = {
      '\u0301': "'", '\u0300': "'", '\u0302': "^", '\u0303': "~", '\u0327': "c",
    };
    return map[match] || "";
  }).replace(/[^\x00-\x7F]/g, (ch) => {
    const map: Record<string, string> = {
      'á': 'a', 'à': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a',
      'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
      'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
      'ó': 'o', 'ò': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
      'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
      'ç': 'c', 'ñ': 'n',
      'Á': 'A', 'À': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A',
      'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
      'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
      'Ó': 'O', 'Ò': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O',
      'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
      'Ç': 'C', 'Ñ': 'N',
      '–': '-', '—': '-', '"': '"', '"': '"', ''': "'", ''': "'",
      '•': '-', '…': '...', '°': 'o',
    };
    return map[ch] || ch;
  });
}

export function exportTextToPdf(text: string, filename: string, title?: string) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const lineHeight = 6;
  const maxY = pageHeight - margin;

  let currentY = margin;

  // Title
  if (title) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    const safeTitle = sanitize(title);
    const titleLines = pdf.splitTextToSize(safeTitle, contentWidth);
    for (const line of titleLines) {
      if (currentY + 8 > maxY) {
        pdf.addPage();
        currentY = margin;
      }
      // Center title
      const tw = pdf.getTextWidth(line);
      pdf.text(line, margin + (contentWidth - tw) / 2, currentY);
      currentY += 8;
    }
    currentY += 4;
  }

  // Body
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);

  const safeText = sanitize(text);
  const paragraphs = safeText.split("\n");

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === "") {
      currentY += lineHeight * 0.6;
      if (currentY > maxY) {
        pdf.addPage();
        currentY = margin;
      }
      continue;
    }

    // Detect headers (lines in ALL CAPS or starting with numbers followed by .)
    const isHeader = /^[A-Z0-9\s\-:]{5,}$/.test(paragraph.trim()) || /^\d+[\.\)]\s/.test(paragraph.trim());

    if (isHeader) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
    } else {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
    }

    const lines = pdf.splitTextToSize(paragraph.trim(), contentWidth);

    for (let i = 0; i < lines.length; i++) {
      if (currentY + lineHeight > maxY) {
        pdf.addPage();
        currentY = margin;
      }

      const line = lines[i];

      // Justify: stretch words to fill line width (except last line of paragraph)
      if (!isHeader && i < lines.length - 1 && line.trim().length > 0) {
        justifyLine(pdf, line, margin, currentY, contentWidth);
      } else {
        pdf.text(line, margin, currentY);
      }

      currentY += lineHeight;
    }

    if (isHeader) {
      currentY += 1;
    }
  }

  // Footer on all pages
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    const footerText = `Pagina ${p} de ${totalPages}`;
    const fw = pdf.getTextWidth(footerText);
    pdf.text(footerText, pageWidth - margin - fw, pageHeight - 10);
    pdf.setTextColor(0);
  }

  pdf.save(filename);
}

function justifyLine(pdf: jsPDF, line: string, x: number, y: number, maxWidth: number) {
  const words = line.split(/\s+/).filter(w => w.length > 0);
  if (words.length <= 1) {
    pdf.text(line, x, y);
    return;
  }

  const totalWordsWidth = words.reduce((sum, w) => sum + pdf.getTextWidth(w), 0);
  const totalSpacing = maxWidth - totalWordsWidth;
  const spaceWidth = totalSpacing / (words.length - 1);

  let cx = x;
  for (let i = 0; i < words.length; i++) {
    pdf.text(words[i], cx, y);
    cx += pdf.getTextWidth(words[i]) + spaceWidth;
  }
}
