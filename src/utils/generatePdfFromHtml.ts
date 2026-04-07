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
    const imageWidth = pdfWidth;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;

    let heightLeft = imageHeight;
    let position = 0;
    let pageIndex = 0;

    pdf.addImage(imageData, "JPEG", 0, position, imageWidth, imageHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      pageIndex += 1;
      position = -(pdfHeight * pageIndex);
      pdf.addPage();
      pdf.addImage(imageData, "JPEG", 0, position, imageWidth, imageHeight);
      heightLeft -= pdfHeight;
    }

    const totalPages = pdf.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      pdf.setPage(page);
      pdf.setFontSize(8);
      pdf.setTextColor(140);
      pdf.text(`Página ${page}/${totalPages}`, pdfWidth - 24, pdfHeight - 5);
    }

    const filename = `${sanitizeFilename(filenamePrefix || "manual") || "manual"}-${Date.now()}.pdf`;
    const blob = pdf.output("blob");

    return { blob, filename, pdf };
  } finally {
    iframe.remove();
  }
}
