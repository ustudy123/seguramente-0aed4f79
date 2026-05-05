import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface GeneratePdfFromHtmlOptions {
  html: string;
  filenamePrefix: string;
}

const PDF_MARGIN_MM = 15;
const PDF_RENDER_SCALE = 2; // Reduced from 3 to avoid memory issues
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

/**
 * Identify "block" elements within the body that should be captured as
 * non-splittable units. Falls back to all direct children of the body.
 */
function collectSections(root: HTMLElement): HTMLElement[] {
  const direct = Array.from(root.children) as HTMLElement[];
  const sections: HTMLElement[] = [];

  const isHeading = (el: HTMLElement) => /^H[1-6]$/i.test(el.tagName);

  for (const child of direct) {
    // If a top-level wrapper contains many block children, descend one level
    // so that headings and paragraphs become individual sections.
    const grandChildren = Array.from(child.children) as HTMLElement[];
    const looksLikeWrapper =
      grandChildren.length > 3 &&
      grandChildren.some((g) => isHeading(g) || ["P", "DIV", "SECTION", "TABLE", "UL", "OL"].includes(g.tagName));

    if (looksLikeWrapper && child.tagName !== "TABLE") {
      sections.push(...grandChildren);
    } else {
      sections.push(child);
    }
  }

  // Group consecutive headings with the next non-heading sibling so titles
  // never get separated from their content.
  const grouped: HTMLElement[] = [];
  let i = 0;
  while (i < sections.length) {
    const current = sections[i];
    if (isHeading(current) && i + 1 < sections.length) {
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "background:#ffffff;";
      wrapper.appendChild(current.cloneNode(true));
      wrapper.appendChild(sections[i + 1].cloneNode(true));
      grouped.push(wrapper);
      i += 2;
    } else {
      grouped.push(current);
      i += 1;
    }
  }

  return grouped.length ? grouped : direct;
}

export async function generatePdfFromHtml({ html, filenamePrefix }: GeneratePdfFromHtmlOptions) {
  if (!html.trim()) {
    throw new Error("O manual está vazio.");
  }

  const preparedHtml = normalizeManualHtml(html);

  const parser = new DOMParser();
  const doc = parser.parseFromString(preparedHtml, "text/html");
  const bodyContent = doc.body.innerHTML;
  const styles = Array.from(doc.querySelectorAll("style"))
    .map((s) => s.textContent)
    .join("\n");

  // Hidden offscreen container in the main document
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

  const styleEl = document.createElement("style");
  styleEl.textContent = styles;
  container.appendChild(styleEl);

  const contentDiv = document.createElement("div");
  contentDiv.innerHTML = bodyContent;
  contentDiv.style.cssText = [
    "width: 794px",
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
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    await wait(500);

    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pdfWidth - PDF_MARGIN_MM * 2;
    const usableHeight = pdfHeight - PDF_MARGIN_MM * 2;
    const SECTION_GAP_MM = 2;

    const sections = collectSections(contentDiv);
    let currentY = PDF_MARGIN_MM;

    const renderElementToCanvas = async (element: HTMLElement) => {
      // For grouped wrappers, mount them temporarily into the container
      const needsMount = !element.isConnected;
      if (needsMount) {
        element.style.width = "754px"; // 794 - 2*20 padding
        element.style.boxSizing = "border-box";
        container.appendChild(element);
        await wait(50);
      }
      const canvas = await html2canvas(element, {
        scale: PDF_RENDER_SCALE,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      if (needsMount) container.removeChild(element);
      return canvas;
    };

    const addCanvasAsImage = (canvas: HTMLCanvasElement, heightMm: number) => {
      const data = canvas.toDataURL("image/png");
      pdf.addImage(data, "PNG", PDF_MARGIN_MM, currentY, contentWidth, heightMm);
      currentY += heightMm + SECTION_GAP_MM;
    };

    const sliceTallCanvas = (canvas: HTMLCanvasElement) => {
      // Section is taller than a full page — split it across pages at pixel
      // boundaries (last resort; only triggered for oversize blocks).
      const pageHeightPx = Math.floor((canvas.width * usableHeight) / contentWidth);
      let y = 0;
      while (y < canvas.height) {
        const remainingMm = pdfHeight - PDF_MARGIN_MM - currentY;
        const availablePx = Math.floor((canvas.width * remainingMm) / contentWidth);
        if (availablePx < 60) {
          pdf.addPage();
          currentY = PDF_MARGIN_MM;
          continue;
        }
        const sliceH = Math.min(pageHeightPx, availablePx, canvas.height - y);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceH;
        const ctx = slice.getContext("2d");
        if (!ctx) throw new Error("Falha ao preparar slice.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const sliceMm = (sliceH * contentWidth) / canvas.width;
        addCanvasAsImage(slice, sliceMm);
        y += sliceH;
        if (y < canvas.height) {
          pdf.addPage();
          currentY = PDF_MARGIN_MM;
        }
      }
    };

    for (const section of sections) {
      const canvas = await renderElementToCanvas(section);
      if (!canvas.width || !canvas.height) continue;

      const heightMm = (canvas.height * contentWidth) / canvas.width;
      const remainingMm = pdfHeight - PDF_MARGIN_MM - currentY;

      if (heightMm <= usableHeight) {
        // Fits on a page — push to next page if needed
        if (heightMm > remainingMm && currentY > PDF_MARGIN_MM) {
          pdf.addPage();
          currentY = PDF_MARGIN_MM;
        }
        addCanvasAsImage(canvas, heightMm);
      } else {
        // Section is too tall for a single page — slice safely
        if (currentY > PDF_MARGIN_MM) {
          pdf.addPage();
          currentY = PDF_MARGIN_MM;
        }
        sliceTallCanvas(canvas);
      }
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
