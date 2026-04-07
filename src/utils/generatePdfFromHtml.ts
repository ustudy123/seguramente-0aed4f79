import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface GeneratePdfFromHtmlOptions {
  html: string;
  filenamePrefix: string;
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function sanitizeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function generatePdfFromHtml({ html, filenamePrefix }: GeneratePdfFromHtmlOptions) {
  if (!html.trim()) {
    throw new Error("O manual está vazio.");
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.top = "0";
  iframe.style.left = "-10000px";
  iframe.style.width = "794px";
  iframe.style.height = "1123px";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.border = "0";
  iframe.style.background = "#ffffff";

  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve, reject) => {
      iframe.onload = () => resolve();
      iframe.onerror = () => reject(new Error("Falha ao preparar o manual para PDF."));
      iframe.srcdoc = html;
    });

    const iframeWindow = iframe.contentWindow;
    const iframeDocument = iframe.contentDocument;

    if (!iframeWindow || !iframeDocument?.body) {
      throw new Error("Não foi possível acessar o conteúdo do manual.");
    }

    if (iframeDocument.fonts?.ready) {
      await iframeDocument.fonts.ready;
    }

    await wait(400);

    const root = iframeDocument.documentElement;
    const body = iframeDocument.body;
    const captureWidth = Math.max(root.scrollWidth, body.scrollWidth, body.offsetWidth, 794);
    const captureHeight = Math.max(root.scrollHeight, body.scrollHeight, body.offsetHeight, 1123);

    iframe.style.width = `${captureWidth}px`;
    iframe.style.height = `${captureHeight}px`;

    await wait(150);

    const canvas = await html2canvas(body, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: captureWidth,
      height: captureHeight,
      windowWidth: captureWidth,
      windowHeight: captureHeight,
      scrollX: 0,
      scrollY: 0,
    });

    if (!canvas.width || !canvas.height) {
      throw new Error("Falha ao renderizar o conteúdo do manual.");
    }

    const imageData = canvas.toDataURL("image/jpeg", 0.98);
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const MARGIN = 15; // mm
    const contentWidth = pdfWidth - MARGIN * 2;
    const contentHeight = pdfHeight - MARGIN * 2;

    // Scale factor: how many mm per canvas pixel
    const scaleFactor = contentWidth / (canvas.width / 2); // scale:2 was used
    const totalImageHeightMm = (canvas.height / 2) * scaleFactor;

    // How many pixels (at scale 2) fit in one page's content area
    const pageContentHeightPx = contentHeight / scaleFactor * 2;

    const totalPages = Math.ceil((canvas.height) / pageContentHeightPx);

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage();

      // Create a sub-canvas for this page slice
      const sliceY = page * pageContentHeightPx;
      const sliceH = Math.min(pageContentHeightPx, canvas.height - sliceY);

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;
      const ctx = pageCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, sliceY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      }

      const sliceData = pageCanvas.toDataURL("image/jpeg", 0.98);
      const sliceHeightMm = (sliceH / 2) * scaleFactor;

      pdf.addImage(sliceData, "JPEG", MARGIN, MARGIN, contentWidth, sliceHeightMm);
    }

    const finalTotalPages = pdf.getNumberOfPages();
    for (let page = 1; page <= finalTotalPages; page++) {
      pdf.setPage(page);
      pdf.setFontSize(8);
      pdf.setTextColor(140);
      pdf.text(`Página ${page}/${finalTotalPages}`, pdfWidth - 28, pdfHeight - 5);
    }

    const filename = `${sanitizeFilename(filenamePrefix || "manual") || "manual"}-${Date.now()}.pdf`;
    const blob = pdf.output("blob");

    return { blob, filename, pdf };
  } finally {
    iframe.remove();
  }
}
