import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

/**
 * Renders markdown-like text into a styled hidden HTML element,
 * captures it with html2canvas, and exports as a well-formatted PDF.
 */
export async function exportTextToPdf(
  text: string,
  filename: string,
  title?: string,
  empresaNome?: string
) {
  // Create a hidden container with styled HTML
  const container = document.createElement("div");
  container.id = "pdf-render-container";
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: 700px;
    background: #ffffff;
    padding: 48px 56px;
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    line-height: 1.7;
    color: #1a1a1a;
    text-align: justify;
    box-sizing: border-box;
  `;

  // Build HTML content
  let html = "";

  // Company header
  if (empresaNome) {
    html += `<div style="text-align: center; margin-bottom: 8px; padding-bottom: 12px; border-bottom: 2px solid #2563eb;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #6b7280; margin-bottom: 4px;">Empresa Contratante</div>
      <div style="font-size: 18px; font-weight: 700; color: #1e40af;">${escapeHtml(empresaNome)}</div>
    </div>`;
  }

  // Title
  if (title) {
    html += `<h1 style="text-align: center; font-size: 20px; font-weight: 700; color: #111827; margin: 24px 0 20px 0; padding-bottom: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(title)}</h1>`;
  }

  // Process text into formatted HTML
  html += convertTextToHtml(text);

  // Footer
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  html += `<div style="margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #9ca3af;">
    Documento gerado em ${dateStr}
  </div>`;

  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pdfWidth = 210;
    const pdfHeight = 297;
    const margin = 10;
    const contentWidth = pdfWidth - margin * 2;
    const imgRatio = canvas.height / canvas.width;
    const contentHeight = contentWidth * imgRatio;

    if (contentHeight <= pdfHeight - margin * 2) {
      // Fits on one page
      pdf.addImage(imgData, "PNG", margin, margin, contentWidth, contentHeight);
    } else {
      // Multi-page: slice the canvas
      const pageContentHeight = pdfHeight - margin * 2;
      const scaleFactor = contentWidth / canvas.width;
      const sliceHeightPx = pageContentHeight / scaleFactor;
      let srcY = 0;
      let pageNum = 0;

      while (srcY < canvas.height) {
        if (pageNum > 0) pdf.addPage();
        
        const remainingPx = canvas.height - srcY;
        const thisSlicePx = Math.min(sliceHeightPx, remainingPx);
        const thisSliceMm = thisSlicePx * scaleFactor;

        // Create slice canvas
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = thisSlicePx;
        const ctx = sliceCanvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(
          canvas,
          0, srcY, canvas.width, thisSlicePx,
          0, 0, canvas.width, thisSlicePx
        );

        const sliceData = sliceCanvas.toDataURL("image/png");
        pdf.addImage(sliceData, "PNG", margin, margin, contentWidth, thisSliceMm);

        srcY += thisSlicePx;
        pageNum++;
      }

      // Add page numbers
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFontSize(8);
        pdf.setTextColor(180);
        const pageText = `${p} / ${totalPages}`;
        const tw = pdf.getTextWidth(pageText);
        pdf.text(pageText, pdfWidth - margin - tw, pdfHeight - 5);
      }
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function convertTextToHtml(text: string): string {
  const lines = text.split("\n");
  let html = "";
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "") {
      if (inList) { html += "</ul>"; inList = false; }
      html += '<div style="height: 8px;"></div>';
      continue;
    }

    // Bold headers: **text** on its own line
    if (/^\*\*(.+)\*\*$/.test(trimmed)) {
      if (inList) { html += "</ul>"; inList = false; }
      const content = trimmed.replace(/^\*\*(.+)\*\*$/, "$1");
      html += `<h2 style="font-size: 15px; font-weight: 700; color: #1e3a5f; margin: 16px 0 6px 0; text-align: left;">${escapeHtml(content)}</h2>`;
      continue;
    }

    // Inline bold within text
    let processed = escapeHtml(trimmed);
    // Re-apply bold after escaping
    processed = trimmed
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color: #1e3a5f;">$1</strong>');

    // Bullet points
    if (/^[\*\-•]\s/.test(trimmed)) {
      if (!inList) { html += '<ul style="margin: 6px 0; padding-left: 24px;">'; inList = true; }
      const content = processed.replace(/^[\*\-•]\s/, "");
      html += `<li style="margin-bottom: 4px;">${content}</li>`;
      continue;
    }

    // Numbered items
    if (/^\d+[\.\)]\s/.test(trimmed)) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p style="margin: 4px 0; padding-left: 8px;">${processed}</p>`;
      continue;
    }

    // Regular paragraph
    if (inList) { html += "</ul>"; inList = false; }
    html += `<p style="margin: 4px 0; text-align: justify;">${processed}</p>`;
  }

  if (inList) html += "</ul>";
  return html;
}
