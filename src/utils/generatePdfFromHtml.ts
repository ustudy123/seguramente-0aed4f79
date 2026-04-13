import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface GeneratePdfFromHtmlOptions {
  html: string;
  filenamePrefix: string;
}

const PDF_MARGIN_MM = 15;
const PDF_RENDER_SCALE = 3;
const LONG_TEXT_MIN_LENGTH = 80;
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

function appendInlineStyle(element: Element, styleToAppend: string) {
  const existingStyle = element.getAttribute("style")?.trim() || "";
  const normalizedExisting = existingStyle
    ? `${existingStyle}${existingStyle.endsWith(";") ? "" : ";"}`
    : "";

  element.setAttribute("style", `${normalizedExisting}${styleToAppend}`);
}

function hasCenteredAncestor(element: Element | null) {
  let current = element;

  while (current) {
    const style = current.getAttribute("style") || "";
    if (/text-align\s*:\s*center/i.test(style)) {
      return true;
    }
    current = current.parentElement;
  }

  return false;
}

export function normalizeManualHtml(html: string) {
  if (!html.trim()) return html;

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, "text/html");

  const existingNormalizer = documentNode.head.querySelector("style[data-manual-normalizer='true']");
  existingNormalizer?.remove();

  const baseStyle = documentNode.createElement("style");
  baseStyle.setAttribute("data-manual-normalizer", "true");
  baseStyle.textContent = `
    html, body {
      background: #ffffff !important;
    }

    body {
      -webkit-font-smoothing: antialiased;
      text-rendering: geometricPrecision;
      font-kerning: normal;
      max-width: 794px;
      margin: 0 auto;
      padding: 0 20px;
      box-sizing: border-box;
      overflow-wrap: break-word;
      word-wrap: break-word;
      word-break: break-word;
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    img, svg, canvas {
      max-width: 100%;
    }

    p, li, td, th, div, span, blockquote {
      max-width: 100%;
      overflow-wrap: break-word;
      word-wrap: break-word;
    }
  `;
  documentNode.head.appendChild(baseStyle);

  const textElements = documentNode.body.querySelectorAll("p, li, td, blockquote");

  textElements.forEach((element) => {
    const text = element.textContent?.replace(/\s+/g, " ").trim() || "";

    if (text.length < LONG_TEXT_MIN_LENGTH || hasCenteredAncestor(element)) {
      return;
    }

    appendInlineStyle(
      element,
      [
        "text-align: justify !important",
        "text-justify: inter-word",
        "white-space: normal !important",
        "word-break: normal !important",
        "overflow-wrap: break-word !important",
        "word-spacing: 0.05em !important",
        "letter-spacing: normal !important",
        "line-height: 1.65",
        "hyphens: none !important",
      ].join(";") + ";"
    );
  });

  return `<!DOCTYPE html>\n${documentNode.documentElement.outerHTML}`;
}

export async function generatePdfFromHtml({ html, filenamePrefix }: GeneratePdfFromHtmlOptions) {
  if (!html.trim()) {
    throw new Error("O manual está vazio.");
  }

  const preparedHtml = normalizeManualHtml(html);

  // Parse the HTML to extract just the body content and styles
  const parser = new DOMParser();
  const doc = parser.parseFromString(preparedHtml, "text/html");
  const bodyContent = doc.body.innerHTML;
  const styles = Array.from(doc.querySelectorAll("style"))
    .map((s) => s.textContent)
    .join("\n");

  // Create a container div in the main document (avoids cross-document issues with html2canvas)
  const container = document.createElement("div");
  container.setAttribute("aria-hidden", "true");
  container.style.cssText = [
    "position: fixed",
    "top: 0",
    "left: -10000px",
    "width: 794px",
    "background: #ffffff",
    "opacity: 0",
    "pointer-events: none",
    "z-index: -9999",
    "overflow: visible",
  ].join(";");

  // Add styles
  const styleEl = document.createElement("style");
  styleEl.textContent = styles;
  container.appendChild(styleEl);

  // Add content
  const contentDiv = document.createElement("div");
  contentDiv.innerHTML = bodyContent;
  contentDiv.style.cssText = [
    "max-width: 794px",
    "margin: 0 auto",
    "padding: 0 20px",
    "box-sizing: border-box",
    "overflow-wrap: break-word",
    "word-wrap: break-word",
    "word-break: break-word",
    "background: #ffffff",
  ].join(";");
  container.appendChild(contentDiv);

  document.body.appendChild(container);

  try {
    // Wait for fonts and images to load
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    await wait(600);

    const captureWidth = Math.max(contentDiv.scrollWidth, contentDiv.offsetWidth, 794);
    const captureHeight = Math.max(contentDiv.scrollHeight, contentDiv.offsetHeight, 1123);

    container.style.width = `${captureWidth}px`;
    await wait(200);

    const canvas = await html2canvas(contentDiv, {
      scale: PDF_RENDER_SCALE,
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

    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pdfWidth - PDF_MARGIN_MM * 2;
    const contentHeight = pdfHeight - PDF_MARGIN_MM * 2;
    const pageContentHeightPx = Math.max(1, Math.floor((canvas.width * contentHeight) / contentWidth));
    const totalPages = Math.ceil(canvas.height / pageContentHeightPx);

    for (let page = 0; page < totalPages; page += 1) {
      if (page > 0) pdf.addPage();

      const sliceY = page * pageContentHeightPx;
      const sliceH = Math.min(pageContentHeightPx, canvas.height - sliceY);

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;

      const ctx = pageCanvas.getContext("2d");
      if (!ctx) {
        throw new Error("Falha ao preparar a página do PDF.");
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(canvas, 0, sliceY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

      const sliceData = pageCanvas.toDataURL("image/png");
      const sliceHeightMm = (sliceH * contentWidth) / canvas.width;

      pdf.addImage(sliceData, "PNG", PDF_MARGIN_MM, PDF_MARGIN_MM, contentWidth, sliceHeightMm);
    }

    const finalTotalPages = pdf.getNumberOfPages();
    for (let page = 1; page <= finalTotalPages; page += 1) {
      pdf.setPage(page);
      pdf.setFontSize(8);
      pdf.setTextColor(140);
      pdf.text(`Página ${page}/${finalTotalPages}`, pdfWidth - 28, pdfHeight - 5);
    }

    const filename = `${sanitizeFilename(filenamePrefix || "manual") || "manual"}-${Date.now()}.pdf`;
    const blob = pdf.output("blob");

    return { blob, filename, pdf };
  } finally {
    container.remove();
  }
}
