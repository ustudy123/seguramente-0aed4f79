import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Send, CheckCircle2, RotateCcw } from "lucide-react";

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
  { key: "ponto_fechado", label: "Ponto fechado" },
  { key: "eventos_confirmados", label: "Eventos confirmados" },
  { key: "rescisoes_revisadas", label: "Rescisões revisadas" },
  { key: "ferias_calculadas", label: "Férias calculadas" },
  { key: "beneficios_atualizados", label: "Benefícios atualizados" },
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
  const { competencias, criarCompetencia, atualizarCompetencia, loading } = hub;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedComp, setSelectedComp] = useState<any>(null);

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
          {competencias.map((comp: any) => (
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

                {selectedComp?.id === comp.id && comp.status === "em_preparacao" && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <p className="text-sm font-medium">Checklist de Envio</p>
                    {checklistItems.map((item) => (
                      <div key={item.key} className="flex items-center gap-2">
                        <Checkbox checked={!!comp.checklist?.[item.key]} onCheckedChange={() => handleChecklistToggle(comp, item.key)} onClick={(e) => e.stopPropagation()} />
                        <Label className="text-sm">{item.label}</Label>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
