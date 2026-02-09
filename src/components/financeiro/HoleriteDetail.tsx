import { useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, X, User, Briefcase, Building2, Calendar, Send, FolderOpen, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FolhaItem } from "@/hooks/useFinanceiro";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

// Dados fictícios para demonstração
interface EventoFicticio {
  codigo: string;
  descricao: string;
  referencia: string;
  tipo: "provento" | "desconto";
  valor: number;
}

function gerarEventosFicticios(salarioBase: number): EventoFicticio[] {
  const sal = salarioBase || 4500;
  return [
    { codigo: "001", descricao: "Salário Base", referencia: "30 dias", tipo: "provento", valor: sal },
    { codigo: "003", descricao: "Hora Extra 50%", referencia: "8,5h", tipo: "provento", valor: +(sal / 220 * 1.5 * 8.5).toFixed(2) },
    { codigo: "004", descricao: "Hora Extra 100%", referencia: "4h", tipo: "provento", valor: +(sal / 220 * 2 * 4).toFixed(2) },
    { codigo: "006", descricao: "Adicional Noturno", referencia: "20%", tipo: "provento", valor: +(sal * 0.05).toFixed(2) },
    { codigo: "010", descricao: "DSR s/ Horas Extras", referencia: "", tipo: "provento", valor: +(sal * 0.02).toFixed(2) },
    { codigo: "101", descricao: "INSS", referencia: "14%", tipo: "desconto", valor: +(sal * 0.14).toFixed(2) },
    { codigo: "102", descricao: "IRRF", referencia: "15%", tipo: "desconto", valor: +(sal * 0.075).toFixed(2) },
    { codigo: "110", descricao: "Vale Transporte", referencia: "6%", tipo: "desconto", valor: +(sal * 0.06).toFixed(2) },
    { codigo: "111", descricao: "Vale Alimentação", referencia: "", tipo: "desconto", valor: 150 },
    { codigo: "120", descricao: "Plano de Saúde", referencia: "", tipo: "desconto", valor: 289.90 },
    { codigo: "121", descricao: "Plano Odontológico", referencia: "", tipo: "desconto", valor: 45.00 },
  ];
}

interface HoleriteDetailProps {
  open: boolean;
  onClose: () => void;
  item: FolhaItem | null;
  competencia: string;
}

function gerarPDFBlob(item: FolhaItem, competencia: string, eventos: EventoFicticio[], proventos: EventoFicticio[], descontos: EventoFicticio[], totalProventos: number, totalDescontos: number, totalLiquido: number, fmtMoeda: (v: number) => string, formatCompetencia: (c: string) => string, dadosFicticios: any): Blob {
  const doc = new jsPDF("p", "mm", "a4");
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("SEGURAMENTE", margin, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Recibo de Pagamento de Salário", margin, 19);
  doc.text(`Competência: ${formatCompetencia(competencia)}`, margin, 25);
  y = 38;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DO COLABORADOR", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const infoLines = [
    [`Nome: ${item.colaborador_nome}`, `Matrícula: ${dadosFicticios.matricula}`],
    [`CPF: ${item.colaborador_cpf || "***.***.***-**"}`, `Admissão: ${dadosFicticios.admissao}`],
    [`Cargo: ${item.cargo || "Não informado"}`, `CBO: ${dadosFicticios.cbo}`],
    [`Departamento: ${item.departamento || "Não informado"}`, `PIS: ${dadosFicticios.pis}`],
  ];
  infoLines.forEach(([left, right]) => {
    doc.text(left, margin, y);
    doc.text(right, margin + contentW / 2, y);
    y += 5;
  });

  y += 3;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  doc.setFillColor(243, 244, 246);
  doc.rect(margin, y - 3, contentW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Cód.", margin + 2, y + 1);
  doc.text("Descrição", margin + 18, y + 1);
  doc.text("Referência", margin + 90, y + 1);
  doc.text("Proventos", margin + 120, y + 1);
  doc.text("Descontos", margin + 150, y + 1);
  y += 8;

  doc.setFont("helvetica", "normal");
  proventos.forEach((ev) => {
    doc.text(ev.codigo, margin + 2, y);
    doc.text(ev.descricao, margin + 18, y);
    doc.text(ev.referencia, margin + 90, y);
    doc.text(fmtMoeda(ev.valor), margin + 120, y);
    y += 5;
  });

  descontos.forEach((ev) => {
    doc.text(ev.codigo, margin + 2, y);
    doc.text(ev.descricao, margin + 18, y);
    doc.text(ev.referencia, margin + 90, y);
    doc.text("", margin + 120, y);
    doc.text(fmtMoeda(ev.valor), margin + 150, y);
    y += 5;
  });

  y += 3;
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Total Proventos:", margin + 70, y);
  doc.text(`R$ ${fmtMoeda(totalProventos)}`, margin + 120, y);
  y += 6;
  doc.text("Total Descontos:", margin + 70, y);
  doc.setTextColor(220, 38, 38);
  doc.text(`R$ ${fmtMoeda(totalDescontos)}`, margin + 150, y);
  y += 6;
  doc.setTextColor(0, 0, 0);

  doc.setFillColor(30, 64, 175);
  doc.rect(margin + 60, y - 4, contentW - 60, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(`LÍQUIDO A RECEBER: R$ ${fmtMoeda(totalLiquido)}`, margin + 65, y + 3);

  y += 18;
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.text(`Base INSS: R$ ${fmtMoeda(dadosFicticios.baseINSS)}   |   Base IRRF: R$ ${fmtMoeda(dadosFicticios.baseIRRF)}   |   Base FGTS: R$ ${fmtMoeda(dadosFicticios.baseFGTS)}   |   FGTS do Mês: R$ ${fmtMoeda(dadosFicticios.fgts)}`, margin, y);

  y += 15;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.line(margin, y, margin + 70, y);
  y += 4;
  doc.text("Assinatura do Empregador", margin, y);

  doc.line(margin + 100, y - 4, pageW - margin, y - 4);
  doc.text("Assinatura do Empregado", margin + 100, y);

  return doc.output("blob");
}

export const HoleriteDetail = ({ open, onClose, item, competencia }: HoleriteDetailProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const { tenantId, user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [archiving, setArchiving] = useState(false);
  const [archived, setArchived] = useState(false);
  const [sendingSignature, setSendingSignature] = useState(false);
  const [sentSignature, setSentSignature] = useState(false);

  if (!item) return null;

  const eventos = gerarEventosFicticios(item.salario_base);
  const proventos = eventos.filter(e => e.tipo === "provento");
  const descontos = eventos.filter(e => e.tipo === "desconto");
  const totalProventos = proventos.reduce((s, e) => s + e.valor, 0);
  const totalDescontos = descontos.reduce((s, e) => s + e.valor, 0);
  const totalLiquido = totalProventos - totalDescontos;

  const fmtMoeda = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  const formatCompetencia = (comp: string) => {
    const [y, m] = comp.split("-");
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${meses[Number(m) - 1]} de ${y}`;
  };

  const dadosFicticios = {
    matricula: `MAT-${(Math.random() * 9000 + 1000).toFixed(0)}`,
    admissao: "15/03/2022",
    ctps: "12345/001-SP",
    pis: "123.45678.90-1",
    cbo: "2524-05",
    fgts: +(item.salario_base * 0.08).toFixed(2),
    baseINSS: totalProventos,
    baseIRRF: totalProventos - totalProventos * 0.14,
    baseFGTS: totalProventos,
  };

  const generatePdfBlob = () => {
    return gerarPDFBlob(item, competencia, eventos, proventos, descontos, totalProventos, totalDescontos, totalLiquido, fmtMoeda, formatCompetencia, dadosFicticios);
  };

  const handleDownloadPDF = () => {
    const blob = generatePdfBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `holerite_${item.colaborador_nome.replace(/\s+/g, "_")}_${competencia}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const findOrCreateColaboradorPasta = async (): Promise<string | null> => {
    if (!tenantId || !item.colaborador_id) return null;

    // Try to find existing collaborator folder
    const { data: existingPasta } = await supabase
      .from("documento_pastas")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("colaborador_id", item.colaborador_id)
      .eq("tipo", "colaborador")
      .maybeSingle();

    return existingPasta?.id || null;
  };

  const handleArchive = async () => {
    if (!tenantId || !user) return toast.error("Usuário não autenticado");
    setArchiving(true);
    try {
      const blob = generatePdfBlob();
      const fileName = `holerite_${competencia}_${item.colaborador_nome.replace(/\s+/g, "_")}.pdf`;
      const storagePath = item.colaborador_id
        ? `${tenantId}/colaboradores/${item.colaborador_id}/${Date.now()}_${fileName}`
        : `${tenantId}/${Date.now()}_${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(storagePath, blob, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw uploadError;

      // Find collaborator folder
      const pastaId = await findOrCreateColaboradorPasta();

      // Create document record
      const { error: docError } = await supabase
        .from("documentos" as never)
        .insert({
          tenant_id: tenantId,
          colaborador_id: item.colaborador_id || null,
          colaborador_nome: item.colaborador_nome,
          colaborador_cpf: item.colaborador_cpf || null,
          nome_arquivo: storagePath,
          nome_original: fileName,
          tipo: "Holerite",
          tamanho: blob.size,
          mime_type: "application/pdf",
          storage_path: storagePath,
          status: "valido",
          observacoes: `Holerite competência ${formatCompetencia(competencia)}`,
          criado_por: user.id,
          criado_por_nome: profile?.nome_completo,
          pasta_id: pastaId,
        } as never);

      if (docError) {
        await supabase.storage.from("documentos").remove([storagePath]);
        throw docError;
      }

      queryClient.invalidateQueries({ queryKey: ["documentos"] });
      queryClient.invalidateQueries({ queryKey: ["documentos-com-pasta"] });
      setArchived(true);
      toast.success("Holerite arquivado na pasta do colaborador!");
    } catch (err: any) {
      toast.error("Erro ao arquivar: " + err.message);
    } finally {
      setArchiving(false);
    }
  };

  const handleSendForSignature = async () => {
    if (!tenantId || !user) return toast.error("Usuário não autenticado");
    setSendingSignature(true);
    try {
      // First archive the document if not already
      let documentoId: string | null = null;

      if (!archived) {
        const blob = generatePdfBlob();
        const fileName = `holerite_${competencia}_${item.colaborador_nome.replace(/\s+/g, "_")}.pdf`;
        const storagePath = item.colaborador_id
          ? `${tenantId}/colaboradores/${item.colaborador_id}/${Date.now()}_${fileName}`
          : `${tenantId}/${Date.now()}_${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("documentos")
          .upload(storagePath, blob, { contentType: "application/pdf", upsert: false });
        if (uploadError) throw uploadError;

        const pastaId = await findOrCreateColaboradorPasta();

        const { data: docData, error: docError } = await supabase
          .from("documentos" as never)
          .insert({
            tenant_id: tenantId,
            colaborador_id: item.colaborador_id || null,
            colaborador_nome: item.colaborador_nome,
            colaborador_cpf: item.colaborador_cpf || null,
            nome_arquivo: storagePath,
            nome_original: fileName,
            tipo: "Holerite",
            tamanho: blob.size,
            mime_type: "application/pdf",
            storage_path: storagePath,
            status: "valido",
            observacoes: `Holerite competência ${formatCompetencia(competencia)} - Enviado para assinatura`,
            criado_por: user.id,
            criado_por_nome: profile?.nome_completo,
            pasta_id: pastaId,
          } as never)
          .select("id")
          .single();

        if (docError) {
          await supabase.storage.from("documentos").remove([storagePath]);
          throw docError;
        }
        documentoId = (docData as any)?.id || null;
        setArchived(true);
      }

      // Create signature request
      const { error: sigError } = await supabase
        .from("holerite_assinaturas" as never)
        .insert({
          tenant_id: tenantId,
          folha_item_id: item.id,
          colaborador_id: item.colaborador_id || item.colaborador_nome,
          colaborador_nome: item.colaborador_nome,
          competencia,
          documento_id: documentoId,
          status: "pendente",
          enviado_por: user.id,
          enviado_por_nome: profile?.nome_completo,
        } as never);

      if (sigError) throw sigError;

      setSentSignature(true);
      toast.success("Holerite enviado para assinatura do colaborador!");
    } catch (err: any) {
      toast.error("Erro ao enviar para assinatura: " + err.message);
    } finally {
      setSendingSignature(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setArchived(false); setSentSignature(false); onClose(); } }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Holerite — {formatCompetencia(competencia)}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 -mt-2">
          <Button size="sm" variant="outline" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4 mr-2" />Baixar PDF
          </Button>
          <Button
            size="sm"
            variant={archived ? "secondary" : "outline"}
            onClick={handleArchive}
            disabled={archiving || archived}
          >
            {archiving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : archived ? <CheckCircle className="w-4 h-4 mr-2 text-success" /> : <FolderOpen className="w-4 h-4 mr-2" />}
            {archived ? "Arquivado" : "Arquivar em Documentos"}
          </Button>
          <Button
            size="sm"
            variant={sentSignature ? "secondary" : "default"}
            className={sentSignature ? "" : "gradient-primary"}
            onClick={handleSendForSignature}
            disabled={sendingSignature || sentSignature}
          >
            {sendingSignature ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : sentSignature ? <CheckCircle className="w-4 h-4 mr-2 text-success" /> : <Send className="w-4 h-4 mr-2" />}
            {sentSignature ? "Enviado para Assinatura" : "Enviar para Assinatura"}
          </Button>
        </div>

        <div ref={contentRef} className="space-y-5">
          {/* Dados do Colaborador */}
          <div className="bg-muted/30 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dados do Colaborador</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Nome</p>
                  <p className="text-sm font-medium">{item.colaborador_nome}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Cargo</p>
                  <p className="text-sm font-medium">{item.cargo || "Não informado"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Departamento</p>
                  <p className="text-sm font-medium">{item.departamento || "Não informado"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Admissão</p>
                  <p className="text-sm font-medium">{dadosFicticios.admissao}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-muted-foreground">Matrícula:</span> <span className="font-medium">{dadosFicticios.matricula}</span></div>
              <div><span className="text-muted-foreground">CPF:</span> <span className="font-medium">{item.colaborador_cpf || "***.***.***-**"}</span></div>
              <div><span className="text-muted-foreground">PIS:</span> <span className="font-medium">{dadosFicticios.pis}</span></div>
              <div><span className="text-muted-foreground">CBO:</span> <span className="font-medium">{dadosFicticios.cbo}</span></div>
            </div>
          </div>

          {/* Tabela de Eventos */}
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Cód.</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Descrição</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Referência</th>
                  <th className="text-right p-3 font-semibold text-xs uppercase tracking-wider text-success">Proventos</th>
                  <th className="text-right p-3 font-semibold text-xs uppercase tracking-wider text-destructive">Descontos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {proventos.map((ev, i) => (
                  <tr key={`p-${i}`} className="hover:bg-muted/20">
                    <td className="p-3 text-muted-foreground font-mono text-xs">{ev.codigo}</td>
                    <td className="p-3 font-medium">{ev.descricao}</td>
                    <td className="p-3 text-muted-foreground">{ev.referencia}</td>
                    <td className="p-3 text-right text-success font-medium">R$ {fmtMoeda(ev.valor)}</td>
                    <td className="p-3 text-right">—</td>
                  </tr>
                ))}
                {descontos.map((ev, i) => (
                  <tr key={`d-${i}`} className="hover:bg-muted/20">
                    <td className="p-3 text-muted-foreground font-mono text-xs">{ev.codigo}</td>
                    <td className="p-3 font-medium">{ev.descricao}</td>
                    <td className="p-3 text-muted-foreground">{ev.referencia}</td>
                    <td className="p-3 text-right">—</td>
                    <td className="p-3 text-right text-destructive font-medium">R$ {fmtMoeda(ev.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totais */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-success/5 border border-success/20 rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Proventos</p>
              <p className="text-xl font-bold text-success">R$ {fmtMoeda(totalProventos)}</p>
            </div>
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Descontos</p>
              <p className="text-xl font-bold text-destructive">R$ {fmtMoeda(totalDescontos)}</p>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Líquido a Receber</p>
              <p className="text-xl font-bold text-primary">R$ {fmtMoeda(totalLiquido)}</p>
            </div>
          </div>

          {/* Bases de cálculo */}
          <div className="bg-muted/20 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Bases de Cálculo</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-muted-foreground">Base INSS:</span> <span className="font-medium">R$ {fmtMoeda(dadosFicticios.baseINSS)}</span></div>
              <div><span className="text-muted-foreground">Base IRRF:</span> <span className="font-medium">R$ {fmtMoeda(dadosFicticios.baseIRRF)}</span></div>
              <div><span className="text-muted-foreground">Base FGTS:</span> <span className="font-medium">R$ {fmtMoeda(dadosFicticios.baseFGTS)}</span></div>
              <div><span className="text-muted-foreground">FGTS do Mês:</span> <span className="font-medium">R$ {fmtMoeda(dadosFicticios.fgts)}</span></div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
