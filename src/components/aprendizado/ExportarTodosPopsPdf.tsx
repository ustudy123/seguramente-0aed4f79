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

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 5.5;
const FONT_SIZE_BODY = 10;
const FONT_SIZE_H1 = 16;
const FONT_SIZE_H2 = 12;
const FONT_SIZE_SMALL = 8;

function sanitizeText(str: string): string {
  return str
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

class PdfBuilder {
  pdf: jsPDF;
  y: number = MARGIN;
  pageNum: number = 1;

  constructor() {
    this.pdf = new jsPDF("p", "mm", "a4");
  }

  checkSpace(needed: number) {
    if (this.y + needed > PAGE_HEIGHT - MARGIN) {
      this.pdf.addPage();
      this.pageNum++;
      this.y = MARGIN;
    }
  }

  addText(text: string, fontSize: number, options?: { bold?: boolean; color?: [number, number, number]; indent?: number; maxWidth?: number; align?: "left" | "center" | "justify" }) {
    const { bold = false, color = [51, 51, 51], indent = 0, maxWidth = CONTENT_WIDTH, align = "left" } = options || {};
    this.pdf.setFontSize(fontSize);
    this.pdf.setFont("helvetica", bold ? "bold" : "normal");
    this.pdf.setTextColor(color[0], color[1], color[2]);

    const effectiveWidth = maxWidth - indent;
    const lines = this.pdf.splitTextToSize(sanitizeText(text), effectiveWidth);

    for (const line of lines) {
      this.checkSpace(fontSize * 0.4 + 1);
      if (align === "center") {
        this.pdf.text(line, PAGE_WIDTH / 2, this.y, { align: "center" });
      } else {
        this.pdf.text(line, MARGIN + indent, this.y);
      }
      this.y += fontSize * 0.4 + 1;
    }
  }

  addGap(mm: number) {
    this.y += mm;
  }

  addLine(color: [number, number, number] = [37, 99, 235]) {
    this.checkSpace(2);
    this.pdf.setDrawColor(color[0], color[1], color[2]);
    this.pdf.setLineWidth(0.5);
    this.pdf.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y);
    this.y += 3;
  }

  addSection(title: string, content: string) {
    if (!content?.trim()) return;
    this.checkSpace(15);
    this.addText(title, FONT_SIZE_H2, { bold: true, color: [30, 64, 175] });
    this.addGap(1);
    this.addText(content, FONT_SIZE_BODY);
    this.addGap(3);
  }

  addListSection(title: string, items: string[]) {
    if (!items?.length) return;
    this.checkSpace(15);
    this.addText(title, FONT_SIZE_H2, { bold: true, color: [30, 64, 175] });
    this.addGap(1);
    for (const item of items) {
      this.checkSpace(LINE_HEIGHT + 2);
      this.addText(`• ${item}`, FONT_SIZE_BODY, { indent: 3 });
    }
    this.addGap(3);
  }

  addNumberedPages() {
    const total = this.pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      this.pdf.setPage(i);
      this.pdf.setFontSize(8);
      this.pdf.setTextColor(140);
      this.pdf.text(`Página ${i}/${total}`, PAGE_WIDTH - 28, PAGE_HEIGHT - 5);
    }
  }
}

function buildAllPopsPdf(pops: PopData[], funcaoNome?: string): jsPDF {
  const builder = new PdfBuilder();
  const now = new Date();
  const dateStr = format(now, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  // Cover
  builder.addGap(40);
  builder.addText("Procedimentos Operacionais Padrão", FONT_SIZE_H1 + 4, { bold: true, color: [26, 54, 93], align: "center" });
  builder.addGap(4);
  builder.addText(funcaoNome || "Função", FONT_SIZE_H1, { bold: true, color: [30, 64, 175], align: "center" });
  builder.addGap(6);
  builder.addLine();
  builder.addGap(2);
  builder.addText(`${pops.length} POP${pops.length !== 1 ? "s" : ""} • Gerado em ${dateStr}`, FONT_SIZE_SMALL + 1, { color: [107, 114, 128], align: "center" });
  builder.addGap(10);

  // Index
  builder.addText("Índice", FONT_SIZE_H2 + 1, { bold: true, color: [26, 54, 93] });
  builder.addGap(3);
  for (let i = 0; i < pops.length; i++) {
    builder.checkSpace(LINE_HEIGHT + 2);
    builder.addText(`${i + 1}. ${pops[i].codigo} — ${pops[i].titulo}`, FONT_SIZE_BODY, { indent: 3 });
  }

  // Each POP
  for (const pop of pops) {
    builder.pdf.addPage();
    builder.pageNum++;
    builder.y = MARGIN;

    builder.addText(`${pop.codigo} — ${pop.titulo}`, FONT_SIZE_H1, { bold: true, color: [26, 54, 93] });
    builder.addLine();
    builder.addGap(2);

    // Metadata
    const meta = [
      `Versão: ${pop.versao_atual}`,
      `Status: ${STATUS_LABELS[pop.status] || pop.status}`,
      `Criado por: ${pop.criado_por_nome || "—"}`,
      `Criado em: ${format(new Date(pop.created_at), "dd/MM/yyyy", { locale: ptBR })}`,
      ...(pop.gerado_por_ia ? ["🤖 Gerado por IA"] : []),
    ];
    for (const m of meta) {
      builder.addText(m, FONT_SIZE_SMALL + 1, { color: [75, 85, 99] });
    }
    builder.addGap(4);

    // Sections
    builder.addSection("1. Objetivo", pop.objetivo || "");
    builder.addSection("2. Escopo", pop.escopo || "");

    // Responsibilities
    const resp = (pop.responsabilidades || {}) as any;
    if (resp.executante || resp.supervisao || resp.interfaces) {
      builder.addText("3. Responsabilidades", FONT_SIZE_H2, { bold: true, color: [30, 64, 175] });
      builder.addGap(1);
      if (resp.executante) builder.addText(`• Executante: ${resp.executante}`, FONT_SIZE_BODY, { indent: 3 });
      if (resp.supervisao) builder.addText(`• Supervisão: ${resp.supervisao}`, FONT_SIZE_BODY, { indent: 3 });
      if (resp.interfaces) builder.addText(`• Interfaces: ${resp.interfaces}`, FONT_SIZE_BODY, { indent: 3 });
      builder.addGap(3);
    }

    builder.addSection("4. Definições", pop.definicoes || "");
    builder.addListSection("5. Pré-requisitos", pop.pre_requisitos || []);
    builder.addListSection("6. Materiais, Ferramentas e Sistemas", pop.materiais_ferramentas || []);
    builder.addSection("7. EPIs / Requisitos de SST", pop.epis_sst || "");

    // Steps
    const passos = pop.procedimento_passos || [];
    if (passos.length > 0) {
      builder.addText("8. Procedimento Passo a Passo", FONT_SIZE_H2, { bold: true, color: [30, 64, 175] });
      builder.addGap(2);
      for (const p of passos) {
        builder.checkSpace(12);
        let stepText = `Passo ${p.numero}: ${p.descricao}`;
        if (p.tempo_estimado) stepText += ` (${p.tempo_estimado})`;
        builder.addText(stepText, FONT_SIZE_BODY, { indent: 3 });
        if (p.ponto_atencao) {
          builder.addText(`⚠️ ${p.ponto_atencao}`, FONT_SIZE_SMALL + 1, { indent: 8, color: [180, 120, 0] });
        }
        builder.addGap(1);
      }
      builder.addGap(2);
    }

    builder.addSection("9. Critérios de Qualidade", pop.criterios_qualidade || "");
    builder.addSection("10. Registros e Evidências", pop.registros_evidencias || "");
    builder.addSection("11. Tratamento de Não Conformidades", pop.tratamento_nao_conformidades || "");
    builder.addSection("12. Referências", pop.referencias || "");
  }

  // Footer
  builder.addNumberedPages();
  return builder.pdf;
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
