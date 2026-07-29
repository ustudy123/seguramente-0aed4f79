import { useMemo, useState } from "react";
import { ShieldCheck, Download, FileText, Loader2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { INRColaborador } from "@/hooks/useINR";
import { gerarEvidenciaNR1, NIVEL_LABEL } from "@/lib/feriasEvidenciaNR1";
import { cn } from "@/lib/utils";

interface Props {
  ranking: INRColaborador[];
  empresaNome?: string;
}

export function FeriasEvidenciaNR1({ ranking, empresaNome }: Props) {
  const evidencia = useMemo(() => gerarEvidenciaNR1(ranking), [ranking]);
  const [exportando, setExportando] = useState(false);

  const exportarPDF = async () => {
    setExportando(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF();
      const ml = 14;
      let y = 18;

      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.text("Evidência de Monitoramento — Fatores Organizacionais", ml, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(90, 90, 90);
      doc.text("Férias como indicador de risco psicossocial · NR-1 / Portaria MTE 1.419/2024", ml, y);
      y += 5;
      if (empresaNome) { doc.text(empresaNome, ml, y); y += 5; }
      doc.text(`Gerado em ${new Date(evidencia.geradoEm).toLocaleString("pt-BR")}`, ml, y);
      doc.setTextColor(0, 0, 0);
      y += 8;

      // Resumo
      autoTable(doc, {
        startY: y,
        head: [["Indicador", "Valor"]],
        body: [
          ["Colaboradores monitorados", String(evidencia.totalColaboradores)],
          ["Índice de descanso efetivo (geral)", `${evidencia.indiceDescansoGeral}%`],
          ["Casos críticos", String(evidencia.criticos)],
          ["Casos de risco alto", String(evidencia.altos)],
          ["Com férias vencidas", String(evidencia.comFeriasVencidas)],
        ],
        headStyles: { fillColor: [30, 64, 175], fontSize: 9, textColor: 255 },
        bodyStyles: { fontSize: 9 },
        margin: { left: ml, right: ml },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

      // Por departamento
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Risco organizacional por departamento", ml, y);
      y += 2;
      autoTable(doc, {
        startY: y + 2,
        head: [["Departamento", "Colab.", "Score médio", "Descanso", "Críticos", "Nível"]],
        body: evidencia.departamentos.map(d => [
          d.departamento, String(d.totalColaboradores), `${d.scoreMedio}/100`,
          `${d.indiceDescanso}%`, String(d.criticos + d.altos), NIVEL_LABEL[d.nivelArea].label,
        ]),
        headStyles: { fillColor: [30, 64, 175], fontSize: 9, textColor: 255 },
        bodyStyles: { fontSize: 8 },
        margin: { left: ml, right: ml },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

      // Achados
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Achados para o inventário de riscos", ml, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      for (const a of evidencia.achados) {
        const linhas = doc.splitTextToSize(`• ${a}`, 180);
        doc.text(linhas, ml, y);
        y += linhas.length * 5 + 1;
      }
      y += 4;
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      const rodape = doc.splitTextToSize(
        "Documento gerado pelo YourEyes a partir do cruzamento de dados de férias, ponto, afastamentos e " +
        "avaliação psicossocial na mesma base. Serve como evidência de monitoramento e controle de fatores " +
        "organizacionais de risco, conforme exigido pela NR-1 após a Portaria MTE 1.419/2024.", 180);
      doc.text(rodape, ml, y);

      doc.save(`evidencia_nr1_ferias_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Evidência exportada.");
    } catch (e) {
      toast.error("Falha ao exportar", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setExportando(false);
    }
  };

  if (ranking.filter(r => r.score > 0).length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>Sem sinais de risco organizacional no momento. A evidência aparece quando houver fatores a documentar.</p>
      </div>
    );
  }

  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              Evidência NR-1 — fatores organizacionais
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Cruzamento de férias, ponto, afastamentos e avaliação psicossocial. Demonstra
              monitoramento dos fatores que a Portaria MTE 1.419/2024 incorporou à NR-1.
            </p>
          </div>
          <Button onClick={exportarPDF} disabled={exportando} className="gap-2">
            {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar para o inventário
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Resumo label="Índice de descanso" valor={`${evidencia.indiceDescansoGeral}%`}
            tom={evidencia.indiceDescansoGeral < 70 ? "alerta" : "ok"} />
          <Resumo label="Monitorados" valor={String(evidencia.totalColaboradores)} />
          <Resumo label="Críticos" valor={String(evidencia.criticos)}
            tom={evidencia.criticos > 0 ? "alerta" : "neutro"} />
          <Resumo label="Férias vencidas" valor={String(evidencia.comFeriasVencidas)}
            tom={evidencia.comFeriasVencidas > 0 ? "alerta" : "neutro"} />
        </div>

        {/* Departamentos */}
        <div>
          <p className="text-xs font-medium mb-2 text-muted-foreground">Risco por departamento</p>
          <div className="space-y-1.5">
            {evidencia.departamentos.map(d => (
              <div key={d.departamento} className="flex items-center gap-3 rounded-lg border p-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{d.departamento}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {d.totalColaboradores} colab. · descanso {d.indiceDescanso}%
                    {d.destaques.length > 0 && ` · ${d.destaques.join(", ")}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold">{d.scoreMedio}<span className="text-[10px] text-muted-foreground">/100</span></div>
                </div>
                <Badge className={cn("text-[10px]", NIVEL_LABEL[d.nivelArea].cls)}>
                  {NIVEL_LABEL[d.nivelArea].label}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Achados */}
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
          <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5 text-blue-800">
            <FileText className="h-3.5 w-3.5" /> Achados para o inventário de riscos
          </p>
          <ul className="space-y-1">
            {evidencia.achados.map((a, i) => (
              <li key={i} className="text-xs text-blue-900/80 flex gap-1.5">
                <span className="shrink-0">•</span><span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function Resumo({ label, valor, tom = "neutro" }: {
  label: string; valor: string; tom?: "ok" | "alerta" | "neutro";
}) {
  return (
    <div className={cn("rounded-lg border p-2.5",
      tom === "ok" && "border-emerald-200 bg-emerald-50/40",
      tom === "alerta" && "border-amber-200 bg-amber-50/40")}>
      <div className="text-xl font-bold">{valor}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
