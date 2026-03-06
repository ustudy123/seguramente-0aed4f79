import { useState } from "react";
import { 
  Target, 
  ClipboardCheck, 
  LayoutGrid, 
  FileText, 
  Users,
  TrendingUp,
  AlertCircle,
  Settings,
  BarChart3,
  PenTool,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAvaliacoes } from "@/hooks/useAvaliacoes";
import { useMetas } from "@/hooks/useMetas";
import { useAvaliacaoPermissoes } from "@/hooks/useAvaliacaoPermissoes";
import { AvaliacaoInbox } from "@/components/avaliacoes/resposta/AvaliacaoInbox";
import { CicloList } from "@/components/avaliacoes/ciclos/CicloList";
import { MetasList } from "@/components/avaliacoes/metas/MetasList";
import { TemplateList } from "@/components/avaliacoes/templates/TemplateList";
import { Matriz9Box } from "@/components/avaliacoes/resultados/Matriz9Box";
import { AvaliacaoFormulario } from "@/components/avaliacoes/formulario/AvaliacaoFormulario";
import { ResultadosCiclo } from "@/components/avaliacoes/resultados/ResultadosCiclo";
import { AvaliacaoConfig } from "@/components/avaliacoes/config/AvaliacaoConfig";

export default function Avaliacoes() {
  const [activeTab, setActiveTab] = useState("inbox");
  const { podeVerCiclos, podeVerConfiguracoes, podeVerTemplates, podeVerResultados, podeCriarCiclo } = useAvaliacaoPermissoes();
  
  const { 
    ciclosAtivos, 
    avaliacoesPendentes, 
    taxaConclusao,
    isLoadingCiclos,
  } = useAvaliacoes();
  
  const { 
    metasAtivas, 
    progressoMedio,
    isLoadingMetas,
  } = useMetas();

  const isLoading = isLoadingCiclos || isLoadingMetas;

  const stats = [
    {
      title: "Ciclos Ativos",
      value: ciclosAtivos,
      icon: ClipboardCheck,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Avaliações Pendentes",
      value: avaliacoesPendentes,
      icon: AlertCircle,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Metas em Andamento",
      value: metasAtivas,
      icon: Target,
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      title: "Progresso Médio",
      value: `${progressoMedio}%`,
      icon: TrendingUp,
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Avaliações de Desempenho</h1>
          <p className="text-muted-foreground">
            Performance · Desenvolvimento · Risco Humano · Decisão · Prova Organizacional
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "..." : stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-auto min-w-full sm:min-w-0">
            <TabsTrigger value="inbox" className="flex items-center gap-1.5">
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Minha Caixa</span>
              {avaliacoesPendentes > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5">
                  {avaliacoesPendentes}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ciclos" className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Ciclos</span>
            </TabsTrigger>
            <TabsTrigger value="formulario" className="flex items-center gap-1.5">
              <PenTool className="h-4 w-4" />
              <span className="hidden sm:inline">Formulário</span>
            </TabsTrigger>
            <TabsTrigger value="metas" className="flex items-center gap-1.5">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Metas</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Templates</span>
            </TabsTrigger>
            <TabsTrigger value="resultados" className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Resultados</span>
            </TabsTrigger>
            <TabsTrigger value="9box" className="flex items-center gap-1.5">
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">9-Box</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-1.5">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="inbox" className="space-y-4">
          <AvaliacaoInbox />
        </TabsContent>

        <TabsContent value="ciclos" className="space-y-4">
          <CicloList />
        </TabsContent>

        <TabsContent value="formulario" className="space-y-4">
          <AvaliacaoFormulario />
        </TabsContent>

        <TabsContent value="metas" className="space-y-4">
          <MetasList />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <TemplateList />
        </TabsContent>

        <TabsContent value="resultados" className="space-y-4">
          <ResultadosCiclo />
        </TabsContent>

        <TabsContent value="9box" className="space-y-4">
          <Matriz9Box />
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <AvaliacaoConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
