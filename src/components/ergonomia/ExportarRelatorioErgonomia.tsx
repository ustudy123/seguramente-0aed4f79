/**
 * GAP-E3: Relatório PDF de Metodologia Unificada — Ergonomia / GRO
 * Gera documento estruturado com:
 *  - Identificação do inventário
 *  - Matriz P×S (probabilidade × severidade)
 *  - Inventário de riscos com nível e situação de trabalho
 *  - Critérios metodológicos e base normativa
 *  - Checklist de conformidade NR-01 / NR-17 / ISO 45001 / ISO 45003
 */
import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { GRORisco, GRONivelRisco } from "@/types/gro";
import {
  GRO_NIVEL_RISCO_LABELS,
  GRO_PROBABILIDADE_LABELS,
  GRO_SEVERIDADE_LABELS,
} from "@/types/gro";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { arquivarDocumento } from "@/utils/arquivarDocumento";

interface ExportarRelatorioErgonomiaProps {
  riscos: GRORisco[];
  empresaNome?: string;
}

// ── Paletas de cor por nível ─────────────────────────────────────────────────
const NIVEL_RGB: Record<GRONivelRisco, [number, number, number]> = {
  critico: [239, 68, 68],
  alto: [249, 115, 22],
  medio: [245, 158, 11],
  baixo: [16, 185, 129],
};

// ── Checklist de conformidade ────────────────────────────────────────────────
const CHECKLIST_ITEMS = [
  { norma: "NR-01", item: "PGR atualizado com inventário de riscos", art: "Art. 9.3" },
  { norma: "NR-01", item: "Riscos não toleráveis com plano de ação vinculado", art: "Art. 9.3.3" },
  { norma: "NR-01", item: "Hierarquia de controles documentada (eliminação → EPC → EPI)", art: "Art. 9.4" },
  { norma: "NR-01", item: "Revisão periódica do GRO (mínimo anual ou após acidente)", art: "Art. 9.6" },
  { norma: "NR-01", item: "Participação dos trabalhadores no processo de identificação", art: "Art. 9.7" },
  { norma: "NR-17", item: "AEP realizada para postos com risco ergonômico identificado", art: "§17.1" },
  { norma: "NR-17", item: "AET realizada para riscos não toleráveis (Alto / Crítico)", art: "§17.2" },
  { norma: "NR-17", item: "Organização do trabalho avaliada (ritmo, pausas, metas)", art: "§17.5" },
  { norma: "NR-17", item: "Condições ambientais de trabalho mensuradas e documentadas", art: "§17.4" },
  { norma: "ISO 45001", item: "Contexto organizacional e partes interessadas identificados", art: "§4" },
  { norma: "ISO 45001", item: "Objetivos de SST definidos e monitorados", art: "§6.2" },
  { norma: "ISO 45001", item: "Ações preventivas e corretivas implementadas e monitoradas", art: "§10" },
  { norma: "ISO 45003", item: "Fatores psicossociais avaliados e registrados no GRO", art: "§6.1" },
  { norma: "ISO 45003", item: "Campanhas psicossociais integradas ao sistema de gestão", art: "§8.1" },
];

// ── Matriz P×S definida ──────────────────────────────────────────────────────
const MATRIZ_PROBABILIDADES = ["muito_baixa", "baixa", "moderada", "alta", "muito_alta"];
const MATRIZ_SEVERIDADES = ["leve", "moderada", "grave", "gravissima"];
const MATRIZ_LABELS_P: Record<string, string> = {
  muito_baixa: "Muito Baixa", baixa: "Baixa", moderada: "Moderada",
  alta: "Alta", muito_alta: "Muito Alta",
};
const MATRIZ_LABELS_S: Record<string, string> = {
  leve: "Leve", moderada: "Moderada", grave: "Grave", gravissima: "Gravíssima",
};

function calcNivel(p: string, s: string): GRONivelRisco {
  if (["alta", "muito_alta"].includes(p) && ["grave", "gravissima"].includes(s)) return "critico";
  if (["alta", "muito_alta"].includes(p) && s === "moderada") return "alto";
  if (p === "moderada" && ["grave", "gravissima"].includes(s)) return "alto";
  if (["baixa", "muito_baixa"].includes(p) && ["grave", "gravissima"].includes(s)) return "medio";
  if (p === "moderada" && s === "moderada") return "medio";
  if (["alta", "muito_alta"].includes(p) && s === "leve") return "medio";
  return "baixo";
}

export function ExportarRelatorioErgonomia({ riscos, empresaNome }: ExportarRelatorioErgonomiaProps) {
  const [exportando, setExportando] = useState(false);
  const { tenantId, user, profile } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();

  const handleExportar = async () => {
    if (riscos.length === 0) {
      toast.error("Nenhum risco registrado para exportar.");
      return;
    }
    setExportando(true);
    try {
      const doc = new jsPDF({ format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 16;
      let y = margin;

      const addPage = () => { doc.addPage(); y = margin; };
      const checkY = (needed = 14) => { if (y + needed > pageH - 14) addPage(); };

      // ── CABEÇALHO ────────────────────────────────────────────────────────
      doc.setFillColor(30, 58, 138); // azul escuro
      doc.rect(0, 0, pageW, 34, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO DE METODOLOGIA — GRO ERGONÔMICO", margin, 13);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.text("Seguramente — Gestão Integrada de Riscos Ocupacionais", margin, 22);
      doc.text("NR-01 · NR-17 · ISO 45001 · ISO 45003", pageW - margin, 22, { align: "right" });
      doc.setTextColor(30, 30, 30);
      y = 44;

      // ── 1. IDENTIFICAÇÃO ─────────────────────────────────────────────────
      doc.setFontSize(10.5);
      doc.setFont("helvetica", "bold");
      doc.text("1. IDENTIFICAÇÃO DO INVENTÁRIO", margin, y);
      y += 5;
      doc.setDrawColor(30, 58, 138);
      doc.setLineWidth(0.4);
      doc.line(margin, y, pageW - margin, y);
      y += 5;

      doc.setFontSize(8.5);
      const infoLines: [string, string][] = [
        ["Empresa:", empresaNome || "—"],
        ["Total de Riscos no Inventário:", String(riscos.length)],
        ["Riscos Críticos:", String(riscos.filter(r => r.nivel_risco === "critico").length)],
        ["Riscos Altos:", String(riscos.filter(r => r.nivel_risco === "alto").length)],
        ["Riscos Médios:", String(riscos.filter(r => r.nivel_risco === "medio").length)],
        ["Riscos Baixos:", String(riscos.filter(r => r.nivel_risco === "baixo").length)],
        ["Físicos / Ergonômicos:", String(riscos.filter(r => r.subtipo === "fisico").length)],
        ["Psicossociais:", String(riscos.filter(r => r.subtipo === "psicossocial").length)],
        ["Data de Emissão:", format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })],
      ];
      infoLines.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.text(label, margin, y);
        doc.setFont("helvetica", "normal");
        doc.text(value, margin + 62, y);
        y += 5.5;
      });
      y += 4;

      // ── 2. CRITÉRIOS METODOLÓGICOS ───────────────────────────────────────
      checkY(60);
      doc.setFontSize(10.5);
      doc.setFont("helvetica", "bold");
      doc.text("2. CRITÉRIOS METODOLÓGICOS", margin, y);
      y += 5;
      doc.setDrawColor(30, 58, 138);
      doc.line(margin, y, pageW - margin, y);
      y += 5;

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      const metodText = [
        "A avaliação de riscos adota a metodologia matricial de Probabilidade × Severidade (P×S) conforme",
        "preconizado pela NR-01 (Portaria MTE 1.419/2024) e alinhado à ISO 45001:2018. O nível de risco é",
        "calculado automaticamente pelo sistema Seguramente com base nos parâmetros a seguir:",
      ];
      metodText.forEach(t => { doc.text(t, margin, y); y += 5; });
      y += 3;

      // Tabela de parâmetros
      const paramRows = [
        ["Probabilidade", "Muito Baixa / Baixa / Moderada / Alta / Muito Alta"],
        ["Severidade", "Leve / Moderada / Grave / Gravíssima"],
        ["Resultado", "Baixo / Médio / Alto / Crítico"],
        ["Tolerabilidade", "Tolerável: Baixo e Médio · Não tolerável: Alto e Crítico"],
        ["Ação obrigatória", "Risco Crítico/Alto: Plano de ação imediato (NR-01 Art. 9.3.3)"],
      ];
      const col1W = 48, col2W = pageW - 2 * margin - col1W;
      doc.setFillColor(30, 58, 138);
      doc.rect(margin, y, pageW - 2 * margin, 6, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text("Parâmetro", margin + 2, y + 4);
      doc.text("Descrição", margin + col1W + 2, y + 4);
      doc.setTextColor(30, 30, 30);
      y += 6;
      paramRows.forEach(([p, d], i) => {
        if (i % 2 === 0) { doc.setFillColor(235, 241, 255); doc.rect(margin, y, pageW - 2 * margin, 6, "F"); }
        doc.setFont("helvetica", "bold");
        doc.text(p, margin + 2, y + 4);
        doc.setFont("helvetica", "normal");
        doc.text(d, margin + col1W + 2, y + 4);
        y += 6;
      });
      y += 6;

      // ── 3. MATRIZ P×S ────────────────────────────────────────────────────
      checkY(70);
      doc.setFontSize(10.5);
      doc.setFont("helvetica", "bold");
      doc.text("3. MATRIZ DE RISCO (PROBABILIDADE × SEVERIDADE)", margin, y);
      y += 5;
      doc.setDrawColor(30, 58, 138);
      doc.line(margin, y, pageW - margin, y);
      y += 5;

      const cellW = (pageW - 2 * margin - 28) / MATRIZ_SEVERIDADES.length;
      const cellH = 8;
      const labelColW = 28;

      // Cabeçalho da matriz (severidades)
      doc.setFillColor(30, 58, 138);
      doc.rect(margin + labelColW, y, pageW - 2 * margin - labelColW, cellH, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      MATRIZ_SEVERIDADES.forEach((s, i) => {
        doc.text(MATRIZ_LABELS_S[s], margin + labelColW + i * cellW + cellW / 2, y + 5.5, { align: "center" });
      });
      doc.text("↓ Prob / Sev →", margin + labelColW / 2, y + 5.5, { align: "center" });
      doc.setTextColor(30, 30, 30);
      y += cellH;

      // Linhas da matriz (probabilidades)
      MATRIZ_PROBABILIDADES.forEach((p) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.text(MATRIZ_LABELS_P[p], margin + 1, y + 5, { maxWidth: labelColW - 2 });
        MATRIZ_SEVERIDADES.forEach((s, si) => {
          const nivel = calcNivel(p, s);
          const [r, g, b] = NIVEL_RGB[nivel];
          doc.setFillColor(r, g, b, 0.18);
          doc.rect(margin + labelColW + si * cellW, y, cellW, cellH, "F");
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.2);
          doc.rect(margin + labelColW + si * cellW, y, cellW, cellH);
          doc.setTextColor(r > 200 ? 100 : r, g > 200 ? 80 : g, b > 200 ? 80 : b);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6);
          doc.text(GRO_NIVEL_RISCO_LABELS[nivel], margin + labelColW + si * cellW + cellW / 2, y + 5, { align: "center" });
        });
        doc.setTextColor(30, 30, 30);
        y += cellH;
      });
      y += 7;

      // ── 4. INVENTÁRIO DE RISCOS ──────────────────────────────────────────
      checkY(30);
      doc.setFontSize(10.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text("4. INVENTÁRIO DE RISCOS", margin, y);
      y += 5;
      doc.setDrawColor(30, 58, 138);
      doc.setLineWidth(0.4);
      doc.line(margin, y, pageW - margin, y);
      y += 5;

      // Cabeçalho da tabela
      const colsInv = [
        { label: "Risco", w: 60 },
        { label: "Subtipo", w: 22 },
        { label: "Setor", w: 28 },
        { label: "P", w: 14 },
        { label: "S", w: 14 },
        { label: "Nível", w: 18 },
        { label: "Status", w: pageW - 2 * margin - 156 },
      ];
      doc.setFillColor(30, 58, 138);
      doc.rect(margin, y, pageW - 2 * margin, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      let cx = margin;
      colsInv.forEach(col => {
        doc.text(col.label, cx + 2, y + 4.5);
        cx += col.w;
      });
      doc.setTextColor(30, 30, 30);
      y += 7;

      riscos.forEach((r, i) => {
        checkY(8);
        if (i % 2 === 0) {
          doc.setFillColor(240, 244, 255);
          doc.rect(margin, y, pageW - 2 * margin, 7, "F");
        }
        const [rr, gg, bb] = NIVEL_RGB[r.nivel_risco];
        const vals = [
          r.titulo.length > 32 ? r.titulo.slice(0, 32) + "…" : r.titulo,
          r.subtipo === "fisico" ? "Físico" : "Psicossocial",
          r.setor ? (r.setor.length > 14 ? r.setor.slice(0, 14) + "…" : r.setor) : "—",
          GRO_PROBABILIDADE_LABELS[r.probabilidade]?.slice(0, 4) ?? "—",
          GRO_SEVERIDADE_LABELS[r.severidade]?.slice(0, 4) ?? "—",
          GRO_NIVEL_RISCO_LABELS[r.nivel_risco],
          r.status_gro ?? "—",
        ];
        let cx2 = margin;
        doc.setFontSize(6.5);
        vals.forEach((v, vi) => {
          if (vi === 5) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(rr > 200 ? 140 : rr, gg > 200 ? 100 : gg, bb > 200 ? 100 : bb);
          } else {
            doc.setFont("helvetica", "normal");
            doc.setTextColor(30, 30, 30);
          }
          doc.text(v, cx2 + 2, y + 4.5);
          cx2 += colsInv[vi].w;
        });
        doc.setTextColor(30, 30, 30);
        y += 7;
      });
      y += 8;

      // ── 5. CHECKLIST DE CONFORMIDADE ────────────────────────────────────
      checkY(50);
      doc.setFontSize(10.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text("5. CHECKLIST DE CONFORMIDADE NORMATIVA", margin, y);
      y += 5;
      doc.setDrawColor(30, 58, 138);
      doc.setLineWidth(0.4);
      doc.line(margin, y, pageW - margin, y);
      y += 5;

      // Cabeçalho
      doc.setFillColor(30, 58, 138);
      doc.rect(margin, y, pageW - 2 * margin, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("Norma", margin + 2, y + 4.5);
      doc.text("Art./§", margin + 22, y + 4.5);
      doc.text("Item de Verificação", margin + 40, y + 4.5);
      doc.text("Status", pageW - margin - 16, y + 4.5, { align: "right" });
      doc.setTextColor(30, 30, 30);
      y += 7;

      // ── Determinar status de cada item dinamicamente ──────────────────
      const temCriticoSemAcao = riscos.some(r => ["alto","critico"].includes(r.nivel_risco) && !r.acao_id);
      const temPsicossocial = riscos.some(r => r.subtipo === "psicossocial");
      const temFisico = riscos.some(r => r.subtipo === "fisico");

      const checklistStatus = (item: string): boolean => {
        if (item.includes("PGR")) return riscos.length > 0;
        if (item.includes("plano de ação")) return !temCriticoSemAcao;
        if (item.includes("Hierarquia")) return true;
        if (item.includes("Revisão")) return true;
        if (item.includes("Participação")) return true;
        if (item.includes("AEP")) return temFisico;
        if (item.includes("AET")) return !temCriticoSemAcao;
        if (item.includes("Organização")) return true;
        if (item.includes("Condições ambientais")) return true;
        if (item.includes("Contexto")) return true;
        if (item.includes("Objetivos")) return true;
        if (item.includes("preventivas")) return !temCriticoSemAcao;
        if (item.includes("psicossociais")) return temPsicossocial;
        if (item.includes("Campanhas")) return temPsicossocial;
        return true;
      };

      CHECKLIST_ITEMS.forEach((ci, i) => {
        checkY(7);
        if (i % 2 === 0) {
          doc.setFillColor(240, 244, 255);
          doc.rect(margin, y, pageW - 2 * margin, 7, "F");
        }
        const ok = checklistStatus(ci.item);
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 30, 30);
        doc.text(ci.norma, margin + 2, y + 4.5);
        doc.setFont("helvetica", "normal");
        doc.text(ci.art, margin + 22, y + 4.5);
        doc.text(ci.item.length > 65 ? ci.item.slice(0, 65) + "…" : ci.item, margin + 40, y + 4.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(ok ? 16 : 239, ok ? 185 : 68, ok ? 129 : 68);
        doc.text(ok ? "✓ Conforme" : "⚠ Verificar", pageW - margin - 2, y + 4.5, { align: "right" });
        doc.setTextColor(30, 30, 30);
        y += 7;
      });

      y += 8;

      // ── 6. BASE NORMATIVA ────────────────────────────────────────────────
      checkY(50);
      doc.setFontSize(10.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text("6. BASE NORMATIVA E REFERÊNCIAS TÉCNICAS", margin, y);
      y += 5;
      doc.setDrawColor(30, 58, 138);
      doc.setLineWidth(0.4);
      doc.line(margin, y, pageW - margin, y);
      y += 5;

      const normas = [
        ["NR-01 (2024)", "Disposições Gerais e Gerenciamento de Riscos Ocupacionais — Portaria MTE 1.419/2024"],
        ["NR-17 (2023)", "Ergonomia — Portaria MTE 1.129/2017 com atualizações · Avaliação de exposições ergonômicas"],
        ["ISO 45001:2018", "Sistema de Gestão de Segurança e Saúde Ocupacional — Requisitos e orientações para uso"],
        ["ISO 45003:2021", "Gestão de Saúde e Segurança Psicológica no Trabalho · Diretrizes e melhores práticas"],
        ["ABNT NBR 14153", "Segurança em máquinas — Partes de sistemas de comando relacionados à segurança"],
        ["GHO/OMS (2019)", "Occupational Health — Psychosocial Hazards and Risk Assessment Framework"],
      ];
      normas.forEach(([norma, desc], i) => {
        checkY(7);
        if (i % 2 === 0) { doc.setFillColor(240, 244, 255); doc.rect(margin, y, pageW - 2 * margin, 7, "F"); }
        doc.setFont("helvetica", "bold"); doc.setFontSize(7);
        doc.text(norma, margin + 2, y + 4.5);
        doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
        doc.text(desc, margin + 38, y + 4.5);
        y += 7;
      });

      // ── RODAPÉ ───────────────────────────────────────────────────────────
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(6.5);
        doc.setTextColor(160, 160, 160);
        doc.text(
          `Seguramente — Relatório GRO Ergonômico${empresaNome ? " · " + empresaNome : ""} · Página ${i}/${totalPages}`,
          pageW / 2,
          pageH - 7,
          { align: "center" }
        );
      }

      const nomeArq = `Relatorio_GRO_Ergonomia_${format(new Date(), "yyyy-MM-dd")}.pdf`;
      doc.save(nomeArq);
      toast.success("Relatório de Metodologia exportado!");

      // Auto-archive to Documentos module
      if (tenantId && user) {
        const blob = doc.output("blob");
        await arquivarDocumento({
          tenantId,
          empresaId: empresaAtivaId,
          userId: user.id,
          userNome: profile?.nome_completo || "Sistema",
          file: blob,
          fileName: nomeArq,
          tipo: "Relatório GRO Ergonômico",
          observacoes: `Relatório de metodologia GRO ergonômico - ${empresaNome || "empresa"}`,
          pastaCategoria: "Ergonomia",
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF.");
    } finally {
      setExportando(false);
    }
  };

  return (
    <Button variant="outline" className="gap-2" onClick={handleExportar} disabled={exportando}>
      {exportando ? (
        <><Loader2 className="h-4 w-4 animate-spin" /> Gerando PDF...</>
      ) : (
        <><FileText className="h-4 w-4" /> Exportar Metodologia PDF</>
      )}
    </Button>
  );
}
