import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompetenciaInput } from "@/components/ui/competencia-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Download, FileSpreadsheet } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

interface Props { hub: any; }

const acaoLabels: Record<string, string> = {
  enviado: "Enviado", recebido: "Recebido", substituido: "Substituído",
  aprovado: "Aprovado", rejeitado: "Rejeitado", reaberto: "Reaberto",
  criado: "Criado", atualizado: "Atualizado", pago: "Pago", vencido: "Vencido",
};

const acaoColors: Record<string, string> = {
  enviado: "bg-blue-100 text-blue-800", recebido: "bg-green-100 text-green-800",
  substituido: "bg-orange-100 text-orange-800", aprovado: "bg-emerald-100 text-emerald-800",
  rejeitado: "bg-red-100 text-red-800", reaberto: "bg-amber-100 text-amber-800",
  criado: "bg-violet-100 text-violet-800", atualizado: "bg-cyan-100 text-cyan-800",
  pago: "bg-green-100 text-green-800", vencido: "bg-red-100 text-red-800",
};

const perfilLabels: Record<string, string> = {
  rh: "RH", contador: "Contador", financeiro: "Financeiro", admin: "Admin", sistema: "Sistema",
};

export function HubHistorico({ hub }: Props) {
  const { historico, loading } = hub;
  const [filtroAcao, setFiltroAcao] = useState("todos");
  const [filtroCompetencia, setFiltroCompetencia] = useState("");

  const filtered = historico.filter((h: any) => {
    if (filtroAcao !== "todos" && h.acao !== filtroAcao) return false;
    if (filtroCompetencia && h.competencia !== filtroCompetencia) return false;
    return true;
  });

  const exportData = filtered.map((h: any) => ({
    Data: format(parseISO(h.created_at), "dd/MM/yyyy HH:mm"),
    Usuário: h.usuario_nome || "Sistema",
    Perfil: perfilLabels[h.perfil] || h.perfil || "",
    Competência: h.competencia || "",
    "Tipo Documento": h.tipo_documento || "",
    Ação: acaoLabels[h.acao] || h.acao,
    Descrição: h.descricao || "",
  }));

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Histórico");
    XLSX.writeFile(wb, `historico-hub-contabil-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Excel exportado!");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Histórico de Movimentações — Hub Contábil", 14, 15);
    doc.setFontSize(8);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 22);

    let y = 30;
    const headers = ["Data", "Usuário", "Perfil", "Competência", "Ação", "Descrição"];
    const colWidths = [35, 40, 25, 25, 25, 120];

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    headers.forEach((h, i) => {
      const x = 14 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.text(h, x, y);
    });
    y += 5;
    doc.setFont("helvetica", "normal");

    exportData.forEach((row) => {
      if (y > 190) { doc.addPage(); y = 15; }
      const vals = [row.Data, row.Usuário, row.Perfil, row.Competência, row.Ação, row.Descrição];
      vals.forEach((v, i) => {
        const x = 14 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.text(String(v || "").substring(0, 50), x, y);
      });
      y += 4;
    });

    doc.save(`historico-hub-contabil-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("PDF exportado!");
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2"><History className="w-5 h-5" /> Histórico de Movimentações</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={filtered.length === 0}>
            <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportPDF} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <span className="text-xs text-muted-foreground">Ação</span>
          <Select value={filtroAcao} onValueChange={setFiltroAcao}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {Object.entries(acaoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Competência</span>
          <CompetenciaInput value={filtroCompetencia} onChange={setFiltroCompetencia} className="w-[160px]" />
        </div>
        {(filtroAcao !== "todos" || filtroCompetencia) && (
          <Button variant="ghost" size="sm" onClick={() => { setFiltroAcao("todos"); setFiltroCompetencia(""); }}>Limpar</Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhum registro encontrado.</CardContent></Card>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((h: any) => (
            <Card key={h.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={acaoColors[h.acao] || "bg-gray-100 text-gray-800"}>{acaoLabels[h.acao] || h.acao}</Badge>
                    {h.competencia && <Badge variant="outline" className="text-xs">{h.competencia}</Badge>}
                    {h.tipo_documento && <span className="text-xs text-muted-foreground">{h.tipo_documento}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{h.descricao}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-medium">{h.usuario_nome || "Sistema"}</p>
                  {h.perfil && <Badge variant="secondary" className="text-[10px]">{perfilLabels[h.perfil] || h.perfil}</Badge>}
                  <p className="text-[10px] text-muted-foreground">{format(parseISO(h.created_at), "dd/MM/yyyy HH:mm")}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
