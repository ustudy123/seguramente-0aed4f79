import { useState } from "react";
import { confirm } from "@/components/ui/confirm-dialog";
import { 
  Plus, Target, TrendingUp, MoreVertical, Trash2, Edit,
  ChevronDown, ChevronRight, CheckCircle2, Clock, AlertCircle,
  Shield, Eye, ListChecks
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useMetas } from "@/hooks/useMetas";
import { 
  STATUS_META_LABELS, PERIODO_LABELS, OKR_TIPO_LABELS,
  type MetaStatus, type Meta
} from "@/types/avaliacao";
import { IERM_CONFIG, CATEGORIA_META_LABELS, type IermNivel, type CategoriaMetaMEA } from "@/types/mea";
import { MetaForm } from "./MetaForm";
import { IermBadge } from "./IermBadge";
import { MetaDetailDialog } from "./MetaDetailDialog";

const statusConfig: Record<MetaStatus, { color: string; icon: typeof Clock }> = {
  nao_iniciada: { color: "bg-slate-100 text-slate-700", icon: Clock },
  em_andamento: { color: "bg-blue-100 text-blue-700", icon: TrendingUp },
  concluida: { color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  cancelada: { color: "bg-slate-100 text-slate-500", icon: Clock },
  atrasada: { color: "bg-red-100 text-red-700", icon: AlertCircle },
};

const TIPOS_AVALIACAO = ["individual", "equipe", "departamento"] as const;
const TIPO_LABELS: Record<string, string> = {
  todos: "Todos",
  individual: "Individual",
  equipe: "Equipe",
  departamento: "Departamento",
};

export function MetasList() {
  const { metas: todasMetas, isLoadingMetas, deleteMeta, deleteOkr, createOkr, createCheckin, isCreatingCheckin } = useMetas();
  const [showForm, setShowForm] = useState(false);
  const [okrMetaId, setOkrMetaId] = useState<string | null>(null);
  const [okrForm, setOkrForm] = useState({ key_result: "", descricao: "", tipo: "percentual" as string, valor_alvo: 100, unidade: "" });
  const [checkinOkrId, setCheckinOkrId] = useState<string | null>(null);
  const [checkinValor, setCheckinValor] = useState("");
  const [checkinObs, setCheckinObs] = useState("");
  const [expandedMetas, setExpandedMetas] = useState<Set<string>>(new Set());
  const [detailMeta, setDetailMeta] = useState<(Meta & { categoria_meta?: string; ierm_score?: number; ierm_nivel?: string }) | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");

  // Filtra apenas metas relevantes para avaliação de desempenho
  const metasAvaliacao = todasMetas.filter(m => TIPOS_AVALIACAO.includes(m.tipo as any));
  const metas = filtroTipo === "todos" ? metasAvaliacao : metasAvaliacao.filter(m => m.tipo === filtroTipo);

  const toggleExpanded = (id: string) => {
    setExpandedMetas(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteMeta = async (id: string) => {
    const confirmed = await confirm({ title: "Excluir meta", description: "Tem certeza que deseja excluir esta meta e todos os seus OKRs?", confirmLabel: "Excluir" });
    if (confirmed) {
      await deleteMeta(id);
    }
  };

  const handleAddOkr = async () => {
    if (!okrMetaId || !okrForm.key_result) return;
    await createOkr({
      meta_id: okrMetaId,
      key_result: okrForm.key_result,
      descricao: okrForm.descricao || undefined,
      tipo: okrForm.tipo as any,
      valor_inicial: 0,
      valor_atual: 0,
      valor_alvo: okrForm.valor_alvo,
      unidade: okrForm.unidade || undefined,
    });
    setOkrMetaId(null);
    setOkrForm({ key_result: "", descricao: "", tipo: "percentual", valor_alvo: 100, unidade: "" });
  };

  const handleDeleteOkr = async (id: string) => {
    const confirmed = await confirm({ title: "Excluir Resultado-Chave", description: "Tem certeza que deseja excluir este Resultado-Chave?", confirmLabel: "Excluir" });
    if (confirmed) {
      await deleteOkr(id);
    }
  };

  const handleCheckin = async (okrId: string, valorAtual: number) => {
    const valor = Number(checkinValor);
    if (isNaN(valor)) return;
    await createCheckin({
      okr_id: okrId,
      valor_anterior: valorAtual,
      valor_novo: valor,
      observacao: checkinObs || undefined,
    });
    setCheckinOkrId(null);
    setCheckinValor("");
    setCheckinObs("");
  };

  if (isLoadingMetas) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4 mx-auto" />
            <div className="h-8 bg-muted rounded w-1/2 mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Metas Ergonomicamente Alinhadas (MEA)
          </h2>
          <p className="text-sm text-muted-foreground">
            Metas com análise ergonômica integrada, ações e rastreabilidade completa
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Filtrar tipo" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TIPO_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Meta
          </Button>
        </div>
      </div>

      {/* Stats */}
      {metas.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total", value: metas.length, color: "text-foreground" },
            { label: "Em Andamento", value: metas.filter(m => m.status === "em_andamento").length, color: "text-blue-600" },
            { label: "Concluídas", value: metas.filter(m => m.status === "concluida").length, color: "text-green-600" },
            { label: "Com Risco Ergonômico", value: metas.filter(m => (m as any).ierm_nivel === "risco").length, color: "text-red-600" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-3 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {metas.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-muted rounded-full">
                <Target className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Nenhuma meta cadastrada</h3>
                <p className="text-muted-foreground">
                  Crie sua primeira meta ergonomicamente alinhada.
                </p>
              </div>
              <Button onClick={() => setShowForm(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Meta
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {metas.map((meta) => {
            const extMeta = meta as Meta & { categoria_meta?: string; ierm_score?: number; ierm_nivel?: string };
            const StatusIcon = statusConfig[meta.status]?.icon || Clock;
            const statusColor = statusConfig[meta.status]?.color || "bg-slate-100";
            const isExpanded = expandedMetas.has(meta.id);
            const hasOkrs = meta.okrs && meta.okrs.length > 0;

            return (
              <Card key={meta.id} className="hover:shadow-md transition-shadow">
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(meta.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={statusColor}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {STATUS_META_LABELS[meta.status]}
                          </Badge>
                          <Badge variant="outline">
                            {PERIODO_LABELS[meta.periodo]} {meta.ano}
                            {meta.trimestre && ` ${meta.trimestre}º Trimestre`}
                          </Badge>
                          <Badge variant="secondary">
                            {CATEGORIA_META_LABELS[(extMeta.categoria_meta as CategoriaMetaMEA) || "operacional"]}
                          </Badge>
                          {extMeta.ierm_score !== undefined && extMeta.ierm_score > 0 && (
                            <IermBadge 
                              score={extMeta.ierm_score} 
                              nivel={(extMeta.ierm_nivel as IermNivel) || "segura"} 
                              compact 
                            />
                          )}
                        </div>

                        <div>
                          <h3 className="font-semibold text-lg">{meta.titulo}</h3>
                          {meta.descricao && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{meta.descricao}</p>
                          )}
                        </div>

                        {meta.colaborador_nome && (
                          <p className="text-sm text-muted-foreground">
                            Responsável: {meta.colaborador_nome}
                          </p>
                        )}

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Progresso</span>
                            <span className="font-medium">{meta.progresso}%</span>
                          </div>
                          <Progress value={meta.progresso} className="h-2" />
                        </div>

                        <div className="flex items-center gap-2">
                          {hasOkrs && (
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="gap-2 p-0 h-auto">
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                {meta.okrs?.length} OKR(s)
                              </Button>
                            </CollapsibleTrigger>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-1.5 h-7 text-xs"
                            onClick={() => setDetailMeta(extMeta)}
                          >
                            <Eye className="h-3 w-3" />
                            Detalhar
                          </Button>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="gap-2" onClick={() => setDetailMeta(extMeta)}>
                            <ListChecks className="h-4 w-4" />
                            Ações & AEM
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2" onClick={() => setOkrMetaId(meta.id)}>
                            <Plus className="h-4 w-4" />
                            Adicionar OKR
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2">
                            <Edit className="h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteMeta(meta.id)} className="gap-2 text-destructive">
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <CollapsibleContent className="mt-4">
                      <div className="space-y-3 pl-4 border-l-2 border-muted">
                        {meta.okrs?.map((okr) => {
                          const OkrStatusIcon = statusConfig[okr.status]?.icon || Clock;
                          const okrStatusColor = statusConfig[okr.status]?.color || "bg-slate-100";
                          return (
                            <div key={okr.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">{OKR_TIPO_LABELS[okr.tipo]}</Badge>
                                    <Badge className={`${okrStatusColor} text-xs`}>
                                      <OkrStatusIcon className="h-3 w-3 mr-1" />
                                      {STATUS_META_LABELS[okr.status]}
                                    </Badge>
                                  </div>
                                  <p className="font-medium">{okr.key_result}</p>
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1"
                                    onClick={() => {
                                      setCheckinOkrId(checkinOkrId === okr.id ? null : okr.id);
                                      setCheckinValor(String(okr.valor_atual || 0));
                                      setCheckinObs("");
                                    }}>
                                    <TrendingUp className="h-3 w-3" />
                                    Check-in
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteOkr(okr.id)}>
                                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">{okr.valor_atual} / {okr.valor_alvo} {okr.unidade}</span>
                                  <span className="font-medium">{okr.progresso}%</span>
                                </div>
                                <Progress value={okr.progresso} className="h-1.5" />
                              </div>
                              {checkinOkrId === okr.id && (
                                <div className="mt-2 p-3 bg-background border rounded-lg space-y-3">
                                  <p className="text-sm font-medium">Atualizar progresso</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Valor atual</Label>
                                      <Input type="number" value={checkinValor} onChange={(e) => setCheckinValor(e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Alvo</Label>
                                      <Input value={`${okr.valor_alvo} ${okr.unidade || ""}`} disabled />
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Observação</Label>
                                    <Input value={checkinObs} onChange={(e) => setCheckinObs(e.target.value)} placeholder="O que mudou?" />
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => setCheckinOkrId(null)}>Cancelar</Button>
                                    <Button size="sm" onClick={() => handleCheckin(okr.id, okr.valor_atual || 0)} disabled={isCreatingCheckin}>Salvar</Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </CardContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Meta Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="w-full max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
            <DialogTitle>Nova Meta Ergonomicamente Alinhada</DialogTitle>
            <DialogDescription>
              Defina a meta e sua análise ergonômica integrada
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <MetaForm onSuccess={() => setShowForm(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* OKR Dialog */}
      <Dialog open={!!okrMetaId} onOpenChange={(open) => !open && setOkrMetaId(null)}>
        <DialogContent className="w-full max-w-md max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
            <DialogTitle>Novo Resultado-Chave</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="space-y-2">
              <Label>Resultado-Chave *</Label>
              <Input placeholder="Ex: Aumentar vendas em 20%" value={okrForm.key_result}
                onChange={(e) => setOkrForm(f => ({ ...f, key_result: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Medição</Label>
              <Select value={okrForm.tipo} onValueChange={(v) => setOkrForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(OKR_TIPO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor Alvo</Label>
                <Input type="number" value={okrForm.valor_alvo}
                  onChange={(e) => setOkrForm(f => ({ ...f, valor_alvo: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Input placeholder="Ex: %, unid, R$" value={okrForm.unidade}
                  onChange={(e) => setOkrForm(f => ({ ...f, unidade: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOkrMetaId(null)}>Cancelar</Button>
              <Button onClick={handleAddOkr}>Adicionar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Meta Detail Dialog */}
      {detailMeta && (
        <MetaDetailDialog 
          meta={detailMeta} 
          open={!!detailMeta} 
          onOpenChange={(open) => !open && setDetailMeta(null)} 
        />
      )}
    </div>
  );
}
