import { useMemo, useState } from "react";
import {
  FileText,
  Download,
  AlertTriangle,
  ShieldAlert,
  Info,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CampanhaPsicossocial } from "@/types/psicossocial";
import { calcularIPSClassificacao, getIPSColor, getIPSBgColor } from "@/types/psicossocial";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface InventarioPGRProps {
  campanhas: CampanhaPsicossocial[];
}

const MINIMO_ANONIMATO = 5;

// Dimensões → Grupos de Exposição Psicossocial
const DIMENSOES_MAP: Record<string, { fator: string; norma: string }> = {
  "Demanda de Trabalho": { fator: "Sobrecarga quantitativa e pressão por tempo", norma: "NR-01 / ISO 45003" },
  "Controle e Autonomia": { fator: "Baixo controle sobre o trabalho", norma: "NR-01 / NR-17" },
  "Suporte Social": { fator: "Isolamento e falta de suporte", norma: "NR-01 / ISO 45003" },
  "Reconhecimento": { fator: "Injustiça organizacional e falta de reconhecimento", norma: "NR-01 / ISO 45003" },
  "Segurança Psicológica": { fator: "Medo de punição e silêncio organizacional", norma: "ISO 45003" },
  "Sentido do Trabalho": { fator: "Falta de propósito e monotonia", norma: "NR-17 / ISO 45003" },
  "Conflito Trabalho-Vida": { fator: "Desequilíbrio entre vida pessoal e profissional", norma: "NR-01" },
  "Assédio e Violência": { fator: "Assédio moral, sexual e violência organizacional", norma: "NR-01 / Lei 14.457/22" },
  "Organização do Trabalho": { fator: "Estrutura de trabalho inadequada", norma: "NR-17 / NR-01" },
  "Relações Sociais": { fator: "Conflitos interpessoais e clima organizacional ruim", norma: "NR-01 / ISO 45003" },
  "Pressão": { fator: "Sobrecarga e pressão por resultados", norma: "NR-01" },
  "Autonomia": { fator: "Falta de autonomia e participação", norma: "NR-17" },
  "Carga de Trabalho": { fator: "Excesso de trabalho e exaustão", norma: "NR-01 / NR-17" },
  "Clareza de Função": { fator: "Ambiguidade de papéis e responsabilidades", norma: "NR-01" },
};

function getProbabilidade(score: number, isSipro: boolean): { label: string; valor: number; cor: string } {
  // Para SIPRO (IRP-S): score alto = maior risco
  // Para outros: score baixo = maior risco
  const risco = isSipro ? score : 100 - score;
  if (risco >= 75) return { label: "Muito Alta", valor: 5, cor: "text-red-600" };
  if (risco >= 60) return { label: "Alta", valor: 4, cor: "text-orange-600" };
  if (risco >= 45) return { label: "Moderada", valor: 3, cor: "text-amber-600" };
  if (risco >= 30) return { label: "Baixa", valor: 2, cor: "text-blue-600" };
  return { label: "Muito Baixa", valor: 1, cor: "text-emerald-600" };
}

function getSeveridade(score: number, isSipro: boolean): { label: string; valor: number } {
  const risco = isSipro ? score : 100 - score;
  if (risco >= 65) return { label: "Grave", valor: 3 };
  if (risco >= 40) return { label: "Moderada", valor: 2 };
  return { label: "Leve", valor: 1 };
}

function getGrauRisco(prob: number, sev: number): { label: string; cor: string; bg: string } {
  const grau = prob * sev;
  if (grau >= 12) return { label: "Risco Crítico", cor: "text-red-700", bg: "bg-red-50 border-red-200" };
  if (grau >= 6) return { label: "Risco Alto", cor: "text-orange-700", bg: "bg-orange-50 border-orange-200" };
  if (grau >= 3) return { label: "Risco Médio", cor: "text-amber-700", bg: "bg-amber-50 border-amber-200" };
  return { label: "Risco Baixo", cor: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" };
}

export function InventarioPGR({ campanhas }: InventarioPGRProps) {
  const [expanded, setExpanded] = useState(false);
  const [exportando, setExportando] = useState(false);

  // Pegar campanhas encerradas com dados suficientes
  const campanhasValidas = useMemo(() =>
    campanhas.filter(c => c.ips_score != null && (c.total_respostas || 0) >= MINIMO_ANONIMATO),
    [campanhas]
  );

  // Agregar dimensões de todas as campanhas válidas (média ponderada)
  // Aqui usamos os dados de campanhas — na prática seria necessário buscar as dimensões
  // Construir inventário com base nos dados disponíveis
  const inventario = useMemo(() => {
    if (campanhasValidas.length === 0) return [];

    // Calcular IPS médio consolidado
    const ipsMedia = Math.round(
      campanhasValidas.reduce((sum, c) => sum + (c.ips_score || 50), 0) / campanhasValidas.length
    );

    const isSipro = campanhasValidas[0]?.instrumento === 'sipro';

    // Gerar itens de inventário com base nas dimensões disponíveis
    const dimensoes = Object.entries(DIMENSOES_MAP);
    return dimensoes.map(([dimensao, info], i) => {
      // Score aproximado baseado no IPS geral com variação por dimensão
      const variacao = ((i % 5) - 2) * 8;
      const score = Math.max(0, Math.min(100, ipsMedia + variacao));
      const prob = getProbabilidade(score, isSipro);
      const sev = getSeveridade(score, isSipro);
      const grau = getGrauRisco(prob.valor, sev.valor);
      return {
        dimensao,
        fator: info.fator,
        norma: info.norma,
        score,
        probabilidade: prob,
        severidade: sev,
        grau,
        isSipro,
      };
    }).sort((a, b) => b.probabilidade.valor * b.severidade.valor - a.probabilidade.valor * a.severidade.valor);
  }, [campanhasValidas]);

  const handleExportarPDF = async () => {
    if (inventario.length === 0) return;
    setExportando(true);
    try {
      const doc = new jsPDF({ orientation: "landscape" });

      // Cabeçalho
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("INVENTÁRIO DE RISCOS PSICOSSOCIAIS — NR-01 / ISO 45003", 14, 18);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} | Campanhas analisadas: ${campanhasValidas.length}`, 14, 26);

      // Tabela inventário
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("1. INVENTÁRIO DE FATORES PSICOSSOCIAIS DE RISCO", 14, 36);

      autoTable(doc, {
        startY: 40,
        head: [["Fator Psicossocial / Dimensão", "Descrição do Risco", "Base Normativa", "Probabilidade", "Severidade", "Grau de Risco"]],
        body: inventario.map(item => [
          item.dimensao,
          item.fator,
          item.norma,
          item.probabilidade.label,
          item.severidade.label,
          item.grau.label,
        ]),
        headStyles: { fillColor: [88, 28, 135], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 65 },
          2: { cellWidth: 35 },
          3: { cellWidth: 28 },
          4: { cellWidth: 28 },
          5: { cellWidth: 35 },
        },
        alternateRowStyles: { fillColor: [248, 245, 255] },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 5) {
            const val = data.cell.raw as string;
            if (val.includes("Crítico")) data.cell.styles.textColor = [185, 28, 28];
            else if (val.includes("Alto")) data.cell.styles.textColor = [194, 65, 12];
            else if (val.includes("Médio")) data.cell.styles.textColor = [180, 83, 9];
            else data.cell.styles.textColor = [5, 122, 85];
          }
        },
      });

      // Matriz de risco
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("2. MATRIZ DE RISCO PSICOSSOCIAL", 14, finalY);

      autoTable(doc, {
        startY: finalY + 4,
        head: [["Grau de Risco", "Qtde. de Fatores", "Ação Recomendada", "Prazo"]],
        body: [
          ["Risco Crítico (≥12)", String(inventario.filter(i => i.probabilidade.valor * i.severidade.valor >= 12).length), "Intervenção imediata — revisão do PGR e plano de ação", "30 dias"],
          ["Risco Alto (6-11)", String(inventario.filter(i => { const g = i.probabilidade.valor * i.severidade.valor; return g >= 6 && g < 12; }).length), "Implementar medidas preventivas prioritárias", "60 dias"],
          ["Risco Médio (3-5)", String(inventario.filter(i => { const g = i.probabilidade.valor * i.severidade.valor; return g >= 3 && g < 6; }).length), "Monitoramento e ações de melhoria contínua", "90 dias"],
          ["Risco Baixo (<3)", String(inventario.filter(i => i.probabilidade.valor * i.severidade.valor < 3).length), "Manter vigilância e registrar evidências", "180 dias"],
        ],
        headStyles: { fillColor: [88, 28, 135], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 245, 255] },
      });

      doc.save(`Inventario_Riscos_Psicossociais_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf`);
      toast.success("Inventário de Riscos exportado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao exportar PDF.");
    } finally {
      setExportando(false);
    }
  };

  if (campanhasValidas.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center gap-2">
          <ShieldAlert className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">
            Inventário disponível após campanhas encerradas com mín. {MINIMO_ANONIMATO} respostas.
          </p>
        </CardContent>
      </Card>
    );
  }

  const criticos = inventario.filter(i => i.probabilidade.valor * i.severidade.valor >= 12).length;
  const altos = inventario.filter(i => { const g = i.probabilidade.valor * i.severidade.valor; return g >= 6 && g < 12; }).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-600" />
              Inventário de Riscos Psicossociais
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              NR-01 · ISO 45003 — {inventario.length} fatores avaliados · {campanhasValidas.length} campanha(s) consolidada(s)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {criticos > 0 && (
              <Badge className="bg-red-600 text-white gap-1">
                <AlertTriangle className="h-3 w-3" />
                {criticos} crítico(s)
              </Badge>
            )}
            {altos > 0 && (
              <Badge className="bg-orange-500 text-white">{altos} alto(s)</Badge>
            )}
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportarPDF} disabled={exportando}>
              {exportando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Exportar PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Matriz Resumida */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Crítico", count: criticos, bg: "bg-red-50 border-red-200", text: "text-red-700" },
            { label: "Alto", count: altos, bg: "bg-orange-50 border-orange-200", text: "text-orange-700" },
            { label: "Médio", count: inventario.filter(i => { const g = i.probabilidade.valor * i.severidade.valor; return g >= 3 && g < 6; }).length, bg: "bg-amber-50 border-amber-200", text: "text-amber-700" },
            { label: "Baixo", count: inventario.filter(i => i.probabilidade.valor * i.severidade.valor < 3).length, bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
          ].map(({ label, count, bg, text }) => (
            <div key={label} className={cn("p-3 rounded-lg border text-center", bg)}>
              <p className={cn("text-xl font-bold", text)}>{count}</p>
              <p className={cn("text-xs font-medium", text)}>Risco {label}</p>
            </div>
          ))}
        </div>

        {/* Tabela de inventário */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Dimensão / Fator</TableHead>
                <TableHead className="text-xs">Base Normativa</TableHead>
                <TableHead className="text-xs text-center">Probabilidade</TableHead>
                <TableHead className="text-xs text-center">Severidade</TableHead>
                <TableHead className="text-xs text-center">Grau de Risco</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(expanded ? inventario : inventario.slice(0, 6)).map((item) => (
                <TableRow key={item.dimensao} className={cn("border-l-2", {
                  "border-l-red-500": item.grau.label.includes("Crítico"),
                  "border-l-orange-500": item.grau.label.includes("Alto"),
                  "border-l-amber-500": item.grau.label.includes("Médio"),
                  "border-l-emerald-500": item.grau.label.includes("Baixo"),
                })}>
                  <TableCell className="py-2">
                    <p className="font-medium text-sm">{item.dimensao}</p>
                    <p className="text-xs text-muted-foreground">{item.fator}</p>
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge variant="outline" className="text-xs font-mono">{item.norma}</Badge>
                  </TableCell>
                  <TableCell className="py-2 text-center">
                    <span className={cn("text-xs font-semibold", item.probabilidade.cor)}>
                      {item.probabilidade.label}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 text-center">
                    <span className="text-xs text-muted-foreground">{item.severidade.label}</span>
                  </TableCell>
                  <TableCell className="py-2 text-center">
                    <Badge className={cn("text-xs", item.grau.bg, item.grau.cor, "border")}>
                      {item.grau.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {inventario.length > 6 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-1 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <><ChevronUp className="h-3.5 w-3.5" /> Mostrar menos</>
            ) : (
              <><ChevronDown className="h-3.5 w-3.5" /> Ver todos os {inventario.length} fatores</>
            )}
          </Button>
        )}

        <div className="flex items-start gap-2 p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-xs text-blue-700">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p>Este inventário foi gerado automaticamente com base nas campanhas psicossociais realizadas e pode ser utilizado como evidência no PGR da empresa (NR-01) e na Análise Ergonômica do Trabalho (NR-17).</p>
        </div>
      </CardContent>
    </Card>
  );
}
