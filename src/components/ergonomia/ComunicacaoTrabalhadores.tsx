/**
 * ComunicacaoTrabalhadores — RQ-19 / RQ-20
 * Mecanismos obrigatórios de participação e comunicação conforme NR-1 §1.4.5
 * e ISO 45003 §8.1
 */
import { useState } from "react";
import {
  Users,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Brain,
  Activity,
  FileText,
  MessageSquare,
  Eye,
  Shield,
  Info,
  Download,
  Calendar,
  Building2,
  ChevronDown,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { GRORisco, GRONivelRisco } from "@/types/gro";
import {
  GRO_NIVEL_RISCO_LABELS,
  GRO_STATUS_LABELS,
  GRO_SUBTIPO_LABELS,
  GRO_FONTE_LABELS,
} from "@/types/gro";

interface ComunicacaoTrabalhadoresProps {
  riscos: GRORisco[];
}

const NIVEL_COLORS: Record<GRONivelRisco, string> = {
  critico: "bg-red-100 text-red-700 border-red-200",
  alto: "bg-orange-100 text-orange-700 border-orange-200",
  medio: "bg-amber-100 text-amber-700 border-amber-200",
  baixo: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const NIVEL_POINT: Record<GRONivelRisco, string> = {
  critico: "bg-red-500",
  alto: "bg-orange-500",
  medio: "bg-amber-500",
  baixo: "bg-emerald-500",
};

export function ComunicacaoTrabalhadores({ riscos }: ComunicacaoTrabalhadoresProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [secaoExpandida, setSecaoExpandida] = useState<string | null>(null);

  const dataGeracao = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const riscosNaoToleraveis = riscos.filter((r) => ["alto", "critico"].includes(r.nivel_risco));
  const riscosComAcao = riscos.filter((r) => r.acao_id);
  const riscosControlados = riscos.filter((r) => ["controlado", "monitorado", "revisado"].includes(r.status_gro));
  const riscosPsico = riscos.filter((r) => r.subtipo === "psicossocial");

  // Agrupar por setor para comunicação setorial
  const porSetor = riscos.reduce<Record<string, GRORisco[]>>((acc, r) => {
    const s = r.setor ?? "Geral / Todos os setores";
    if (!acc[s]) acc[s] = [];
    acc[s].push(r);
    return acc;
  }, {});

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* ── Painel de conformidade ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Riscos a comunicar</span>
            </div>
            <p className="text-2xl font-bold">{riscos.length}</p>
            <p className="text-xs text-muted-foreground">{riscosNaoToleraveis.length} não toleráveis</p>
          </CardContent>
        </Card>
        <Card className={cn("border", riscosNaoToleraveis.length > 0 ? "border-orange-200 bg-orange-50/20" : "border-border/50")}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Bell className={cn("h-4 w-4", riscosNaoToleraveis.length > 0 ? "text-orange-600" : "text-muted-foreground")} />
              <span className="text-xs text-muted-foreground">Alertas ativos</span>
            </div>
            <p className={cn("text-2xl font-bold", riscosNaoToleraveis.length > 0 ? "text-orange-700" : "")}>{riscosNaoToleraveis.length}</p>
            <p className="text-xs text-muted-foreground">requerem comunicação</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">Ações comunicadas</span>
            </div>
            <p className="text-2xl font-bold text-emerald-700">{riscosComAcao.length}</p>
            <p className="text-xs text-muted-foreground">riscos com plano vinculado</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">Psicossociais</span>
            </div>
            <p className="text-2xl font-bold">{riscosPsico.length}</p>
            <p className="text-xs text-muted-foreground">anonimizados / agregados</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="riscos" className="space-y-3">
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="riscos" className="gap-1.5 text-xs">
            <AlertTriangle className="h-3.5 w-3.5" />
            Comunicar Riscos
          </TabsTrigger>
          <TabsTrigger value="acoes" className="gap-1.5 text-xs">
            <TrendingUp className="h-3.5 w-3.5" />
            Comunicar Ações
          </TabsTrigger>
          <TabsTrigger value="participacao" className="gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" />
            Participação
          </TabsTrigger>
          <TabsTrigger value="relatorio" className="gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" />
            Relatório p/ Trabalhadores
          </TabsTrigger>
        </TabsList>

        {/* ── Aba: Comunicar Riscos (RQ-20) ── */}
        <TabsContent value="riscos" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                Riscos Identificados — Comunicação Obrigatória (RQ-20)
              </CardTitle>
              <CardDescription className="text-xs">
                NR-1 §1.4.5.b — Trabalhadores devem ser informados dos riscos e medidas de controle
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {riscos.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm px-4">
                  <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhum risco no GRO para comunicar.</p>
                </div>
              ) : (
                Object.entries(porSetor).map(([setor, lista]) => (
                  <div key={setor} className="border-b border-border/40 last:border-0">
                    <button
                      className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-muted/30 transition-colors"
                      onClick={() => setSecaoExpandida(secaoExpandida === setor ? null : setor)}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">{setor}</span>
                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{lista.length}</Badge>
                        {lista.some((r) => ["alto", "critico"].includes(r.nivel_risco)) && (
                          <Badge variant="outline" className="h-4 px-1.5 text-[10px] border-red-200 text-red-600 bg-red-50">
                            Atenção
                          </Badge>
                        )}
                      </div>
                      {secaoExpandida === setor ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                    {secaoExpandida === setor && (
                      <div className="divide-y divide-border/20 bg-muted/10">
                        {lista.map((risco) => (
                          <div key={risco.id} className="px-4 py-2.5 flex items-start gap-3">
                            <div className={cn("w-2 h-2 rounded-full shrink-0 mt-1.5", NIVEL_POINT[risco.nivel_risco])} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{risco.titulo}</p>
                              {risco.descricao && (
                                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{risco.descricao}</p>
                              )}
                              <div className="flex gap-1.5 mt-1 flex-wrap">
                                <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5 border", NIVEL_COLORS[risco.nivel_risco])}>
                                  {GRO_NIVEL_RISCO_LABELS[risco.nivel_risco]}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                  {GRO_STATUS_LABELS[risco.status_gro]}
                                </Badge>
                                {risco.medidas_recomendadas && risco.medidas_recomendadas.length > 0 && (
                                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-emerald-600 border-emerald-200">
                                    {risco.medidas_recomendadas.length} medida(s)
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {risco.subtipo === "psicossocial" ? (
                              <Brain className="h-3.5 w-3.5 text-purple-400 shrink-0 mt-0.5" />
                            ) : (
                              <Activity className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Aba: Comunicar Ações ── */}
        <TabsContent value="acoes" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Ações Implementadas — Comunicação aos Trabalhadores (RQ-20)
              </CardTitle>
              <CardDescription className="text-xs">
                NR-1 §1.4.5.c — Trabalhadores devem ser informados das medidas adotadas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {riscosControlados.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhum risco em fase de controle/monitoramento ainda.</p>
                  <p className="text-xs mt-1">Avance riscos no ciclo PDCA para exibir ações comunicadas.</p>
                </div>
              ) : (
                riscosControlados.map((risco) => (
                  <div key={risco.id} className="p-3 rounded-lg border border-border/50 bg-muted/20">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{risco.titulo}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Status: <span className="font-medium">{GRO_STATUS_LABELS[risco.status_gro]}</span>
                        </p>
                        {risco.medidas_recomendadas && risco.medidas_recomendadas.length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {risco.medidas_recomendadas.slice(0, 3).map((m, i) => (
                              <p key={i} className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <span className="text-emerald-500">✓</span> {m}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5 border shrink-0", NIVEL_COLORS[risco.nivel_risco])}>
                        {GRO_NIVEL_RISCO_LABELS[risco.nivel_risco]}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Aba: Participação (RQ-19) ── */}
        <TabsContent value="participacao" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Mecanismos de Participação dos Trabalhadores (RQ-19)
              </CardTitle>
              <CardDescription className="text-xs">
                NR-1 §1.4.5.a · ISO 45003 §8.1 — Coleta de percepção, feedback e participação na avaliação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {[
                {
                  icone: MessageSquare,
                  titulo: "Questionário Psicossocial (SIPRO)",
                  descricao: "Pesquisa anônima e agregada sobre fatores psicossociais. Respostas individuais nunca são expostas. Mínimo 5 respondentes para divulgação.",
                  status: riscosPsico.length > 0 ? "ativo" : "configurar",
                  ref: "ISO 45003",
                  badge: riscosPsico.length > 0 ? `${riscosPsico.length} dimensões importadas` : "Não iniciado",
                  badgeCor: riscosPsico.length > 0 ? "text-emerald-600 border-emerald-200 bg-emerald-50" : "text-amber-600 border-amber-200 bg-amber-50",
                },
                {
                  icone: Eye,
                  titulo: "Levantamento Ergonômico Participativo",
                  descricao: "Trabalhadores participam da identificação de perigos na AEP. Suas percepções são registradas na fonte 'Observação' do GRO.",
                  status: "orientacao",
                  ref: "NR-17",
                  badge: "Registro manual na AEP",
                  badgeCor: "text-blue-600 border-blue-200 bg-blue-50",
                },
                {
                  icone: Bell,
                  titulo: "Comunicação de Resultados",
                  descricao: "Trabalhadores recebem comunicação sobre riscos identificados, medidas adotadas e progressos do plano de ação — via aba 'Comunicar Riscos' e 'Comunicar Ações'.",
                  status: "ativo",
                  ref: "NR-1",
                  badge: `${riscos.length} riscos registrados`,
                  badgeCor: "text-emerald-600 border-emerald-200 bg-emerald-50",
                },
                {
                  icone: FileText,
                  titulo: "Relatório Consolidado para Trabalhadores",
                  descricao: "Documento simplificado com riscos identificados, níveis e ações previstas. Disponível na aba 'Relatório p/ Trabalhadores'.",
                  status: "ativo",
                  ref: "NR-1",
                  badge: "Disponível agora",
                  badgeCor: "text-emerald-600 border-emerald-200 bg-emerald-50",
                },
              ].map((mecanismo) => {
                const Icone = mecanismo.icone;
                return (
                  <div key={mecanismo.titulo} className="flex items-start gap-3 p-3 border border-border/50 rounded-lg hover:bg-muted/20 transition-colors">
                    <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
                      <Icone className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-medium">{mecanismo.titulo}</p>
                        <Badge variant="outline" className="text-[9px] h-3.5 px-1">{mecanismo.ref}</Badge>
                        <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5 border", mecanismo.badgeCor)}>
                          {mecanismo.badge}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{mecanismo.descricao}</p>
                    </div>
                  </div>
                );
              })}

              {/* Aviso ISO 45003 confidencialidade */}
              <div className="p-3 bg-purple-50/60 border border-purple-200/60 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 text-purple-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold text-purple-800">Proteção da Confidencialidade (ISO 45003)</p>
                    <p className="text-[11px] text-purple-700 mt-0.5">
                      Identidade ≠ resposta. Resultados psicossociais são exibidos apenas de forma agregada
                      (≥5 respondentes). Dados individuais são protegidos e nunca expostos em relatórios.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Aba: Relatório para Trabalhadores ── */}
        <TabsContent value="relatorio" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Relatório de Riscos para Trabalhadores
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Versão simplificada para comunicação direta à equipe
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={handlePrint}>
                  <Download className="h-3.5 w-3.5" />
                  Imprimir
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pb-4">
              {/* Cabeçalho do relatório */}
              <div className="p-4 border rounded-lg bg-primary/5">
                <p className="text-sm font-bold text-center">COMUNICADO AOS TRABALHADORES</p>
                <p className="text-xs text-center text-muted-foreground mt-0.5">
                  Riscos Identificados e Medidas de Proteção — {dataGeracao}
                </p>
              </div>

              {/* Mensagem introdutória */}
              <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                <p>
                  Prezados colaboradores, em cumprimento ao disposto na <strong>NR-1 §1.4.5</strong> e à
                  política de saúde e segurança da empresa, comunicamos os riscos ergonômicos e
                  psicossociais identificados no ambiente de trabalho, bem como as medidas de
                  controle adotadas ou em andamento.
                </p>
              </div>

              {/* Lista de riscos por nível */}
              {["critico", "alto", "medio", "baixo"].map((nivel) => {
                const lista = riscos.filter((r) => r.nivel_risco === nivel);
                if (lista.length === 0) return null;
                return (
                  <div key={nivel}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn("w-2.5 h-2.5 rounded-full", NIVEL_POINT[nivel as GRONivelRisco])} />
                      <p className="text-xs font-semibold">
                        {GRO_NIVEL_RISCO_LABELS[nivel as GRONivelRisco]} ({lista.length})
                      </p>
                    </div>
                    <div className="space-y-1.5 ml-4">
                      {lista.map((risco) => (
                        <div key={risco.id} className={cn("p-2.5 rounded border text-xs", NIVEL_COLORS[risco.nivel_risco] + "/20", "border-border/40")}>
                          <p className="font-medium">{risco.titulo}</p>
                          {risco.setor && <p className="text-[11px] text-muted-foreground">Setor: {risco.setor}</p>}
                          {risco.medidas_recomendadas && risco.medidas_recomendadas.length > 0 && (
                            <p className="text-[11px] text-emerald-700 mt-0.5">
                              ✓ Medidas: {risco.medidas_recomendadas.slice(0, 2).join("; ")}
                            </p>
                          )}
                          {risco.subtipo === "psicossocial" && (
                            <p className="text-[11px] text-purple-600 mt-0.5">
                              * Dados psicossociais anonimizados — ISO 45003
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {riscos.length === 0 && (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhum risco cadastrado para comunicar.</p>
                </div>
              )}

              {/* Rodapé */}
              {riscos.length > 0 && (
                <div className="p-3 border-t border-border/40 text-[11px] text-muted-foreground">
                  <p>
                    Em caso de dúvidas ou para reportar novos riscos, entre em contato com o
                    responsável de SST da empresa. Sua participação é fundamental para um ambiente
                    de trabalho mais seguro e saudável.
                  </p>
                  <p className="mt-1 font-medium">Sistema YourEyes · {dataGeracao}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
