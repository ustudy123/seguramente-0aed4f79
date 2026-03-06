import { useState } from "react";
import {
  BarChart3,
  Brain,
  TrendingUp,
  Users,
  Download,
  ShieldCheck,
  Lock,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePsicossocial } from "@/hooks/usePsicossocial";
import { RadarPsicossocial } from "./RadarPsicossocial";
import { IPSGauge } from "./IPSGauge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import {
  type CampanhaPsicossocial,
  getIPSColor,
  getIPSBgColor,
  calcularIPSClassificacao,
  type IPSClassificacao,
} from "@/types/psicossocial";
import { cn } from "@/lib/utils";

const MINIMO_ANONIMATO = 5;

interface ResultadosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campanha: CampanhaPsicossocial;
}

export function ResultadosModal({ open, onOpenChange, campanha }: ResultadosModalProps) {
  const { useEstatisticasCampanha, useRespostasCampanha } = usePsicossocial();
  const { data: stats, isLoading: loadingStats } = useEstatisticasCampanha(campanha.id);
  const { data: respostas = [], isLoading: loadingRespostas } = useRespostasCampanha(campanha.id);
  const { user, profile } = useAuth();
  const { tenantId } = useTenant();
  const { empresaAtivaId } = useEmpresaAtiva();

  const [analisandoIA, setAnalisandoIA] = useState(false);
  const [analiseIA, setAnaliseIA] = useState<string | null>(null);
  const [criandoAcao, setCriandoAcao] = useState(false);

  const isLoading = loadingStats || loadingRespostas;

  // IPS e classificação a partir das estatísticas reais
  const ips = stats?.ips;
  const ipsClass = ips !== undefined ? calcularIPSClassificacao(ips) : null;

  // Dimensões por resposta → agregar média por dimensão
  const dimensoesAgregadas = (() => {
    if (!stats?.anonimato_garantido || respostas.length < MINIMO_ANONIMATO) return [];
    const mapa: Record<string, number[]> = {};
    respostas.forEach(r => {
      r.indicadores?.detalhes?.forEach(d => {
        if (!mapa[d.bloco]) mapa[d.bloco] = [];
        mapa[d.bloco].push(d.media);
      });
    });
    return Object.entries(mapa).map(([bloco, valores]) => ({
      bloco,
      media: Math.round(valores.reduce((a, b) => a + b, 0) / valores.length),
    })).sort((a, b) => a.media - b.media); // ordenado do pior para o melhor
  })();

  const getNivelScore = (score: number): { label: string; cls: IPSClassificacao } => {
    const cls = calcularIPSClassificacao(score);
    const labels: Record<IPSClassificacao, string> = {
      saudavel: 'Saudável',
      estavel: 'Estável',
      atencao: 'Atenção',
      risco: 'Risco',
      critico: 'Crítico',
    };
    return { label: labels[cls], cls };
  };

  const handleAnalisarIA = async () => {
    if (!stats || !ips) return;
    setAnalisandoIA(true);
    setAnaliseIA(null);
    try {
      const contexto = {
        campanha: campanha.nome,
        instrumento: campanha.instrumento || 'copsoq',
        ips,
        classificacao: ipsClass,
        total_respostas: stats.concluidos,
        taxa_participacao: stats.taxa_participacao,
        dimensoes_criticas: dimensoesAgregadas.filter(d => d.media < 50).map(d => d.bloco),
        dimensoes_atencao: dimensoesAgregadas.filter(d => d.media >= 50 && d.media < 65).map(d => d.bloco),
        dimensoes_saudaveis: dimensoesAgregadas.filter(d => d.media >= 80).map(d => d.bloco),
      };

      const { data, error } = await supabase.functions.invoke('ai-psicossocial-analise', {
        body: { contexto },
      });

      if (error) throw error;
      setAnaliseIA(data?.analise || "Análise não disponível.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar análise IA. Verifique a configuração da edge function.");
    } finally {
      setAnalisandoIA(false);
    }
  };

  const handleCriarAcao = async () => {
    if (!tenantId || !ips || !ipsClass) return;
    setCriandoAcao(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-psicossocial-analise', {
        body: {
          contexto: {
            campanha: campanha.nome,
            instrumento: campanha.instrumento || 'copsoq',
            ips,
            classificacao: ipsClass,
            dimensoes_criticas: dimensoesAgregadas.filter(d => d.media < 50).map(d => d.bloco),
          },
          modo: 'plano_acao',
        },
      });
      if (error) throw error;

      const sugestao = data?.sugestao_acao;
      const { error: errAcao } = await supabase.from('plano_acoes').insert({
        tenant_id: tenantId,
        empresa_id: empresaAtivaId || null,
        titulo: sugestao?.titulo || `Ação Psicossocial — ${campanha.nome}`,
        descricao: sugestao?.descricao || `Ação gerada a partir da campanha psicossocial com IPS ${ips}.`,
        porque: sugestao?.porque || `IPS ${ips} — Classificação: ${ipsClass}`,
        onde: sugestao?.onde || 'Organização',
        como: sugestao?.como || 'Implementar ações de melhoria psicossocial conforme diagnóstico.',
        tipo: 'preventiva' as const,
        prioridade: (ips < 35 ? 'imediato' : ips < 50 ? 'urgente' : 'medio') as any,
        origem_modulo: 'manual' as const,
        origem_descricao: `Campanha Psicossocial: ${campanha.nome}`,
        criado_por: user?.id,
        criado_por_nome: profile?.nome_completo || 'Sistema',
        exige_evidencia: false,
        codigo: '',
        progresso: 0,
        status: 'pendente' as const,
        tempo_gasto_minutos: 0,
      });
      if (errAcao) throw errAcao;
      toast.success("Ação criada no Plano de Ação com sugestão IA!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao criar ação: " + (err.message || ""));
    } finally {
      setCriandoAcao(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            Resultados — {campanha.nome}
          </DialogTitle>
          <DialogDescription>
            {stats?.concluidos || 0} respostas de {stats?.total_convites || 0} convites enviados
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : stats?.concluidos === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma resposta ainda</h3>
            <p className="text-muted-foreground">Aguardando colaboradores responderem o questionário</p>
          </div>
        ) : (
          <Tabs defaultValue="visao_geral" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="visao_geral">Visão Geral</TabsTrigger>
              <TabsTrigger value="dimensoes">Por Dimensão</TabsTrigger>
              <TabsTrigger value="ia">
                <Sparkles className="h-3.5 w-3.5 mr-1 text-purple-500" />
                Análise IA
              </TabsTrigger>
              <TabsTrigger value="participacao">Participação</TabsTrigger>
            </TabsList>

            {/* ── Tab: Visão Geral ── */}
            <TabsContent value="visao_geral" className="space-y-4 mt-4">
              {!stats?.anonimato_garantido ? (
                <Card className="border-amber-200 bg-amber-50/40">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <Lock className="h-6 w-6 text-amber-600" />
                      <div>
                        <p className="font-semibold text-amber-800">Número insuficiente de respostas para garantir anonimato estatístico</p>
                        <p className="text-sm text-amber-700">
                          Mínimo necessário: {MINIMO_ANONIMATO} respostas. Atual: {stats?.concluidos || 0}.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* IPS principal */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 to-background">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                          <Brain className="h-4 w-4 text-purple-600" />
                          IPS — Índice Psicossocial
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col items-center">
                        {ips !== undefined && ipsClass ? (
                          <IPSGauge score={ips} classificacao={ipsClass} size="lg" />
                        ) : (
                          <p className="text-muted-foreground text-sm py-6">Score indisponível</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Radar */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Radar Psicossocial</CardTitle>
                        <CardDescription className="text-xs">Score por dimensão (0-100)</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {stats?.radar && stats.radar.length > 0 ? (
                          <RadarPsicossocial dados={stats.radar} />
                        ) : (
                          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                            Dados insuficientes para o radar
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Destaques: top piores e melhores */}
                  {dimensoesAgregadas.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Card className="border-red-100">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-4 w-4" />
                            Dimensões Críticas
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {dimensoesAgregadas.filter(d => d.media < 65).slice(0, 4).map(d => {
                            const nivel = getNivelScore(d.media);
                            return (
                              <div key={d.bloco} className="flex items-center justify-between">
                                <span className="text-sm truncate max-w-[65%]">{d.bloco}</span>
                                <div className="flex items-center gap-2">
                                  <Progress value={d.media} className="w-16 h-1.5" />
                                  <span className={cn("text-xs font-semibold w-8 text-right", getIPSColor(nivel.cls))}>{d.media}</span>
                                </div>
                              </div>
                            );
                          })}
                          {dimensoesAgregadas.filter(d => d.media < 65).length === 0 && (
                            <p className="text-sm text-muted-foreground">Nenhuma dimensão crítica 🎉</p>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="border-emerald-100">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2 text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" />
                            Pontos Fortes
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {[...dimensoesAgregadas].reverse().filter(d => d.media >= 65).slice(0, 4).map(d => {
                            const nivel = getNivelScore(d.media);
                            return (
                              <div key={d.bloco} className="flex items-center justify-between">
                                <span className="text-sm truncate max-w-[65%]">{d.bloco}</span>
                                <div className="flex items-center gap-2">
                                  <Progress value={d.media} className="w-16 h-1.5" />
                                  <span className={cn("text-xs font-semibold w-8 text-right", getIPSColor(nivel.cls))}>{d.media}</span>
                                </div>
                              </div>
                            );
                          })}
                          {[...dimensoesAgregadas].reverse().filter(d => d.media >= 65).length === 0 && (
                            <p className="text-sm text-muted-foreground">Sem dimensões saudáveis ainda</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* ── Tab: Por Dimensão ── */}
            <TabsContent value="dimensoes" className="mt-4">
              {!stats?.anonimato_garantido ? (
                <Card className="border-amber-200 bg-amber-50/40">
                  <CardContent className="pt-4 flex items-center gap-3">
                    <Lock className="h-5 w-5 text-amber-600" />
                    <p className="text-sm text-amber-800 font-medium">Número insuficiente de respostas para garantir anonimato estatístico</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {dimensoesAgregadas.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Sem dados de dimensões disponíveis.</p>
                  ) : (
                    dimensoesAgregadas.map(d => {
                      const nivel = getNivelScore(d.media);
                      return (
                        <div key={d.bloco} className={cn("flex items-center justify-between p-3 rounded-lg border", getIPSBgColor(nivel.cls) + "/30")}>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={cn("w-2 h-8 rounded-full shrink-0", {
                              'bg-emerald-500': nivel.cls === 'saudavel',
                              'bg-blue-500': nivel.cls === 'estavel',
                              'bg-amber-500': nivel.cls === 'atencao',
                              'bg-orange-500': nivel.cls === 'risco',
                              'bg-red-500': nivel.cls === 'critico',
                            })} />
                            <p className="font-medium text-sm truncate">{d.bloco}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <Progress value={d.media} className="w-28 h-2" />
                            <span className="text-sm font-bold w-8 text-right">{d.media}</span>
                            <Badge variant="outline" className={cn("text-xs min-w-[70px] justify-center", getIPSColor(nivel.cls))}>
                              {nivel.label}
                            </Badge>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </TabsContent>

            {/* ── Tab: Análise IA ── */}
            <TabsContent value="ia" className="mt-4 space-y-4">
              {!stats?.anonimato_garantido ? (
                <Card className="border-amber-200 bg-amber-50/40">
                  <CardContent className="pt-4 flex items-center gap-3">
                    <Lock className="h-5 w-5 text-amber-600" />
                    <p className="text-sm text-amber-800 font-medium">Número insuficiente de respostas para garantir anonimato estatístico</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card className="border-purple-200 bg-purple-50/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-600" />
                        Interpretação IA dos Resultados
                      </CardTitle>
                      <CardDescription className="text-xs">
                        A IA analisa o IPS, dimensões críticas e padrões para gerar recomendações organizacionais
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {analiseIA ? (
                        <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground bg-background rounded-lg p-4 border">
                          {analiseIA}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <Brain className="h-10 w-10 mx-auto mb-2 opacity-40" />
                          <p className="text-sm">Clique em "Analisar com IA" para gerar a interpretação dos resultados</p>
                        </div>
                      )}
                      <Button
                        onClick={handleAnalisarIA}
                        disabled={analisandoIA || !ips}
                        className="w-full gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                      >
                        {analisandoIA ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</>
                        ) : (
                          <><Sparkles className="h-4 w-4" /> {analiseIA ? 'Reanalisar com IA' : 'Analisar com IA'}</>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Criar Plano de Ação */}
                  {ips !== undefined && ips < 80 && (
                    <Card className="border-amber-200 bg-amber-50/20">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-amber-600" />
                          Plano de Ação Preventivo
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Gere automaticamente uma ação 5W2H no Plano de Ação a partir deste diagnóstico
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button
                          onClick={handleCriarAcao}
                          disabled={criandoAcao}
                          variant="outline"
                          className="w-full gap-2 border-amber-300 hover:bg-amber-50"
                        >
                          {criandoAcao ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Criando ação...</>
                          ) : (
                            <><Sparkles className="h-4 w-4 text-amber-600" /> Criar Ação no Plano de Ação</>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          Acessível em Planos & Desenvolvimento → Plano de Ação
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            {/* ── Tab: Participação ── */}
            <TabsContent value="participacao" className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total de Convites</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.total_convites || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Concluídos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-600">{stats?.concluidos || 0}</div>
                    {stats && stats.concluidos >= MINIMO_ANONIMATO ? (
                      <div className="flex items-center gap-1 mt-1">
                        <ShieldCheck className="h-3 w-3 text-emerald-600" />
                        <span className="text-xs text-emerald-600">Anonimato garantido</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 mt-1">
                        <Lock className="h-3 w-3 text-amber-600" />
                        <span className="text-xs text-amber-600">
                          Faltam {MINIMO_ANONIMATO - (stats?.concluidos || 0)} respostas
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Pendentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-600">{stats?.pendentes || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Taxa de Participação</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.taxa_participacao?.toFixed(0) || 0}%</div>
                    <Progress value={stats?.taxa_participacao || 0} className="h-2 mt-2" />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {stats && stats.concluidos > 0 && stats.anonimato_garantido && (
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar Relatório
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
