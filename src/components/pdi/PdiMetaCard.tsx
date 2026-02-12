import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Plus, Trash2, CheckCircle2, Circle, Clock, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PdiMeta, PdiAcao, PdiAcaoInsert, PdiAcaoStatus } from "@/types/pdi";
import { PDI_META_CATEGORIA_LABELS, PDI_META_STATUS_LABELS, PDI_ACAO_TIPO_LABELS, PDI_ACAO_STATUS_LABELS } from "@/types/pdi";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PdiMetaCardProps {
  meta: PdiMeta;
  onUpdateMeta: (data: any) => Promise<any>;
  onDeleteMeta: (id: string) => Promise<any>;
  onCreateAcao: (data: PdiAcaoInsert) => Promise<any>;
  onUpdateAcao: (data: any) => Promise<any>;
  onDeleteAcao: (id: string) => Promise<any>;
}

const statusIcon: Record<PdiAcaoStatus, React.ElementType> = {
  nao_iniciada: Circle,
  em_andamento: Clock,
  concluida: CheckCircle2,
  bloqueada: Ban,
};

export const PdiMetaCard = ({ meta, onUpdateMeta, onDeleteMeta, onCreateAcao, onUpdateAcao, onDeleteAcao }: PdiMetaCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAcaoForm, setShowAcaoForm] = useState(false);
  const [novaAcao, setNovaAcao] = useState("");

  const handleAddAcao = async () => {
    if (!novaAcao.trim()) return;
    await onCreateAcao({ meta_id: meta.id, titulo: novaAcao.trim() });
    setNovaAcao("");
    setShowAcaoForm(false);
  };

  const toggleAcaoStatus = async (acao: PdiAcao) => {
    const next: PdiAcaoStatus = acao.status === "concluida" ? "nao_iniciada" : "concluida";
    await onUpdateAcao({ id: acao.id, status: next });
    // Recalcular progresso da meta
    const acoes = meta.acoes || [];
    const totalAcoes = acoes.length;
    const concluidas = acoes.filter(a => a.id === acao.id ? next === "concluida" : a.status === "concluida").length;
    const prog = totalAcoes > 0 ? Math.round((concluidas / totalAcoes) * 100) : 0;
    await onUpdateMeta({
      id: meta.id,
      progresso: prog,
      status: prog >= 100 ? "concluida" : prog > 0 ? "em_andamento" : "nao_iniciada",
    });
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-start gap-3">
              <ChevronDown className={cn("w-4 h-4 mt-1 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-foreground truncate">{meta.titulo}</h4>
                  <Badge variant="outline" className="text-[10px]">{PDI_META_CATEGORIA_LABELS[meta.categoria]}</Badge>
                  <Badge variant={meta.status === "concluida" ? "default" : meta.status === "atrasada" ? "destructive" : "secondary"} className="text-[10px]">
                    {PDI_META_STATUS_LABELS[meta.status]}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={meta.progresso} className="h-1.5 flex-1" />
                  <span className="text-xs font-medium text-muted-foreground">{meta.progresso}%</span>
                  <span className="text-[10px] text-muted-foreground">Peso {meta.peso}</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); onDeleteMeta(meta.id); }}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3 border-t pt-3">
            {/* SMART details */}
            {(meta.especifica || meta.mensuravel || meta.atingivel || meta.relevante || meta.temporal) && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
                {[
                  { label: "S — Específica", value: meta.especifica },
                  { label: "M — Mensurável", value: meta.mensuravel },
                  { label: "A — Atingível", value: meta.atingivel },
                  { label: "R — Relevante", value: meta.relevante },
                  { label: "T — Temporal", value: meta.temporal },
                ].map(s => s.value && (
                  <div key={s.label} className="bg-muted/50 rounded-lg p-2">
                    <p className="font-semibold text-primary">{s.label}</p>
                    <p className="text-muted-foreground mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Indicador */}
            {meta.indicador_sucesso && (
              <div className="text-xs bg-accent/30 rounded-lg p-2">
                <span className="font-medium text-accent-foreground">KPI:</span> {meta.indicador_sucesso}
                {meta.valor_base !== null && meta.valor_alvo !== null && (
                  <span className="ml-2 text-muted-foreground">({meta.valor_base} → {meta.valor_alvo} {meta.unidade || ""})</span>
                )}
              </div>
            )}

            {/* Ações */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Ações ({meta.acoes?.length || 0})</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowAcaoForm(true)}>
                  <Plus className="w-3 h-3" /> Ação
                </Button>
              </div>

              {(meta.acoes || []).map(acao => {
                const Icon = statusIcon[acao.status];
                return (
                  <div key={acao.id} className="flex items-center gap-2 py-1.5 group">
                    <button onClick={() => toggleAcaoStatus(acao)} className="flex-shrink-0">
                      <Icon className={cn("w-4 h-4", acao.status === "concluida" ? "text-success" : "text-muted-foreground")} />
                    </button>
                    <span className={cn("text-sm flex-1", acao.status === "concluida" && "line-through text-muted-foreground")}>{acao.titulo}</span>
                    <Badge variant="outline" className="text-[9px]">{PDI_ACAO_TIPO_LABELS[acao.tipo]}</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => onDeleteAcao(acao.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                );
              })}

              {showAcaoForm && (
                <div className="flex gap-2 mt-2">
                  <Input
                    value={novaAcao}
                    onChange={e => setNovaAcao(e.target.value)}
                    placeholder="Título da ação"
                    className="h-8 text-sm"
                    onKeyDown={e => e.key === "Enter" && handleAddAcao()}
                    autoFocus
                  />
                  <Button size="sm" className="h-8" onClick={handleAddAcao}>Adicionar</Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowAcaoForm(false)}>✕</Button>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
