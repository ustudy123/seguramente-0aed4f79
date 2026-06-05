/**
 * RelatorioModal — GAP 4: Geração de documentos estruturados
 * Gera relatório psicossocial completo + seção de metodologia exportável (PDF)
 * Conformidade: NR-01, NR-17, ISO 45003, COPSOQ III
 */
import { useState, useMemo, useEffect } from "react";
import { FileText, Download, Loader2, X, Shield, BookOpen, AlertTriangle, CheckCircle2, Info, Quote } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { CampanhaPsicossocial, RadarDimensao } from "@/types/psicossocial";
import { calcularIPSClassificacao, getIPSLabel } from "@/types/psicossocial";
import { scoreToProbabilidade, scoreToSeveridade, calcularNivelGRO, GRO_NIVEL_RISCO_LABELS } from "@/types/gro";
import { resolverFatorPorSubject } from "@/data/catalogoRiscosPsicossociais";
import { useAuthContext } from "@/contexts/AuthContext";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { arquivarDocumento } from "@/utils/arquivarDocumento";
import { useEvidenciasEntrevista } from "@/hooks/useEvidenciasEntrevista";
import { usePsicossocialResultadosGHE } from "@/hooks/usePsicossocialResultadosGHE";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Sanitize text for jsPDF but maintain basic accented characters if using a standard font
// The user explicitly requested proper accents.
// jsPDF standard fonts (helvetica/times/courier) support WinAnsiEncoding which covers most Western European accents.
const sanitize = (text: string): string => {
  if (!text) return "";
  // Keep the text as is, just handle null/undefined
  return text;
};

const MINIMO_ANONIMATO = 5;

interface RelatorioModalProps {
  open: boolean;
  onClose: () => void;
  campanhas: CampanhaPsicossocial[];
  empresaNome?: string;
  campanhaIdInicial?: string;
}

const NIVEL_BADGE: Record<string, string> = {
  critico: "bg-red-50 text-red-700 border-red-200",
  alto: "bg-orange-50 text-orange-700 border-orange-200",
  medio: "bg-amber-50 text-amber-700 border-amber-200",
  baixo: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function RelatorioModal({ open, onClose, campanhas, empresaNome, campanhaIdInicial }: RelatorioModalProps) {
  const [exportando, setExportando] = useState(false);
  const [filtroCampanhaId, setFiltroCampanhaId] = useState<string>("todos");

  useEffect(() => {
    if (open) {
      setFiltroCampanhaId(campanhaIdInicial || "todos");
    }
  }, [open, campanhaIdInicial]);
  const { tenantId, user, profile } = useAuthContext();
  const { empresaAtiva, empresaAtivaId } = useEmpresaAtiva();

  // Campanhas de entrevista guiada (qualitativas) — todas elegíveis
  const campanhasEntrevista = useMemo(
    () => campanhas.filter((c: any) => c.tipo_instrumento === "entrevista_guiada"),
    [campanhas],
  );
  
  const campanhasValidas = campanhas.filter(c => {
    const isEntrevistaGuiada = (c as any).tipo_instrumento === "entrevista_guiada";
    const minRespostas = isEntrevistaGuiada ? 1 : MINIMO_ANONIMATO;
    
    return c.ips_score != null &&
      (c.total_respostas || 0) >= minRespostas;
  });

  // Prioridade para campanha selecionada
  const campanha = useMemo(() => {
    if (filtroCampanhaId !== "todos") {
      return campanhasValidas.find(c => c.id === filtroCampanhaId) ?? campanhasValidas[0];
    }
    // Se "todos" estiver selecionado e houver campanhas válidas (quantitativas)
    if (campanhasValidas.length > 0) return campanhasValidas[0];
    return campanhasEntrevista[0];
  }, [filtroCampanhaId, campanhasEntrevista, campanhasValidas]);

  const campanhaEntrevistaIds = useMemo(() => {
    // Se uma campanha específica está selecionada e é de entrevista, buscamos evidências apenas dela
    if (campanha && (campanha as any).tipo_instrumento === "entrevista_guiada") {
      return [campanha.id];
    }
    // Se "todos" está selecionado ou é quantitativa, buscamos de todas as entrevistas pertinentes à campanha atual
    // Mas para evitar confusão entre campanhas, se for uma campanha quantitativa específica, 
    // idealmente não mostraríamos evidências de entrevistas que não têm relação.
    // O usuário relatou que trouxe evidências de outra campanha.
    if (filtroCampanhaId !== "todos") {
      return []; // Não traz evidências se for uma campanha quantitativa específica
    }
    return campanhasEntrevista.map(c => c.id);
  }, [filtroCampanhaId, campanha, campanhasEntrevista]);

  const { data: evidenciasQualitativas = [] } = useEvidenciasEntrevista(campanhaEntrevistaIds);

  const isEntrevista = (campanha as any)?.tipo_instrumento === "entrevista_guiada";
  const isSipro = (campanha?.instrumento === 'sipro' && !isEntrevista) || isEntrevista;
  const isEntrevistaOnly = isEntrevista || (!campanhasValidas.length && temEvidenciasQualitativas);
  const totalRespondentes = campanhasValidas.reduce((s, c) => s + (c.total_respostas ?? 0), 0);
  const rawScore = campanha?.ips_score ?? 0;
  const ipsScore = isSipro ? 100 - rawScore : rawScore;
  const ipsClass = calcularIPSClassificacao(ipsScore);
  const radar = (campanha?.radar_data ?? []) as RadarDimensao[];
  // Agrega dimensões do instrumento por Fator de Risco Psicossocial (catálogo 13 fatores NR-01/ISO 45003)
  const fatoresAvaliados = useMemo(() => {
    type Agg = { fator: string; dimensoes: string[]; soma: number; n: number };
    const porFator: Record<string, Agg> = {};
    for (const d of radar) {
      const f = resolverFatorPorSubject(d.subject);
      const key = f?.nome ?? d.subject;
      if (!porFator[key]) porFator[key] = { fator: key, dimensoes: [], soma: 0, n: 0 };
      porFator[key].dimensoes.push(d.subject);
      porFator[key].soma += d.value;
      porFator[key].n += 1;
    }
    return Object.values(porFator).map(a => {
      const scoreMedio = a.n > 0 ? a.soma / a.n : 0;
      const risco = isSipro ? Math.round(scoreMedio) : Math.round(100 - scoreMedio);
      const prob = scoreToProbabilidade(scoreMedio, isSipro);
      const sev = scoreToSeveridade(scoreMedio, isSipro);
      const nivel = calcularNivelGRO(prob, sev);
      return { fator: a.fator, dimensoes: a.dimensoes, risco, nivel };
    }).sort((a, b) => b.risco - a.risco);
  }, [radar, isSipro]);

  const criticos = fatoresAvaliados.filter(d => d.nivel === 'critico');
  const altos = fatoresAvaliados.filter(d => d.nivel === 'alto');
  const medios = fatoresAvaliados.filter(d => d.nivel === 'medio');
  const baixos = fatoresAvaliados.filter(d => d.nivel === 'baixo');

  const { resultadosPorGHE = [] } = usePsicossocialResultadosGHE(campanhasValidas.map(c => c.id));

  const dataGeracao = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const handleExportarPDF = async () => {
    if (!podeExportar || !campanha) return;
    setExportando(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", format: "a4", unit: "mm" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      
      // Margins ABNT: Superior 3.0, Esquerda 3.0, Inferior 2.0, Direita 2.0
      const mt = 30; // Margin Top
      const ml = 30; // Margin Left
      const mb = 20; // Margin Bottom
      const mr = 20; // Margin Right
      const contentWidth = pageW - ml - mr;
      
      let y = mt;

      const addFooter = () => {
        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(140, 140, 140);
          const footerText = `YourEyes — Relatório Psicossocial | ${sanitize(campanha.nome)} | Página ${i}/${totalPages}`;
          const tw = doc.getTextWidth(footerText);
          // Position footer inside bottom margin
          doc.text(footerText, (pageW / 2), pageH - (mb / 2), { align: "center" });
        }
      };

      // ── Cabecalho ──────────────────────────────────────────────────────
      doc.setFillColor(88, 28, 135);
      doc.rect(0, 0, pageW, 35, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO DE DIAGNÓSTICO PSICOSSOCIAL", pageW / 2, 12, { align: "center" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("NR-01 · NR-17 · ISO 45003 · COPSOQ III", pageW / 2, 19, { align: "center" });
      doc.text(`Emitido em: ${dataGeracao} | Empresa: ${sanitize(empresaAtiva?.razao_social ?? empresaNome ?? "N/D")}`, pageW / 2, 26, { align: "center" });

      y = mt + 15; // Start content below top margin + spacing from header if it was at 0, but header is at top. 
      // Adjusted y to be relative to mt
      y = mt + 10;
      doc.setTextColor(0, 0, 0);

      // Helper function to check page overflow
      const checkPageOverflow = (neededHeight: number) => {
        if (y + neededHeight > pageH - mb) {
          doc.addPage();
          y = mt;
          return true;
        }
        return false;
      };

      // ── 1. Identificacao ───────────────────────────────────────────────
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("1. IDENTIFICAÇÃO DA AVALIAÇÃO", ml, y);
      y += 6;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const identificacao = isEntrevista
        ? [
            ["Campanha", sanitize(campanha.nome)],
            ["Modalidade", "Entrevista Guiada por IA (qualitativa)"],
            ["Periodo", `${campanha.data_inicio ?? "?"} a ${campanha.data_fim ?? "atual"}`],
            ["Respondentes", String(campanha.total_respostas ?? 0)],
            ["Entrevistas com evidencias", String(evidenciasQualitativas.reduce((s, e) => s + e.count, 0))],
            ["Fatores identificados", String(evidenciasQualitativas.length)],
            ["Razao Social", sanitize(empresaAtiva?.razao_social ?? "N/D")],
            ["CNPJ", empresaAtiva?.cnpj ?? "N/D"],
            ["Data de Emissao", dataGeracao],
          ]
        : [
            ["Campanha", sanitize(campanha.nome)],
            ["Instrumento", isSipro ? "SIPRO — Indice YourEyes de Risco Psicossocial Organizacional" : (campanha.instrumento?.toUpperCase() ?? "N/D")],
            ["Periodo", `${campanha.data_inicio ?? "?"} a ${campanha.data_fim ?? "atual"}`],
            ["Total de Respondentes", String(campanha.total_respostas ?? 0)],
            ["Razao Social", sanitize(empresaAtiva?.razao_social ?? "N/D")],
            ["CNPJ", empresaAtiva?.cnpj ?? "N/D"],
            ["Data de Emissao", dataGeracao],
            ["IPS Global", `${ipsScore}/100 — ${getIPSLabel(ipsClass)}`],
          ];
      autoTable(doc, {
        startY: y,
        margin: { left: ml, right: mr, top: mt, bottom: mb },
        head: [["Campo", "Informação"]],
        body: identificacao,
        headStyles: { fillColor: [88, 28, 135], fontSize: 8, textColor: 255 },
        bodyStyles: { fontSize: 8, halign: 'justify' },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 } },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // ── 2. Sintese Executiva ───────────────────────────────────────────
      if (!isEntrevistaOnly) {
        checkPageOverflow(30);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("2. SÍNTESE EXECUTIVA", ml, y);
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
          margin: { left: ml, right: mr, top: mt, bottom: mb },
          body: sintese,
          headStyles: { fillColor: [88, 28, 135], fontSize: 8 },
          bodyStyles: { fontSize: 8, halign: 'justify' },
          didParseCell: (data) => {
            const text = String(data.cell.raw);
            if (text.includes("CRÍTICO")) data.cell.styles.textColor = [185, 28, 28];
            else if (text.includes("ALTO")) data.cell.styles.textColor = [194, 65, 12];
            else if (text.includes("MÉDIO")) data.cell.styles.textColor = [180, 83, 9];
            else data.cell.styles.textColor = [5, 122, 85];
          },
        });
        y = (doc as any).lastAutoTable.finalY + 10;

        // ── 3. Inventario de Riscos ────────────────────────────────────────
        checkPageOverflow(30);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("3. INVENTÁRIO DE FATORES DE RISCO PSICOSSOCIAL", ml, y);
        y += 5;

        if (resultadosPorGHE.length > 0) {
          resultadosPorGHE.forEach((ghe) => {
            checkPageOverflow(30);
            
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text(`GHE: ${sanitize(ghe.ghe_nome)}`, ml, y);
            y += 4;
            
            const funcDepto = ghe.composicaoSetorCargos.length > 0 
              ? ghe.composicaoSetorCargos.map(c => `${c.cargos.join("/")}/${c.setor}`).join("; ")
              : "N/A";
            
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.text(`FUNÇÃO/DEPARTAMENTO: ${sanitize(funcDepto)}`, ml, y);
            y += 4;
            
            doc.text(`Respondentes: responderam ${ghe.count} de ${ghe.count}`, ml, y);
            y += 5;

            // Agrega fatores por GHE
            const fatoresGHE = (() => {
              type Agg = { fator: string; dimensoes: string[]; soma: number; n: number };
              const porFator: Record<string, Agg> = {};
              for (const d of ghe.radar) {
                const f = resolverFatorPorSubject(d.subject);
                const key = f?.nome ?? d.subject;
                if (!porFator[key]) porFator[key] = { fator: key, dimensoes: [], soma: 0, n: 0 };
                porFator[key].dimensoes.push(d.subject);
                porFator[key].soma += d.value;
                porFator[key].n += 1;
              }
              return Object.values(porFator).map(a => {
                const scoreMedio = a.n > 0 ? a.soma / a.n : 0;
                const risco = isSipro ? Math.round(scoreMedio) : Math.round(100 - scoreMedio);
                const prob = scoreToProbabilidade(scoreMedio, isSipro);
                const sev = scoreToSeveridade(scoreMedio, isSipro);
                const nivel = calcularNivelGRO(prob, sev);
                return { fator: a.fator, dimensoes: a.dimensoes, risco, nivel };
              }).sort((a, b) => b.risco - a.risco);
            })();

            autoTable(doc, {
              startY: y,
              margin: { left: ml, right: mr, top: mt, bottom: mb },
              head: [["Fator de Risco", "Dimensões equivalentes", "Score Risco", "Nível GRO", "Base Normativa"]],
              body: fatoresGHE.map(d => [
                sanitize(d.fator),
                sanitize(d.dimensoes.join(", ")),
                `${d.risco}%`,
                GRO_NIVEL_RISCO_LABELS[d.nivel],
                "NR-01 / NR-17 / ISO 45003",
              ]),
              headStyles: { fillColor: [88, 28, 135], fontSize: 8, textColor: 255 },
              bodyStyles: { fontSize: 8, halign: 'justify' },
              alternateRowStyles: { fillColor: [248, 245, 255] },
              didParseCell: (data) => {
                if (data.section === "body" && data.column.index === 3) {
                  const v = String(data.cell.raw);
                  if (v.includes("Crítico")) data.cell.styles.textColor = [185, 28, 28];
                  else if (v.includes("Alto")) data.cell.styles.textColor = [194, 65, 12];
                  else if (v.includes("Médio")) data.cell.styles.textColor = [180, 83, 9];
                  else data.cell.styles.textColor = [5, 122, 85];
                }
              },
            });
            y = (doc as any).lastAutoTable.finalY + 12;
          });
        } else {
          autoTable(doc, {
            startY: y,
            margin: { left: ml, right: mr, top: mt, bottom: mb },
            head: [["Fator de Risco", "Dimensões equivalentes", "Score Risco", "Nível GRO", "Base Normativa"]],
            body: fatoresAvaliados.map(d => [
              sanitize(d.fator),
              sanitize(d.dimensoes.join(", ")),
              `${d.risco}%`,
              GRO_NIVEL_RISCO_LABELS[d.nivel],
              "NR-01 / NR-17 / ISO 45003",
            ]),
            headStyles: { fillColor: [88, 28, 135], fontSize: 8, textColor: 255 },
            bodyStyles: { fontSize: 8, halign: 'justify' },
            alternateRowStyles: { fillColor: [248, 245, 255] },
            didParseCell: (data) => {
              if (data.section === "body" && data.column.index === 3) {
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
      }

      // ── 4. Metodologia de Graduação de Risco (Novas Tabelas) ──────────
      doc.addPage();
      y = mt;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("4. METODOLOGIA DE GRADUAÇÃO DE RISCO (P x S)", ml, y);
      y += 8;

      doc.setFontSize(9);
      doc.text("4.1. Tabela de Probabilidade", ml, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        margin: { left: ml, right: mr, top: mt, bottom: mb },
        head: [["Índice/Nível", "Classificação", "Critério Operacional"]],
        body: [
          ["Nível 5", "Quase Certa", "Ocorrência contínua ou diária. Medidas de prevenção são inexistentes ou totalmente ineficazes."],
          ["Nível 4", "Frequente", "Ocorre de forma regular na rotina de trabalho. Medidas de prevenção são insuficientes ou frágeis."],
          ["Nível 3", "Possível", "Ocorrência documentada ou com relatos recorrentes. Medidas de prevenção apresentam falhas intermitentes."],
          ["Nível 2", "Remota", "Pode ocorrer em situações muito específicas ou raramente no ano. Medidas de prevenção são majoritariamente eficazes."],
          ["Nível 1", "Aceitável/Improvável", "Ocorrência imprevisível ou sem histórico no setor. Medidas de prevenção são totalmente eficazes."],
        ],
        headStyles: { fillColor: [31, 41, 55], fontSize: 8, textColor: 255 },
        bodyStyles: { fontSize: 8, halign: 'justify' },
        didParseCell: (data) => {
          if (data.section === "body") {
            const rowIdx = data.row.index;
            const colors = [
              [254, 226, 226], // Nível 5 - Vermelho
              [255, 237, 213], // Nível 4 - Laranja
              [254, 252, 232], // Nível 3 - Amarelo
              [239, 246, 255], // Nível 2 - Azul
              [240, 253, 244], // Nível 1 - Verde
            ];
            data.cell.styles.fillColor = colors[rowIdx] as [number, number, number];
          }
        }
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      checkPageOverflow(60);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("4.2. Tabela de Severidade", ml, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        margin: { left: ml, right: mr, top: mt, bottom: mb },
        head: [["Índice/Nível", "Classificação", "Impacto à Saúde"]],
        body: [
          ["Nível 5", "Catastrófica/Crítica", "Incapacidade permanente para o trabalho ou comprometimento total e irreversível da saúde."],
          ["Nível 4", "Grande/Alta", "Lesão crônica ou adoecimento ocupacional diagnosticado (ex: Burnout, ansiedade grave). Gera afastamento prolongado (> 15 dias)."],
          ["Nível 3", "Média/Moderada", "Agravamento clínico tratável, disfunção reversível. Pode gerar absenteísmo de curto prazo (até 15 dias)."],
          ["Nível 2", "Pequena/Menor", "Sintomas leves (ex: estresse pontual), sem necessidade de afastamento ou restrição médica."],
          ["Nível 1", "Insignificante", "Desconforto temporário sem alteração clínica ou prejuízo ao desempenho laboral."],
        ],
        headStyles: { fillColor: [31, 41, 55], fontSize: 8, textColor: 255 },
        bodyStyles: { fontSize: 8, halign: 'justify' },
        didParseCell: (data) => {
          if (data.section === "body") {
            const rowIdx = data.row.index;
            const colors = [
              [254, 226, 226], // Nível 5 - Vermelho
              [255, 237, 213], // Nível 4 - Laranja
              [254, 252, 232], // Nível 3 - Amarelo
              [239, 246, 255], // Nível 2 - Azul
              [240, 253, 244], // Nível 1 - Verde
            ];
            data.cell.styles.fillColor = colors[rowIdx] as [number, number, number];
          }
        }
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      checkPageOverflow(80);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("4.3. Matriz de Graduação de Risco", ml, y);
      y += 4;

      const matrizData = [
        ["5 - Quase Certa", "MÉDIO", "MÉDIO", "ALTO", "CRÍTICO", "CRÍTICO"],
        ["4 - Frequente", "MÉDIO", "MÉDIO", "MÉDIO", "ALTO", "CRÍTICO"],
        ["3 - Possível", "BAIXO", "BAIXO", "MÉDIO", "ALTO", "ALTO"],
        ["2 - Remota", "TRIVIAL", "BAIXO", "BAIXO", "MÉDIO", "ALTO"],
        ["1 - Improvável", "TRIVIAL", "TRIVIAL", "BAIXO", "BAIXO", "MÉDIO"],
      ];

      autoTable(doc, {
        startY: y,
        margin: { left: ml, right: mr, top: mt, bottom: mb },
        head: [["Prob. \\ Sev.", "1 - Insig.", "2 - Pequena", "3 - Média", "4 - Grande", "5 - Catast."]],
        body: matrizData,
        headStyles: { fillColor: [31, 41, 55], fontSize: 7, textColor: 255, halign: 'center' },
        bodyStyles: { fontSize: 7, halign: 'center', minCellHeight: 10 },
        columnStyles: { 0: { fontStyle: "bold", fillColor: [31, 41, 55], textColor: 255, cellWidth: 30 } },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index > 0) {
            const val = String(data.cell.raw);
            if (val === "CRÍTICO") { data.cell.styles.fillColor = [254, 226, 226]; data.cell.styles.textColor = [153, 27, 27]; }
            else if (val === "ALTO") { data.cell.styles.fillColor = [255, 237, 213]; data.cell.styles.textColor = [154, 52, 18]; }
            else if (val === "MÉDIO") { data.cell.styles.fillColor = [254, 252, 232]; data.cell.styles.textColor = [133, 77, 14]; }
            else if (val === "BAIXO") { data.cell.styles.fillColor = [239, 246, 255]; data.cell.styles.textColor = [30, 64, 175]; }
            else if (val === "TRIVIAL") { data.cell.styles.fillColor = [240, 253, 244]; data.cell.styles.textColor = [22, 101, 52]; }
          }
        }
      });
      y = (doc as any).lastAutoTable.finalY + 12;

      // ── 5. Metodologia (Original) ─────────────────────────────────────
      checkPageOverflow(40);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("5. METODOLOGIA E CRITÉRIOS DE AVALIAÇÃO", ml, y);
      y += 8;

      const metodologiaBlocks = [
        {
          titulo: "4.1 Instrumento Utilizado",
          corpo: isSipro
            ? "SIPRO — Índice YourEyes de Risco Psicossocial Organizacional. Instrumento autoral desenvolvido com base nos modelos COPSOQ III, HSE e PROART, adaptado ao contexto brasileiro. Score calculado por dimensão em escala 0-100, onde score alto indica maior risco. Atende aos requisitos da NR-01."
            : `${campanha.instrumento?.toUpperCase()} — Instrumento internacional de avaliação de riscos psicossociais.`,
        },
        {
          titulo: "4.2 Cálculo do IPS (Índice Psicossocial YourEyes)",
          corpo: "O IPS é calculado como média ponderada pelo número de respondentes em cada campanha ativa. Classificação: >=80 = Saudável; 65-79 = Estável; 50-64 = Atenção; 35-49 = Risco; <35 = Crítico. Mínimo de 5 respondentes exigido para questionários (ISO 45003 §6.1.2); entrevistas guiadas são isentas deste mínimo por natureza qualitativa.",
        },
        {
          titulo: "4.3 Conversão para Nível GRO (NR-01)",
          corpo: "Cada dimensão psicossocial é convertida para perigo ocupacional via matriz PxS:\n• Score >=75: Probabilidade Muito Alta + Severidade Grave -> Risco CRÍTICO\n• Score 55-74: Probabilidade Alta + Severidade Moderada -> Risco ALTO\n• Score 35-54: Probabilidade Moderada + Severidade Moderada -> Risco MÉDIO\n• Score <35: Probabilidade Baixa + Severidade Leve -> Risco BAIXO",
        },
      ];

      for (const bloco of metodologiaBlocks) {
        checkPageOverflow(30);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(bloco.titulo, ml, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const lines = doc.splitTextToSize(bloco.corpo, contentWidth);
        doc.text(lines, ml, y, { align: 'justify', maxWidth: contentWidth });
        y += lines.length * 4.5 + 6;
      }

      // ── 5. Conformidade ───────────────────────────────────────────────
      checkPageOverflow(30);
      y += 5;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("5. CONFORMIDADE NORMATIVA", ml, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        margin: { left: ml, right: mr, top: mt, bottom: mb },
        head: [["Norma / Padrão", "Requisito Atendido"]],
        body: [
          ["NR-01 (GRO/PGR)", "Identificação e avaliação de riscos psicossociais no inventário"],
          ["NR-17 (Ergonomia)", "Integração de fatores psicossociais na AEP com vínculo setor/função"],
          ["ISO 45003:2021", "Gestão de riscos psicossociais com confidencialidade e agrupamento"],
          ["LGPD (Lei 13.709/18)", "Dados coletados de forma anônima; sem vinculação individual"],
        ],
        headStyles: { fillColor: [88, 28, 135], fontSize: 8, textColor: 255 },
        bodyStyles: { fontSize: 8, halign: 'justify' },
        alternateRowStyles: { fillColor: [248, 245, 255] },
      });

      // ── 6. Analise por GHE ────────────────────────────────────────────
      if (!isEntrevistaOnly && resultadosPorGHE.length > 0) {
        doc.addPage();
        y = mt;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("6. ESTRATIFICAÇÃO E ANÁLISE POR GHE", ml, y);
        y += 6;
        autoTable(doc, {
          startY: y,
          margin: { left: ml, right: mr, top: mt, bottom: mb },
          head: [["GHE", "Respondentes", "IPS Médio", "Situação"]],
          body: resultadosPorGHE.map(g => [
            sanitize(g.ghe_nome),
            String(g.count),
            `${g.ipsMedio || 0}/100`,
            getIPSLabel(calcularIPSClassificacao(g.ipsMedio || 0))
          ]),
          headStyles: { fillColor: [88, 28, 135], fontSize: 8, textColor: 255 },
          bodyStyles: { fontSize: 8, halign: 'justify' },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // ── 7. Evidencias Qualitativas ────────────────────────────────────
      if (temEvidenciasQualitativas) {
        doc.addPage();
        y = mt;
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("7. EVIDÊNCIAS QUALITATIVAS — ENTREVISTAS GUIADAS", ml, y);
        y += 8;
        
        for (const ev of evidenciasQualitativas) {
          const trechos: string[] = [];
          for (const e of ev.evidencias) {
            for (const t of e.trechos_anonimizados ?? []) {
              if (t && trechos.length < 3) trechos.push(t);
            }
            if (trechos.length >= 3) break;
          }
          if (!trechos.length) continue;
          checkPageOverflow(30);
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text(`• ${sanitize(ev.risco_nome)} (P${ev.p_max} x S${ev.s_max})`, ml, y);
          y += 5;
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          for (const t of trechos) {
            const linhas = doc.splitTextToSize(`"${sanitize(t)}"`, contentWidth - 4);
            checkPageOverflow(linhas.length * 4 + 4);
            doc.text(linhas, ml + 4, y, { align: 'justify', maxWidth: contentWidth - 4 });
            y += linhas.length * 4 + 2;
          }
          y += 4;
        }
      }

      addFooter();
      const pdfFileName = `Relatorio_Psicossocial_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf`;
      doc.save(pdfFileName);

      // Auto-archive
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
          observacoes: `Relatório psicossocial - ${campanha.nome}`,
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
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground font-medium">Campanha:</span>
            <Select value={filtroCampanhaId} onValueChange={setFiltroCampanhaId}>
              <SelectTrigger className="h-8 w-[240px] text-xs">
                <SelectValue placeholder="Selecionar Campanha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Média Consolidada (Geral)</SelectItem>
                {campanhasValidas.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {(c as any).tipo_instrumento === "entrevista_guiada" ? "🎙️ " : ""}
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogDescription className="mt-2">
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

              <div className="flex-1 mt-3 overflow-hidden flex flex-col min-h-[400px]">
                {/* ── Relatório ─────────────────────────────────────── */}
                <TabsContent value="relatorio" className="mt-0 flex-1 overflow-y-auto space-y-4 px-1 pb-6">
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

                      {/* Inventário por Fator de Risco (13 fatores NR-01 / ISO 45003) */}
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fatores de risco avaliados ({fatoresAvaliados.length})</p>
                        {fatoresAvaliados.map(d => (
                          <div key={d.fator} className="flex items-center justify-between py-2 px-3 rounded border bg-card text-sm">
                            <div className="flex flex-col">
                              <span className="font-medium">{d.fator}</span>
                              {d.dimensoes.length > 0 && (
                                <span className="text-[11px] text-muted-foreground">
                                  Dimensões: {d.dimensoes.join(" · ")}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
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
                <TabsContent value="metodologia" className="mt-0 flex-1 overflow-y-auto space-y-4 px-1 pb-6">
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
              </div>
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
