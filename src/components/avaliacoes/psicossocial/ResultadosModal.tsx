import { useMemo, useState } from "react";
import {
  BarChart3,
  Brain,
  TrendingUp,
  Users,
  ShieldCheck,
  Lock,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  GitCompare,
  Wrench,
} from "lucide-react";
import { PrivacidadeGrupoAlert } from "./PrivacidadeGrupoAlert";
import {
  aplicarRegrasPrivacidade,
  estimarContagemPorGrupo,
} from "@/lib/psicossocial-privacy";
import { ExportarRelatorio } from "./ExportarRelatorio";
import { IntegracaoErgonomiaAEP } from "./IntegracaoErgonomiaAEP";
import { ContaprovaOrganizacional } from "./ContaprovaOrganizacional";
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
import { useAuthContext } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import {
  type CampanhaPsicossocial,
  getIPSColor,
  getIPSBgColor,
  getIRPSColor,
  getIRPSBgColor,
  getIRPSLabel,
  calcularIPSClassificacao,
  calcularIRPSClassificacao,
  type IPSClassificacao,
  type IRPSClassificacao,
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
  // Removemos a busca manual de respostas aqui pois as estatísticas já trazem o IPS e radar agregados,
  // e as respostas individuais são sensíveis ao anonimato. Se precisarmos de detalhes por dimensão,
  // eles devem vir de 'stats'.
  const loadingRespostas = false;
  const respostas: any[] = [];
  const { user, profile } = useAuthContext();
  const { tenantId } = useTenant();
  const { empresaAtivaId } = useEmpresaAtiva();

  const [analisandoIA, setAnalisandoIA] = useState(false);
  const [analiseIA, setAnaliseIA] = useState<string | null>(null);
  const [criandoAcao, setCriandoAcao] = useState(false);

  const isLoading = loadingStats || loadingRespostas;

  const isSipro = campanha.instrumento === 'sipro';

  // IPS e classificação a partir das estatísticas reais
  const ips = stats?.ips;
  const ipsClass = ips !== undefined
    ? isSipro
      ? calcularIRPSClassificacao(ips) as unknown as IPSClassificacao
      : calcularIPSClassificacao(ips)
    : null;

  // Label e cor do score principal conforme instrumento
  const scoreLabel = isSipro ? 'IRP-S — Índice de Risco Psicossocial' : 'IPS — Índice Psicossocial';
  const scoreDescricao = isSipro
    ? 'Score 0–100: quanto maior, maior o risco organizacional'
    : 'Score 0–100: quanto maior, mais saudável o ambiente';

  // ── GAP A+B+C: Proteção de privacidade por grupo (ISO 45003) ───────────────
  // Verifica se há situações de trabalho segmentadas e aplica regras de mínimo.
  const privacidadeGrupos = useMemo(() => {
    const situacoes = campanha.situacoes_trabalho ?? [];
    const totalRespondentes = stats?.concluidos ?? 0;
    if (situacoes.length === 0) return null; // sem segmentação — usa proteção global
    const contagem = estimarContagemPorGrupo(totalRespondentes, situacoes);
    return aplicarRegrasPrivacidade(situacoes, contagem, totalRespondentes);
  }, [campanha.situacoes_trabalho, stats?.concluidos]);

  // Dimensões por resposta → agregar média por dimensão
  // Para SIPRO (IRP-S): maior score = maior risco → críticas têm score ALTO, pontos fortes têm score BAIXO
  // Para demais: menor score = pior → críticas têm score BAIXO, pontos fortes têm score ALTO
  const dimensoesAgregadas = (() => {
    if (!stats?.anonimato_garantido || !stats?.radar || stats.radar.length === 0) return [];
    
    // Usamos os dados do radar que já estão agregados nas estatísticas
    const arr = stats.radar.map(d => ({
      bloco: d.subject,
      media: d.value,
    }));

    // SIPRO: ordenar do mais crítico (maior score) para o menos
    // Outros: ordenar do mais crítico (menor score) para o melhor
    return isSipro
      ? arr.sort((a, b) => b.media - a.media)
      : arr.sort((a, b) => a.media - b.media);
  })();

  // Para SIPRO: crítico = score alto (≥50); ponto forte = score baixo (≤24)
  // Para demais: crítico = score baixo (<65); ponto forte = score alto (≥65)
  const limiarCritico = isSipro ? 50 : 65;
  const limiarForte = isSipro ? 25 : 65;
  const isCritico = (media: number) => isSipro ? media >= limiarCritico : media < limiarCritico;
  const isForte = (media: number) => isSipro ? media <= limiarForte : media >= limiarForte;

  const getNivelScore = (score: number): { label: string; cls: IPSClassificacao } => {
    // Para SIPRO usa lógica invertida (IRP-S): alto = ruim
    // Faixas espelhadas do IPS: 0-20 saudável, 21-35 estável, 36-50 atenção, 51-65 risco, 66-100 crítico
    const cls = isSipro
      ? (score >= 66 ? 'critico' : score >= 51 ? 'risco' : score >= 36 ? 'atencao' : score >= 21 ? 'estavel' : 'saudavel') as IPSClassificacao
      : calcularIPSClassificacao(score);
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
        dimensoes_criticas: dimensoesAgregadas.filter(d => isSipro ? d.media >= 50 : d.media < 50).map(d => d.bloco),
        dimensoes_atencao: dimensoesAgregadas.filter(d => isSipro ? (d.media >= 36 && d.media < 50) : (d.media >= 50 && d.media < 65)).map(d => d.bloco),
        dimensoes_saudaveis: dimensoesAgregadas.filter(d => isSipro ? d.media <= 20 : d.media >= 80).map(d => d.bloco),
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
            dimensoes_criticas: dimensoesAgregadas.filter(d => isSipro ? d.media >= 50 : d.media < 50).map(d => d.bloco),
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
        origem_modulo: 'psicossocial' as const,
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
          <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="visao_geral">Visão Geral</TabsTrigger>
              <TabsTrigger value="dimensoes">Por Dimensão</TabsTrigger>
              <TabsTrigger value="ia">
                <Sparkles className="h-3.5 w-3.5 mr-1 text-purple-500" />
                IA
              </TabsTrigger>
              <TabsTrigger value="contraprova">
                <GitCompare className="h-3.5 w-3.5 mr-1" />
                Contraprova
              </TabsTrigger>
              <TabsTrigger value="ergonomia">
                <Wrench className="h-3.5 w-3.5 mr-1" />
                Ergonomia
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
                  {/* GAP C — badge compacto de privacidade por grupo na visão geral */}
                  {privacidadeGrupos && (
                    <PrivacidadeGrupoAlert resultado={privacidadeGrupos} compact />
                  )}

                  {/* IPS principal */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 to-background">
                      <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                          <Brain className="h-4 w-4 text-purple-600" />
                          {scoreLabel}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col items-center">
                        {ips !== undefined && ipsClass ? (
                          <>
                            <IPSGauge score={ips} classificacao={ipsClass} size="lg" />
                            <p className="text-xs text-muted-foreground text-center mt-2">{scoreDescricao}</p>
                          </>
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
                            {isSipro ? 'Maiores Riscos (IRP-S)' : 'Dimensões Críticas'}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {dimensoesAgregadas.filter(d => isCritico(d.media)).slice(0, 4).map(d => {
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
                          {dimensoesAgregadas.filter(d => isCritico(d.media)).length === 0 && (
                            <p className="text-sm text-muted-foreground">
                              {isSipro ? 'Nenhuma dimensão em risco 🎉' : 'Nenhuma dimensão crítica 🎉'}
                            </p>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="border-emerald-100">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2 text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" />
                            {isSipro ? 'Condições Favoráveis (IRP-S)' : 'Pontos Fortes'}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {[...dimensoesAgregadas].reverse().filter(d => isForte(d.media)).slice(0, 4).map(d => {
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
                          {[...dimensoesAgregadas].reverse().filter(d => isForte(d.media)).length === 0 && (
                            <p className="text-sm text-muted-foreground">
                              {isSipro ? 'Sem dimensões favoráveis ainda' : 'Sem dimensões saudáveis ainda'}
                            </p>
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
                <div className="space-y-3">
                  {/* GAP C — Alerta de privacidade por grupo (ISO 45003) */}
                  {privacidadeGrupos && (
                    <PrivacidadeGrupoAlert resultado={privacidadeGrupos} />
                  )}
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

            {/* ── Tab: Contraprova Organizacional ── */}
            <TabsContent value="contraprova" className="mt-4">
              <ContaprovaOrganizacional campanha={campanha} ips={ips} />
            </TabsContent>

            {/* ── Tab: Ergonomia / AEP ── */}
            <TabsContent value="ergonomia" className="mt-4 space-y-3">
              {/* GAP 3: Banner de recomendação de AET quando IPS < 65 ou múltiplos críticos */}
              {stats?.anonimato_garantido && ips !== undefined && (
                (() => {
                  const criticos = dimensoesAgregadas.filter(d => isCritico(d.media));
                  const isRiscoRelevante = isSipro ? ips >= 50 : ips < 65;
                  const multiplosRiscos = criticos.length >= 2;
                  const riscoUrgente = isSipro ? ips >= 75 : ips < 35;

                  if (!isRiscoRelevante && !multiplosRiscos) return null;

                  return (
                    <div className={`flex items-start gap-3 p-4 rounded-xl border-2 ${
                      riscoUrgente
                        ? 'border-destructive/50 bg-destructive/5'
                        : 'border-orange-200 bg-orange-50/50'
                    }`}>
                      <div className={`p-2 rounded-lg shrink-0 ${riscoUrgente ? 'bg-destructive/10' : 'bg-orange-100'}`}>
                        <span className="text-lg">{riscoUrgente ? '🚨' : '⚠️'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${riscoUrgente ? 'text-destructive' : 'text-orange-800'}`}>
                          {riscoUrgente
                            ? 'AET Obrigatória — Risco Crítico Identificado (NR-17 §17.5)'
                            : `AET Recomendada — ${criticos.length > 0 ? `${criticos.length} dimensão(ões) em risco` : 'IPS em nível de atenção'}`
                          }
                        </p>
                        <p className={`text-xs mt-0.5 ${riscoUrgente ? 'text-destructive/80' : 'text-orange-700'}`}>
                          {riscoUrgente
                            ? 'Riscos críticos exigem Análise Ergonômica do Trabalho para investigação aprofundada das condições organizacionais conforme NR-17.'
                            : 'Recomenda-se iniciar uma Análise Ergonômica do Trabalho (AET) para aprofundar a investigação dos fatores psicossociais identificados.'
                          }
                          {criticos.length > 0 && (
                            <span className="block mt-1">
                              <strong>Dimensões afetadas:</strong> {criticos.slice(0, 3).map(d => d.bloco).join(', ')}{criticos.length > 3 ? ` e mais ${criticos.length - 3}` : ''}.
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          📋 Base normativa: NR-17 / ISO 45003 — Acesse o módulo de Ergonomia para iniciar a AET.
                        </p>
                      </div>
                    </div>
                  );
                })()
              )}
              <IntegracaoErgonomiaAEP
                campanha={campanha}
                ips={ips}
                dimensoesCriticas={dimensoesAgregadas.filter(d => isCritico(d.media)).map(d => d.bloco)}
              />
            </TabsContent>

            {/* ── Tab: Participação ── */}
            <TabsContent value="participacao" className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-5">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total de pessoas que responderam</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.concluidos || 0}</div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Respostas efetivamente registradas
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total no Setor</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">{stats?.total_convites || 0}</div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {stats?.concluidos || 0} de {stats?.total_convites || 0} colaboradores do setor responderam
                    </p>
                    <Progress
                      value={stats?.total_convites ? ((stats.concluidos || 0) / stats.total_convites) * 100 : 0}
                      className="h-1.5 mt-2"
                    />
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
          <ExportarRelatorio
            campanha={campanha}
            stats={stats}
            dimensoes={dimensoesAgregadas}
            analiseIA={analiseIA}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
