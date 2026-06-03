import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CompetenciaInput } from "@/components/ui/competencia-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { usePontoFechamento, type PontoEspelho } from "@/hooks/usePontoFechamento";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { arquivarDocumento } from "@/utils/arquivarDocumento";
import { format } from "date-fns";
import { Lock, Unlock, FileText, CheckCircle, AlertTriangle, Download, Archive, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const STATUS_FECHAMENTO: Record<string, { label: string; color: string }> = {
  aberto: { label: "Aberto", color: "bg-green-100 text-green-800" },
  em_revisao: { label: "Em Revisão", color: "bg-yellow-100 text-yellow-800" },
  fechado: { label: "Fechado", color: "bg-red-100 text-red-800" },
};

const STATUS_ESPELHO: Record<string, { label: string; color: string }> = {
  gerado: { label: "Gerado", color: "bg-gray-100 text-gray-800" },
  enviado: { label: "Enviado", color: "bg-blue-100 text-blue-800" },
  confirmado: { label: "Confirmado", color: "bg-green-100 text-green-800" },
  ressalva: { label: "Ressalva", color: "bg-yellow-100 text-yellow-800" },
};

export function PontoFechamentoTab() {
  const { useFechamentos, useEspelhos, fecharPeriodo, fechandoPeriodo, confirmarEspelho, confirmandoEspelho } = usePontoFechamento();
  const { tenantId, user, profile } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const [competencia, setCompetencia] = useState(format(new Date(), "yyyy-MM"));
  const [showFechar, setShowFechar] = useState(false);
  const [showRessalva, setShowRessalva] = useState(false);
  const [selectedEspelho, setSelectedEspelho] = useState<PontoEspelho | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [ressalvaTexto, setRessalvaTexto] = useState("");

  const { data: fechamentos = [] } = useFechamentos();
  const { data: espelhos = [], isLoading } = useEspelhos(competencia);
  const queryClient = useQueryClient();

  const fechamentoAtual = fechamentos.find(f => f.competencia === competencia);
  const isFechado = fechamentoAtual?.status === "fechado";

  // Live preview: aggregate ponto_diario when there are no persisted espelhos
  const periodo = (() => {
    const [yStr, mStr] = competencia.split("-");
    const y = parseInt(yStr); const m = parseInt(mStr);
    const lastDay = new Date(y, m, 0).getDate();
    return { start: `${competencia}-01`, end: `${competencia}-${String(lastDay).padStart(2, "0")}` };
  })();

  const { data: previewEspelhos = [], isLoading: loadingPreview } = useQuery({
    queryKey: ["ponto-espelhos-preview", tenantId, empresaAtivaId, competencia],
    queryFn: async (): Promise<PontoEspelho[]> => {
      if (!tenantId) return [];
      let q = fromTable("ponto_diario")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("data", periodo.start)
        .lte("data", periodo.end);
      if (empresaAtivaId) q = q.eq("empresa_id", empresaAtivaId);
      const { data, error } = await q as { data: any[] | null; error: Error | null };
      if (error) throw error;
      const map = new Map<string, any>();
      (data || []).forEach((r: any) => {
        const key = r.colaborador_cpf || r.colaborador_id;
        if (!key) return;
        if (!map.has(key)) {
          map.set(key, {
            id: `preview-${key}`,
            tenant_id: tenantId,
            colaborador_id: r.colaborador_id,
            colaborador_nome: r.colaborador_nome,
            colaborador_cpf: r.colaborador_cpf,
            competencia,
            total_horas_normais_minutos: 0,
            total_horas_extras_50_minutos: 0,
            total_horas_extras_100_minutos: 0,
            total_adicional_noturno_minutos: 0,
            total_faltas: 0,
            total_atrasos_minutos: 0,
            total_dsr: 0,
            banco_horas_saldo_minutos: 0,
            status: "preview",
            ressalva_texto: null,
            data_confirmacao: null,
            created_at: r.created_at,
          });
        }
        const agg = map.get(key);
        agg.total_horas_extras_50_minutos += Number(r.horas_extras_50_minutos || 0);
        agg.total_horas_extras_100_minutos += Number(r.horas_extras_100_minutos || 0);
        agg.total_adicional_noturno_minutos += Number(r.adicional_noturno_minutos || 0);
        agg.total_atrasos_minutos += Number(r.atraso_minutos || 0);
        if (r.status === "falta") agg.total_faltas += 1;
      });
      return Array.from(map.values()).sort((a, b) => (a.colaborador_nome || "").localeCompare(b.colaborador_nome || ""));
    },
    enabled: !!tenantId && espelhos.length === 0,
  });

  // Realtime: refresh espelhos/preview when ponto changes
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`ponto-espelho-live-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ponto_diario", filter: `tenant_id=eq.${tenantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["ponto-espelhos-preview"] });
        queryClient.invalidateQueries({ queryKey: ["ponto-espelhos"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ponto_registros", filter: `tenant_id=eq.${tenantId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["ponto-espelhos-preview"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, queryClient]);

  const rowsToShow: PontoEspelho[] = espelhos.length > 0 ? espelhos : previewEspelhos;
  const isPreview = espelhos.length === 0 && previewEspelhos.length > 0;

  const formatMinutos = (min: number) => {
    const abs = Math.abs(min);
    return `${Math.floor(abs / 60)}h ${abs % 60}min`;
  };

  const handleFechar = async () => {
    await fecharPeriodo({ competencia, observacoes });
    setShowFechar(false);
    setObservacoes("");
  };

  const handleConfirmar = async (espelhoId: string) => {
    await confirmarEspelho({ espelhoId });
  };

  const handleRessalva = async () => {
    if (!selectedEspelho) return;
    await confirmarEspelho({ espelhoId: selectedEspelho.id, ressalva: ressalvaTexto });
    setShowRessalva(false);
    setRessalvaTexto("");
    setSelectedEspelho(null);
  };

  const gerarEspelhoPDF = async (espelho: PontoEspelho) => {
    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.text("Espelho de Ponto", 20, 20);
    pdf.setFontSize(10);
    pdf.text(`Competência: ${espelho.competencia}`, 20, 30);
    pdf.text(`Colaborador: ${espelho.colaborador_nome}`, 20, 37);
    pdf.text(`CPF: ${espelho.colaborador_cpf}`, 20, 44);
    pdf.text(`Status: ${STATUS_ESPELHO[espelho.status]?.label || espelho.status}`, 20, 51);

    let y = 65;
    pdf.setFontSize(12);
    pdf.text("Resumo da Jornada", 20, y); y += 10;
    pdf.setFontSize(10);
    pdf.text(`Horas Extras 50%: ${formatMinutos(espelho.total_horas_extras_50_minutos)}`, 20, y); y += 7;
    pdf.text(`Horas Extras 100%: ${formatMinutos(espelho.total_horas_extras_100_minutos)}`, 20, y); y += 7;
    pdf.text(`Adicional Noturno: ${formatMinutos(espelho.total_adicional_noturno_minutos)}`, 20, y); y += 7;
    pdf.text(`Total Faltas: ${espelho.total_faltas}`, 20, y); y += 7;
    pdf.text(`Total Atrasos: ${formatMinutos(espelho.total_atrasos_minutos)}`, 20, y); y += 7;
    pdf.text(`Banco de Horas: ${formatMinutos(espelho.banco_horas_saldo_minutos)}`, 20, y); y += 14;

    if (espelho.status === "confirmado" || espelho.status === "ressalva") {
      pdf.text(`Confirmado em: ${espelho.data_confirmacao ? format(new Date(espelho.data_confirmacao), "dd/MM/yyyy HH:mm") : "-"}`, 20, y); y += 7;
      if (espelho.ressalva_texto) {
        pdf.text(`Ressalva: ${espelho.ressalva_texto}`, 20, y);
      }
    }

    // Download local
    pdf.save(`espelho-ponto-${espelho.colaborador_nome}-${espelho.competencia}.pdf`);
    toast.success("PDF gerado!");

    // Auto-archive to Documentos module
    if (tenantId && user) {
      const blob = pdf.output("blob");
      const fileName = `Espelho de Ponto - ${espelho.colaborador_nome} - ${espelho.competencia}.pdf`;
      await arquivarDocumento({
        tenantId,
        empresaId: empresaAtivaId,
        userId: user.id,
        userNome: profile?.nome_completo || "Sistema",
        file: blob,
        fileName,
        tipo: "Espelho de Ponto",
        observacoes: `Espelho de ponto competência ${espelho.competencia}`,
        colaboradorId: espelho.colaborador_id || null,
        colaboradorNome: espelho.colaborador_nome,
        colaboradorCpf: espelho.colaborador_cpf,
        subpastaColaborador: "Vida Funcional",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" /> Fechamento & Espelho de Ponto
          </h3>
          <p className="text-sm text-muted-foreground">Feche períodos e gerencie espelhos de ponto</p>
        </div>
        <div className="flex items-center gap-2">
          <CompetenciaInput value={competencia} onChange={setCompetencia} className="w-[180px]" />
          {!isFechado && (
            <Button variant="destructive" onClick={() => setShowFechar(true)}>
              <Lock className="w-4 h-4 mr-2" /> Fechar Período
            </Button>
          )}
        </div>
      </div>

      {/* Status do Fechamento */}
      {fechamentoAtual && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isFechado ? <Lock className="w-6 h-6 text-destructive" /> : <Unlock className="w-6 h-6 text-success" />}
              <div>
                <p className="font-medium">Competência {competencia}</p>
                <p className="text-sm text-muted-foreground">
                  {isFechado ? `Fechado em ${format(new Date(fechamentoAtual.data_fechamento!), "dd/MM/yyyy HH:mm")} por ${fechamentoAtual.fechado_por_nome}` : "Aberto para edição"}
                </p>
              </div>
            </div>
            <Badge className={STATUS_FECHAMENTO[fechamentoAtual.status]?.color}>
              {STATUS_FECHAMENTO[fechamentoAtual.status]?.label}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Espelhos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" /> Espelhos de Ponto — {competencia}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead className="text-right">HE 50%</TableHead>
                <TableHead className="text-right">HE 100%</TableHead>
                <TableHead className="text-right">Adic. Noturno</TableHead>
                <TableHead className="text-right">Faltas</TableHead>
                <TableHead className="text-right">Atrasos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : espelhos.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {isFechado ? "Nenhum espelho gerado." : "Feche o período para gerar espelhos."}
                </TableCell></TableRow>
              ) : espelhos.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.colaborador_nome}</TableCell>
                  <TableCell className="text-right font-mono">{formatMinutos(e.total_horas_extras_50_minutos)}</TableCell>
                  <TableCell className="text-right font-mono">{formatMinutos(e.total_horas_extras_100_minutos)}</TableCell>
                  <TableCell className="text-right font-mono">{formatMinutos(e.total_adicional_noturno_minutos)}</TableCell>
                  <TableCell className="text-right">{e.total_faltas}</TableCell>
                  <TableCell className="text-right font-mono">{formatMinutos(e.total_atrasos_minutos)}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_ESPELHO[e.status]?.color}>{STATUS_ESPELHO[e.status]?.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => gerarEspelhoPDF(e)} title="Baixar PDF">
                        <Download className="w-4 h-4" />
                      </Button>
                      {e.status === "gerado" && (
                        <>
                          <Button size="sm" variant="ghost" className="text-success" onClick={() => handleConfirmar(e.id)} title="Confirmar">
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-warning" onClick={() => { setSelectedEspelho(e); setShowRessalva(true); }} title="Ressalva">
                            <AlertTriangle className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Fechar */}
      <Dialog open={showFechar} onOpenChange={setShowFechar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar Período</DialogTitle>
            <DialogDescription>Ao fechar, os dados ficarão bloqueados para alteração e os espelhos serão gerados.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
              <strong>Atenção:</strong> Esta ação não pode ser desfeita. Certifique-se de que todos os ajustes foram processados.
            </div>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observações sobre o fechamento..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFechar(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleFechar} disabled={fechandoPeriodo}>
              {fechandoPeriodo ? "Fechando..." : "Confirmar Fechamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Ressalva */}
      <Dialog open={showRessalva} onOpenChange={setShowRessalva}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Ressalva</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição da ressalva</Label>
              <Textarea value={ressalvaTexto} onChange={e => setRessalvaTexto(e.target.value)} placeholder="Descreva a divergência encontrada..." rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRessalva(false)}>Cancelar</Button>
            <Button onClick={handleRessalva} disabled={!ressalvaTexto || confirmandoEspelho}>
              {confirmandoEspelho ? "Registrando..." : "Registrar Ressalva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
