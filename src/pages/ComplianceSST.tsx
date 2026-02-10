import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Shield,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingDown,
  Upload,
  Search,
  BarChart3,
  FileCheck,
  AlertCircle,
  ArrowRight,
  Activity,
  BookOpen,
  Zap,
  Target,
} from "lucide-react";

const ComplianceSST = () => {
  const [activeTab, setActiveTab] = useState("painel");

  // Mock data for dashboard
  const conformidadeGeral = 72;
  const alertasCriticos = 3;
  const alertasAtencao = 7;
  const acoesEmDia = 85;
  const documentosVigentes = 4;
  const documentosVencidos = 1;

  const documentos = [
    { tipo: "PGR", status: "vigente", emissao: "2025-03-15", vigencia: "2026-03-15", empresa: "Safety Corp", profissional: "Eng. Carlos Silva" },
    { tipo: "PCMSO", status: "vigente", emissao: "2025-01-10", vigencia: "2026-01-10", empresa: "MedWork", profissional: "Dr. Ana Santos" },
    { tipo: "LTCAT", status: "vencido", emissao: "2023-06-20", vigencia: "2024-06-20", empresa: "Safety Corp", profissional: "Eng. Carlos Silva" },
    { tipo: "AEP", status: "vigente", emissao: "2025-05-01", vigencia: "2026-05-01", empresa: "Ergon", profissional: "Ft. Maria Lima" },
    { tipo: "PPRA (Legado)", status: "vigente", emissao: "2024-11-01", vigencia: "2025-11-01", empresa: "Safety Corp", profissional: "Eng. Carlos Silva" },
  ];

  const alertas = [
    { tipo: "critico", descricao: "LTCAT vencido desde Jun/2024 — exposição a agentes nocivos sem laudo atualizado", norma: "IN PRES/INSS 128/2022", documento: "LTCAT" },
    { tipo: "critico", descricao: "Risco químico identificado no PGR sem exame correspondente no PCMSO", norma: "NR-07, NR-09", documento: "PGR / PCMSO" },
    { tipo: "critico", descricao: "Evento S-2240 não localizado para risco identificado no LTCAT", norma: "eSocial", documento: "LTCAT / eSocial" },
    { tipo: "alerta", descricao: "Treinamento NR-35 (trabalho em altura) vencido para 3 colaboradores", norma: "NR-35", documento: "PGR" },
    { tipo: "alerta", descricao: "Função 'Operador de Empilhadeira' consta no PGR mas ausente no PCMSO", norma: "NR-07", documento: "PGR / PCMSO" },
    { tipo: "atencao", descricao: "PGR não contempla risco ergonômico para setor Administrativo", norma: "NR-17", documento: "PGR" },
    { tipo: "atencao", descricao: "Vigência do PCMSO expira em 60 dias", norma: "NR-07", documento: "PCMSO" },
  ];

  const indicadores = [
    { titulo: "Índice de Conformidade SST", valor: "72%", tendencia: "up", icone: Shield },
    { titulo: "Alertas Críticos Ativos", valor: "3", tendencia: "down", icone: AlertTriangle },
    { titulo: "Ações Legais em Dia", valor: "85%", tendencia: "up", icone: CheckCircle2 },
    { titulo: "CATs no Período", valor: "2", tendencia: "stable", icone: Activity },
    { titulo: "Exposição Financeira", valor: "R$ 45.000", tendencia: "down", icone: TrendingDown },
    { titulo: "Impacto FAP Estimado", valor: "1.2→0.9", tendencia: "up", icone: Target },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" />
            Compliance SST
          </h1>
          <p className="text-muted-foreground mt-1">
            Governança, conformidade e inteligência legal em Saúde e Segurança do Trabalho
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <BookOpen className="w-4 h-4 mr-2" />
            Guia NRs
          </Button>
          <Button size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Upload Documento
          </Button>
        </div>
      </div>

      {/* Disclaimer */}
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
        <CardContent className="py-3 px-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Aviso legal:</strong> Este módulo não substitui profissionais legalmente habilitados nem elabora documentos obrigatórios (PGR, PCMSO, LTCAT). 
            Atua como orquestrador da execução, auditor de coerência e gerador de inteligência preventiva.
          </p>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
          <TabsTrigger value="painel" className="text-xs md:text-sm">
            <BarChart3 className="w-4 h-4 mr-1.5" />
            Painel
          </TabsTrigger>
          <TabsTrigger value="documentos" className="text-xs md:text-sm">
            <FileText className="w-4 h-4 mr-1.5" />
            Documentos
          </TabsTrigger>
          <TabsTrigger value="alertas" className="text-xs md:text-sm">
            <AlertTriangle className="w-4 h-4 mr-1.5" />
            Alertas
          </TabsTrigger>
          <TabsTrigger value="acoes" className="text-xs md:text-sm">
            <Target className="w-4 h-4 mr-1.5" />
            Ações
          </TabsTrigger>
          <TabsTrigger value="esocial" className="text-xs md:text-sm">
            <FileCheck className="w-4 h-4 mr-1.5" />
            eSocial
          </TabsTrigger>
        </TabsList>

        {/* PAINEL */}
        <TabsContent value="painel" className="space-y-6">
          {/* Indicadores */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {indicadores.map((ind, i) => (
              <Card key={i}>
                <CardContent className="p-4 text-center">
                  <ind.icone className="w-6 h-6 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold text-foreground">{ind.valor}</p>
                  <p className="text-xs text-muted-foreground mt-1">{ind.titulo}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Conformidade e Documentos */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Índice de Conformidade SST</CardTitle>
                <CardDescription>Visão consolidada do nível de conformidade</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-4xl font-bold text-primary">{conformidadeGeral}%</span>
                  <Badge variant={conformidadeGeral >= 80 ? "default" : conformidadeGeral >= 60 ? "secondary" : "destructive"}>
                    {conformidadeGeral >= 80 ? "Bom" : conformidadeGeral >= 60 ? "Atenção" : "Crítico"}
                  </Badge>
                </div>
                <Progress value={conformidadeGeral} className="h-3" />
                <div className="grid grid-cols-3 gap-3 text-center text-sm">
                  <div>
                    <p className="font-semibold text-destructive">{alertasCriticos}</p>
                    <p className="text-muted-foreground text-xs">Críticos</p>
                  </div>
                  <div>
                    <p className="font-semibold text-accent-foreground">{alertasAtencao}</p>
                    <p className="text-muted-foreground text-xs">Alertas</p>
                  </div>
                  <div>
                    <p className="font-semibold text-primary">{acoesEmDia}%</p>
                    <p className="text-muted-foreground text-xs">Ações em dia</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Documentos Legais</CardTitle>
                <CardDescription>Status de vigência dos documentos obrigatórios</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {documentos.slice(0, 4).map((doc, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{doc.tipo}</p>
                        <p className="text-xs text-muted-foreground">{doc.profissional}</p>
                      </div>
                    </div>
                    <Badge variant={doc.status === "vigente" ? "default" : "destructive"} className="text-xs">
                      {doc.status === "vigente" ? "Vigente" : "Vencido"}
                    </Badge>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="w-full mt-2">
                  Ver todos <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Alertas recentes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Alertas Recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alertas.slice(0, 4).map((alerta, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="mt-0.5">
                    {alerta.tipo === "critico" ? (
                      <div className="w-3 h-3 rounded-full bg-destructive" />
                    ) : alerta.tipo === "alerta" ? (
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">{alerta.descricao}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{alerta.norma}</Badge>
                      <Badge variant="outline" className="text-xs">{alerta.documento}</Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs">
                    <Zap className="w-3 h-3 mr-1" />
                    Ação
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOCUMENTOS */}
        <TabsContent value="documentos" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Gestão de Documentos Legais</h2>
            <Button size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Upload Documento
            </Button>
          </div>

          <div className="grid gap-4">
            {documentos.map((doc, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{doc.tipo}</p>
                      <p className="text-sm text-muted-foreground">
                        {doc.empresa} — {doc.profissional}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Emissão: {doc.emissao} | Vigência: {doc.vigencia}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={doc.status === "vigente" ? "default" : "destructive"}>
                      {doc.status === "vigente" ? "Vigente" : "Vencido"}
                    </Badge>
                    <Button variant="outline" size="sm">
                      <Search className="w-4 h-4 mr-1" />
                      Análise IA
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ALERTAS */}
        <TabsContent value="alertas" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Alertas de Conformidade</h2>
            <div className="flex gap-2">
              <Badge variant="destructive">{alertas.filter(a => a.tipo === "critico").length} Críticos</Badge>
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">{alertas.filter(a => a.tipo === "alerta").length} Alertas</Badge>
              <Badge variant="secondary">{alertas.filter(a => a.tipo === "atencao").length} Atenção</Badge>
            </div>
          </div>

          <div className="space-y-3">
            {alertas.map((alerta, i) => (
              <Card key={i} className={
                alerta.tipo === "critico" ? "border-destructive/50" :
                alerta.tipo === "alerta" ? "border-amber-300" : ""
              }>
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="mt-1">
                    {alerta.tipo === "critico" ? (
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                    ) : alerta.tipo === "alerta" ? (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={
                        alerta.tipo === "critico" ? "destructive" :
                        alerta.tipo === "alerta" ? "secondary" : "outline"
                      } className="text-xs">
                        {alerta.tipo === "critico" ? "🔴 Crítico" : alerta.tipo === "alerta" ? "🟠 Alerta Técnico" : "🟡 Atenção"}
                      </Badge>
                    </div>
                    <p className="text-sm">{alerta.descricao}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">{alerta.norma}</Badge>
                      <Badge variant="outline" className="text-xs">{alerta.documento}</Badge>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">
                    <Zap className="w-4 h-4 mr-1" />
                    Gerar Ação
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* AÇÕES */}
        <TabsContent value="acoes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ações Legais de SST</CardTitle>
              <CardDescription>
                Ações geradas a partir de obrigações identificadas nos documentos e análises de conformidade
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                As ações de SST são integradas ao módulo de Plano de Ação com origem "Legal / SST".
              </p>
              <Button variant="outline" className="mt-4">
                <ArrowRight className="w-4 h-4 mr-2" />
                Ir para Plano de Ação
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* eSocial */}
        <TabsContent value="esocial" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Auditoria eSocial — Eventos SST</CardTitle>
              <CardDescription>
                Confronto entre eventos enviados (S-2210, S-2220, S-2240) e dados dos documentos legais
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileCheck className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Em breve: conecte o certificado digital da empresa para auditoria automática dos eventos SST no eSocial.
              </p>
              <Button variant="outline" className="mt-4" disabled>
                <Clock className="w-4 h-4 mr-2" />
                Em Desenvolvimento
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ComplianceSST;
