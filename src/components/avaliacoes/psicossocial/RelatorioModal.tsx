/**
 * RelatorioModal — GAP 4: Geração de documentos estruturados
 * Gera relatório psicossocial completo + seção de metodologia exportável (PDF)
 * Conformidade: NR-01, NR-17, ISO 45003, COPSOQ III
 */
import { useState, useMemo } from "react";
import { FileText, Download, Loader2, X, Shield, BookOpen, AlertTriangle, CheckCircle2, Info, Quote } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { CampanhaPsicossocial, RadarDimensao } from "@/types/psicossocial";
import { calcularIPSClassificacao, getIPSLabel } from "@/types/psicossocial";
import { scoreToProbabilidade, scoreToSeveridade, calcularNivelGRO, GRO_NIVEL_RISCO_LABELS } from "@/types/gro";
import { useAuthContext } from "@/contexts/AuthContext";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { arquivarDocumento } from "@/utils/arquivarDocumento";
import { useEvidenciasEntrevista } from "@/hooks/useEvidenciasEntrevista";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MINIMO_ANONIMATO = 5;

interface RelatorioModalProps {
  open: boolean;
  onClose: () => void;
  campanhas: CampanhaPsicossocial[];
  empresaNome?: string;
}

const NIVEL_BADGE: Record<string, string> = {
  critico: "bg-red-50 text-red-700 border-red-200",
  alto: "bg-orange-50 text-orange-700 border-orange-200",
  medio: "bg-amber-50 text-amber-700 border-amber-200",
  baixo: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function RelatorioModal({ open, onClose, campanhas, empresaNome }: RelatorioModalProps) {
  const [exportando, setExportando] = useState(false);
  const { tenantId, user, profile } = useAuthContext();
  const { empresaAtivaId } = useEmpresaAtiva();

  // Campanhas de entrevista guiada (qualitativas) — todas elegíveis
  const campanhasEntrevista = useMemo(
    () => campanhas.filter((c: any) => c.tipo_instrumento === "entrevista_guiada"),
    [campanhas],
  );
  const campanhaEntrevistaIds = useMemo(
    () => campanhasEntrevista.map((c) => c.id),
    [campanhasEntrevista],
  );
  const { data: evidenciasQualitativas = [] } = useEvidenciasEntrevista(campanhaEntrevistaIds);

  const campanhasValidas = campanhas.filter(c =>
    c.ips_score != null &&
    (c.total_respostas || 0) >= MINIMO_ANONIMATO &&
    Array.isArray(c.radar_data) && c.radar_data.length > 0
  );

  const temEvidenciasQualitativas = evidenciasQualitativas.length > 0;
  const podeExportar = campanhasValidas.length > 0 || temEvidenciasQualitativas;

  const campanha = campanhasValidas[0] ?? campanhasEntrevista[0];
  const isSipro = campanha?.instrumento === 'sipro';
  const isEntrevistaOnly = !campanhasValidas.length && temEvidenciasQualitativas;
  const totalRespondentes = campanhasValidas.reduce((s, c) => s + (c.total_respostas ?? 0), 0);
  const rawScore = campanha?.ips_score ?? 0;
  const ipsScore = isSipro ? 100 - rawScore : rawScore;
  const ipsClass = calcularIPSClassificacao(ipsScore);
  const radar = (campanha?.radar_data ?? []) as RadarDimensao[];

  const dimensoesAvaliadas = radar.map(d => {
    const risco = isSipro ? d.value : 100 - d.value;
    const prob = scoreToProbabilidade(d.value, isSipro);
    const sev = scoreToSeveridade(d.value, isSipro);
    const nivel = calcularNivelGRO(prob, sev);
    return { ...d, risco, nivel };
  }).sort((a, b) => b.risco - a.risco);

  const criticos = dimensoesAvaliadas.filter(d => d.nivel === 'critico');
  const altos = dimensoesAvaliadas.filter(d => d.nivel === 'alto');
  const medios = dimensoesAvaliadas.filter(d => d.nivel === 'medio');
  const baixos = dimensoesAvaliadas.filter(d => d.nivel === 'baixo');

  const dataGeracao = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const handleExportarPDF = async () => {
    if (!podeExportar || !campanha) return;
    setExportando(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      let y = 20;

      // ── Cabeçalho ──────────────────────────────────────────────────────
      doc.setFillColor(88, 28, 135);
      doc.rect(0, 0, pageW, 40, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO DE DIAGNÓSTICO PSICOSSOCIAL", pageW / 2, 16, { align: "center" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("NR-01 · NR-17 · ISO 45003 · COPSOQ III", pageW / 2, 24, { align: "center" });
      doc.text(`Emitido em: ${dataGeracao} | Empresa: ${empresaNome ?? "N/D"}`, pageW / 2, 31, { align: "center" });

      y = 52;
      doc.setTextColor(0, 0, 0);

      // ── 1. Identificação ───────────────────────────────────────────────
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("1. IDENTIFICAÇÃO DA AVALIAÇÃO", 14, y);
      y += 6;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const identificacao = [
        ["Campanha", campanha.nome],
        ["Instrumento", isSipro ? "SIPRO — Índice YourEyes de Risco Psicossocial Organizacional" : (campanha.instrumento?.toUpperCase() ?? "N/D")],
        ["Período", `${campanha.data_inicio ?? "?"} a ${campanha.data_fim ?? "atual"}`],
        ["Total de Respondentes", String(campanha.total_respostas ?? 0)],
        ["Empresas Avaliadas", empresaNome ?? "N/D"],
        ["Data de Emissão", dataGeracao],
        ["IPS Global", `${ipsScore}/100 — ${getIPSLabel(ipsClass)}`],
      ];
      autoTable(doc, {
        startY: y,
        head: [["Campo", "Informação"]],
        body: identificacao,
        headStyles: { fillColor: [88, 28, 135], fontSize: 8, textColor: 255 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 } },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // ── 2. Síntese Executiva ───────────────────────────────────────────
      if (!isEntrevistaOnly) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("2. SÍNTESE EXECUTIVA", 14, y);
        y += 5;
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        const sintese = [
          [`${criticos.length} dimensão(ões) em nível CRÍTICO — Intervenção imediata necessária (prazo ≤ 30 dias)`],
          [`${altos.length} dimensão(ões) em nível ALTO — Ação preventiva prioritária (prazo ≤ 60 dias)`],
          [`${medios.length} dimensão(ões) em nível MÉDIO — Monitoramento e melhorias contínuas (prazo ≤ 90 dias)`],
          [`${baixos.length} dimensão(ões) em nível BAIXO — Manter vigilância (prazo ≤ 180 dias)`],
        ];
        autoTable(doc, {
          startY: y,
          body: sintese,
          headStyles: { fillColor: [88, 28, 135], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          didParseCell: (data) => {
            const text = String(data.cell.raw);
            if (text.includes("CRÍTICO")) data.cell.styles.textColor = [185, 28, 28];
            else if (text.includes("ALTO")) data.cell.styles.textColor = [194, 65, 12];
            else if (text.includes("MÉDIO")) data.cell.styles.textColor = [180, 83, 9];
            else data.cell.styles.textColor = [5, 122, 85];
          },
        });
        y = (doc as any).lastAutoTable.finalY + 10;

        // ── 3. Inventário de Riscos ────────────────────────────────────────
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("3. INVENTÁRIO DE FATORES DE RISCO PSICOSSOCIAL", 14, y);
        y += 5;
        autoTable(doc, {
          startY: y,
          head: [["Dimensão", "Score Risco", "Nível GRO", "Base Normativa"]],
          body: dimensoesAvaliadas.map(d => [
            d.subject,
            `${d.risco}%`,
            GRO_NIVEL_RISCO_LABELS[d.nivel],
            "NR-01 / NR-17 / ISO 45003",
          ]),
          headStyles: { fillColor: [88, 28, 135], fontSize: 8, textColor: 255 },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [248, 245, 255] },
          didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 2) {
              const v = String(data.cell.raw);
              if (v.includes("Crítico")) data.cell.styles.textColor = [185, 28, 28];
              else if (v.includes("Alto")) data.cell.styles.textColor = [194, 65, 12];
              else if (v.includes("Médio")) data.cell.styles.textColor = [180, 83, 9];
              else data.cell.styles.textColor = [5, 122, 85];
            }
          },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // ── 4. Metodologia ────────────────────────────────────────────────
      doc.addPage();
      y = 20;
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("4. METODOLOGIA E CRITÉRIOS DE AVALIAÇÃO", 14, y);
      y += 8;

      const metodologiaBlocks = [
        {
          titulo: "4.1 Instrumento Utilizado",
          corpo: isSipro
            ? "SIPRO — Indice YourEyes de Risco Psicossocial Organizacional. Instrumento autoral desenvolvido com base nos modelos COPSOQ III, HSE e PROART, adaptado ao contexto brasileiro. Integrado nativamente com GRO, Planos de Acao, Motor AET e indicadores da plataforma YourEyes, proporcionando avaliacao mais assertiva do que questionarios isolados. Score calculado por dimensao em escala 0-100, onde score alto indica maior risco. Atende aos requisitos da NR-01."
            : `${campanha.instrumento?.toUpperCase()} — Instrumento internacional de avaliação de riscos psicossociais. Escala Likert 0-4, onde score alto indica melhor condição (modelo protetivo), com inversão para cálculo de risco.`,
        },
        {
          titulo: "4.2 Cálculo do IPS (Índice Psicossocial YourEyes)",
          corpo: "O IPS é calculado como média ponderada pelo número de respondentes em cada campanha ativa. Classificação: ≥80 = Saudável; 65-79 = Estável; 50-64 = Atenção; 35-49 = Risco; <35 = Crítico. Mínimo de 5 respondentes exigido para garantir confidencialidade (ISO 45003 §6.1.2).",
        },
        {
          titulo: "4.3 Conversão para Nível GRO (NR-01)",
          corpo: "Cada dimensão psicossocial é convertida para perigo ocupacional via matriz P×S:\n• Score ≥75: Probabilidade Muito Alta + Severidade Grave → Risco CRÍTICO\n• Score 55-74: Probabilidade Alta + Severidade Moderada → Risco ALTO\n• Score 35-54: Probabilidade Moderada + Severidade Moderada → Risco MÉDIO\n• Score <35: Probabilidade Baixa + Severidade Leve → Risco BAIXO",
        },
        {
          titulo: "4.4 Confidencialidade e Anonimato (ISO 45003 + COPSOQ III)",
          corpo: "Resultados somente exibidos para grupos com ≥5 respondentes. Quando o grupo setor+função não atinge o mínimo, o sistema aplica agrupamento automático na hierarquia: Função → Setor → Empresa. Identidade individual nunca é vinculada às respostas. Separação técnica entre coleta (individual), processamento (segmentado) e exibição (agregada e anonimizada).",
        },
        {
          titulo: "4.5 Plano de Ação (NR-01 §1.4)",
          corpo: "Dimensões em nível ALTO ou CRÍTICO geram automaticamente ações obrigatórias no Plano de Ação Global (metodologia 5W2H). Risco CRÍTICO: prazo máximo de 30 dias. Risco ALTO: prazo máximo de 60 dias. Rastreabilidade completa: ação vinculada à dimensão, campanha e risco GRO correspondente.",
        },
        {
          titulo: "4.6 Integração com NR-17 (Ergonomia)",
          corpo: "Riscos psicossociais identificados são automaticamente exportados para o módulo de Ergonomia (AEP) quando IPS indica nível de atenção, risco ou crítico. Vínculo obrigatório com Situação de Trabalho (par Setor+Função), garantindo rastreabilidade exigida pela NR-17 §17.1.1.",
        },
        {
          titulo: "4.7 Fontes e Limitações",
          corpo: "Fontes: respostas coletadas via questionário digital anônimo. Limitações: (a) distribuição estimada de respondentes por grupo quando não há controle nominal; (b) viés de autorrelato; (c) resultado representa percepção coletiva e não diagnóstico individual; (d) recomenda-se reaplicação periódica conforme NR-01 §1.5.4.",
        },
      ];

      for (const bloco of metodologiaBlocks) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(bloco.titulo, 14, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const lines = doc.splitTextToSize(bloco.corpo, pageW - 28);
        doc.text(lines, 14, y);
        y += lines.length * 4.5 + 6;
      }

      // ── 5. Assinaturas / Conformidade ─────────────────────────────────
      if (y > 240) { doc.addPage(); y = 20; }
      y += 5;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("5. CONFORMIDADE NORMATIVA", 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Norma / Padrão", "Requisito Atendido"]],
        body: [
          ["NR-01 (GRO/PGR)", "Identificação e avaliação de riscos psicossociais no inventário"],
          ["NR-17 (Ergonomia)", "Integração de fatores psicossociais na AEP com vínculo setor/função"],
          ["ISO 45003:2021", "Gestão de riscos psicossociais com confidencialidade e agrupamento"],
          ["COPSOQ III", "Mínimo de 5 respondentes por grupo; agrupamento automático"],
          ["LGPD (Lei 13.709/18)", "Dados coletados de forma anônima; sem vinculação individual"],
        ],
        headStyles: { fillColor: [88, 28, 135], fontSize: 8, textColor: 255 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 245, 255] },
      });

      // ── 6. Evidências Qualitativas (Entrevistas Guiadas IA) ──────────
      if (temEvidenciasQualitativas) {
        doc.addPage();
        y = 20;
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("6. EVIDÊNCIAS QUALITATIVAS — ENTREVISTAS GUIADAS POR IA", 14, y);
        y += 5;
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        const introQual = doc.splitTextToSize(
          "Resultados qualitativos extraídos automaticamente por IA a partir de entrevistas individuais guiadas (SIPRO conversacional). Trechos anonimizados — nomes, locais e identificadores removidos para preservar o anonimato (LGPD + ISO 45003).",
          pageW - 28,
        );
        doc.text(introQual, 14, y);
        y += introQual.length * 4 + 4;

        autoTable(doc, {
          startY: y,
          head: [["Fator de Risco", "Menções", "P", "S", "Nível"]],
          body: evidenciasQualitativas.map((ev) => [
            ev.risco_nome,
            String(ev.count),
            String(ev.p_max),
            String(ev.s_max),
            GRO_NIVEL_RISCO_LABELS[ev.nivel as keyof typeof GRO_NIVEL_RISCO_LABELS] ?? ev.nivel,
          ]),
          headStyles: { fillColor: [88, 28, 135], fontSize: 8, textColor: 255 },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [248, 245, 255] },
          didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 4) {
              const v = String(data.cell.raw);
              if (v.includes("Crítico")) data.cell.styles.textColor = [185, 28, 28];
              else if (v.includes("Alto")) data.cell.styles.textColor = [194, 65, 12];
              else if (v.includes("Médio")) data.cell.styles.textColor = [180, 83, 9];
              else data.cell.styles.textColor = [5, 122, 85];
            }
          },
        });
        y = (doc as any).lastAutoTable.finalY + 8;

        // Trechos anonimizados por fator (até 3 por risco)
        for (const ev of evidenciasQualitativas) {
          const trechos: string[] = [];
          for (const e of ev.evidencias) {
            for (const t of e.trechos_anonimizados ?? []) {
              if (t && trechos.length < 3) trechos.push(t);
            }
            if (trechos.length >= 3) break;
          }
          if (!trechos.length) continue;
          if (y > 255) { doc.addPage(); y = 20; }
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text(`• ${ev.risco_nome}`, 14, y);
          y += 4;
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          for (const t of trechos) {
            const linhas = doc.splitTextToSize(`"${t}"`, pageW - 32);
            if (y + linhas.length * 4 > 280) { doc.addPage(); y = 20; }
            doc.text(linhas, 18, y);
            y += linhas.length * 4 + 2;
          }
          y += 3;
        }
      }

      const pdfFileName = `Relatorio_Psicossocial_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf`;
      doc.save(pdfFileName);

      // Auto-archive to Documentos module
      if (tenantId && user) {
        const blob = doc.output("blob");
        await arquivarDocumento({
          tenantId,
          empresaId: empresaAtivaId,
          userId: user.id,
          userNome: profile?.nome_completo || "Sistema",
          file: blob,
          fileName: pdfFileName,
          tipo: "Relatório Psicossocial",
          observacoes: `Relatório psicossocial - ${campanha.nome} - ${empresaNome || "N/D"}`,
          pastaCategoria: "Psicossocial",
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setExportando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            Relatório de Diagnóstico Psicossocial
          </DialogTitle>
          <DialogDescription>
            NR-01 · NR-17 · ISO 45003 · COPSOQ III — Documento estruturado com metodologia
          </DialogDescription>
        </DialogHeader>

        {!podeExportar ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
            <p className="font-medium">Sem dados suficientes</p>
            <p className="text-sm text-muted-foreground">
              Necessário ao menos uma campanha encerrada com ≥{MINIMO_ANONIMATO} respondentes,
              ou entrevistas guiadas por IA concluídas com evidências.
            </p>
          </div>
        ) : (
          <>
            <Tabs defaultValue="relatorio" className="flex-1 flex flex-col min-h-0">
              <TabsList className="shrink-0">
                <TabsTrigger value="relatorio">Relatório</TabsTrigger>
                <TabsTrigger value="metodologia">Metodologia</TabsTrigger>
                <TabsTrigger value="conformidade">Conformidade</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 mt-3">
                {/* ── Relatório ─────────────────────────────────────── */}
                <TabsContent value="relatorio" className="mt-0 space-y-4 px-1">
                  {/* Identificação */}
                  <div className="rounded-lg border p-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Identificação</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                      <span className="text-muted-foreground">Campanha:</span><span className="font-medium">{campanha.nome}</span>
                      <span className="text-muted-foreground">Modalidade:</span>
                      <span className="font-medium">
                        {isEntrevistaOnly ? "Entrevista Guiada por IA (qualitativa)" : (isSipro ? "SIPRO (quantitativa)" : campanha.instrumento?.toUpperCase())}
                      </span>
                      {!isEntrevistaOnly && (
                        <>
                          <span className="text-muted-foreground">Respondentes:</span><span className="font-medium">{totalRespondentes}</span>
                        </>
                      )}
                      <span className="text-muted-foreground">Emitido em:</span><span className="font-medium">{dataGeracao}</span>
                      {!isEntrevistaOnly && (
                        <>
                          <span className="text-muted-foreground">IPS Global:</span>
                          <span className={cn("font-bold", ipsClass === 'critico' ? "text-red-600" : ipsClass === 'risco' ? "text-orange-600" : ipsClass === 'atencao' ? "text-amber-600" : "text-emerald-600")}>
                            {ipsScore}/100 — {getIPSLabel(ipsClass)}
                          </span>
                        </>
                      )}
                      {temEvidenciasQualitativas && (
                        <>
                          <span className="text-muted-foreground">Entrevistas com evidências:</span>
                          <span className="font-medium">{evidenciasQualitativas.reduce((s, e) => s + e.count, 0)} menção(ões) em {evidenciasQualitativas.length} fator(es)</span>
                        </>
                      )}
                    </div>
                  </div>

                  {!isEntrevistaOnly && (
                    <>
                      {/* Síntese */}
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: "Crítico", count: criticos.length, cls: "bg-red-50 border-red-200 text-red-700" },
                          { label: "Alto", count: altos.length, cls: "bg-orange-50 border-orange-200 text-orange-700" },
                          { label: "Médio", count: medios.length, cls: "bg-amber-50 border-amber-200 text-amber-700" },
                          { label: "Baixo", count: baixos.length, cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
                        ].map(({ label, count, cls }) => (
                          <div key={label} className={cn("rounded-lg border p-3 text-center", cls)}>
                            <p className="text-2xl font-bold">{count}</p>
                            <p className="text-xs font-medium">{label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Inventário de dimensões */}
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dimensões avaliadas ({dimensoesAvaliadas.length})</p>
                        {dimensoesAvaliadas.map(d => (
                          <div key={d.subject} className="flex items-center justify-between py-2 px-3 rounded border bg-card text-sm">
                            <span className="font-medium">{d.subject}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{d.risco}%</span>
                              <Badge variant="outline" className={cn("text-xs", NIVEL_BADGE[d.nivel])}>
                                {GRO_NIVEL_RISCO_LABELS[d.nivel]}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Evidências qualitativas (entrevistas IA) */}
                  {temEvidenciasQualitativas && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                        <Quote className="h-3.5 w-3.5" /> Evidências qualitativas — entrevistas guiadas por IA
                      </p>
                      {evidenciasQualitativas.map((ev) => (
                        <div key={ev.risco_nome} className="rounded-lg border p-3 space-y-2 bg-purple-50/30">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{ev.risco_nome}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">P{ev.p_max} × S{ev.s_max} · {ev.count} menção(ões)</span>
                              <Badge variant="outline" className={cn("text-xs", NIVEL_BADGE[ev.nivel])}>
                                {GRO_NIVEL_RISCO_LABELS[ev.nivel as keyof typeof GRO_NIVEL_RISCO_LABELS] ?? ev.nivel}
                              </Badge>
                            </div>
                          </div>
                          {ev.evidencias.slice(0, 2).flatMap((e) => (e.trechos_anonimizados ?? []).slice(0, 2)).slice(0, 3).map((t, i) => (
                            <p key={i} className="text-xs italic text-muted-foreground border-l-2 border-purple-300 pl-2">"{t}"</p>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ── Metodologia ───────────────────────────────────── */}
                <TabsContent value="metodologia" className="mt-0 space-y-4 px-1">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-purple-50 border border-purple-200 text-xs text-purple-800">
                    <BookOpen className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>Este documento descreve os critérios, lógica e fontes utilizados para a geração do diagnóstico psicossocial, garantindo rastreabilidade e auditabilidade conforme exigido pela NR-01.</p>
                  </div>

                  {[
                    {
                      num: "4.1", titulo: "Instrumento Utilizado",
                      texto: isSipro
                        ? "SIPRO: escala Likert 1-5, score por dimensão = ((média-1)/4)×100. Score alto = maior risco. 11 dimensões, 43 perguntas."
                        : `${campanha.instrumento?.toUpperCase()}: escala Likert 0-4, score invertido para cálculo de risco. Score alto = melhor condição.`,
                    },
                    {
                      num: "4.2", titulo: "Cálculo do IPS",
                      texto: "Média ponderada por respondentes. Classificação: ≥80 Saudável · 65-79 Estável · 50-64 Atenção · 35-49 Risco · <35 Crítico. Mínimo 5 respondentes (ISO 45003).",
                    },
                    {
                      num: "4.3", titulo: "Conversão GRO — Matriz P×S (NR-01)",
                      texto: "Score ≥75 → Risco CRÍTICO (30 dias) · Score 55-74 → Alto (60 dias) · Score 35-54 → Médio (90 dias) · Score <35 → Baixo (180 dias).",
                    },
                    {
                      num: "4.4", titulo: "Confidencialidade (ISO 45003 + COPSOQ III)",
                      texto: "Mínimo 5 respondentes por grupo. Fallback automático: Função → Setor → Empresa. Coleta individual, processamento segmentado, exibição agregada.",
                    },
                    {
                      num: "4.5", titulo: "Plano de Ação (NR-01 §1.4)",
                      texto: "ALTO e CRÍTICO geram ação obrigatória 5W2H automaticamente. Reavaliação mandatória quando a ação é concluída.",
                    },
                    {
                      num: "4.6", titulo: "Fontes e Limitações",
                      texto: "Dados de autorrelato anônimo. Estimativa proporcional de respondentes por grupo quando sem controle nominal. Resultado coletivo, não diagnóstico individual.",
                    },
                  ].map(({ num, titulo, texto }) => (
                    <div key={num} className="rounded-lg border p-3 space-y-1">
                      <p className="text-sm font-semibold">{num}. {titulo}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{texto}</p>
                    </div>
                  ))}
                </TabsContent>

                {/* ── Conformidade ──────────────────────────────────── */}
                <TabsContent value="conformidade" className="mt-0 space-y-3 px-1">
                  {[
                    { norma: "NR-01 (GRO/PGR)", req: "Identificação e avaliação de riscos psicossociais no inventário", ok: true },
                    { norma: "NR-17 (Ergonomia)", req: "Integração na AEP com vínculo setor/função obrigatório", ok: !!(campanha?.situacoes_trabalho?.length) },
                    { norma: "ISO 45003:2021", req: "Gestão de riscos psicossociais com confidencialidade e agrupamento", ok: true },
                    { norma: "COPSOQ III", req: "Mínimo 5 respondentes; agrupamento automático", ok: true },
                    { norma: "LGPD", req: "Dados anônimos sem vinculação individual", ok: true },
                  ].map(({ norma, req, ok }) => (
                    <div key={norma} className={cn("flex items-start gap-3 p-3 rounded-lg border", ok ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200")}>
                      {ok ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="text-sm font-semibold">{norma}</p>
                        <p className="text-xs text-muted-foreground">{req}</p>
                        {!ok && <p className="text-xs text-amber-700 mt-1">⚠️ Configure Situações de Trabalho (Setor+Função) na campanha para conformidade completa com NR-17.</p>}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>O relatório exportado em PDF inclui a seção de metodologia completa, tornando o documento auditável e rastreável conforme NR-01 §1.4.2.</p>
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>

            <Separator />
            <div className="flex items-center justify-between shrink-0 pt-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5 text-purple-500" />
                <span>Relatório com metodologia · NR-01 / ISO 45003</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                  <X className="h-3.5 w-3.5 mr-1" /> Fechar
                </Button>
                <Button size="sm" onClick={handleExportarPDF} disabled={exportando} className="gap-2">
                  {exportando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Exportar PDF Completo
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
