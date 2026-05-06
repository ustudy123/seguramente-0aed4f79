import { useState } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  Target, MoreVertical, TrendingUp, Eye, Trash2, Edit,
  AlertTriangle, CheckCircle2,
  Building2, Users, User, Layers, GitBranch,
  Send, Pause, XCircle, RotateCcw, Archive,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { MetaCompleta, MetaNivel, MetaWorkflowStatus } from "@/types/metas-module";
import {
  NIVEL_LABELS, NIVEL_CORES, STATUS_LABELS, STATUS_CORES,
  WORKFLOW_STATUS_LABELS, WORKFLOW_STATUS_CORES, PERIODO_LABELS,
} from "@/types/metas-module";

interface MetasListViewProps {
  metas: MetaCompleta[];
  nivel?: MetaNivel;
  onEdit?: (meta: MetaCompleta) => void;
  onDelete?: (id: string) => void;
  onWorkflow?: (id: string, status: MetaWorkflowStatus) => void;
  onDesdobrar?: (meta: MetaCompleta) => void;
  onDetail?: (meta: MetaCompleta) => void;
  onCheckin?: (meta: MetaCompleta) => void;
}

const NIVEL_ICONS = {
  estrategica: Layers,
  unidade: Building2,
  setor: Users,
  individual: User,
};

const NIVEL_CARD_STYLES: Record<MetaNivel, string> = {
  estrategica:
    "bg-gradient-to-br from-violet-200 via-violet-100 to-fuchsia-200/80 border-l-4 border-l-violet-600 dark:from-violet-900/60 dark:via-violet-950/50 dark:to-fuchsia-900/40 dark:border-l-violet-400",
  unidade:
    "bg-gradient-to-br from-sky-200 via-sky-100 to-blue-200/80 border-l-4 border-l-sky-600 dark:from-sky-900/60 dark:via-sky-950/50 dark:to-blue-900/40 dark:border-l-sky-400",
  setor:
    "bg-gradient-to-br from-emerald-200 via-emerald-100 to-teal-200/80 border-l-4 border-l-emerald-600 dark:from-emerald-900/60 dark:via-emerald-950/50 dark:to-teal-900/40 dark:border-l-emerald-400",
  individual:
    "bg-gradient-to-br from-amber-200 via-amber-100 to-orange-200/80 border-l-4 border-l-amber-600 dark:from-amber-900/60 dark:via-amber-950/50 dark:to-orange-900/40 dark:border-l-amber-400",
};

export function MetasListView({
  metas, nivel, onEdit, onDelete, onWorkflow, onDesdobrar, onDetail, onCheckin,
}: MetasListViewProps) {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  const filtered = metas.filter(m => {
    if (busca && !m.titulo.toLowerCase().includes(busca.toLowerCase())) return false;
    if (filtroStatus !== "todos" && m.workflow_status !== filtroStatus) return false;
    return true;
  });

  const getWorkflowActions = (status: MetaWorkflowStatus) => {
    const actions: { label: string; status: MetaWorkflowStatus; icon: typeof Send }[] = [];
    switch (status) {
      case "rascunho":
        actions.push({ label: "Enviar para Aprovação", status: "em_aprovacao", icon: Send });
        actions.push({ label: "Ativar Diretamente", status: "ativa", icon: CheckCircle2 });
        break;
      case "em_aprovacao":
        actions.push({ label: "Aprovar e Ativar", status: "ativa", icon: CheckCircle2 });
        actions.push({ label: "Devolver (Rascunho)", status: "rascunho", icon: RotateCcw });
        break;
      case "ativa":
        actions.push({ label: "Suspender", status: "suspensa", icon: Pause });
        actions.push({ label: "Enviar para Revisão", status: "em_revisao", icon: Edit });
        actions.push({ label: "Encerrar", status: "encerrada", icon: Archive });
        break;
      case "em_revisao":
        actions.push({ label: "Reativar", status: "ativa", icon: CheckCircle2 });
        break;
      case "suspensa":
        actions.push({ label: "Reativar", status: "ativa", icon: CheckCircle2 });
        actions.push({ label: "Cancelar", status: "cancelada", icon: XCircle });
        break;
    }
    return actions;
  };

  if (filtered.length === 0 && metas.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-muted rounded-full">
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Nenhuma meta {nivel ? NIVEL_LABELS[nivel].toLowerCase() : ""} cadastrada</h3>
              <p className="text-muted-foreground">Clique em "Nova Meta" para começar.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Buscar metas..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="em_aprovacao">Em Aprovação</SelectItem>
            <SelectItem value="ativa">Ativa</SelectItem>
            <SelectItem value="em_revisao">Em Revisão</SelectItem>
            <SelectItem value="suspensa">Suspensa</SelectItem>
            <SelectItem value="encerrada">Encerrada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      <div className="grid gap-3">
        {filtered.map(meta => {
          const NivelIcon = NIVEL_ICONS[meta.nivel] || Target;
          const workflowActions = getWorkflowActions(meta.workflow_status);

          return (
            <Card key={meta.id} className={`hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 ${NIVEL_CARD_STYLES[meta.nivel] || ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2 min-w-0">
                    {/* Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge className={`${NIVEL_CORES[meta.nivel]} text-[10px]`}>
                        <NivelIcon className="h-3 w-3 mr-1" />
                        {NIVEL_LABELS[meta.nivel]}
                      </Badge>
                      <Badge className={`${WORKFLOW_STATUS_CORES[meta.workflow_status]} text-[10px]`}>
                        {WORKFLOW_STATUS_LABELS[meta.workflow_status]}
                      </Badge>
                      <Badge className={`${STATUS_CORES[meta.status]} text-[10px]`}>
                        {STATUS_LABELS[meta.status]}
                      </Badge>
                      {meta.periodo && (
                        <Badge variant="outline" className="text-[10px]">
                          {PERIODO_LABELS[meta.periodo]} {meta.ano} {meta.trimestre ? ` Q${meta.trimestre}` : ""}
                        </Badge>
                      )}
                      {meta.risco_nivel && meta.risco_nivel !== "baixo" && (
                        <Badge variant="destructive" className="text-[10px] gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Risco {meta.risco_nivel}
                        </Badge>
                      )}
                      {meta.compartilhada && (
                        <Badge variant="outline" className="text-[10px]">👥 Compartilhada</Badge>
                      )}
                      {!!meta.participantes?.length && (
                        <Badge variant="outline" className="text-[10px]">
                          {meta.participantes.length} participante{meta.participantes.length === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>

                    {/* Título e descrição */}
                    <div>
                      <h3 className="font-semibold text-sm">{meta.titulo}</h3>
                      {meta.descricao && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{meta.descricao}</p>
                      )}
                    </div>

                    {/* Info contextual */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {meta.responsavel_nome && <span>👤 {meta.responsavel_nome}</span>}
                      {meta.unidade_nome && <span>🏢 {meta.unidade_nome}</span>}
                      {meta.setor_nome && <span>🏷️ {meta.setor_nome}</span>}
                      {meta.colaborador_nome && <span>👤 {meta.colaborador_nome}</span>}
                      {meta.objetivo_estrategico && <span>🎯 {meta.objetivo_estrategico}</span>}
                      {meta.meta_pai_id && <span>↗️ Derivada</span>}
                    </div>

                    {/* Indicador + Progresso */}
                    <div className="space-y-2">
                      {meta.indicador_nome && (
                        <span className="text-xs text-muted-foreground block">
                          📊 {meta.indicador_nome}: {meta.valor_atual ?? 0} / {meta.valor_alvo ?? "—"} {meta.indicador_unidade || ""}
                        </span>
                      )}

                      <div className="flex items-center gap-2">
                        <Progress value={meta.progresso} className="h-1.5 flex-1" />
                        <span className="text-xs font-medium w-8 text-right">{meta.progresso}%</span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          Para avançar a meta, registre um check-in de progresso.
                        </span>
                        <Button
                          size="sm"
                          onClick={() => onCheckin?.(meta)}
                          className="gap-1.5"
                        >
                          <TrendingUp className="h-4 w-4" />
                          Atualizar progresso
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onDetail?.(meta)} className="gap-2">
                        <Eye className="h-4 w-4" /> Detalhar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onCheckin?.(meta)} className="gap-2">
                        <TrendingUp className="h-4 w-4" /> Atualizar progresso
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit?.(meta)} className="gap-2">
                        <Edit className="h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      {meta.nivel !== "individual" && (
                        <DropdownMenuItem onClick={() => onDesdobrar?.(meta)} className="gap-2">
                          <GitBranch className="h-4 w-4" /> Desdobrar com IA
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {workflowActions.map(action => (
                        <DropdownMenuItem
                          key={action.status}
                          onClick={() => onWorkflow?.(meta.id, action.status)}
                          className="gap-2"
                        >
                          <action.icon className="h-4 w-4" /> {action.label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={async () => {
                          const confirmed = await confirm({ title: "Excluir meta", description: "Tem certeza que deseja excluir esta meta?", confirmLabel: "Excluir" });
                          if (confirmed) onDelete?.(meta.id);
                        }}
                        className="gap-2 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && metas.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Nenhuma meta corresponde aos filtros aplicados.
        </p>
      )}
    </div>
  );
}
