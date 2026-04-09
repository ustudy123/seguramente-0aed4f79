import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { PopData } from "@/hooks/usePopAtividade";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ExportarTodosPopsPdfProps {
  pops: PopData[];
  funcaoNome?: string;
}

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  publicado: "Publicado",
  desatualizado: "Desatualizado",
};

const PAGE_W = 210;
const PAGE_H = 297;
const M_LEFT = 20;
const M_RIGHT = 20;
const M_TOP = 22;
const M_BOTTOM = 20;
const CW = PAGE_W - M_LEFT - M_RIGHT;

/** Strip emojis and non-latin1 symbols that jsPDF can't render */
function cleanStr(s: string): string {
  return (s || "")
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

class PopPdfBuilder {
  doc: jsPDF;
  y = M_TOP;

  constructor() {
    this.doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  }

  private ensureSpace(h: number) {
    if (this.y + h > PAGE_H - M_BOTTOM) {
      this.doc.addPage();
      this.y = M_TOP;
    }
  }

  gap(mm: number) {
    this.y += mm;
  }

  hLine(r = 37, g = 99, b = 235, width = 0.4) {
    this.ensureSpace(3);
    this.doc.setDrawColor(r, g, b);
    this.doc.setLineWidth(width);
    this.doc.line(M_LEFT, this.y, PAGE_W - M_RIGHT, this.y);
    this.y += 3;
  }

  /** Render wrapped text with proper line height */
  text(
    txt: string,
    size: number,
    opts?: {
      bold?: boolean;
      italic?: boolean;
      color?: [number, number, number];
      indent?: number;
      align?: "left" | "center";
      lineH?: number;
    }
  ) {
    const {
      bold = false,
      italic = false,
      color = [40, 40, 40],
      indent = 0,
      align = "left",
      lineH,
    } = opts || {};

    const clean = cleanStr(txt);
    if (!clean) return;

    const style = bold && italic ? "bolditalic" : bold ? "bold" : italic ? "italic" : "normal";
    this.doc.setFont("helvetica", style);
    this.doc.setFontSize(size);
    this.doc.setTextColor(color[0], color[1], color[2]);

    const effectiveW = CW - indent;
    const lines: string[] = this.doc.splitTextToSize(clean, effectiveW);
    const lh = lineH ?? size * 0.45 + 0.8;

    for (const line of lines) {
      this.ensureSpace(lh + 1);
      if (align === "center") {
        this.doc.text(line, PAGE_W / 2, this.y, { align: "center" });
      } else {
        this.doc.text(line, M_LEFT + indent, this.y);
      }
      this.y += lh;
    }
  }

  /** Section heading with colored left bar */
  sectionTitle(title: string) {
    this.ensureSpace(14);
    this.gap(3);
    // Blue left bar
    this.doc.setFillColor(37, 99, 235);
    this.doc.rect(M_LEFT, this.y - 3.5, 1.2, 5, "F");
    this.text(title, 11, { bold: true, color: [26, 54, 93], indent: 4 });
    this.gap(1.5);
  }

  /** Section with title + body text */
  section(title: string, content: string | null | undefined) {
    if (!content?.trim()) return;
    this.sectionTitle(title);
    this.text(content, 9.5, { indent: 2, color: [50, 50, 50] });
    this.gap(3);
  }

  /** Section with title + bullet list */
  listSection(title: string, items: string[] | null | undefined) {
    if (!items?.length) return;
    this.sectionTitle(title);
    for (const item of items) {
      this.ensureSpace(8);
      this.text(`\u2022  ${item}`, 9.5, { indent: 5, color: [50, 50, 50] });
      this.gap(0.5);
    }
    this.gap(2);
  }

  /** Rounded-rect info box */
  infoBox(label: string, value: string, x: number, w: number) {
    this.doc.setFillColor(245, 247, 250);
    this.doc.roundedRect(x, this.y - 3.5, w, 6.5, 1.5, 1.5, "F");
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(7.5);
    this.doc.setTextColor(30, 64, 175);
    this.doc.text(label, x + 2, this.y);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(60, 60, 60);
    this.doc.text(cleanStr(value), x + 2 + this.doc.getTextWidth(label) + 1.5, this.y);
  }

  /** Step box with number badge */
  stepBox(numero: number, descricao: string, tempo?: string, atencao?: string) {
    const totalH = 10 + (atencao ? 8 : 0);
    this.ensureSpace(totalH);

    // Light blue background
    const boxY = this.y - 1;
    this.doc.setFillColor(240, 247, 255);
    // We'll draw after measuring text height
    const stepLabel = `Passo ${numero}`;
    let bodyText = cleanStr(descricao);
    if (tempo) bodyText += `  (${cleanStr(tempo)})`;

    const lines = this.doc.splitTextToSize(bodyText, CW - 22);
    const textH = lines.length * 4.5 + 3;
    const boxH = textH + (atencao ? 9 : 2);

    this.doc.roundedRect(M_LEFT, boxY, CW, boxH, 1.5, 1.5, "F");

    // Number badge
    this.doc.setFillColor(37, 99, 235);
    this.doc.roundedRect(M_LEFT + 2, this.y - 0.5, 14, 5, 1, 1, "F");
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8);
    this.doc.setTextColor(255, 255, 255);
    this.doc.text(stepLabel, M_LEFT + 9, this.y + 2.8, { align: "center" });

    // Description text
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(40, 40, 40);
    let ty = this.y + 0.5;
    for (const line of lines) {
      this.doc.text(line, M_LEFT + 19, ty);
      ty += 4.5;
    }
    this.y = ty;

    // Attention box
    if (atencao) {
      this.gap(0.5);
      const atY = this.y - 1;
      this.doc.setFillColor(254, 243, 199);
      this.doc.roundedRect(M_LEFT + 18, atY, CW - 20, 7, 1, 1, "F");
      this.doc.setFont("helvetica", "italic");
      this.doc.setFontSize(8);
      this.doc.setTextColor(146, 100, 10);
      const atLines = this.doc.splitTextToSize(`Atencao: ${cleanStr(atencao)}`, CW - 25);
      this.doc.text(atLines[0], M_LEFT + 20, this.y + 2);
      this.y += 7;
    }

    this.y = boxY + boxH + 2.5;
  }

  addPageNumbers() {
    const total = this.doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      this.doc.setPage(i);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7.5);
      this.doc.setTextColor(160, 160, 160);
      this.doc.text(
        `Pagina ${i} / ${total}`,
        PAGE_W - M_RIGHT,
        PAGE_H - 8,
        { align: "right" }
      );
    }
  }
}

function buildAllPopsPdf(pops: PopData[], funcaoNome?: string): jsPDF {
  const b = new PopPdfBuilder();
  const now = new Date();
  const dateStr = format(now, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  // ─── COVER PAGE ───
  b.gap(50);
  b.text("Procedimentos Operacionais Padrao", 22, {
    bold: true,
    color: [26, 54, 93],
    align: "center",
  });
  b.gap(6);
  b.text(funcaoNome || "Funcao", 16, {
    bold: true,
    color: [37, 99, 235],
    align: "center",
  });
  b.gap(8);
  b.hLine(200, 200, 200, 0.3);
  b.gap(3);
  b.text(
    `${pops.length} POP${pops.length !== 1 ? "s" : ""}  -  Gerado em ${dateStr}`,
    9,
    { color: [130, 130, 130], align: "center" }
  );
  b.gap(20);

  // ─── INDEX ───
  b.doc.setFillColor(245, 247, 250);
  b.doc.roundedRect(M_LEFT, b.y - 2, CW, 10 + pops.length * 6.5, 2, 2, "F");
  b.text("Indice", 12, { bold: true, color: [26, 54, 93], indent: 4 });
  b.gap(3);
  for (let i = 0; i < pops.length; i++) {
    b.ensureSpace(7);
    b.text(`${i + 1}.  ${pops[i].codigo} - ${cleanStr(pops[i].titulo)}`, 9.5, {
      indent: 6,
      color: [60, 60, 60],
    });
    b.gap(1);
  }

  // ─── EACH POP ───
  for (const pop of pops) {
    b.doc.addPage();
    b.y = M_TOP;

    // Title
    b.text(`${pop.codigo} - ${cleanStr(pop.titulo)}`, 15, {
      bold: true,
      color: [26, 54, 93],
    });
    b.gap(1);
    b.hLine(37, 99, 235, 0.6);
    b.gap(2);

    // Metadata row
    const createdDate = format(new Date(pop.created_at), "dd/MM/yyyy", { locale: ptBR });
    const halfW = CW / 2 - 1;
    b.infoBox("Versao: ", pop.versao_atual || "1.0", M_LEFT, halfW);
    b.infoBox("Status: ", STATUS_LABELS[pop.status] || pop.status, M_LEFT + halfW + 2, halfW);
    b.y += 5;
    b.infoBox("Criado por: ", pop.criado_por_nome || "-", M_LEFT, halfW);
    b.infoBox("Data: ", createdDate, M_LEFT + halfW + 2, halfW);
    if (pop.gerado_por_ia) {
      b.y += 5;
      b.infoBox("Origem: ", "Gerado por IA", M_LEFT, halfW);
    }
    b.y += 5;
    b.gap(4);

    // Content sections
    b.section("1. Objetivo", pop.objetivo);
    b.section("2. Escopo", pop.escopo);

    // Responsibilities
    const resp = (pop.responsabilidades || {}) as Record<string, string>;
    if (resp.executante || resp.supervisao || resp.interfaces) {
      b.sectionTitle("3. Responsabilidades");
      if (resp.executante) {
        b.text(`\u2022  Executante: ${resp.executante}`, 9.5, { indent: 5, color: [50, 50, 50] });
        b.gap(0.5);
      }
      if (resp.supervisao) {
        b.text(`\u2022  Supervisao: ${resp.supervisao}`, 9.5, { indent: 5, color: [50, 50, 50] });
        b.gap(0.5);
      }
      if (resp.interfaces) {
        b.text(`\u2022  Interfaces: ${resp.interfaces}`, 9.5, { indent: 5, color: [50, 50, 50] });
        b.gap(0.5);
      }
      b.gap(3);
    }

    b.section("4. Definicoes", pop.definicoes);
    b.listSection("5. Pre-requisitos", pop.pre_requisitos);
    b.listSection("6. Materiais, Ferramentas e Sistemas", pop.materiais_ferramentas);
    b.section("7. EPIs / Requisitos de SST", pop.epis_sst);

    // Steps
    const passos = pop.procedimento_passos || [];
    if (passos.length > 0) {
      b.sectionTitle("8. Procedimento Passo a Passo");
      b.gap(1);
      for (const p of passos) {
        b.stepBox(p.numero, p.descricao, p.tempo_estimado, p.ponto_atencao);
      }
      b.gap(2);
    }

    b.section("9. Criterios de Qualidade", pop.criterios_qualidade);
    b.section("10. Registros e Evidencias", pop.registros_evidencias);
    b.section("11. Tratamento de Nao Conformidades", pop.tratamento_nao_conformidades);
    b.section("12. Referencias", pop.referencias);
  }

  // Footer on every page
  b.addPageNumbers();

  return b.doc;
}

function sanitizeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function ExportarTodosPopsPdf({ pops, funcaoNome }: ExportarTodosPopsPdfProps) {
  const [loading, setLoading] = useState(false);

  if (pops.length === 0) return null;

  const handleExport = async () => {
    setLoading(true);
    try {
      const pdf = buildAllPopsPdf(pops, funcaoNome);
      const filename = `${sanitizeFilename(`pops-${funcaoNome || "funcao"}`) || "pops"}-${Date.now()}.pdf`;
      pdf.save(filename);
      toast.success(`PDF com ${pops.length} POP${pops.length !== 1 ? "s" : ""} exportado!`);
    } catch (err: any) {
      console.error("Erro ao exportar POPs:", err);
      toast.error("Erro ao gerar o PDF. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" className="gap-1" onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {loading ? "Gerando PDF..." : `Baixar Todos POPs (${pops.length})`}
    </Button>
  );
}
