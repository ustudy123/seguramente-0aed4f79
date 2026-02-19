import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Send, CheckCircle2, RotateCcw, FileText, Receipt, Users, Clock, Briefcase, CalendarDays, DollarSign, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";

interface Props { hub: any; }

const statusColors: Record<string, string> = {
  em_preparacao: "bg-yellow-100 text-yellow-800",
  enviado: "bg-blue-100 text-blue-800",
  em_processamento: "bg-purple-100 text-purple-800",
  em_conferencia: "bg-orange-100 text-orange-800",
  aprovado: "bg-green-100 text-green-800",
  finalizado: "bg-emerald-100 text-emerald-800",
  reaberto: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  em_preparacao: "Em Preparação",
  enviado: "Enviado à Contabilidade",
  em_processamento: "Em Processamento",
  em_conferencia: "Em Conferência",
  aprovado: "Aprovado",
  finalizado: "Finalizado",
  reaberto: "Reaberto",
};

const checklistItems = [
  { key: "ponto_fechado", label: "Ponto fechado", icon: Clock },
  { key: "eventos_confirmados", label: "Eventos confirmados (HE, faltas, afastamentos)", icon: CalendarDays },
  { key: "rescisoes_revisadas", label: "Rescisões revisadas", icon: Briefcase },
  { key: "ferias_calculadas", label: "Férias calculadas", icon: CalendarDays },
  { key: "beneficios_atualizados", label: "Benefícios atualizados", icon: Heart },
];

const nextStatusMap: Record<string, string[]> = {
  em_preparacao: ["enviado"],
  enviado: ["em_processamento"],
  em_processamento: ["em_conferencia"],
  em_conferencia: ["aprovado", "reaberto"],
  aprovado: ["finalizado"],
  finalizado: [],
  reaberto: ["em_preparacao"],
};

export function HubCompetencias({ hub }: Props) {
  const { competencias, documentos, guias, criarCompetencia, atualizarCompetencia, loading } = hub;
  const { profile } = useAuthContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedComp, setSelectedComp] = useState<any>(null);
  const [consolidacao, setConsolidacao] = useState<Record<string, any>>({});

  const tenantId = profile?.tenant_id;

  // Buscar dados consolidados completos para cada competência
  useEffect(() => {
    if (!tenantId || competencias.length === 0) return;
    const fetchConsolidacao = async () => {
      const result: Record<string, any> = {};
      for (const comp of competencias) {
        const mes = comp.competencia;
        const [year, month] = mes.split("-").map(Number);
        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const endDate = new Date(year, month, 0).toISOString().split("T")[0];

        const [pontoRes, admRes, afastRes, feriasRes, rescRes, benefRes] = await Promise.all([
          supabase.from("ponto_diario").select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId).gte("data", startDate).lte("data", endDate),
          supabase.from("admissoes").select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId).gte("data_admissao", startDate).lte("data_admissao", endDate)
            .eq("status", "concluido"),
          supabase.from("afastamentos").select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .gte("data_inicio", startDate).lte("data_inicio", endDate),
          supabase.from("ferias_assinatura_links").select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId).gte("data_inicio_ferias", startDate).lte("data_inicio_ferias", endDate),
          supabase.from("admissoes").select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId).eq("status", "desligado")
            .gte("data_desligamento", startDate).lte("data_desligamento", endDate),
          supabase.from("beneficios_colaboradores").select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId).eq("status", "ativo"),
        ]);

        // Horas extras do mês (ponto_diario com horas > 8h)
        const { data: pontoData } = await supabase.from("ponto_diario")
          .select("horas_trabalhadas, status")
          .eq("tenant_id", tenantId).gte("data", startDate).lte("data", endDate);

        const horasExtras = pontoData?.filter((p: any) => {
          if (!p.horas_trabalhadas) return false;
          const match = p.horas_trabalhadas.match(/(\d+):(\d+)/);
          if (!match) return false;
          return parseInt(match[1]) > 8;
        }).length || 0;

        const faltas = pontoData?.filter((p: any) => p.status === "falta").length || 0;

        const docsComp = documentos.filter((d: any) => d.competencia === mes);
        const guiasComp = guias.filter((g: any) => g.competencia === mes);

        result[mes] = {
          ponto: pontoRes.count || 0,
          admissoes: admRes.count || 0,
          afastamentos: afastRes.count || 0,
          ferias: feriasRes.count || 0,
          rescisoes: rescRes.count || 0,
          beneficios: benefRes.count || 0,
          horasExtras,
          faltas,
          documentos: docsComp.length,
          guias: guiasComp.length,
        };
      }
      setConsolidacao(result);
    };
    fetchConsolidacao();
  }, [tenantId, competencias, documentos, guias]);

  const now = new Date();
  const months: string[] = [];
  for (let i = -2; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const existingMonths = competencias.map((c: any) => c.competencia);
  const availableMonths = months.filter((m) => !existingMonths.includes(m));

  const handleCreate = async (month: string) => {
    await criarCompetencia(month);
    setDialogOpen(false);
  };

  const handleStatusChange = async (comp: any, newStatus: string) => {
    await atualizarCompetencia(comp.id, { ...comp, status: newStatus, competencia: comp.competencia });
  };

  const handleChecklistToggle = async (comp: any, key: string) => {
    const newChecklist = { ...comp.checklist, [key]: !comp.checklist?.[key] };
    await atualizarCompetencia(comp.id, { checklist: newChecklist });
  };

  const allChecked = (comp: any) => checklistItems.every((i) => comp.checklist?.[i.key]);

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Gestão de Competências</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Competência</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Abrir Competência</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {availableMonths.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todas as competências próximas já foram criadas.</p>
              ) : (
                availableMonths.map((m) => (
                  <Button key={m} variant="outline" className="w-full justify-start" onClick={() => handleCreate(m)}>{m}</Button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {competencias.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhuma competência registrada. Clique em "Nova Competência" para começar.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {competencias.map((comp: any) => {
            const cons = consolidacao[comp.competencia];
            return (
              <Card key={comp.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedComp(selectedComp?.id === comp.id ? null : comp)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold">{comp.competencia}</span>
                      <Badge className={statusColors[comp.status]}>{statusLabels[comp.status]}</Badge>
                    </div>
                    <div className="flex gap-2">
                      {nextStatusMap[comp.status]?.map((ns: string) => {
                        const blocked = ns === "enviado" && !allChecked(comp);
                        return (
                          <Button key={ns} size="sm" variant="outline" disabled={blocked}
                            onClick={(e) => { e.stopPropagation(); handleStatusChange(comp, ns); }}
                            title={blocked ? "Complete o checklist antes de enviar" : ""}>
                            {ns === "enviado" && <Send className="w-3.5 h-3.5 mr-1" />}
                            {ns === "aprovado" && <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                            {ns === "reaberto" && <RotateCcw className="w-3.5 h-3.5 mr-1" />}
                            {statusLabels[ns] || ns}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Consolidação completa de dados */}
                  {cons && (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                        <Clock className="w-3 h-3" /> {cons.ponto} reg. ponto
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                        <Users className="w-3 h-3" /> {cons.admissoes} admissões
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                        <Briefcase className="w-3 h-3" /> {cons.rescisoes} rescisões
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                        <CalendarDays className="w-3 h-3" /> {cons.ferias} férias
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                        <DollarSign className="w-3 h-3" /> {cons.horasExtras} HE
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                        <Heart className="w-3 h-3" /> {cons.afastamentos} afast.
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                        <Users className="w-3 h-3" /> {cons.faltas} faltas
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                        <Heart className="w-3 h-3" /> {cons.beneficios} benef. ativos
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                        <FileText className="w-3 h-3" /> {cons.documentos} docs
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                        <Receipt className="w-3 h-3" /> {cons.guias} guias
                      </div>
                    </div>
                  )}

                  {selectedComp?.id === comp.id && comp.status === "em_preparacao" && (
                    <div className="mt-4 pt-4 border-t space-y-2">
                      <p className="text-sm font-medium">Checklist de Envio</p>
                      {checklistItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <div key={item.key} className="flex items-center gap-2">
                            <Checkbox checked={!!comp.checklist?.[item.key]} onCheckedChange={() => handleChecklistToggle(comp, item.key)} onClick={(e) => e.stopPropagation()} />
                            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                            <Label className="text-sm">{item.label}</Label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
