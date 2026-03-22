import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { HubProcesso } from "@/hooks/useHubProcessos";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  User, Calendar, AlertTriangle, ArrowRight, Plus, GripVertical
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  processos: HubProcesso[];
  onNovoProcesso: () => void;
  onVerProcesso: (id: string) => void;
  onRefresh: () => void;
}

const COLUNAS = [
  { status: "rascunho", label: "Rascunho", color: "border-t-muted-foreground/30" },
  { status: "aguardando_documentos", label: "Aguard. Docs", color: "border-t-amber-400" },
  { status: "pronto_para_envio", label: "Pronto p/ Envio", color: "border-t-blue-400" },
  { status: "enviado_contabilidade", label: "Enviado", color: "border-t-indigo-400" },
  { status: "em_analise", label: "Em Análise", color: "border-t-violet-400" },
  { status: "pendente_complementacao", label: "Pend. Complementação", color: "border-t-orange-400" },
  { status: "documentos_devolvidos", label: "Docs Devolvidos", color: "border-t-sky-400" },
  { status: "aguardando_assinatura", label: "Aguard. Assinatura", color: "border-t-yellow-400" },
  { status: "concluido", label: "Concluído", color: "border-t-green-400" },
];

const PRIORIDADE_COLOR: Record<string, string> = {
  urgente: "text-destructive font-bold",
  alta: "text-orange-600",
  normal: "text-muted-foreground",
  baixa: "text-muted-foreground/60",
};

export function HubKanban({ processos, onNovoProcesso, onVerProcesso, onRefresh }: Props) {
  const { profile } = useAuthContext();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingOver, setDraggingOver] = useState<string | null>(null);

  const handleDragStart = (id: string) => setDraggingId(id);
  const handleDragEnd = () => { setDraggingId(null); setDraggingOver(null); };

  const handleDrop = async (novoStatus: string) => {
    if (!draggingId || !novoStatus) return;
    const processo = processos.find(p => p.id === draggingId);
    if (!processo || processo.status === novoStatus) {
      setDraggingId(null);
      setDraggingOver(null);
      return;
    }
    const { error } = await supabase
      .from("hub_processos")
      .update({ status: novoStatus } as any)
      .eq("id", draggingId);
    if (error) { toast.error(error.message); }
    else { toast.success(`Status atualizado para "${novoStatus.replace(/_/g, " ")}"`); onRefresh(); }
    setDraggingId(null);
    setDraggingOver(null);
  };

  // Processos ativos (excluindo cancelados)
  const ativos = processos.filter(p => p.status !== "cancelado");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Kanban — Fluxo por Status</h2>
          <p className="text-sm text-muted-foreground">Arraste os cards para mover entre etapas</p>
        </div>
        <Button onClick={onNovoProcesso} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Nova Solicitação
        </Button>
      </div>

      {/* Board */}
      <div className="overflow-x-auto pb-3">
        <div className="flex gap-3 min-w-max">
          {COLUNAS.map(col => {
            const cards = ativos.filter(p => p.status === col.status);
            const isDragTarget = draggingOver === col.status;
            return (
              <div
                key={col.status}
                className={`w-64 flex-shrink-0 rounded-xl border-t-4 bg-muted/30 border ${col.color} transition-all ${isDragTarget ? "ring-2 ring-primary/40 bg-primary/5" : ""}`}
                onDragOver={e => { e.preventDefault(); setDraggingOver(col.status); }}
                onDragLeave={() => setDraggingOver(null)}
                onDrop={() => handleDrop(col.status)}
              >
                {/* Cabeçalho da coluna */}
                <div className="p-3 border-b">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{col.label}</span>
                    <Badge variant="secondary" className="text-xs h-5 px-1.5">
                      {cards.length}
                    </Badge>
                  </div>
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 min-h-[200px]">
                  {cards.length === 0 && (
                    <div className={`rounded-lg border-2 border-dashed p-4 text-center text-xs text-muted-foreground transition-all ${isDragTarget ? "border-primary/40 bg-primary/5" : "border-transparent"}`}>
                      {isDragTarget ? "Soltar aqui" : "Vazio"}
                    </div>
                  )}
                  {cards.map(p => {
                    const slaVencido = p.sla_vencimento && new Date(p.sla_vencimento) < new Date();
                    return (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={() => handleDragStart(p.id)}
                        onDragEnd={handleDragEnd}
                        className={`bg-background rounded-lg border p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all select-none ${
                          draggingId === p.id ? "opacity-50 scale-95" : ""
                        } ${slaVencido ? "border-destructive/50" : ""}`}
                        onClick={() => onVerProcesso(p.id)}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1.5">
                          <span className="text-xs font-mono text-muted-foreground">{p.codigo}</span>
                          <div className="flex items-center gap-1">
                            {p.prioridade !== "normal" && (
                              <span className={`text-xs ${PRIORIDADE_COLOR[p.prioridade]}`}>
                                {p.prioridade === "urgente" ? "🔴" : "🟠"}
                              </span>
                            )}
                            {slaVencido && (
                              <AlertTriangle className="w-3 h-3 text-destructive" />
                            )}
                            <GripVertical className="w-3 h-3 text-muted-foreground/40" />
                          </div>
                        </div>

                        <p className="text-xs font-medium leading-tight line-clamp-2 mb-2">{p.titulo}</p>

                        <div className="space-y-1">
                          {p.colaborador_nome && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="w-3 h-3 shrink-0" />
                              <span className="truncate">{p.colaborador_nome}</span>
                            </div>
                          )}
                          {p.competencia && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3 shrink-0" />
                              <span>{p.competencia}</span>
                            </div>
                          )}
                        </div>

                        {p.gerado_automaticamente && (
                          <div className="mt-2">
                            <span className="text-xs bg-primary/10 text-primary rounded px-1 py-0.5">Auto</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
