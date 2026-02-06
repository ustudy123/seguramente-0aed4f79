import { useState } from "react";
import { 
  Target, 
  ClipboardCheck, 
  LayoutGrid, 
  FileText, 
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Plus,
  Brain
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAvaliacoes } from "@/hooks/useAvaliacoes";
import { useMetas } from "@/hooks/useMetas";
import { usePsicossocial } from "@/hooks/usePsicossocial";
import { AvaliacaoInbox } from "@/components/avaliacoes/resposta/AvaliacaoInbox";
import { CicloList } from "@/components/avaliacoes/ciclos/CicloList";
import { MetasList } from "@/components/avaliacoes/metas/MetasList";
import { TemplateList } from "@/components/avaliacoes/templates/TemplateList";
import { Matriz9Box } from "@/components/avaliacoes/resultados/Matriz9Box";
import { PsicossocialDashboard } from "@/components/avaliacoes/psicossocial/PsicossocialDashboard";

export default function Avaliacoes() {
  const [activeTab, setActiveTab] = useState("inbox");
  
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

  const { campanhasAtivas } = usePsicossocial();

  const isLoading = isLoadingCiclos || isLoadingMetas;

  const stats = [
    {
      title: "Ciclos Ativos",
      value: ciclosAtivos,
      icon: ClipboardCheck,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Avaliações Pendentes",
      value: avaliacoesPendentes,
      icon: AlertCircle,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
    {
      title: "Metas em Andamento",
      value: metasAtivas,
      icon: Target,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Progresso Médio",
      value: `${progressoMedio}%`,
      icon: TrendingUp,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Avaliações de Desempenho</h1>
          <p className="text-muted-foreground">
            Gestão de performance, competências e desenvolvimento
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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="inbox" className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Minha Caixa</span>
            {avaliacoesPendentes > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5">
                {avaliacoesPendentes}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ciclos" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Ciclos</span>
          </TabsTrigger>
          <TabsTrigger value="metas" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Metas</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
          <TabsTrigger value="9box" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">9-Box</span>
          </TabsTrigger>
          <TabsTrigger value="psicossocial" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">Psicossocial</span>
            {campanhasAtivas > 0 && (
              <Badge className="h-5 px-1.5 bg-purple-500">
                {campanhasAtivas}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-4">
          <AvaliacaoInbox />
        </TabsContent>

        <TabsContent value="ciclos" className="space-y-4">
          <CicloList />
        </TabsContent>

        <TabsContent value="metas" className="space-y-4">
          <MetasList />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <TemplateList />
        </TabsContent>

        <TabsContent value="9box" className="space-y-4">
          <Matriz9Box />
        </TabsContent>

        <TabsContent value="psicossocial" className="space-y-4">
          <PsicossocialDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
