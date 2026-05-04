import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompetenciaInput } from "@/components/ui/competencia-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePonto } from "@/hooks/usePonto";
import { usePontoFechamento } from "@/hooks/usePontoFechamento";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { format } from "date-fns";
import { FileDown, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

type ReportType = "espelho" | "horas_extras" | "banco_horas" | "absenteismo" | "afd";

const REPORT_TYPES: { value: ReportType; label: string; desc: string }[] = [
  { value: "espelho", label: "Espelho de Ponto", desc: "Resumo mensal de marcações por colaborador" },
  { value: "horas_extras", label: "Horas Extras", desc: "Detalhamento de horas extras do período" },
  { value: "banco_horas", label: "Banco de Horas", desc: "Saldo e movimentações do banco de horas" },
  { value: "absenteismo", label: "Absenteísmo", desc: "Relatório de faltas e atrasos" },
  { value: "afd", label: "AFD (Arquivo Fonte de Dados)", desc: "Arquivo legal conforme Portaria 671" },
];

export function PontoRelatoriosTab() {
  const [competencia, setCompetencia] = useState(format(new Date(), "yyyy-MM"));
  const [tipoRelatorio, setTipoRelatorio] = useState<ReportType>("espelho");
  const [formatoExport, setFormatoExport] = useState<"pdf" | "excel">("pdf");
  const [gerando, setGerando] = useState(false);

  const { usePontoDiario } = usePonto();
  const { useEspelhos } = usePontoFechamento();

  const startDate = new Date(competencia + "-01");
  const { data: espelhos = [] } = useEspelhos(competencia);

  const formatMinutos = (min: number) => `${Math.floor(Math.abs(min) / 60)}h ${Math.abs(min) % 60}min`;

  const gerarRelatorio = async () => {
    setGerando(true);
    try {
      if (tipoRelatorio === "afd") {
        await gerarAFD();
        return;
      }

      if (formatoExport === "pdf") {
        gerarPDF();
      } else {
        gerarExcel();
      }
    } catch (error) {
      toast.error("Erro ao gerar relatório");
    } finally {
      setGerando(false);
    }
  };

  const gerarAFD = async () => {
    // AFD - Arquivo Fonte de Dados (formato texto conforme Portaria 671)
    // Puxa marcações REAIS da tabela ponto_marcacoes
    const startDate2 = `${competencia}-01`;
    const endMonth2 = parseInt(competencia.split("-")[1]);
    const endYear2 = parseInt(competencia.split("-")[0]);
    const lastDay2 = new Date(endYear2, endMonth2, 0).getDate();
    const endDate2 = `${competencia}-${String(lastDay2).padStart(2, "0")}`;

    const { data: marcacoes, error } = await fromTable("ponto_marcacoes")
      .select("*")
      .gte("data_marcacao", startDate2)
      .lte("data_marcacao", endDate2)
      .order("data_marcacao")
      .order("hora_marcacao") as { data: any[] | null; error: any };

    if (error) {
      toast.error("Erro ao buscar marcações: " + error.message);
      return;
    }

    const registros = marcacoes || [];
    let conteudo = "";

    // Registro tipo 1 - Cabeçalho
    const dataGeracao = format(new Date(), "ddMMyyyy");
    const horaGeracao = format(new Date(), "HHmmss");
    const cnpj = "00000000000000"; // placeholder
    const razaoSocial = "YourEyes".padEnd(150);
    conteudo += `1${cnpj}${razaoSocial}${dataGeracao}${horaGeracao}\n`;

    // Registro tipo 2 - Identificação do REP-P
    conteudo += `2YourEyes REP-P v1.0\n`;

    // Registro tipo 3 - Marcações de ponto (uma por linha)
    let seq = 0;
    registros.forEach((m: any) => {
      seq++;
      const nsr = String(seq).padStart(10, "0");
      const tipoReg = "3";
      const dataMarcacao = (m.data_marcacao || "").replace(/-/g, "");
      const horaMarcacao = (m.hora_marcacao || "").replace(/:/g, "").substring(0, 4);
      const cpf = (m.colaborador_cpf || "").replace(/\D/g, "").padStart(11, "0");
      
      // Formato: 3 + NSR(10) + Tipo(1) + Data(8) + Hora(4) + CPF(11)
      conteudo += `${tipoReg}${nsr}1${dataMarcacao}${horaMarcacao}${cpf}\n`;
    });

    // Registro tipo 9 - Trailer
    const totalRegistros = String(seq + 2).padStart(10, "0");
    conteudo += `9${totalRegistros}\n`;

    if (seq === 0) {
      toast.warning("Nenhuma marcação encontrada para esta competência.");
      return;
    }

    const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AFD_${competencia}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`AFD gerado com ${seq} marcações!`);
  };

  const gerarPDF = () => {
    const pdf = new jsPDF();
    const titulo = REPORT_TYPES.find(r => r.value === tipoRelatorio)?.label || "Relatório";

    pdf.setFontSize(16);
    pdf.text(`${titulo} — ${competencia}`, 20, 20);
    pdf.setFontSize(9);
    pdf.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 20, 28);

    let y = 40;

    if (tipoRelatorio === "espelho") {
      espelhos.forEach(e => {
        if (y > 270) { pdf.addPage(); y = 20; }
        pdf.setFontSize(11);
        pdf.text(e.colaborador_nome, 20, y); y += 6;
        pdf.setFontSize(9);
        pdf.text(`CPF: ${e.colaborador_cpf} | HE 50%: ${formatMinutos(e.total_horas_extras_50_minutos)} | HE 100%: ${formatMinutos(e.total_horas_extras_100_minutos)} | Faltas: ${e.total_faltas} | Status: ${e.status}`, 20, y);
        y += 10;
      });
    } else if (tipoRelatorio === "horas_extras") {
      const heColabs = espelhos.filter(e => e.total_horas_extras_50_minutos > 0 || e.total_horas_extras_100_minutos > 0);
      heColabs.forEach(e => {
        if (y > 270) { pdf.addPage(); y = 20; }
        pdf.setFontSize(10);
        pdf.text(`${e.colaborador_nome}: HE 50% = ${formatMinutos(e.total_horas_extras_50_minutos)}, HE 100% = ${formatMinutos(e.total_horas_extras_100_minutos)}`, 20, y);
        y += 8;
      });
      if (heColabs.length === 0) pdf.text("Nenhuma hora extra registrada.", 20, y);
    } else if (tipoRelatorio === "absenteismo") {
      const faltosos = espelhos.filter(e => e.total_faltas > 0);
      faltosos.forEach(e => {
        if (y > 270) { pdf.addPage(); y = 20; }
        pdf.setFontSize(10);
        pdf.text(`${e.colaborador_nome}: ${e.total_faltas} falta(s), Atrasos: ${formatMinutos(e.total_atrasos_minutos)}`, 20, y);
        y += 8;
      });
      if (faltosos.length === 0) pdf.text("Nenhuma falta registrada.", 20, y);
    }

    pdf.save(`${titulo.replace(/\s/g, "_")}_${competencia}.pdf`);
    toast.success("PDF gerado!");
  };

  const gerarExcel = () => {
    const titulo = REPORT_TYPES.find(r => r.value === tipoRelatorio)?.label || "Relatório";
    let dados: any[] = [];

    if (tipoRelatorio === "espelho" || tipoRelatorio === "horas_extras" || tipoRelatorio === "absenteismo") {
      dados = espelhos.map(e => ({
        Colaborador: e.colaborador_nome,
        CPF: e.colaborador_cpf,
        "HE 50% (min)": e.total_horas_extras_50_minutos,
        "HE 100% (min)": e.total_horas_extras_100_minutos,
        "Adic. Noturno (min)": e.total_adicional_noturno_minutos,
        Faltas: e.total_faltas,
        "Atrasos (min)": e.total_atrasos_minutos,
        Status: e.status,
      }));
    }

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, titulo);
    XLSX.writeFile(wb, `${titulo.replace(/\s/g, "_")}_${competencia}.xlsx`);
    toast.success("Excel gerado!");
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileDown className="w-5 h-5 text-primary" /> Relatórios do Ponto
        </h3>
        <p className="text-sm text-muted-foreground">Gere relatórios legais e gerenciais</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Competência</Label>
          <CompetenciaInput value={competencia} onChange={setCompetencia} />
        </div>
        <div className="space-y-2">
          <Label>Tipo de Relatório</Label>
          <Select value={tipoRelatorio} onValueChange={v => setTipoRelatorio(v as ReportType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {REPORT_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Formato</Label>
          {tipoRelatorio === "afd" ? (
            <Input value="TXT (Portaria 671)" disabled />
          ) : (
            <Select value={formatoExport} onValueChange={v => setFormatoExport(v as "pdf" | "excel")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="excel">Excel</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Report description */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">{REPORT_TYPES.find(r => r.value === tipoRelatorio)?.label}</p>
              <p className="text-sm text-muted-foreground">{REPORT_TYPES.find(r => r.value === tipoRelatorio)?.desc}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={gerarRelatorio} disabled={gerando} className="w-full md:w-auto">
        <Download className="w-4 h-4 mr-2" />
        {gerando ? "Gerando..." : "Gerar Relatório"}
      </Button>

      {/* Info about AFD/AEFP */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <h4 className="font-medium mb-2">📋 Arquivos Legais (Portaria MTP 671/2021)</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>AFD</strong> — Arquivo Fonte de Dados: registro imutável de todas as marcações (.txt)</li>
            <li>• <strong>AEFP</strong> — Espelho de Ponto: gerado automaticamente na aba Fechamento</li>
            <li>• Retenção mínima: 5 anos para fiscalização trabalhista</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
