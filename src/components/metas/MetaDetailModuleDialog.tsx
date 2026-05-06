import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp, FileText, History, AlertTriangle,
  Sparkles, Loader2, CheckCircle2, Users, Download, ExternalLink, Calendar as CalendarIcon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MetaCompleta, MetaCheckin } from "@/types/metas-module";
import {
  NIVEL_LABELS, NIVEL_CORES, WORKFLOW_STATUS_LABELS, WORKFLOW_STATUS_CORES,
  STATUS_LABELS, STATUS_CORES, PERIODO_LABELS,
} from "@/types/metas-module";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { MetaEvidenciaForm } from "./MetaEvidenciaForm";

interface MetaDetailModuleDialogProps {
  meta: MetaCompleta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCheckin?: (data: { meta_id: string; valor_novo?: number; progresso_novo: number; observacao?: string }) => Promise<void>;
  onAddEvidencia?: (data: any) => Promise<void>;
}

export function MetaDetailModuleDialog({ meta, open, onOpenChange, onCheckin, onAddEvidencia }: MetaDetailModuleDialogProps) {
  const { tenantId } = useAuth();
  const [checkinValue, setCheckinValue] = useState("");
  const [checkinObs, setCheckinObs] = useState("");
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [riskAnalysis, setRiskAnalysis] = useState<any>(null);

  // Resetar campos ao trocar de meta
  useEffect(() => {
    setCheckinValue("");
    setCheckinObs("");
  }, [meta?.id]);

  // Cálculo automático de progresso (sempre entre 0 e 100, nunca negativo)
  const calcularProgresso = (valor: number): number => {
    if (!meta?.valor_alvo || meta.valor_alvo === 0) return 0;
    const target = meta.valor_alvo;
    const direcao = meta.indicador_direcao || 'maior_melhor';
    let prog = 0;
    if (direcao === 'menor_melhor') {
      // Quanto menor, melhor. Ex: alvo=5 acidentes, atual=3 → mais próximo de zero é melhor
      prog = target > 0 ? Math.max(0, (1 - valor / target) * 100) : 0;
    } else {
      // maior_melhor (padrão): valor / alvo
      prog = (valor / target) * 100;
    }
    return Math.max(0, Math.min(100, Math.round(prog)));
  };

  const valorNumerico = checkinValue !== "" ? parseFloat(checkinValue) : NaN;
  const progressoCalculado = !isNaN(valorNumerico) ? calcularProgresso(valorNumerico) : meta?.progresso ?? 0;
  const valorRestante = meta?.valor_alvo && !isNaN(valorNumerico)
    ? Math.max(0, meta.valor_alvo - valorNumerico)
    : meta?.valor_alvo ?? 0;

  const { data: checkins = [] } = useQuery({
    queryKey: ["meta-checkins-detail", meta?.id],
    queryFn: async () => {
      if (!meta?.id) return [];
      const { data } = await supabase
        .from("metas_checkins")
        .select("*")
        .eq("meta_id", meta.id)
        .order("created_at", { ascending: false });
      return (data || []) as MetaCheckin[];
    },
    enabled: !!meta?.id,
  });

  const { data: workflowLogs = [] } = useQuery({
    queryKey: ["meta-workflow-detail", meta?.id],
    queryFn: async () => {
      if (!meta?.id) return [];
      const { data } = await supabase
        .from("metas_workflow_log")
        .select("*")
        .eq("meta_id", meta.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!meta?.id,
  });

  const { data: evidencias = [], refetch: refetchEvidencias } = useQuery({
    queryKey: ["meta-evidencias-detail", meta?.id],
    queryFn: async () => {
      if (!meta?.id) return [];
      const { data } = await supabase
        .from("metas_evidencias")
        .select("*")
        .eq("meta_id", meta.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!meta?.id,
  });

  const { data: participantes = [] } = useQuery({
    queryKey: ["meta-participantes-detail", meta?.id, tenantId],
    queryFn: async () => {
      if (!meta?.id || !tenantId) return [];
      const { data, error } = await supabase
        .from("metas_participantes")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("meta_id", meta.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!meta?.id && !!tenantId,
  });

  const handleCheckin = async () => {
    if (!meta || !onCheckin) return;
    if (checkinValue === "" || isNaN(valorNumerico)) {
      toast.error("Informe o valor atual alcançado");
      return;
    }
    await onCheckin({
      meta_id: meta.id,
      valor_novo: valorNumerico,
      progresso_novo: progressoCalculado,
      observacao: checkinObs || undefined,
    });
    setCheckinValue("");
    setCheckinObs("");
    toast.success("Check-in registrado!");
  };

  const handleAddEvidencia = async (data: any) => {
    if (!onAddEvidencia) return;
    await onAddEvidencia(data);
    refetchEvidencias();
  };

  const handleDownloadEvidencia = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("documentos")
        .createSignedUrl(path, 3600);

      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (error: any) {
      toast.error("Erro ao gerar link de download: " + error.message);
    }
  };

  const handleAnaliseRisco = async () => {
    if (!meta) return;
    setIsAnalysing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-metas", {
        body: { acao: "analisar_risco", meta },
      });
      if (error) throw error;
      setRiskAnalysis(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsAnalysing(false);
    }
  };

  if (!meta) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
          <div className="space-y-2">
            <DialogTitle className="text-lg">{meta.titulo}</DialogTitle>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge className={`${NIVEL_CORES[meta.nivel]} text-[10px]`}>
                {NIVEL_LABELS[meta.nivel]}
              </Badge>
              <Badge className={`${WORKFLOW_STATUS_CORES[meta.workflow_status]} text-[10px]`}>
                {WORKFLOW_STATUS_LABELS[meta.workflow_status]}
              </Badge>
              <Badge className={`${STATUS_CORES[meta.status]} text-[10px]`}>
                {STATUS_LABELS[meta.status]}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {PERIODO_LABELS[meta.periodo]} {meta.ano}
                {meta.trimestre && ` ${meta.trimestre}º Trimestre`}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium">{meta.progresso}%</span>
              </div>
              <Progress value={meta.progresso} className="h-2" />
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="checkin" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-6">
              <TabsTrigger value="checkin" className="gap-1 text-xs">
                <TrendingUp className="h-3.5 w-3.5" /> Check-in
              </TabsTrigger>
              <TabsTrigger value="evidencias" className="gap-1 text-xs">
                <FileText className="h-3.5 w-3.5" /> Evidências
              </TabsTrigger>
              <TabsTrigger value="participantes" className="gap-1 text-xs">
                <Users className="h-3.5 w-3.5" /> Participantes
              </TabsTrigger>
              <TabsTrigger value="risco" className="gap-1 text-xs">
                <AlertTriangle className="h-3.5 w-3.5" /> Análise IA
              </TabsTrigger>
              <TabsTrigger value="historico" className="gap-1 text-xs">
                <History className="h-3.5 w-3.5" /> Histórico
              </TabsTrigger>
            </TabsList>

            <div className="px-6 py-4">
              {/* Check-in */}
              <TabsContent value="checkin" className="mt-0 space-y-4">
                {meta.descricao && (
                  <p className="text-sm text-muted-foreground">{meta.descricao}</p>
                )}
                {meta.indicador_nome && (
                  <div className="p-3 bg-muted/50 rounded-lg text-sm">
                    <strong>Indicador:</strong> {meta.indicador_nome} — Atual: <strong>{meta.valor_atual ?? 0}</strong> / Alvo: <strong>{meta.valor_alvo ?? "—"}</strong> {meta.indicador_unidade || ""}
                  </div>
                )}

                <Card className="border-primary/20">
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" /> Registrar Check-in
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Informe o quanto você já alcançou desta meta. O progresso é calculado automaticamente.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Quanto você já alcançou? {meta.indicador_unidade && <span className="text-muted-foreground font-normal">(em {meta.indicador_unidade})</span>}
                      </Label>
                      {meta.indicador_tipo === "qualitativo" ? (
                        <Select value={checkinValue} onValueChange={setCheckinValue}>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Selecione o estado atual..." />
                          </SelectTrigger>
                          <SelectContent>
                            {meta.indicador_unidade === "status" && (
                              <>
                                <SelectItem value="0">Não Iniciado</SelectItem>
                                <SelectItem value="50">Em Andamento</SelectItem>
                                <SelectItem value="100">Concluído</SelectItem>
                              </>
                            )}
                            {meta.indicador_unidade === "nivel" && (
                              <>
                                <SelectItem value="1">Nível 1</SelectItem>
                                <SelectItem value="2">Nível 2</SelectItem>
                                <SelectItem value="3">Nível 3</SelectItem>
                                <SelectItem value="4">Nível 4</SelectItem>
                                <SelectItem value="5">Nível 5</SelectItem>
                              </>
                            )}
                            {meta.indicador_unidade === "conceito" && (
                              <>
                                <SelectItem value="0">E (Insuficiente)</SelectItem>
                                <SelectItem value="25">D (Regular)</SelectItem>
                                <SelectItem value="50">C (Bom)</SelectItem>
                                <SelectItem value="75">B (Muito Bom)</SelectItem>
                                <SelectItem value="100">A (Excelente)</SelectItem>
                              </>
                            )}
                            {!["status", "nivel", "conceito"].includes(meta.indicador_unidade || "") && (
                              <>
                                <SelectItem value="0">0%</SelectItem>
                                <SelectItem value="25">25%</SelectItem>
                                <SelectItem value="50">50%</SelectItem>
                                <SelectItem value="75">75%</SelectItem>
                                <SelectItem value="100">100%</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        <>
                          <Input
                            type="number"
                            min="0"
                            value={checkinValue}
                            onChange={e => setCheckinValue(e.target.value)}
                            placeholder={`Ex: ${Math.round((meta.valor_alvo ?? 10) / 2)}`}
                            className="h-11 text-base"
                          />
                          <p className="text-xs text-muted-foreground">
                            💡 Digite o número total já alcançado até hoje (não a diferença).
                            {meta.valor_alvo ? ` Sua meta é alcançar ${meta.valor_alvo} ${meta.indicador_unidade || ""}.` : ""}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Preview do progresso calculado */}
                    {checkinValue !== "" && !isNaN(valorNumerico) && meta.valor_alvo !== undefined && (
                      <div className="p-3 rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Sparkles className="h-3.5 w-3.5 text-primary" /> Progresso calculado
                          </span>
                          <span className="font-bold text-lg text-primary">{progressoCalculado}%</span>
                        </div>
                        <Progress value={progressoCalculado} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                          {progressoCalculado >= 100
                            ? "🎉 Meta alcançada! Parabéns."
                            : `Faltam ${valorRestante} ${meta.indicador_unidade || ""} para atingir o alvo de ${meta.valor_alvo}.`}
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Observação <span className="text-muted-foreground font-normal">(opcional)</span>
                      </Label>
                      <Textarea
                        value={checkinObs}
                        onChange={e => setCheckinObs(e.target.value)}
                        rows={3}
                        placeholder="Ex: Concluímos o treinamento da equipe A. Próxima semana iniciamos a equipe B."
                      />
                      <p className="text-xs text-muted-foreground">
                        Conte o que foi feito desde o último check-in, dificuldades encontradas ou próximos passos.
                      </p>
                    </div>

                    <Button onClick={handleCheckin} className="gap-2 w-full sm:w-auto" disabled={checkinValue === ""}>
                      <CheckCircle2 className="h-4 w-4" /> Salvar Check-in
                    </Button>
                  </CardContent>
                </Card>

                {checkins.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Histórico de Check-ins</h4>
                    {checkins.map(c => (
                      <div key={c.id} className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="font-medium">{c.realizado_por_nome}</span>
                          <span className="text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                        <div>
                          Progresso: {c.progresso_anterior}% → {c.progresso_novo}%
                          {c.valor_novo !== null && ` | Valor: ${c.valor_novo}`}
                        </div>
                        {c.observacao && <p className="text-muted-foreground">{c.observacao}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Evidências */}
              <TabsContent value="evidencias" className="mt-0 space-y-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-900 p-3 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> O que anexar aqui?</p>
                  <p>Comprovantes do que foi declarado nos check-ins: <strong>fotos, listas de presença, certificados, planilhas, links de relatório</strong>. Recomendado anexar 1 evidência a cada check-in para dar segurança jurídica à meta.</p>
                </div>
                <MetaEvidenciaForm metaId={meta.id} onSave={handleAddEvidencia} />

                {evidencias.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma evidência anexada ainda.</p>
                ) : (
                  evidencias.map((e: any) => (
                    <div key={e.id} className="p-3 bg-muted/50 rounded-lg text-xs space-y-2 border border-border/50">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] capitalize">{e.tipo}</Badge>
                          <span className="font-medium text-sm">{e.titulo || e.arquivo_nome || "Evidência"}</span>
                        </div>
                        <span className="text-muted-foreground shrink-0">{new Date(e.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                      
                      {e.descricao && <p className="text-muted-foreground leading-relaxed">{e.descricao}</p>}
                      
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        {e.link_externo && (
                          <a 
                            href={e.link_externo} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center gap-1 text-primary hover:underline font-medium"
                          >
                            <ExternalLink className="h-3 w-3" /> Ver Link
                          </a>
                        )}
                        
                        {e.arquivo_url && (
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="h-auto p-0 text-primary font-medium gap-1"
                            onClick={() => handleDownloadEvidencia(e.arquivo_url)}
                          >
                            <Download className="h-3 w-3" /> 
                            {e.arquivo_nome || "Baixar Arquivo"}
                          </Button>
                        )}
                      </div>

                      <Separator className="my-2 opacity-50" />
                      
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-3">
                          {e.periodo_referencia && (
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3" /> {e.periodo_referencia}
                            </span>
                          )}
                          {e.criado_por_nome && (
                            <span className="flex items-center gap-1 text-primary/80">
                              <Users className="h-3 w-3" /> {e.criado_por_nome}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="participantes" className="mt-0 space-y-4">
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold">Responsabilidade da meta</h4>
                        <p className="text-sm text-muted-foreground">
                          {meta.compartilhada
                            ? "Meta compartilhada com co-responsáveis definidos."
                            : "Meta individual, sem co-responsáveis adicionais."}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {participantes.length} participante{participantes.length === 1 ? "" : "s"}
                      </Badge>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                      <span className="text-muted-foreground">Responsável principal:</span>{" "}
                      <span className="font-medium">{meta.responsavel_nome || "Não definido"}</span>
                    </div>

                    {participantes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum participante adicional vinculado.</p>
                    ) : (
                      <div className="space-y-2">
                        {participantes.map((participante: any) => (
                          <div key={participante.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-sm">
                            <div>
                              <p className="font-medium">{participante.participante_nome}</p>
                              <p className="text-xs text-muted-foreground">ID: {participante.participante_id}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{participante.papel || "co_responsavel"}</Badge>
                              <Badge variant="secondary">Peso {participante.peso ?? 1}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Análise IA */}
              <TabsContent value="risco" className="mt-0 space-y-4">
                <Button variant="outline" onClick={handleAnaliseRisco} disabled={isAnalysing} className="gap-1.5">
                  {isAnalysing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Analisar Risco com IA
                </Button>

                {riskAnalysis && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={riskAnalysis.nivel_risco === "baixo" ? "secondary" : "destructive"}>
                          Risco: {riskAnalysis.nivel_risco}
                        </Badge>
                        <span className="text-sm">Probabilidade: {riskAnalysis.probabilidade_atingimento}%</span>
                      </div>
                      <p className="text-sm">{riskAnalysis.resumo}</p>
                      {riskAnalysis.fatores_risco?.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold mb-1">Fatores de Risco</h5>
                          <ul className="text-xs space-y-1">
                            {riskAnalysis.fatores_risco.map((f: string, i: number) => (
                              <li key={i} className="flex gap-1"><AlertTriangle className="h-3 w-3 text-warning shrink-0 mt-0.5" />{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {riskAnalysis.recomendacoes?.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold mb-1">Recomendações</h5>
                          <ul className="text-xs space-y-1">
                            {riskAnalysis.recomendacoes.map((r: string, i: number) => (
                              <li key={i} className="flex gap-1"><Sparkles className="h-3 w-3 text-primary shrink-0 mt-0.5" />{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Conteúdo gerado por IA — sujeito a revisão humana
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Histórico */}
              <TabsContent value="historico" className="mt-0 space-y-2">
                {workflowLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem histórico de workflow.</p>
                ) : (
                  workflowLogs.map((log: any) => (
                    <div key={log.id} className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium">{log.usuario_nome || "Sistema"}</span>
                        <span className="text-muted-foreground">{new Date(log.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <p>
                        {log.acao === "criacao" ? "Meta criada" : `${log.status_anterior || "—"} → ${log.status_novo}`}
                      </p>
                      {log.justificativa && <p className="text-muted-foreground">{log.justificativa}</p>}
                    </div>
                  ))
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
