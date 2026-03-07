import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const contentType = req.headers.get("content-type") || "";

    let pdfBytes: Uint8Array | null = null;
    let fileName = "documento.pdf";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) throw new Error("Arquivo não enviado no campo 'file'");
      fileName = file.name;
      pdfBytes = new Uint8Array(await file.arrayBuffer());
    } else {
      // JSON com base64
      const body = await req.json();
      if (!body.base64 && !body.data) throw new Error("Envie o arquivo como multipart ou base64 no campo 'base64'");
      const b64 = body.base64 || body.data;
      const cleanB64 = b64.includes(",") ? b64.split(",")[1] : b64;
      const binaryStr = atob(cleanB64);
      pdfBytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        pdfBytes[i] = binaryStr.charCodeAt(i);
      }
      fileName = body.fileName || "documento.pdf";
    }

    let extractedText = "";
    const isPdf = fileName.toLowerCase().endsWith(".pdf");
    const isDocx = fileName.toLowerCase().endsWith(".docx") || fileName.toLowerCase().endsWith(".doc");

    if (isPdf) {
      extractedText = await extractPdfText(pdfBytes);
    } else if (isDocx) {
      extractedText = await extractDocxText(pdfBytes);
    } else {
      // Tentar como texto direto
      extractedText = new TextDecoder("utf-8", { fatal: false }).decode(pdfBytes);
    }

    // Limpeza e truncagem
    extractedText = cleanText(extractedText).substring(0, 30000);

    const charCount = extractedText.length;
    const wordCount = extractedText.split(/\s+/).filter(Boolean).length;

    console.log(`Extração concluída: ${charCount} chars, ${wordCount} palavras`);

    return new Response(
      JSON.stringify({
        texto: extractedText,
        chars: charCount,
        palavras: wordCount,
        qualidade: charCount > 500 ? "boa" : charCount > 100 ? "media" : "baixa",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("sst-pdf-extract error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  // Método 1: Extração estruturada via parsing manual do PDF
  const text = extractPdfTextManual(bytes);
  if (text.length > 300) {
    console.log(`PDF manual extraction: ${text.length} chars`);
    return text;
  }

  // Método 2: Tentar via pdf-parse (npm)
  try {
    // @ts-ignore
    const pdfParse = await import("npm:pdf-parse@1.1.1");
    const result = await pdfParse.default(bytes);
    console.log(`pdf-parse extraction: ${result.text.length} chars, ${result.numpages} páginas`);
    return result.text || "";
  } catch (e) {
    console.warn("pdf-parse falhou:", e);
  }

  // Método 3: Extração de strings legíveis como fallback
  return extractReadableStrings(bytes);
}

function extractPdfTextManual(bytes: Uint8Array): string {
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(bytes);
  let text = "";

  // Extrair texto de streams descomprimidos
  // Pattern: conteúdo entre stream e endstream
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let streamMatch;
  while ((streamMatch = streamRegex.exec(raw)) !== null) {
    const streamContent = streamMatch[1];
    
    // Extrair operadores Tj e TJ (texto PDF)
    const tjRegex = /\(([^)]{2,200})\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(streamContent)) !== null) {
      const t = decodePdfString(tjMatch[1]);
      if (t.trim()) text += t + " ";
    }

    // Array TJ: [(text)spacing(text)] TJ
    const arrTjRegex = /\[([^\]]{2,500})\]\s*TJ/g;
    let arrMatch;
    while ((arrMatch = arrTjRegex.exec(streamContent)) !== null) {
      const inner = arrMatch[1];
      const parts = inner.match(/\(([^)]{1,200})\)/g) || [];
      for (const p of parts) {
        const t = decodePdfString(p.slice(1, -1));
        if (t.trim()) text += t;
      }
      text += " ";
    }
  }

  // Extrair de objetos texto diretos fora de streams
  const directTj = /\(([^)]{2,200})\)\s*Tj/g;
  let dMatch;
  while ((dMatch = directTj.exec(raw)) !== null) {
    const t = decodePdfString(dMatch[1]);
    if (t.trim() && !text.includes(t)) text += t + " ";
  }

  return cleanText(text);
}

function decodePdfString(s: string): string {
  return s
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\")
    .replace(/\\([()\\])/g, "$1");
}

function extractReadableStrings(bytes: Uint8Array): string {
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(bytes);
  
  // Extrair sequências de caracteres legíveis com pelo menos 4 chars
  const matches = raw.match(/[A-Za-zÀ-ÿ0-9\s.,;:!?()[\]{}"'@#$%&*+=\-_/]{4,}/g) || [];
  
  return matches
    .filter(s => s.trim().length >= 4 && /[A-Za-zÀ-ÿ]{3,}/.test(s))
    .join(" ");
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  try {
    // DOCX é um ZIP - extrair word/document.xml
    // @ts-ignore
    const JSZip = await import("npm:jszip@3.10.1");
    const zip = await JSZip.default.loadAsync(bytes);
    const docXml = zip.file("word/document.xml");
    if (!docXml) throw new Error("document.xml não encontrado");
    
    const xmlContent = await docXml.async("string");
    
    // Remover tags XML e extrair texto
    const text = xmlContent
      .replace(/<w:br[^>]*>/g, "\n")
      .replace(/<w:p[^>]*>/g, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    
    return text;
  } catch (e) {
    console.warn("DOCX extraction falhou:", e);
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
}

function cleanText(text: string): string {
  return text
    .replace(/\x00/g, "")
    .replace(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ")
    .replace(/\s{3,}/g, "  ")
    .trim();
}
