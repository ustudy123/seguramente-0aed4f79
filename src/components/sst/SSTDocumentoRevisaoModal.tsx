import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Building2, Users, Briefcase, AlertTriangle, Target, UserCheck,
  AlertCircle, CheckCircle2, Minus, Brain, FileText, Calendar,
  User, BarChart2, Stethoscope, Layers, FlaskConical, Zap,
  ArrowUpRight, CheckCheck, ChevronDown, ChevronRight
} from "lucide-react";
import { SSTDocumento } from "@/hooks/useSSTDocumentos";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: SSTDocumento | null;
}

function ConfiancaBadge({ confianca }: { confianca: "alta" | "media" | "baixa" }) {
  if (confianca === "alta") return <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">✓ Alta</Badge>;
  if (confianca === "media") return <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">~ Média</Badge>;
  return <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">! Baixa</Badge>;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "bg-green-500" : value >= 40 ? "bg-amber-500" : "bg-destructive";
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium w-8 text-right">{value}%</span>
    </div>
  );
}

const parsePrazo = (prazoStr: string | undefined): string | null => {
  if (!prazoStr) return null;
  const hoje = new Date();
  const lower = prazoStr.toLowerCase();
  if (lower.includes("imediato") || lower.includes("urgente")) { hoje.setDate(hoje.getDate() + 7); return hoje.toISOString().split("T")[0]; }
  if (lower.includes("curto") || lower.includes("30 dias")) { hoje.setMonth(hoje.getMonth() + 1); return hoje.toISOString().split("T")[0]; }
  if (lower.includes("médio") || lower.includes("medio") || lower.includes("90 dias")) { hoje.setMonth(hoje.getMonth() + 3); return hoje.toISOString().split("T")[0]; }
  if (lower.includes("longo") || lower.includes("6 meses")) { hoje.setMonth(hoje.getMonth() + 6); return hoje.toISOString().split("T")[0]; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(prazoStr)) return prazoStr;
  return null;
};

export function SSTDocumentoRevisaoModal({ open, onOpenChange, documento }: Props) {
  const [acaoExpandida, setAcaoExpandida] = useState<number | null>(null);
  const [acoesSalvas, setAcoesSalvas] = useState<Set<number>>(new Set());
  const [importandoTodas, setImportandoTodas] = useState(false);

  const dados = documento?.analise_ia as any;

  if (!documento || !dados) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dados não disponíveis</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4 text-center">
            Este documento não possui dados extraídos pela IA.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  const tipo = dados.tipo_documento || documento.tipo || "SST";
  const isMedico = tipo === "PCMSO";
  const isErgonomico = tipo === "AET";
  const score = dados.score_qualidade;

  const InventarioIcon = isMedico ? Stethoscope
    : isErgonomico ? Layers
    : tipo === "LAUDO_INSALUBRIDADE" || tipo === "LAUDO_PERICULOSIDADE" ? FlaskConical
    : tipo === "LTCAT" ? Zap
    : AlertTriangle;

  const getInventarioLabel = () => {
    if (isMedico) return "Exames";
    if (isErgonomico) return "Ergonomia";
    if (tipo === "LTCAT") return "Agentes Nocivos";
    return "Riscos";
  };

  const inventarioCount = isMedico
    ? (dados.matriz_exames?.length || 0) + (dados.inventario_riscos?.length || 0)
    : isErgonomico
    ? (dados.fatores_ergonomicos?.length || 0) + (dados.inventario_riscos?.length || 0)
    : dados.inventario_riscos?.length || 0;

  const enviarAcaoPlano = async (acao: any, index: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada"); return; }
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", session.user.id).maybeSingle();
      if (!profile?.tenant_id) { toast.error("Tenant não encontrado"); return; }

      const prioridadeMap: Record<string, string> = {
        alta: "urgente", media: "medio", baixa: "baixo",
        urgente: "urgente", imediato: "imediato", medio: "medio", baixo: "baixo",
      };
      const textoBase = acao.what || acao.recomendacao || "Ação extraída de documento SST";
      const titulo = textoBase.length > 200 ? textoBase.substring(0, 197) + "..." : textoBase;
      const prazoDate = parsePrazo(acao.when || acao.prazo);
      const tipoAcao = acao.prioridade === "alta" ? "corretiva" : acao.prioridade === "baixa" ? "melhoria" : "preventiva";

      const { error } = await supabase.from("plano_acoes").insert([{
        tenant_id: profile.tenant_id,
        codigo: `SST-${Date.now()}`,
        titulo,
        descricao: acao.recomendacao || titulo,
        porque: acao.why || `Recomendação extraída de documento ${tipo}`,
        onde: acao.where || acao.setor || "A definir",
        como: acao.how || titulo,
        responsavel_nome: acao.who || acao.responsavel || "A definir",
        prazo: prazoDate || null,
        tipo: tipoAcao,
        prioridade: (prioridadeMap[acao.prioridade] || "medio") as any,
        status: "pendente" as any,
        origem_modulo: "manual",
        origem_descricao: `Revisão pós-importação: ${documento.arquivo_nome || tipo}`,
        criado_por: session.user.id,
        criado_por_nome: session.user.email,
        progresso: 0,
        exige_evidencia: false,
        tempo_gasto_minutos: 0,
      }]);

      if (error) throw error;
      setAcoesSalvas(prev => new Set([...prev, index]));
      toast.success("Ação enviada para o Plano de Ação!");
    } catch (err: any) {
      toast.error("Erro ao enviar ação: " + err.message);
    }
  };

  const enviarTodasAcoes = async () => {
    if (!dados.plano_acao?.length) return;
    setImportandoTodas(true);
    for (let i = 0; i < dados.plano_acao.length; i++) {
      if (!acoesSalvas.has(i)) await enviarAcaoPlano(dados.plano_acao[i], i);
    }
    setImportandoTodas(false);
    toast.success("Todas as ações foram importadas!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/20 px-6 py-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="text-base font-bold">Revisão de Dados Extraídos — {documento.tipo}</span>
              <p className="text-xs text-muted-foreground font-normal">{documento.arquivo_nome}</p>
            </div>
          </DialogTitle>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {documento.empresa_emissora && (
              <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{documento.empresa_emissora}</span>
            )}
            {documento.profissional_responsavel && (
              <span className="flex items-center gap-1"><User className="w-3 h-3" />{documento.profissional_responsavel}</span>
            )}
            {documento.data_emissao && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Emissão: {format(new Date(documento.data_emissao + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            )}
            {documento.data_vigencia && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Vigência: {format(new Date(documento.data_vigencia + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            )}
            {dados.data && (
              <span className="flex items-center gap-1 text-primary">
                <CheckCircle2 className="w-3 h-3" />
                Importado em: {format(new Date(dados.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-4">
            {/* Tipo e resumo */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{tipo}</Badge>
              <span className="text-xs text-muted-foreground">
                {inventarioCount} {getInventarioLabel().toLowerCase()} identificado(s)
                {" · "}{dados.plano_acao?.length || 0} ação(ões) extraída(s)
              </span>
            </div>

            {/* Score */}
            {score && (
              <Card className={score.geral >= 70 ? "border-green-200 bg-green-50/50" : score.geral >= 40 ? "border-amber-200 bg-amber-50/50" : "border-destructive/30 bg-destructive/5"}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-sm">Score de Qualidade da Extração</span>
                    </div>
                    <span className={`text-2xl font-bold ${score.geral >= 70 ? "text-green-600" : score.geral >= 40 ? "text-amber-600" : "text-destructive"}`}>
                      {score.geral}%
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <ScoreBar label="Dados Gerais" value={score.dados_gerais} />
                    <ScoreBar label={getInventarioLabel()} value={score.inventario} />
                    <ScoreBar label="Plano de Ação" value={score.plano_acao} />
                    <ScoreBar label="Responsáveis" value={score.responsaveis} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tabs de revisão */}
            <Tabs defaultValue="dados_gerais">
              <TabsList className="grid grid-cols-4 md:grid-cols-7 w-full h-auto flex-wrap">
                <TabsTrigger value="dados_gerais" className="text-xs py-1.5">
                  <Building2 className="w-3.5 h-3.5 mr-1" />Dados Gerais
                </TabsTrigger>
                <TabsTrigger value="estrutura" className="text-xs py-1.5">
                  <Users className="w-3.5 h-3.5 mr-1" />Estrutura
                </TabsTrigger>
                <TabsTrigger value="funcoes" className="text-xs py-1.5">
                  <Briefcase className="w-3.5 h-3.5 mr-1" />Funções
                </TabsTrigger>
                <TabsTrigger value="inventario" className="text-xs py-1.5">
                  <InventarioIcon className="w-3.5 h-3.5 mr-1" />{getInventarioLabel()}
                  {inventarioCount > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1 h-4">{inventarioCount}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="plano_acao" className="text-xs py-1.5">
                  <Target className="w-3.5 h-3.5 mr-1" />Plano
                  {(dados.plano_acao?.length || 0) > 0 && (
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1 h-4">{dados.plano_acao.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="responsaveis" className="text-xs py-1.5">
                  <UserCheck className="w-3.5 h-3.5 mr-1" />Responsáveis
                </TabsTrigger>
                <TabsTrigger value="pendencias" className="text-xs py-1.5">
                  <AlertCircle className="w-3.5 h-3.5 mr-1" />Pendências
                  {dados.pendencias?.length > 0 && (
                    <Badge variant="destructive" className="ml-1 text-[10px] px-1 h-4">{dados.pendencias.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Dados Gerais */}
              <TabsContent value="dados_gerais" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(dados.dados_gerais || {}).map(([campo, info]: [string, any]) => (
                    <div key={campo} className="space-y-1 p-3 rounded-lg border bg-muted/20">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-medium text-muted-foreground capitalize">
                          {campo.replace(/_/g, " ")}
                        </label>
                        <ConfiancaBadge confianca={info.confianca} />
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {info.valor || <span className="text-muted-foreground italic">Não identificado</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Estrutura */}
              <TabsContent value="estrutura" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Unidades Identificadas</p>
                    {dados.estrutura_organizacional?.unidades?.length > 0 ? (
                      <div className="space-y-2">
                        {dados.estrutura_organizacional.unidades.map((u: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border text-sm">
                            <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span>{u.nome}</span>
                            {u.endereco && <span className="text-muted-foreground text-xs">— {u.endereco}</span>}
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-muted-foreground italic">Nenhuma unidade identificada</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium mb-2">Setores</p>
                      <div className="flex flex-wrap gap-1.5">
                        {dados.estrutura_organizacional?.setores?.length > 0
                          ? dados.estrutura_organizacional.setores.map((s: string, i: number) => (
                              <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                            ))
                          : <p className="text-xs text-muted-foreground italic">Nenhum identificado</p>}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Departamentos</p>
                      <div className="flex flex-wrap gap-1.5">
                        {dados.estrutura_organizacional?.departamentos?.length > 0
                          ? dados.estrutura_organizacional.departamentos.map((d: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">{d}</Badge>
                            ))
                          : <p className="text-xs text-muted-foreground italic">Nenhum identificado</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Funções */}
              <TabsContent value="funcoes" className="mt-4">
                <ScrollArea className="h-72">
                  <div className="space-y-3 pr-2">
                    {dados.funcoes_atividades?.length > 0 ? (
                      dados.funcoes_atividades.map((f: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg border bg-muted/30">
                          <div className="flex items-center gap-2 mb-2">
                            <Briefcase className="w-4 h-4 text-primary" />
                            <span className="font-medium text-sm">{f.cargo}</span>
                            {f.setor && <Badge variant="outline" className="text-xs">{f.setor}</Badge>}
                          </div>
                          <ul className="space-y-1">
                            {f.atividades?.map((a: string, j: number) => (
                              <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <Minus className="w-3 h-3 mt-0.5 flex-shrink-0" />{a}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                    ) : <p className="text-sm text-muted-foreground italic text-center py-8">Nenhuma função/cargo identificado</p>}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Inventário */}
              <TabsContent value="inventario" className="mt-4">
                <ScrollArea className="h-80">
                  <div className="space-y-3 pr-2">
                    {dados.inventario_riscos?.length > 0 ? (
                      dados.inventario_riscos.map((r: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg border">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <InventarioIcon className="w-4 h-4 text-amber-500 flex-shrink-0" />
                              <span className="font-medium text-sm">{r.risco}</span>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <Badge variant="outline" className="text-[10px]">{r.tipo_risco}</Badge>
                              <ConfiancaBadge confianca={r.confianca} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {r.setor && <span><strong>Setor:</strong> {r.setor}</span>}
                            {r.funcao && <span><strong>Função:</strong> {r.funcao}</span>}
                            {r.fonte_geradora && <span><strong>Fonte:</strong> {r.fonte_geradora}</span>}
                            {r.intensidade && <span><strong>Intensidade:</strong> {r.intensidade}</span>}
                            {r.danos && <span className="col-span-2"><strong>Danos:</strong> {r.danos}</span>}
                            {r.metodologia && <span className="col-span-2"><strong>Metodologia:</strong> {r.metodologia}</span>}
                          </div>
                          {r.controles_existentes?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {r.controles_existentes.map((c: string, j: number) => (
                                <Badge key={j} variant="secondary" className="text-[10px]">{c}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground italic text-center py-8">Nenhum risco identificado</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Plano de Ação */}
              <TabsContent value="plano_acao" className="mt-4">
                {dados.plano_acao?.length > 0 && (
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-muted-foreground">{acoesSalvas.size}/{dados.plano_acao.length} enviada(s)</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={enviarTodasAcoes}
                      disabled={importandoTodas || acoesSalvas.size === dados.plano_acao.length}
                      className="gap-1.5 text-xs"
                    >
                      {importandoTodas ? <><AlertCircle className="w-3.5 h-3.5 animate-pulse" />Importando...</>
                        : acoesSalvas.size === dados.plano_acao.length
                        ? <><CheckCheck className="w-3.5 h-3.5 text-green-600" />Todas importadas</>
                        : <><ArrowUpRight className="w-3.5 h-3.5" />Importar todas ao Plano</>}
                    </Button>
                  </div>
                )}
                <ScrollArea className="h-80">
                  <div className="space-y-3 pr-2">
                    {dados.plano_acao?.length > 0 ? (
                      dados.plano_acao.map((a: any, i: number) => (
                        <div key={i} className={`rounded-lg border transition-colors ${acoesSalvas.has(i) ? "border-green-200 bg-green-50/40" : ""}`}>
                          <div className="flex items-start gap-2 p-3 cursor-pointer" onClick={() => setAcaoExpandida(acaoExpandida === i ? null : i)}>
                            <Target className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-snug">{a.what || a.recomendacao}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                <Badge variant={a.prioridade === "alta" ? "destructive" : a.prioridade === "media" ? "secondary" : "outline"} className="text-[10px]">
                                  {a.prioridade}
                                </Badge>
                                {a.setor && <Badge variant="outline" className="text-[10px]">{a.setor}</Badge>}
                                {a.prazo && <Badge variant="outline" className="text-[10px]">📅 {a.prazo}</Badge>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {acoesSalvas.has(i)
                                ? <div className="flex items-center gap-1 text-xs text-green-600"><CheckCheck className="w-3.5 h-3.5" /><span>Enviada</span></div>
                                : <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary hover:bg-primary/10"
                                    onClick={e => { e.stopPropagation(); enviarAcaoPlano(a, i); }}>
                                    <ArrowUpRight className="w-3 h-3" />Enviar
                                  </Button>
                              }
                              {acaoExpandida === i
                                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                            </div>
                          </div>
                          {acaoExpandida === i && (
                            <div className="border-t px-3 pb-3 pt-2.5 bg-muted/20">
                              <p className="text-[10px] font-semibold text-muted-foreground mb-2 tracking-wide uppercase">Estrutura 5W2H</p>
                              <div className="grid grid-cols-1 gap-1.5 text-xs">
                                {(a.what || a.recomendacao) && <div className="flex gap-2"><span className="font-semibold text-primary w-24 flex-shrink-0">O quê</span><span className="text-muted-foreground">{a.what || a.recomendacao}</span></div>}
                                {a.why && <div className="flex gap-2"><span className="font-semibold text-primary w-24 flex-shrink-0">Por quê</span><span className="text-muted-foreground">{a.why}</span></div>}
                                {(a.where || a.setor) && <div className="flex gap-2"><span className="font-semibold text-primary w-24 flex-shrink-0">Onde</span><span className="text-muted-foreground">{a.where || a.setor}</span></div>}
                                {(a.who || a.responsavel) && <div className="flex gap-2"><span className="font-semibold text-primary w-24 flex-shrink-0">Quem</span><span className="text-muted-foreground">{a.who || a.responsavel}</span></div>}
                                {(a.when || a.prazo) && <div className="flex gap-2"><span className="font-semibold text-primary w-24 flex-shrink-0">Quando</span><span className="text-muted-foreground">{a.when || a.prazo}</span></div>}
                                {a.how && <div className="flex gap-2"><span className="font-semibold text-primary w-24 flex-shrink-0">Como</span><span className="text-muted-foreground">{a.how}</span></div>}
                                {a.how_much && <div className="flex gap-2"><span className="font-semibold text-primary w-24 flex-shrink-0">Custo</span><span className="text-muted-foreground">{a.how_much}</span></div>}
                              </div>
                              {a.trecho_origem && (
                                <div className="mt-2 pt-2 border-t">
                                  <p className="text-[10px] text-muted-foreground">📌 <em>"{a.trecho_origem}"</em></p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground italic text-center py-8">Nenhuma ação identificada</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Responsáveis */}
              <TabsContent value="responsaveis" className="mt-4">
                <div className="space-y-3">
                  {dados.responsaveis_tecnicos?.length > 0 ? (
                    dados.responsaveis_tecnicos.map((r: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg border flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                          <UserCheck className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{r.nome}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {r.formacao && <Badge variant="outline" className="text-xs">{r.formacao}</Badge>}
                            {r.conselho && <Badge variant="outline" className="text-xs">{r.conselho}</Badge>}
                            {r.registro && <Badge variant="secondary" className="text-xs font-mono">{r.registro}</Badge>}
                            {r.funcao_no_doc && <Badge variant="outline" className="text-xs">{r.funcao_no_doc}</Badge>}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground italic text-center py-8">Nenhum responsável técnico identificado</p>
                  )}
                </div>
              </TabsContent>

              {/* Pendências */}
              <TabsContent value="pendencias" className="mt-4">
                <div className="space-y-3">
                  {dados.pendencias?.length > 0 ? (
                    dados.pendencias.map((p: any, i: number) => (
                      <div key={i} className={`p-3 rounded-lg border flex items-start gap-3 ${
                        p.severidade === "critica" ? "border-destructive/30 bg-destructive/5" :
                        p.severidade === "media" ? "border-amber-200 bg-amber-50/50" : "bg-muted/30"
                      }`}>
                        <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${p.severidade === "critica" ? "text-destructive" : p.severidade === "media" ? "text-amber-600" : "text-muted-foreground"}`} />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{p.campo}</p>
                          <p className="text-xs text-muted-foreground">{p.motivo}</p>
                        </div>
                        <Badge variant={p.severidade === "critica" ? "destructive" : "secondary"} className="text-[10px] flex-shrink-0">
                          {p.severidade}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center py-8 gap-2">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                      <p className="text-sm font-medium text-green-700">Sem pendências!</p>
                      <p className="text-xs text-muted-foreground">Todos os campos foram extraídos com sucesso.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
