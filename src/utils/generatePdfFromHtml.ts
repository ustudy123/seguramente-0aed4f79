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

function hasVisualContainerStyle(element: HTMLElement) {
  const style = element.getAttribute("style") || "";
  return /(background|background-color|background-image|linear-gradient|box-shadow|border(?!-collapse)|border-radius|padding)/i.test(style);
}

function hasOpaqueInlineBackground(element: HTMLElement) {
  const style = element.getAttribute("style") || "";
  if (!/(background|background-color)/i.test(style)) return false;
  if (/transparent/i.test(style)) return false;
  if (/rgba\([^)]*,\s*0(?:\.0+)?\s*\)/i.test(style)) return false;
  return true;
}

function usesLightInlineText(element: HTMLElement) {
  const style = element.getAttribute("style") || "";
  return /color\s*:\s*(#fff(?:fff)?|white|rgb\(255\s*,\s*255\s*,\s*255\))/i.test(style);
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
      color: #000000 !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    body {
      -webkit-font-smoothing: antialiased;
      text-rendering: geometricPrecision;
      font-kerning: normal;
      width: 794px !important;
      max-width: 794px !important;
      margin: 0 auto !important;
      padding: 0 40px !important;
      box-sizing: border-box !important;
      overflow-wrap: break-word;
      word-wrap: break-word;
      word-break: break-word;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      color: inherit;
    }

    img, svg, canvas {
      max-width: 100%;
      height: auto;
    }

    p, li, td, th, div, span, blockquote {
      max-width: 100%;
      overflow-wrap: break-word;
      word-wrap: break-word;
    }
  `;
  documentNode.head.appendChild(baseStyle);

  // Ensure naked text nodes in body are wrapped in <p>
  Array.from(documentNode.body.childNodes).forEach(node => {
    if (node.nodeType === 3 && node.textContent?.trim()) { // 3 is Node.TEXT_NODE
      const p = documentNode.createElement("p");
      p.textContent = node.textContent;
      documentNode.body.insertBefore(p, node);
      documentNode.body.removeChild(node);
    }
  });

  // Fix double numbering: if <li> text already starts with "N." or "N)",
  // remove the auto-numbering from the parent <ol>.
  const orderedLists = documentNode.body.querySelectorAll("ol");
  orderedLists.forEach((ol) => {
    const items = Array.from(ol.children).filter((c) => c.tagName === "LI");
    if (!items.length) return;
    const allPrefixed = items.every((li) => /^\s*\d+\s*[.)]/.test(li.textContent || ""));
    if (allPrefixed) {
      appendInlineStyle(ol as HTMLElement, "list-style: none !important; padding-left: 0 !important;");
    }
  });

  const textElements = documentNode.body.querySelectorAll("p, li, td, blockquote");
  const headingElements = documentNode.body.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const visualContainers = documentNode.body.querySelectorAll("div, section, article, header");

  visualContainers.forEach((container) => {
    const htmlElement = container as HTMLElement;
    const inlineStyle = htmlElement.getAttribute("style") || "";

    if (/linear-gradient/i.test(inlineStyle) && !/background-color/i.test(inlineStyle)) {
      appendInlineStyle(htmlElement, "background-color: #1e3a5f !important;");
    }

    if (hasVisualContainerStyle(htmlElement)) {
      appendInlineStyle(
        htmlElement,
        "break-inside: avoid !important; page-break-inside: avoid !important; overflow: visible !important;"
      );
    }
  });

  headingElements.forEach((el) => {
    const heading = el as HTMLElement;
    appendInlineStyle(
      heading,
      [
        "margin-bottom: 12px !important",
        "margin-top: 16px !important",
        "line-height: 1.25 !important",
        "padding-bottom: 6px !important",
        "page-break-after: avoid !important",
        "break-after: avoid !important",
        "page-break-inside: avoid !important",
        "break-inside: avoid !important",
        "background-clip: padding-box !important",
        "overflow-wrap: break-word !important",
        "word-wrap: break-word !important",
        "-webkit-print-color-adjust: exact",
        "print-color-adjust: exact",
      ].join(";") + ";"
    );

    if (usesLightInlineText(heading) && !hasOpaqueInlineBackground(heading)) {
      appendInlineStyle(
        heading,
        "color: #ffffff !important; background: #1e3a5f !important; display: block !important; padding: 12px 16px !important; border-radius: 12px !important;"
      );
    }
  });

  textElements.forEach((element) => {
    const text = element.textContent?.replace(/\s+/g, " ").trim() || "";

    if (text.length < LONG_TEXT_MIN_LENGTH || hasCenteredAncestor(element)) {
      if (element.tagName === "P") {
        appendInlineStyle(element, "margin-top: 0 !important; margin-bottom: 12px !important;");
      }
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
        "line-height: 1.6",
        "hyphens: none !important",
        "margin-top: 0 !important",
        "margin-bottom: 12px !important",
      ].join(";") + ";"
    );
  });

  return `<!DOCTYPE html>\n${documentNode.documentElement.outerHTML}`;
}

/**
 * Identify "block" elements within the body that should be captured as
 * non-splittable units.
 */
function collectSections(root: HTMLElement): HTMLElement[] {
  if (!root) return [];
  
  const sections: HTMLElement[] = [];
  const isHeading = (el: HTMLElement) => el && el.tagName && /^H[1-6]$/i.test(el.tagName);

  const isStandaloneRenderable = (node: HTMLElement) => {
    if (["STYLE", "SCRIPT"].includes(node.tagName)) return false;
    if (isHeading(node)) return true;
    if (["P", "TABLE", "UL", "OL", "BLOCKQUOTE", "HR", "SECTION", "ARTICLE"].includes(node.tagName)) return true;
    return hasVisualContainerStyle(node);
  };

  const walk = (node: HTMLElement) => {
    // If it's the root itself, always recurse
    if (node === root) {
      Array.from(node.children).forEach((child) => walk(child as HTMLElement));
      return;
    }

    if (isStandaloneRenderable(node)) {
      sections.push(node);
      return;
    }

    // For generic containers like DIV that aren't standalone, keep digging
    if (["DIV", "SPAN", "BODY", "MAIN"].includes(node.tagName)) {
      Array.from(node.children).forEach((child) => walk(child as HTMLElement));
    }
  };

  walk(root);

  if (sections.length === 0) {
    console.warn("Nenhuma seção renderizável encontrada via walk. Usando fallback de children.");
    return Array.from(root.children).filter(c => !["STYLE", "SCRIPT"].includes(c.tagName)) as HTMLElement[];
  }

  // Refined grouping: group headings with their immediate followers
  const grouped: HTMLElement[] = [];
  let i = 0;
  while (i < sections.length) {
    const current = sections[i];
    
    if (current && isHeading(current) && i + 1 < sections.length) {
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "background:#ffffff; width: 100%; box-sizing: border-box; display: block; overflow: visible;";
      
      const headingClone = current.cloneNode(true) as HTMLElement;
      headingClone.style.marginBottom = "8px";
      headingClone.style.marginTop = "16px";
      wrapper.appendChild(headingClone);
      
      let j = i + 1;
      // Keep adding elements until we hit another heading or a large block
      while (j < sections.length && j < i + 5) {
        const next = sections[j];
        if (isHeading(next)) break;
        
        const nextClone = next.cloneNode(true) as HTMLElement;
        if (nextClone.tagName === "P") {
          nextClone.style.marginTop = "0px";
          nextClone.style.marginBottom = "12px";
        }
        wrapper.appendChild(nextClone);
        
        if (["TABLE", "UL", "OL"].includes(next.tagName) || hasVisualContainerStyle(next)) {
          j++;
          break;
        }
        j++;
      }
      
      grouped.push(wrapper);
      i = j;
    } else if (current) {
      grouped.push(current);
      i += 1;
    } else {
      i += 1;
    }
  }

  return grouped;
}

export async function generatePdfFromHtml({ html, filenamePrefix }: GeneratePdfFromHtmlOptions) {
  if (!html || !html.trim()) {
    throw new Error("O manual está vazio.");
  }

  console.log("Iniciando geração de PDF para:", filenamePrefix);
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
  container.className = "pdf-generation-container";
  container.style.cssText = [
    "position: fixed",
    "top: 0",
    "left: -5000px", // Less extreme offset
    "width: 794px",
    "background: #ffffff",
    "visibility: visible",
    "display: block",
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
    "padding: 0 40px",
    "box-sizing: border-box",
    "overflow-wrap: break-word",
    "word-wrap: break-word",
    "word-break: break-word",
    "background: #ffffff",
    "color: #000000",
  ].join(";");
  container.appendChild(contentDiv);

  document.body.appendChild(container);
  console.log("Conteúdo montado no DOM para captura.");

  try {
    // Ensure all images are loaded
    const images = container.querySelectorAll("img");
    await Promise.all(
      Array.from(images).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    await wait(800);

    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pdfWidth - PDF_MARGIN_MM * 2;
    const usableHeight = pdfHeight - PDF_MARGIN_MM * 2 - 3; // 3mm bottom safety to avoid clipping descenders
    const SECTION_GAP_MM = 2;

    const sections = collectSections(contentDiv);
    console.log(`Geração PDF: ${sections.length} seções identificadas.`);
    
    if (sections.length === 0) {
      console.error("Erro Crítico: Nenhuma seção encontrada no manual.");
      throw new Error("Não foi possível identificar o conteúdo do manual para geração do PDF.");
    }

    let currentY = PDF_MARGIN_MM;

    const renderElementToCanvas = async (element: HTMLElement) => {
      // For grouped wrappers, mount them temporarily into the container
      const needsMount = !element.isConnected;
      if (needsMount) {
        element.style.width = "754px"; // 794 - 2*20 padding
        element.style.boxSizing = "border-box";
        element.style.background = "#ffffff";
        container.appendChild(element);
        // Wait a bit longer for layout and images
        await wait(100);
      }
      
      try {
        const canvas = await html2canvas(element, {
          scale: PDF_RENDER_SCALE,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          allowTaint: false, // Changed from true to avoid SecurityError on toDataURL
          scrollX: 0,
          scrollY: 0,
        });
        if (needsMount) container.removeChild(element);
        return canvas;
      } catch (err) {
        if (needsMount && element.parentElement === container) {
          container.removeChild(element);
        }
        throw err;
      }
    };

    const addCanvasAsImage = (canvas: HTMLCanvasElement, heightMm: number) => {
      const data = canvas.toDataURL("image/png");
      pdf.addImage(data, "PNG", PDF_MARGIN_MM, currentY, contentWidth, heightMm);
      currentY += heightMm + SECTION_GAP_MM;
    };

    const sliceTallCanvas = (canvas: HTMLCanvasElement) => {
      const pageHeightPx = Math.floor((canvas.width * usableHeight) / contentWidth);
      let y = 0;
      while (y < canvas.height) {
        const remainingMm = pdfHeight - PDF_MARGIN_MM - currentY - 3;
        const availablePx = Math.floor((canvas.width * remainingMm) / contentWidth);
        if (availablePx < 60) {
          pdf.addPage();
          currentY = PDF_MARGIN_MM;
          continue;
        }
        let sliceH = Math.min(pageHeightPx, availablePx, canvas.height - y);
        if (y + sliceH < canvas.height) {
          const scanStart = Math.max(24, sliceH - 160);
          const scanEnd = Math.max(scanStart, sliceH - 8);
          let bestBreak = -1;

          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            // Look for a band of consecutive blank rows (not just one), so we
            // don't break in the middle of descenders.
            const requiredBlankBand = 6;
            let blankRun = 0;
            for (let row = scanEnd; row >= scanStart; row -= 1) {
              const imageData = ctx.getImageData(0, y + row, canvas.width, 1).data;
              let inkPixels = 0;

              for (let i = 0; i < imageData.length; i += 4) {
                const alpha = imageData[i + 3];
                const isDark = imageData[i] < 245 || imageData[i + 1] < 245 || imageData[i + 2] < 245;
                if (alpha > 10 && isDark) inkPixels += 1;
              }

              if (inkPixels < canvas.width * 0.01) {
                blankRun += 1;
                if (blankRun >= requiredBlankBand) {
                  bestBreak = row + requiredBlankBand; // break at top of blank band
                  break;
                }
              } else {
                blankRun = 0;
              }
            }
          }

          if (bestBreak > 0) {
            sliceH = bestBreak;
          }
        }
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceH;
        const sliceCtx = slice.getContext("2d");
        if (!sliceCtx) throw new Error("Falha ao preparar slice.");
        sliceCtx.fillStyle = "#ffffff";
        sliceCtx.fillRect(0, 0, slice.width, slice.height);
        sliceCtx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
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
      try {
        const canvas = await renderElementToCanvas(section);
        if (!canvas || !canvas.width || !canvas.height) {
          console.warn("Seção ignorada por canvas inválido:", section.tagName);
          continue;
        }

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
      } catch (sectionErr) {
        console.error("Erro ao renderizar seção do manual:", sectionErr);
        // Continue to next section instead of failing everything
        continue;
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
