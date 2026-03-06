import { useState } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  Users,
  Send,
  BarChart3,
  Plus,
  QrCode,
  Link as LinkIcon,
  AlertTriangle,
  TrendingUp,
  Heart,
  ShieldCheck,
  FileText,
  Activity,
  Sparkles,
  Lock,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePsicossocial } from "@/hooks/usePsicossocial";
import { CampanhaList } from "./CampanhaList";
import { CampanhaForm } from "./CampanhaForm";
import { IPSGauge } from "./IPSGauge";
import { INSTRUMENTOS, type IPSClassificacao, getIPSLabel, getIPSColor, getIPSBgColor, calcularIPSClassificacao } from "@/types/psicossocial";
import { cn } from "@/lib/utils";

const MINIMO_ANONIMATO = 5;

export function PsicossocialDashboard() {
  const [showForm, setShowForm] = useState(false);
  const { campanhas, campanhasAtivas, isLoadingCampanhas } = usePsicossocial();

  const totalCampanhas = campanhas.length;
  const campanhasEncerradas = campanhas.filter(c => c.status === 'encerrada').length;
  const totalRespostas = campanhas.reduce((sum, c) => sum + (c.total_respostas || 0), 0);

  // IPS consolidado das campanhas encerradas com dados suficientes
  const campanhasComIPS = campanhas.filter(c => c.ips_score != null && (c.total_respostas || 0) >= MINIMO_ANONIMATO);
  const ipsConsolidado = campanhasComIPS.length > 0
    ? Math.round(campanhasComIPS.reduce((sum, c) => sum + (c.ips_score || 50), 0) / campanhasComIPS.length)
    : null;
  const ipsClassificacao: IPSClassificacao | null = ipsConsolidado != null ? calcularIPSClassificacao(ipsConsolidado) : null;

  if (isLoadingCampanhas) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-600" />
            Gestão Psicossocial
          </h2>
          <p className="text-muted-foreground text-sm">
            NR-01 · NR-17 · ISO 45001 · ISO 45003 — Análise multidimensional baseada em evidências
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Stats + IPS */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {/* IPS Card */}
        <Card className="lg:col-span-2 border-purple-200 bg-gradient-to-br from-purple-50/50 to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-600" />
              IPS — Índice Psicossocial Organizacional
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-2">
            {ipsConsolidado != null && ipsClassificacao ? (
              <IPSGauge score={ipsConsolidado} classificacao={ipsClassificacao} size="md" />
            ) : (
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="p-3 rounded-full bg-muted">
                  <Lock className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Mín. {MINIMO_ANONIMATO} respostas para liberar análise
                </p>
              </div>
            )}
            <div className="mt-3 w-full grid grid-cols-5 gap-0.5 text-xs">
              {[
                { label: '0-34', nome: 'Crítico', color: 'bg-red-500' },
                { label: '35-49', nome: 'Risco', color: 'bg-orange-500' },
                { label: '50-64', nome: 'Atenção', color: 'bg-amber-500' },
                { label: '65-79', nome: 'Estável', color: 'bg-blue-500' },
                { label: '80-100', nome: 'Saudável', color: 'bg-emerald-500' },
              ].map(item => (
                <div key={item.label} className="flex flex-col items-center gap-0.5">
                  <div className={cn("h-1.5 w-full rounded-full", item.color)} />
                  <span className="text-muted-foreground text-[10px]">{item.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Campanhas Ativas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campanhas Ativas</CardTitle>
            <div className="p-2 rounded-lg bg-purple-100">
              <Brain className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campanhasAtivas}</div>
            <p className="text-xs text-muted-foreground">de {totalCampanhas} campanhas</p>
          </CardContent>
        </Card>

        {/* Respostas Coletadas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Respostas</CardTitle>
            <div className="p-2 rounded-lg bg-blue-100">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRespostas > 0 ? totalRespostas : '—'}</div>
            <p className="text-xs text-muted-foreground">
              {totalRespostas >= MINIMO_ANONIMATO ? 'Análise liberada' : `Mín. ${MINIMO_ANONIMATO} para análise`}
            </p>
          </CardContent>
        </Card>

        {/* Concluídas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            <div className="p-2 rounded-lg bg-emerald-100">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campanhasEncerradas}</div>
            <p className="text-xs text-muted-foreground">histórico disponível</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principais */}
      <Tabs defaultValue="campanhas">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="campanhas" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="instrumentos" className="gap-2">
            <FileText className="h-4 w-4" />
            Instrumentos
          </TabsTrigger>
          <TabsTrigger value="indicadores" className="gap-2">
            <Activity className="h-4 w-4" />
            Indicadores
          </TabsTrigger>
          <TabsTrigger value="distribuicao" className="gap-2">
            <Send className="h-4 w-4" />
            Distribuição
          </TabsTrigger>
        </TabsList>

        {/* Tab: Campanhas */}
        <TabsContent value="campanhas" className="mt-4">
          <CampanhaList campanhas={campanhas} onNovaCampanha={() => setShowForm(true)} />
        </TabsContent>

        {/* Tab: Instrumentos */}
        <TabsContent value="instrumentos" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {INSTRUMENTOS.map((inst) => (
              <motion.div
                key={inst.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="h-full hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{inst.nome}</CardTitle>
                        <CardDescription className="text-xs mt-1">{inst.descricao}</CardDescription>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">{inst.totalPerguntas} perguntas</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{inst.uso}</p>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dimensões avaliadas</p>
                      <div className="flex flex-wrap gap-1">
                        {inst.dimensoes.slice(0, 5).map(d => (
                          <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
                        ))}
                        {inst.dimensoes.length > 5 && (
                          <Badge variant="secondary" className="text-xs">+{inst.dimensoes.length - 5}</Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 gap-2"
                      onClick={() => setShowForm(true)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Criar campanha com {inst.nome}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Dimensões psicossociais avaliadas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dimensões Psicossociais Avaliadas</CardTitle>
              <CardDescription>Baseadas em NR-01, NR-17, ISO 45001 e ISO 45003</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { icon: AlertTriangle, label: 'Demanda de Trabalho', desc: 'Carga, ritmo, pressão por tempo', color: 'bg-red-100 text-red-600' },
                  { icon: Brain, label: 'Controle e Autonomia', desc: 'Participação, decisões, liberdade', color: 'bg-purple-100 text-purple-600' },
                  { icon: Users, label: 'Relações Sociais', desc: 'Suporte da liderança e equipe', color: 'bg-blue-100 text-blue-600' },
                  { icon: ShieldCheck, label: 'Justiça Organizacional', desc: 'Reconhecimento, tratamento justo', color: 'bg-emerald-100 text-emerald-600' },
                  { icon: Heart, label: 'Segurança Psicológica', desc: 'Liberdade de expressão', color: 'bg-pink-100 text-pink-600' },
                  { icon: Sparkles, label: 'Sentido e Propósito', desc: 'Significado, motivação', color: 'bg-amber-100 text-amber-600' },
                  { icon: Activity, label: 'Monotonia / Boreout', desc: 'Repetitividade, estímulo cognitivo', color: 'bg-slate-100 text-slate-600' },
                  { icon: TrendingUp, label: 'Equilíbrio Trabalho-Vida', desc: 'Conflito pessoal-profissional', color: 'bg-orange-100 text-orange-600' },
                ].map(({ icon: Icon, label, desc, color }) => (
                  <div key={label} className="flex items-start gap-3 p-3 rounded-lg border">
                    <div className={cn("p-2 rounded-lg shrink-0", color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Indicadores */}
        <TabsContent value="indicadores" className="mt-4 space-y-4">
          {/* Regra de Anonimato */}
          <Card className="border-blue-200 bg-blue-50/40">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-blue-100">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Regra de Anonimato Estatístico</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Os resultados só são apresentados quando houver <strong>mínimo de {MINIMO_ANONIMATO} respostas</strong> na campanha.
                    Com menos de {MINIMO_ANONIMATO} respondentes, a análise permanece bloqueada para garantir a privacidade individual.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Índices */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                Índices Calculados Automaticamente
              </CardTitle>
              <CardDescription>Gerados a partir das respostas após atingir o mínimo de anonimato</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { codigo: 'IPS', nome: 'Índice Psicossocial Seguramente', desc: 'Score geral do ambiente organizacional (0-100)', color: 'bg-purple-100 text-purple-600', destaque: true },
                  { codigo: 'IRP-S', nome: 'Risco Psicossocial', desc: 'Exposição a fatores de risco', color: 'bg-red-100 text-red-600', destaque: false },
                  { codigo: 'IBO-S', nome: 'Burnout', desc: 'Indícios de esgotamento profissional', color: 'bg-orange-100 text-orange-600', destaque: false },
                  { codigo: 'IBD-S', nome: 'Boreout', desc: 'Falta de desafio e engajamento', color: 'bg-slate-100 text-slate-600', destaque: false },
                  { codigo: 'IREC-S', nome: 'Recuperação', desc: 'Capacidade de recuperação pós-trabalho', color: 'bg-blue-100 text-blue-600', destaque: false },
                  { codigo: 'ICOP-S', nome: 'Clareza Organizacional', desc: 'Clareza de papéis e direcionamento', color: 'bg-emerald-100 text-emerald-600', destaque: false },
                ].map(({ codigo, nome, desc, color, destaque }) => (
                  <div key={codigo} className={cn("p-4 rounded-lg border", destaque && "border-purple-200 bg-purple-50/30")}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn("px-2 py-0.5 rounded text-xs font-bold", color)}>{codigo}</div>
                      {destaque && <Badge className="bg-purple-600 text-xs">Principal</Badge>}
                    </div>
                    <p className="font-medium text-sm">{nome}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Classificação IPS */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Classificação do IPS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-5">
                {[
                  { range: '80-100', label: 'Ambiente Saudável', cls: 'saudavel' as IPSClassificacao },
                  { range: '65-79', label: 'Ambiente Estável', cls: 'estavel' as IPSClassificacao },
                  { range: '50-64', label: 'Atenção', cls: 'atencao' as IPSClassificacao },
                  { range: '35-49', label: 'Risco Psicossocial', cls: 'risco' as IPSClassificacao },
                  { range: '0-34', label: 'Risco Crítico', cls: 'critico' as IPSClassificacao },
                ].map(({ range, label, cls }) => (
                  <div key={range} className={cn("p-3 rounded-lg text-center", getIPSBgColor(cls))}>
                    <p className={cn("text-lg font-bold", getIPSColor(cls))}>{range}</p>
                    <p className={cn("text-xs font-medium", getIPSColor(cls))}>{label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Distribuição */}
        <TabsContent value="distribuicao" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Canais de Distribuição</CardTitle>
              <CardDescription>Múltiplas formas de enviar o questionário aos colaboradores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-start gap-3 p-4 rounded-lg border hover:shadow-sm transition-shadow">
                  <div className="p-2 rounded-full bg-blue-100 shrink-0">
                    <LinkIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Link Único</p>
                    <p className="text-sm text-muted-foreground mt-0.5">Envie por WhatsApp, e-mail ou intranet</p>
                    <Badge variant="outline" className="mt-2 text-xs text-emerald-600 border-emerald-300">Disponível</Badge>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg border hover:shadow-sm transition-shadow">
                  <div className="p-2 rounded-full bg-purple-100 shrink-0">
                    <QrCode className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">QR Code</p>
                    <p className="text-sm text-muted-foreground mt-0.5">Imprima ou exiba em telas e murais</p>
                    <Badge variant="outline" className="mt-2 text-xs text-emerald-600 border-emerald-300">Disponível</Badge>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg border opacity-60">
                  <div className="p-2 rounded-full bg-emerald-100 shrink-0">
                    <Send className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium">WhatsApp API</p>
                    <p className="text-sm text-muted-foreground mt-0.5">Envio automatizado via API</p>
                    <Badge variant="secondary" className="mt-2 text-xs">Em breve</Badge>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg border opacity-60">
                  <div className="p-2 rounded-full bg-amber-100 shrink-0">
                    <Users className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium">Totem / Quiosque</p>
                    <p className="text-sm text-muted-foreground mt-0.5">Modo presencial sem papel</p>
                    <Badge variant="secondary" className="mt-2 text-xs">Em breve</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Escopos de aplicação */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Escopos de Aplicação</CardTitle>
              <CardDescription>Direcione a campanha para grupos específicos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-5">
                {[
                  { label: 'Empresa Inteira', icon: '🏢' },
                  { label: 'Unidade', icon: '🏭' },
                  { label: 'Setor', icon: '👥' },
                  { label: 'Função', icon: '💼' },
                  { label: 'Grupo Homogêneo', icon: '🎯' },
                ].map(({ label, icon }) => (
                  <div key={label} className="text-center p-3 rounded-lg border bg-muted/30">
                    <div className="text-2xl mb-1">{icon}</div>
                    <p className="text-xs font-medium">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Mesmo quando o envio for individual, os resultados serão sempre agregados para garantir o anonimato.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Nova Campanha */}
      <CampanhaForm
        open={showForm}
        onOpenChange={setShowForm}
      />
    </div>
  );
}
