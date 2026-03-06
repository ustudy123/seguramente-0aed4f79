import { useState } from "react";
import {
  ThumbsUp, ThumbsDown, Minus, MessageSquare, Target, BookOpen,
  Zap, CheckCircle2, Clock, Loader2, FileText, Plus, ExternalLink,
  Award, AlertCircle, Paperclip, Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { ErgonomiaContextPanel } from "./ErgonomiaContextPanel";
import { useAvaliacaoEvidencias } from "@/hooks/useAvaliacaoEvidencias";
import { useAuth } from "@/hooks/useAuth";

interface EvidenciasPanelProps {
  colaboradorId: string;
  colaboradorNome: string;
  colaboradorCargo?: string;
  cicloNome: string;
  cicloId: string;
  dataInicio?: string;
  dataFim?: string;
  evidenciasAnexadas: string[];
  onAnexarEvidencia: (id: string, tipo: string, descricao: string) => void;
}

// ── Modal: Criar Ação 5W2H ────────────────────────────────────────────────────
interface CriarAcaoModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  colaboradorNome: string;
  cicloNome: string;
  contextoSugerido?: string;
  tenantId: string;
  userId: string;
}

function CriarAcaoModal({ open, onOpenChange, colaboradorNome, cicloNome, contextoSugerido, tenantId, userId }: CriarAcaoModalProps) {
  const [titulo, setTitulo] = useState(contextoSugerido ? `Ação para ${colaboradorNome}: ${contextoSugerido}` : "");
  const [descricao, setDescricao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCriar = async () => {
    if (!titulo.trim()) { toast.error("Informe o título da ação"); return; }
    setIsLoading(true);
    try {
      const { error } = await (supabase as any).from("plano_acoes").insert({
        tenant_id: tenantId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        prazo: prazo || null,
        status: "pendente",
        progresso: 0,
        responsavel_id: userId,
        criado_por: userId,
        origem_modulo: "manual",
        origem_descricao: `📊 Avaliação de Desempenho — Ciclo: ${cicloNome} | Colaborador: ${colaboradorNome}`,
        prioridade: "medio",
        tipo: "melhoria",
        exige_evidencia: false,
        codigo: "",
      });
      if (error) throw error;
      toast.success("Ação criada com rastreabilidade no Plano de Ação!");
      onOpenChange(false);
      setTitulo(""); setDescricao(""); setPrazo("");
    } catch (e: any) {
      toast.error("Erro ao criar ação: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Criar Ação de Desenvolvimento
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground flex items-start gap-2">
            <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Origem rastreável: <strong>Avaliação de Desempenho — {cicloNome}</strong><br />Colaborador: <strong>{colaboradorNome}</strong></span>
          </div>
          <div className="space-y-1.5">
            <Label>O quê (título da ação) *</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Desenvolver habilidade em gestão de tempo" />
          </div>
          <div className="space-y-1.5">
            <Label>Por quê / Contexto</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3}
              placeholder="Descreva o contexto da ação, objetivo e resultados esperados..." />
          </div>
          <div className="space-y-1.5">
            <Label>Prazo</Label>
            <Input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCriar} disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar Ação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal: Atribuir Trilha ────────────────────────────────────────────────────
interface AtribuirTrilhaModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  colaboradorId: string;
  colaboradorNome: string;
  cicloNome: string;
  tenantId: string;
}

function AtribuirTrilhaModal({ open, onOpenChange, colaboradorId, colaboradorNome, cicloNome, tenantId }: AtribuirTrilhaModalProps) {
  const [trilhas, setTrilhas] = useState<{ id: string; nome: string; tipo: string }[]>([]);
  const [selected, setSelected] = useState("");
  const [obrigatorio, setObrigatorio] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTrilhas, setIsLoadingTrilhas] = useState(false);

  const fetchTrilhas = async () => {
    setIsLoadingTrilhas(true);
    const { data } = await (supabase as any)
      .from("trilhas")
      .select("id, nome, tipo")
      .eq("tenant_id", tenantId)
      .eq("status", "ativa")
      .order("nome");
    setTrilhas((data || []) as { id: string; nome: string; tipo: string }[]);
    setIsLoadingTrilhas(false);
  };

  const handleAtribuir = async () => {
    if (!selected) { toast.error("Selecione uma trilha"); return; }
    setIsLoading(true);
    try {
      // Verificar se já está atribuída
      const { data: existing } = await (supabase as any)
        .from("trilha_atribuicoes")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("trilha_id", selected)
        .eq("colaborador_id", colaboradorId)
        .maybeSingle();

      if (existing) {
        toast.info("Trilha já atribuída a este colaborador");
        onOpenChange(false);
        return;
      }

      const { error } = await (supabase as any).from("trilha_atribuicoes").insert({
        tenant_id: tenantId,
        trilha_id: selected,
        colaborador_id: colaboradorId,
        colaborador_nome: colaboradorNome,
        tipo: obrigatorio ? "obrigatorio" : "recomendado",
        valor_referencia: `Avaliação de Desempenho — ${cicloNome}`,
      });
      if (error) throw error;
      toast.success(`Trilha atribuída a ${colaboradorNome}!`);
      onOpenChange(false);
      setSelected("");
    } catch (e: any) {
      toast.error("Erro ao atribuir trilha: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (v) fetchTrilhas(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Atribuir Trilha de Aprendizado
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Atribuindo para <strong>{colaboradorNome}</strong> a partir da avaliação do ciclo <strong>{cicloNome}</strong>.
          </p>
          <div className="space-y-1.5">
            <Label>Trilha *</Label>
            {isLoadingTrilhas ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando trilhas...</div>
            ) : (
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma trilha..." />
                </SelectTrigger>
                <SelectContent>
                  {trilhas.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] h-4 capitalize">{t.tipo}</Badge>
                        {t.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
            <Switch checked={obrigatorio} onCheckedChange={setObrigatorio} id="obrigatorio" />
            <Label htmlFor="obrigatorio" className="cursor-pointer">
              <span className="font-medium">Obrigatória</span>
              <p className="text-xs text-muted-foreground">Caso contrário, será apenas recomendada</p>
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleAtribuir} disabled={isLoading || !selected} className="gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
            Atribuir Trilha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Painel Principal ───────────────────────────────────────────────────────────
export function EvidenciasPanel({
  colaboradorId, colaboradorNome, colaboradorCargo, cicloNome, cicloId,
  dataInicio, dataFim, evidenciasAnexadas, onAnexarEvidencia,
}: EvidenciasPanelProps) {
  const { tenantId, user } = useAuth();
  const { data: ev, isLoading } = useAvaliacaoEvidencias(colaboradorId, dataInicio, dataFim);
  const [tab, setTab] = useState("feedbacks");
  const [showCriarAcao, setShowCriarAcao] = useState(false);
  const [acaoContexto, setAcaoContexto] = useState("");
  const [showAtribuirTrilha, setShowAtribuirTrilha] = useState(false);

  const totalEvidencias = (ev?.feedbacks.length || 0) + (ev?.ocorrencias.length || 0) +
    (ev?.metas.length || 0) + (ev?.trilhas.length || 0) + (ev?.acoes.length || 0);

  const abrirCriarAcao = (contexto?: string) => {
    setAcaoContexto(contexto || "");
    setShowCriarAcao(true);
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="p-4 flex items-center justify-center h-48">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Carregando evidências...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {tenantId && user?.id && (
        <>
          <CriarAcaoModal
            open={showCriarAcao}
            onOpenChange={setShowCriarAcao}
            colaboradorNome={colaboradorNome}
            cicloNome={cicloNome}
            contextoSugerido={acaoContexto}
            tenantId={tenantId}
            userId={user.id}
          />
          <AtribuirTrilhaModal
            open={showAtribuirTrilha}
            onOpenChange={setShowAtribuirTrilha}
            colaboradorId={colaboradorId}
            colaboradorNome={colaboradorNome}
            cicloNome={cicloNome}
            tenantId={tenantId}
          />
        </>
      )}

      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2 shrink-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Evidências do Período
            <Badge variant="secondary" className="ml-auto">{totalEvidencias}</Badge>
          </CardTitle>
          {/* Ações rápidas */}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs gap-1.5"
              onClick={() => abrirCriarAcao()}
            >
              <Zap className="h-3.5 w-3.5 text-warning" />
              Criar Ação
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs gap-1.5"
              onClick={() => setShowAtribuirTrilha(true)}
            >
              <BookOpen className="h-3.5 w-3.5 text-info" />
              Atribuir Trilha
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <Tabs value={tab} onValueChange={setTab} className="h-full flex flex-col">
            <TabsList className="grid grid-cols-5 mx-3 mb-0 shrink-0">
              <TabsTrigger value="feedbacks" className="text-[10px] px-1 gap-0.5">
                <ThumbsUp className="h-3 w-3" />
                {(ev?.feedbacks.length || 0) > 0 && <span className="ml-0.5 font-bold text-primary">{ev?.feedbacks.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="ocorrencias" className="text-[10px] px-1 gap-0.5">
                <MessageSquare className="h-3 w-3" />
                {(ev?.ocorrencias.length || 0) > 0 && <span className="ml-0.5 font-bold text-destructive">{ev?.ocorrencias.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="trilhas" className="text-[10px] px-1 gap-0.5">
                <BookOpen className="h-3 w-3" />
                {(ev?.trilhas.length || 0) > 0 && <span className="ml-0.5 font-bold text-success">{ev?.trilhas.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="metas" className="text-[10px] px-1 gap-0.5">
                <Target className="h-3 w-3" />
                {(ev?.metas.length || 0) > 0 && <span className="ml-0.5 font-bold">{ev?.metas.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="acoes" className="text-[10px] px-1 gap-0.5">
                <Zap className="h-3 w-3" />
                {(ev?.acoes.length || 0) > 0 && <span className="ml-0.5 font-bold">{ev?.acoes.length}</span>}
              </TabsTrigger>
            </TabsList>

            {/* Labels das abas */}
            <div className="grid grid-cols-5 mx-3 text-[9px] text-muted-foreground text-center pb-1 shrink-0">
              <span>Feed.</span><span>Ocorr.</span><span>Trilhas</span><span>Metas</span><span>Ações</span>
            </div>

            <ScrollArea className="flex-1 px-3">
              {/* ── FEEDBACKS ── */}
              <TabsContent value="feedbacks" className="mt-0 space-y-2 pb-3">
                {(ev?.feedbacks.length || 0) === 0 ? (
                  <EmptyState icon={ThumbsUp} label="Nenhum feedback no período" />
                ) : ev?.feedbacks.map(f => {
                  const anexado = evidenciasAnexadas.includes(f.id);
                  return (
                    <EvidenciaCard
                      key={f.id}
                      id={f.id}
                      data={f.created_at}
                      badge={<Badge variant="outline" className="text-[10px] h-4 capitalize">{f.categoria}</Badge>}
                      descricao={f.descricao}
                      rodape={f.registrado_por_nome ? `por ${f.registrado_por_nome}` : undefined}
                      anexado={anexado}
                      onAnexar={() => onAnexarEvidencia(f.id, "feedback", f.descricao)}
                      onCriarAcao={() => abrirCriarAcao(f.descricao?.substring(0, 80))}
                    />
                  );
                })}
              </TabsContent>

              {/* ── OCORRÊNCIAS ── */}
              <TabsContent value="ocorrencias" className="mt-0 space-y-2 pb-3">
                {(ev?.ocorrencias.length || 0) === 0 ? (
                  <EmptyState icon={MessageSquare} label="Nenhuma ocorrência no período" />
                ) : ev?.ocorrencias.map(o => {
                  const anexado = evidenciasAnexadas.includes(o.id);
                  return (
                    <EvidenciaCard
                      key={o.id}
                      id={o.id}
                      data={o.created_at}
                      badge={
                        <span className="flex items-center gap-1">
                          {o.tipo === "positiva" ? <ThumbsUp className="h-3 w-3 text-success" /> :
                           o.tipo === "negativa" ? <ThumbsDown className="h-3 w-3 text-destructive" /> :
                           <Minus className="h-3 w-3 text-muted-foreground" />}
                          <Badge variant="outline" className={`text-[10px] h-4 capitalize ${
                            o.tipo === "positiva" ? "border-success/40 text-success" :
                            o.tipo === "negativa" ? "border-destructive/40 text-destructive" : ""
                          }`}>{o.tipo}</Badge>
                          {o.is_advertencia && <Badge variant="destructive" className="text-[10px] h-4">Advertência</Badge>}
                        </span>
                      }
                      descricao={o.descricao}
                      anexado={anexado}
                      onAnexar={() => onAnexarEvidencia(o.id, "ocorrencia", o.descricao)}
                      onCriarAcao={o.tipo === "negativa" ? () => abrirCriarAcao(o.descricao?.substring(0, 80)) : undefined}
                    />
                  );
                })}
              </TabsContent>

              {/* ── TRILHAS ── */}
              <TabsContent value="trilhas" className="mt-0 space-y-2 pb-3">
                <div className="flex justify-end mb-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setShowAtribuirTrilha(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Atribuir nova
                  </Button>
                </div>
                {(ev?.trilhas.length || 0) === 0 ? (
                  <EmptyState icon={BookOpen} label="Nenhuma trilha atribuída">
                    <Button size="sm" variant="outline" className="mt-2 h-7 text-xs gap-1" onClick={() => setShowAtribuirTrilha(true)}>
                      <Plus className="h-3 w-3" /> Atribuir trilha
                    </Button>
                  </EmptyState>
                ) : ev?.trilhas.map(t => (
                  <div key={t.id} className="p-2.5 bg-muted/40 rounded-lg space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium flex-1 truncate">{t.nome}</p>
                      {t.status === "concluida"
                        ? <Badge className="text-[10px] h-4 bg-success/20 text-success border-success/30">Concluída</Badge>
                        : t.status === "em_andamento"
                        ? <Badge variant="secondary" className="text-[10px] h-4">Em andamento</Badge>
                        : <Badge variant="outline" className="text-[10px] h-4 text-muted-foreground">Não iniciada</Badge>
                      }
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={t.percentual} className="h-1.5 flex-1" />
                      <span className="text-[10px] font-medium w-8 text-right">{t.percentual}%</span>
                    </div>
                    {t.status !== "concluida" && (
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] text-info gap-1 px-2 -ml-1"
                        onClick={() => abrirCriarAcao(`Concluir trilha: ${t.nome}`)}>
                        <Zap className="h-3 w-3" /> Criar ação de conclusão
                      </Button>
                    )}
                  </div>
                ))}
              </TabsContent>

              {/* ── METAS ── */}
              <TabsContent value="metas" className="mt-0 space-y-2 pb-3">
                {(ev?.metas.length || 0) === 0 ? (
                  <EmptyState icon={Target} label="Nenhuma meta cadastrada" />
                ) : ev?.metas.map(m => (
                  <div key={m.id} className="p-2.5 bg-muted/40 rounded-lg space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium flex-1 truncate">{m.titulo}</p>
                      <Badge variant={m.status === "concluida" ? "default" : "secondary"} className="text-[10px] h-4 capitalize shrink-0">
                        {m.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={m.progresso} className="h-1.5 flex-1" />
                      <span className="text-[10px] font-medium w-8 text-right">{m.progresso}%</span>
                    </div>
                    {m.progresso < 80 && m.status !== "concluida" && (
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] text-warning gap-1 px-2 -ml-1"
                        onClick={() => abrirCriarAcao(`Apoiar meta: ${m.titulo}`)}>
                        <Zap className="h-3 w-3" /> Criar ação de suporte
                      </Button>
                    )}
                  </div>
                ))}
              </TabsContent>

              {/* ── AÇÕES ── */}
              <TabsContent value="acoes" className="mt-0 space-y-2 pb-3">
                <div className="flex justify-end mb-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => abrirCriarAcao()}>
                    <Plus className="h-3.5 w-3.5" />
                    Nova ação
                  </Button>
                </div>
                {(ev?.acoes.length || 0) === 0 ? (
                  <EmptyState icon={Zap} label="Nenhuma ação em andamento">
                    <Button size="sm" variant="outline" className="mt-2 h-7 text-xs gap-1" onClick={() => abrirCriarAcao()}>
                      <Plus className="h-3 w-3" /> Criar ação
                    </Button>
                  </EmptyState>
                ) : ev?.acoes.map(a => (
                  <div key={a.id} className="p-2.5 bg-muted/40 rounded-lg space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium flex-1 truncate">{a.titulo}</p>
                      <AcaoStatusBadge status={a.status} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={a.progresso} className="h-1.5 flex-1" />
                      <span className="text-[10px] font-medium w-8 text-right">{a.progresso}%</span>
                    </div>
                  </div>
                ))}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </CardContent>
      </Card>

      {/* Painel de Contexto Ergonômico NR-17 */}
      {tenantId && user?.id && colaboradorCargo && (
        <ErgonomiaContextPanel
          colaboradorNome={colaboradorNome}
          colaboradorCargo={colaboradorCargo}
          cicloNome={cicloNome}
          tenantId={tenantId}
          userId={user.id}
        />
      )}
    </>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────────────
function EmptyState({ icon: Icon, label, children }: { icon: typeof FileText; label: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/30" />
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function EvidenciaCard({
  id, data, badge, descricao, rodape, anexado, onAnexar, onCriarAcao,
}: {
  id: string;
  data: string;
  badge: React.ReactNode;
  descricao: string;
  rodape?: string;
  anexado: boolean;
  onAnexar: () => void;
  onCriarAcao?: () => void;
}) {
  return (
    <div className={`p-2.5 rounded-lg space-y-1.5 transition-colors ${anexado ? "bg-primary/10 border border-primary/20" : "bg-muted/40"}`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        {badge}
        <span className="text-[10px] text-muted-foreground ml-auto">
          {format(new Date(data), "dd/MM/yy", { locale: ptBR })}
        </span>
      </div>
      <p className="text-xs line-clamp-2">{descricao}</p>
      {rodape && <p className="text-[10px] text-muted-foreground">{rodape}</p>}
      <div className="flex gap-1 pt-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant={anexado ? "default" : "ghost"}
              className={`h-6 text-[10px] gap-1 px-2 ${anexado ? "bg-primary/20 text-primary hover:bg-primary/30" : ""}`}
              onClick={onAnexar}
            >
              {anexado ? <Check className="h-3 w-3" /> : <Paperclip className="h-3 w-3" />}
              {anexado ? "Anexado" : "Anexar"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{anexado ? "Evidência já anexada à avaliação" : "Anexar como evidência desta avaliação"}</TooltipContent>
        </Tooltip>
        {onCriarAcao && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2 text-warning hover:text-warning"
                onClick={onCriarAcao}>
                <Zap className="h-3 w-3" />
                Ação
              </Button>
            </TooltipTrigger>
            <TooltipContent>Criar ação de desenvolvimento a partir deste item</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

function AcaoStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pendente: { label: "Pendente", className: "bg-muted text-muted-foreground" },
    em_andamento: { label: "Em andamento", className: "bg-info/10 text-info" },
    concluida: { label: "Concluída", className: "bg-success/10 text-success" },
    atrasada: { label: "Atrasada", className: "bg-destructive/10 text-destructive" },
    pausada: { label: "Pausada", className: "bg-warning/10 text-warning" },
  };
  const s = map[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return <Badge variant="secondary" className={`text-[10px] h-4 capitalize ${s.className}`}>{s.label}</Badge>;
}
