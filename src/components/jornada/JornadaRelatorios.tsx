import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { FileDown, FileSpreadsheet, FileText, Download } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

type TipoRelatorio = "individual" | "coletivo" | "conformidade" | "alertas" | "completo";

const TIPOS: Record<TipoRelatorio, string> = {
  individual: "Relatório Individual de Jornada",
  coletivo: "Relatório de Carga por Setor",
  conformidade: "Relatório de Conformidade Legal",
  alertas: "Relatório de Alertas",
  completo: "Relatório Integrado (NR-1 / PGR)",
};

export function JornadaRelatorios() {
  const { tenantId } = useTenant();
  const [tipo, setTipo] = useState<TipoRelatorio>("completo");
  const [formato, setFormato] = useState<"pdf" | "excel">("excel");
  const [gerando, setGerando] = useState(false);

  const gerarRelatorio = async () => {
    if (!tenantId) return;
    setGerando(true);

    try {
      const [{ data: analises }, { data: alertas }] = await Promise.all([
        supabase.from("jornada_analises").select("*").eq("tenant_id", tenantId).order("colaborador_nome"),
        supabase.from("jornada_alertas").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(200),
      ]);

      if (!analises || analises.length === 0) {
        toast.error("Nenhuma análise disponível. Execute a análise no Dashboard primeiro.");
        return;
      }

      if (formato === "excel") {
        gerarExcel(analises || [], alertas || [], tipo);
      } else {
        gerarPDF(analises || [], alertas || [], tipo);
      }

      toast.success("Relatório gerado com sucesso");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGerando(false);
    }
  };

  const gerarExcel = (analises: any[], alertas: any[], tipo: TipoRelatorio) => {
    const wb = XLSX.utils.book_new();

    if (tipo === "individual" || tipo === "completo") {
      const wsData = analises.map(a => ({
        "Colaborador": a.colaborador_nome,
        "CPF": a.colaborador_cpf,
        "Departamento": a.departamento || "—",
        "Cargo": a.cargo || "—",
        "Período": `${a.periodo_inicio} a ${a.periodo_fim}`,
        "Dias Trabalhados": a.dias_trabalhados,
        "Média h/dia": Number(a.media_diaria_horas).toFixed(1),
        "Média h/sem": Number(a.media_semanal_horas).toFixed(1),
        "Total HE": Number(a.total_horas_extras).toFixed(1),
        "Atrasos": a.total_atrasos,
        "Ajustes Manuais": a.total_ajustes_manuais,
        "Violações Intervalo": a.violacoes_intervalo,
        "Violações Interjornada": a.violacoes_interjornada,
        "Violações Jornada": a.violacoes_jornada_diaria,
        "Violações HE": a.violacoes_horas_extras,
        "Violações DSR": a.violacoes_dsr || 0,
        "Nível Risco": a.nivel_risco,
        "Score Risco": Number(a.score_risco).toFixed(1),
        "Conformidade": a.status_conformidade,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wsData), "Individual");
    }

    if (tipo === "coletivo" || tipo === "completo") {
      const depts = new Map<string, any[]>();
      analises.forEach(a => {
        const d = a.departamento || "Sem departamento";
        if (!depts.has(d)) depts.set(d, []);
        depts.get(d)!.push(a);
      });
      const wsData = Array.from(depts.entries()).map(([dept, items]) => ({
        "Departamento": dept,
        "Colaboradores": items.length,
        "Média h/dia": (items.reduce((s, i) => s + Number(i.media_diaria_horas || 0), 0) / items.length).toFixed(1),
        "Total HE": items.reduce((s, i) => s + Number(i.total_horas_extras || 0), 0).toFixed(0),
        "Risco Alto": items.filter(i => i.nivel_risco === "alto").length,
        "Não Conforme": items.filter(i => i.status_conformidade === "nao_conforme").length,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wsData), "Coletivo");
    }

    if (tipo === "conformidade" || tipo === "completo") {
      const wsData = analises.map(a => ({
        "Colaborador": a.colaborador_nome,
        "Status": a.status_conformidade === "conforme" ? "Conforme" : a.status_conformidade === "atencao" ? "Em Atenção" : "Não Conforme",
        "Violações Intervalo": a.violacoes_intervalo,
        "Violações Interjornada": a.violacoes_interjornada,
        "Violações Jornada Diária": a.violacoes_jornada_diaria,
        "Violações HE": a.violacoes_horas_extras,
        "Violações DSR": a.violacoes_dsr || 0,
        "Score Risco": Number(a.score_risco).toFixed(1),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wsData), "Conformidade");
    }

    if (tipo === "alertas" || tipo === "completo") {
      const wsData = alertas.map(a => ({
        "Colaborador": a.colaborador_nome,
        "Tipo": a.tipo,
        "Severidade": a.severidade,
        "Título": a.titulo,
        "Descrição": a.descricao,
        "Ação Sugerida": a.acao_sugerida || "",
        "Resolvido": a.resolvido ? "Sim" : "Não",
        "Data": a.created_at?.slice(0, 10),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wsData), "Alertas");
    }

    XLSX.writeFile(wb, `relatorio_jornada_${tipo}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const gerarPDF = (analises: any[], alertas: any[], tipo: TipoRelatorio) => {
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(16);
    doc.text(TIPOS[tipo], 14, y);
    y += 10;
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, y);
    y += 10;

    doc.setFontSize(11);
    doc.text("Resumo Geral", 14, y);
    y += 7;

    doc.setFontSize(9);
    const totalColab = new Set(analises.map(a => a.colaborador_cpf)).size;
    const mediaGeral = (analises.reduce((s, a) => s + Number(a.media_diaria_horas || 0), 0) / analises.length).toFixed(1);
    const totalHE = analises.reduce((s, a) => s + Number(a.total_horas_extras || 0), 0).toFixed(0);
    const riscoAlto = analises.filter(a => a.nivel_risco === "alto").length;
    const naoConf = analises.filter(a => a.status_conformidade === "nao_conforme").length;

    const resumo = [
      `Colaboradores analisados: ${totalColab}`,
      `Média geral h/dia: ${mediaGeral}h`,
      `Total horas extras: ${totalHE}h`,
      `Colaboradores risco alto: ${riscoAlto}`,
      `Colaboradores não conformes: ${naoConf}`,
      `Alertas pendentes: ${alertas.filter(a => !a.resolvido).length}`,
    ];
    resumo.forEach(line => {
      doc.text(line, 14, y);
      y += 5;
    });

    y += 5;

    if (tipo === "individual" || tipo === "completo") {
      doc.setFontSize(11);
      doc.text("Análise por Colaborador", 14, y);
      y += 7;
      doc.setFontSize(8);

      analises.slice(0, 30).forEach(a => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`${a.colaborador_nome} | Média: ${Number(a.media_diaria_horas).toFixed(1)}h/dia | HE: ${Number(a.total_horas_extras).toFixed(0)}h | Risco: ${a.nivel_risco} | ${a.status_conformidade}`, 14, y);
        y += 4;
      });
      y += 5;
    }

    if (tipo === "alertas" || tipo === "completo") {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(11);
      doc.text("Alertas", 14, y);
      y += 7;
      doc.setFontSize(8);

      alertas.slice(0, 20).forEach(a => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`[${a.severidade?.toUpperCase()}] ${a.titulo}`, 14, y);
        y += 4;
        if (a.acao_sugerida) {
          doc.text(`   → ${a.acao_sugerida}`, 14, y);
          y += 4;
        }
      });
    }

    doc.save(`relatorio_jornada_${tipo}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileDown className="h-5 w-5" /> Relatórios
        </h3>
        <p className="text-sm text-muted-foreground">
          Exporte relatórios de jornada em PDF ou Excel
        </p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Tipo de Relatório</label>
              <Select value={tipo} onValueChange={v => setTipo(v as TipoRelatorio)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPOS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Formato</label>
              <Select value={formato} onValueChange={v => setFormato(v as "pdf" | "excel")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excel">
                    <span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)</span>
                  </SelectItem>
                  <SelectItem value="pdf">
                    <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> PDF</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">O que será incluído:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              {tipo === "individual" && <><li>• Análise detalhada por colaborador</li><li>• Indicadores: média diária, HE, violações, risco</li></>}
              {tipo === "coletivo" && <><li>• Comparativo por departamento/setor</li><li>• Total de HE e colaboradores em risco por setor</li></>}
              {tipo === "conformidade" && <><li>• Status de conformidade por colaborador</li><li>• Detalhamento de violações CLT</li></>}
              {tipo === "alertas" && <><li>• Lista completa de alertas gerados</li><li>• Severidade, descrição e ação sugerida</li></>}
              {tipo === "completo" && <><li>• Resumo executivo com KPIs</li><li>• Análise individual + coletiva + conformidade + alertas</li><li>• Ideal para NR-1 / PGR / auditoria</li></>}
            </ul>
          </div>

          <Button onClick={gerarRelatorio} disabled={gerando} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            {gerando ? "Gerando..." : `Exportar ${formato === "pdf" ? "PDF" : "Excel"}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
