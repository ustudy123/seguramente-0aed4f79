import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompetenciaInput } from "@/components/ui/competencia-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePonto } from "@/hooks/usePonto";
import { usePontoFechamento } from "@/hooks/usePontoFechamento";
import { usePontoBancoHoras } from "@/hooks/usePontoBancoHoras";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { format } from "date-fns";
import { FileDown, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  const { useBancoHorasPorCompetencia } = usePontoBancoHoras();

  const year = parseInt(competencia.split("-")[0]);
  const month = parseInt(competencia.split("-")[1]);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const { data: espelhos = [] } = useEspelhos(competencia);
  const { data: bancosHoras = [] } = useBancoHorasPorCompetencia(competencia);
  const { data: registrosMes = [], isLoading: carregandoRegistros } = usePontoDiario(startDate, endDate);

  const formatMinutos = (min: number) => {
    const totalMinutos = Math.abs(min || 0);
    const h = Math.floor(totalMinutos / 60);
    const m = totalMinutos % 60;
    return `${h}h ${m.toString().padStart(2, "0")}min`;
  };

  // Saldo com sinal (negativo = devendo horas).
  const formatSaldo = (min: number) => `${(min || 0) < 0 ? "-" : ""}${formatMinutos(min)}`;

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
    const doc = new jsPDF();
    const titulo = REPORT_TYPES.find(r => r.value === tipoRelatorio)?.label || "Relatório";
    const logoColor: [number, number, number] = [15, 23, 42]; // Slate 900

    // Header logic
    const addHeader = (data: any) => {
      doc.setFontSize(20);
      doc.setTextColor(logoColor[0], logoColor[1], logoColor[2]);
      doc.text("YourEyes", 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("Controle de Ponto Inteligente", 14, 28);
      
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text(titulo.toUpperCase(), 14, 45);
      
      doc.setFontSize(10);
      doc.text(`Período: ${competencia}`, 14, 52);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 57);
      
      doc.setDrawColor(logoColor[0], logoColor[1], logoColor[2]);
      doc.setLineWidth(0.5);
      doc.line(14, 62, 196, 62);
    };

    if (tipoRelatorio === "espelho") {
      const useEspelhoData = espelhos.length > 0;
      
      const head = [["Colaborador", "CPF", "HE 50%", "HE 100%", "Faltas", "Status"]];
      let body: any[] = [];

      if (useEspelhoData) {
        body = espelhos.map(e => [
          e.colaborador_nome,
          e.colaborador_cpf,
          formatMinutos(e.total_horas_extras_50_minutos),
          formatMinutos(e.total_horas_extras_100_minutos),
          e.total_faltas,
          e.status
        ]);
      } else {
        const colabs = Array.from(new Set(registrosMes.map(r => r.colaborador_cpf)));
        body = colabs.map(cpf => {
          const r = registrosMes.find(reg => reg.colaborador_cpf === cpf);
          const regsColab = registrosMes.filter(reg => reg.colaborador_cpf === cpf);
          const totalFaltas = regsColab.filter(reg => reg.status === "falta").length;
          return [
            r?.colaborador_nome || "N/A",
            cpf,
            "-",
            "-",
            totalFaltas,
            "Aberto"
          ];
        });
      }

      autoTable(doc, {
        head: head,
        body: body,
        startY: 70,
        theme: 'striped',
        headStyles: { fillColor: logoColor, textColor: 255, fontStyle: 'bold' },
        didDrawPage: addHeader,
        margin: { top: 70 }
      });
    } else if (tipoRelatorio === "horas_extras") {
      const head = [["Colaborador", "HE 50%", "HE 100%"]];
      const heColabs = espelhos.filter(e => e.total_horas_extras_50_minutos > 0 || e.total_horas_extras_100_minutos > 0);
      
      const body = heColabs.length > 0 
        ? heColabs.map(e => [
            e.colaborador_nome,
            formatMinutos(e.total_horas_extras_50_minutos),
            formatMinutos(e.total_horas_extras_100_minutos)
          ])
        : [["Nenhuma hora extra registrada no período", "", ""]];

      autoTable(doc, {
        head: head,
        body: body,
        startY: 70,
        theme: 'striped',
        headStyles: { fillColor: logoColor, textColor: 255, fontStyle: 'bold' },
        didDrawPage: addHeader,
        margin: { top: 70 }
      });
    } else if (tipoRelatorio === "absenteismo") {
      const head = [["Colaborador", "Faltas", "Atrasos"]];
      const faltosos = registrosMes.filter(r => r.status === "falta" || r.status === "atraso");
      
      const body: any[] = [];
      if (faltosos.length > 0) {
        const colabNames = Array.from(new Set(faltosos.map(f => f.colaborador_nome)));
        colabNames.forEach(nome => {
          const totalFaltas = faltosos.filter(f => f.colaborador_nome === nome && f.status === "falta").length;
          const totalAtrasos = faltosos.filter(f => f.colaborador_nome === nome && f.status === "atraso").length;
          body.push([nome, totalFaltas, totalAtrasos]);
        });
      } else {
        body.push(["Nenhuma falta ou atraso registrado no período", "", ""]);
      }

      autoTable(doc, {
        head: head,
        body: body,
        startY: 70,
        theme: 'striped',
        headStyles: { fillColor: logoColor, textColor: 255, fontStyle: 'bold' },
        didDrawPage: addHeader,
        margin: { top: 70 }
      });
    } else if (tipoRelatorio === "banco_horas") {
      // Usa o saldo REAL apurado/lançado em ponto_banco_horas (não mais o
      // placeholder com saldo anterior zerado).
      const head = [["Colaborador", "Saldo Anterior", "Créditos", "Débitos", "Compensados", "Saldo Atual"]];
      const body = bancosHoras.map(b => [
        b.colaborador_nome,
        formatSaldo(b.saldo_anterior_minutos),
        "+" + formatMinutos(b.creditos_minutos),
        "-" + formatMinutos(b.debitos_minutos),
        formatMinutos(b.compensados_minutos),
        formatSaldo(b.saldo_atual_minutos),
      ]);

      autoTable(doc, {
        head: head,
        body: body.length > 0 ? body : [["Nenhum saldo apurado nesta competência. Use \"Apurar agora\" no Banco de Horas.", "", "", "", "", ""]],
        startY: 70,
        theme: 'striped',
        headStyles: { fillColor: logoColor, textColor: 255, fontStyle: 'bold' },
        didDrawPage: addHeader,
        margin: { top: 70 }
      });
    }

    // Add page numbers at the end
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount}`, 196, 285, { align: "right" });
    }

    doc.save(`${titulo.replace(/\s/g, "_")}_${competencia}.pdf`);
    toast.success("PDF gerado!");
  };

  const gerarExcel = () => {
    const titulo = REPORT_TYPES.find(r => r.value === tipoRelatorio)?.label || "Relatório";
    let dados: any[] = [];

    if (tipoRelatorio === "banco_horas") {
      dados = bancosHoras.map(b => ({
        Colaborador: b.colaborador_nome,
        CPF: b.colaborador_cpf,
        "Saldo Anterior (min)": b.saldo_anterior_minutos,
        "Créditos (min)": b.creditos_minutos,
        "Débitos (min)": b.debitos_minutos,
        "Compensados (min)": b.compensados_minutos,
        "Saldo Atual (min)": b.saldo_atual_minutos,
        Competência: b.competencia,
      }));
    } else if (espelhos.length > 0) {
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
    } else {
      dados = registrosMes.map(r => ({
        Data: r.data,
        Colaborador: r.colaborador_nome,
        CPF: r.colaborador_cpf,
        Entrada: r.entrada,
        "Saída Almoço": r.saida_almoco,
        "Retorno Almoço": r.retorno_almoco,
        Saída: r.saida,
        Status: r.status,
        Observação: r.observacao
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

      {/* Data preview/summary */}
      {!carregandoRegistros && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Resumo do Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-2xl font-bold">{registrosMes.length}</p>
                <p className="text-xs text-muted-foreground">Total de Batidas</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{new Set(registrosMes.map(r => r.colaborador_cpf)).size}</p>
                <p className="text-xs text-muted-foreground">Colaboradores</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-500">
                  {registrosMes.filter(r => r.status === "falta").length}
                </p>
                <p className="text-xs text-muted-foreground">Faltas Identificadas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-500">
                  {espelhos.length > 0 ? "Fechado" : "Aberto"}
                </p>
                <p className="text-xs text-muted-foreground">Status do Mês</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
