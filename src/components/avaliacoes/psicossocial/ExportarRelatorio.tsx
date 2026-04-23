import { useState } from "react";
import { Download, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import type { CampanhaPsicossocial, IPSClassificacao } from "@/types/psicossocial";
import { calcularIPSClassificacao } from "@/types/psicossocial";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ExportarRelatorioProps {
  campanha: CampanhaPsicossocial;
  stats: {
    ips?: number;
    concluidos: number;
    total_convites: number;
    taxa_participacao: number;
    anonimato_garantido: boolean;
  } | null;
  dimensoes: { bloco: string; media: number }[];
  analiseIA?: string | null;
}

const IPS_LABELS: Record<IPSClassificacao, string> = {
  saudavel: "Ambiente Saudavel",
  estavel: "Ambiente Estavel",
  atencao: "Atencao",
  risco: "Risco Psicossocial",
  critico: "Risco Critico",
};

const IPS_COLORS: Record<IPSClassificacao, [number, number, number]> = {
  saudavel: [16, 185, 129],
  estavel: [59, 130, 246],
  atencao: [245, 158, 11],
  risco: [249, 115, 22],
  critico: [239, 68, 68],
};

// Remove accented characters for jsPDF compatibility
const sanitize = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, " ");

export function ExportarRelatorio({ campanha, stats, dimensoes, analiseIA }: ExportarRelatorioProps) {
  const [exportando, setExportando] = useState(false);

  // SIPRO grava o score em escala IRP-S (alto = pior). Convertemos para a
  // escala IPS (alto = melhor) para manter consistência com o termômetro do
  // dashboard e o ResultadosModal.
  const isSipro = campanha.instrumento === 'sipro';
  const ipsAjustado = stats?.ips !== undefined
    ? (isSipro ? 100 - stats.ips : stats.ips)
    : undefined;

  const handleExportar = async () => {
    if (!stats || !stats.anonimato_garantido) {
      toast.error("Número insuficiente de respostas para exportar.");
      return;
    }

    setExportando(true);
    try {
      const doc = new jsPDF({ format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 18;
      let y = margin;

      // --- CABECALHO ---
      doc.setFillColor(88, 28, 135);
      doc.rect(0, 0, pageW, 32, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.text("RELATORIO DE AVALIACAO PSICOSSOCIAL", margin, 14);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Seguramente - Gestao Inteligente de Riscos Psicossociais", margin, 22);
      doc.text("NR-01 | NR-17 | ISO 45001 | ISO 45003", pageW - margin, 22, { align: "right" });

      y = 44;
      doc.setTextColor(30, 30, 30);

      // --- INFO DA CAMPANHA ---
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("1. IDENTIFICACAO DA CAMPANHA", margin, y);
      y += 6;

      doc.setDrawColor(88, 28, 135);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageW - margin, y);
      y += 6;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      const formatDate = (dateStr: string) => {
        try {
          return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
        } catch {
          return dateStr || "N/D";
        }
      };

      const infoLines: [string, string][] = [
        ["Campanha:", sanitize(campanha.nome)],
        ["Instrumento:", (campanha.instrumento || "COPSOQ").toUpperCase()],
        ["Periodo:", `${formatDate(campanha.data_inicio)} - ${formatDate(campanha.data_fim)}`],
        ["Total de Convites:", String(stats.total_convites)],
        ["Respostas Coletadas:", String(stats.concluidos)],
        ["Taxa de Participacao:", `${stats.taxa_participacao.toFixed(1)}%`],
        ["Anonimato:", "Garantido - minimo estatistico atingido"],
        ["Data do Relatorio:", format(new Date(), "dd/MM/yyyy HH:mm")],
      ];

      infoLines.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.text(label, margin, y);
        doc.setFont("helvetica", "normal");
        doc.text(value, margin + 52, y);
        y += 6;
      });

      y += 4;

      // --- IPS PRINCIPAL ---
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("2. INDICE PSICOSSOCIAL ORGANIZACIONAL (IPS)", margin, y);
      y += 6;
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageW - margin, y);
      y += 6;

      if (ipsAjustado !== undefined) {
        const cls = calcularIPSClassificacao(ipsAjustado);
        const clsLabel = IPS_LABELS[cls];
        const clsColor = IPS_COLORS[cls];

        doc.setFontSize(28);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...clsColor);
        doc.text(String(ipsAjustado), margin, y + 8);

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...clsColor);
        doc.text(`/ 100 - ${clsLabel}`, margin + 18, y + 8);

        doc.setTextColor(30, 30, 30);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Escala: 0-34 Critico | 35-49 Risco | 50-64 Atencao | 65-79 Estavel | 80-100 Saudavel", margin, y + 15, { maxWidth: pageW - 2 * margin, align: "left" });

        // Barra
        const barW = pageW - 2 * margin;
        doc.setFillColor(230, 230, 230);
        doc.roundedRect(margin, y + 18, barW, 5, 1, 1, "F");
        doc.setFillColor(...clsColor);
        doc.roundedRect(margin, y + 18, (ipsAjustado / 100) * barW, 5, 1, 1, "F");

        y += 28;
      }

      y += 4;

      // --- DIMENSOES ---
      if (dimensoes.length > 0) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("3. ANALISE POR DIMENSAO PSICOSSOCIAL", margin, y);
        y += 6;
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageW - margin, y);
        y += 5;

        doc.setFontSize(8);
        // Cabecalho da tabela
        doc.setFillColor(88, 28, 135);
        doc.rect(margin, y, pageW - 2 * margin, 6, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text("Dimensao Psicossocial", margin + 2, y + 4);
        doc.text("Score", pageW - margin - 28, y + 4);
        doc.text("Classificacao", pageW - margin - 22, y + 4);
        y += 6;

        doc.setTextColor(30, 30, 30);
        dimensoes.forEach((d, i) => {
          if (y > 265) {
            doc.addPage();
            y = margin;
          }
          // SIPRO: d.media é score de risco (alto = pior). Converter para escala IPS.
          const scoreIPS = isSipro ? 100 - d.media : d.media;
          const cls = calcularIPSClassificacao(scoreIPS);
          const clsLabel = IPS_LABELS[cls];
          const clsColor = IPS_COLORS[cls];

          if (i % 2 === 0) {
            doc.setFillColor(248, 245, 255);
            doc.rect(margin, y, pageW - 2 * margin, 6, "F");
          }
          doc.setFont("helvetica", "normal");
          const blocoText = sanitize(d.bloco);
          doc.text(blocoText.length > 45 ? blocoText.slice(0, 45) + "..." : blocoText, margin + 2, y + 4);

          doc.setFont("helvetica", "bold");
          doc.setTextColor(...clsColor);
          doc.text(String(scoreIPS), pageW - margin - 30, y + 4, { align: "right" });
          doc.setFont("helvetica", "normal");
          doc.text(clsLabel, pageW - margin - 2, y + 4, { align: "right" });
          doc.setTextColor(30, 30, 30);
          y += 6;
        });
      }

      y += 8;

      // --- ANALISE IA ---
      if (analiseIA) {
        if (y > 220) { doc.addPage(); y = margin; }

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("4. INTERPRETACAO - INTELIGENCIA ARTIFICIAL", margin, y);
        y += 6;
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageW - margin, y);
        y += 5;

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        const sanitizedAnalise = sanitize(analiseIA);
        const lines = doc.splitTextToSize(sanitizedAnalise, pageW - 2 * margin);
        lines.forEach((line: string) => {
          if (y > 270) { doc.addPage(); y = margin; }
          doc.text(line, margin, y, { maxWidth: pageW - 2 * margin, align: "left" });
          y += 5;
        });
      }

      // --- RODAPE ---
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(140, 140, 140);
        const rodape = `Seguramente - Relatorio Psicossocial | ${sanitize(campanha.nome)} | Pagina ${i}/${totalPages}`;
        doc.text(rodape, pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
      }

      const nomeArquivo = `Relatorio_Psicossocial_${campanha.nome.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30)}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
      doc.save(nomeArquivo);
      toast.success("Relatório exportado com sucesso!");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar PDF. Verifique o console para detalhes.");
    } finally {
      setExportando(false);
    }
  };

  if (!stats?.anonimato_garantido) return null;

  return (
    <Button variant="outline" className="gap-2" onClick={handleExportar} disabled={exportando}>
      {exportando ? (
        <><Loader2 className="h-4 w-4 animate-spin" /> Gerando PDF...</>
      ) : (
        <><FileText className="h-4 w-4" /> Exportar Relatório PDF</>
      )}
    </Button>
  );
}
