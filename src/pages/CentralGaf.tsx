import { useState } from "react";
import { motion } from "framer-motion";
import { 
  BarChart3, 
  Brain, 
  ShieldAlert, 
  ClipboardList, 
  Filter,
  Search,
  Download,
  Plus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGafDashboards } from "@/hooks/useGafDashboards";
import { useGafPermissions } from "@/hooks/useGafPermissions";
import { Skeleton } from "@/components/ui/skeleton";
import { AtestadoForm } from "@/components/atestados/AtestadoForm";

import { AtestadoList } from "@/components/atestados/AtestadoList";
import { AfastamentoList } from "@/components/atestados/AfastamentoList";
import { useAtestados } from "@/hooks/useAtestados";
import { Calendar } from "lucide-react";

const CentralGaf = () => {
  const [activeTab, setActiveTab] = useState("absenteismo");
  const [formOpen, setFormOpen] = useState(false);
  
  const { 
    atestados, 
    deleteAtestado, 
    loadingAtestados, 
    afastamentos, 
    loadingAfastamentos,
    getSignedUrl,
    createAtestado,
    deleteAfastamento
  } = useAtestados();
  const { absenteismoStats, saudeMentalStats, fapRatStats, pendenciasStats, isLoading: loadingStats } = useGafDashboards();
  const { permissions, isLoading: loadingPerms } = useGafPermissions();

  const isLoading = loadingStats || loadingPerms || loadingAtestados || loadingAfastamentos;

  const handleCreateAtestado = async (data: { formData: any; file?: File; colaboradorId?: string }) => {
    try {
      await createAtestado(data);
      setFormOpen(false);
    } catch (error) {
      console.error("Erro ao criar atestado:", error);
    }
  };

  const handleExportar = () => {
    const csvEscape = (v: any) => {
      if (v === null || v === undefined) return "";
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows: string[] = [];
    rows.push(["Tipo","Colaborador","CID","Data Início","Data Fim","Dias","Motivo/Tipo","Status"].map(csvEscape).join(";"));

    (atestados || []).forEach((a: any) => {
      rows.push([
        "Atestado",
        a.colaborador?.nome_completo || a.colaborador_nome || "",
        a.cid || "",
        a.data_inicio || "",
        a.data_fim || "",
        a.dias_afastamento ?? "",
        a.tipo || a.motivo || "",
        a.status || "",
      ].map(csvEscape).join(";"));
    });

    (afastamentos || []).forEach((af: any) => {
      rows.push([
        "Afastamento",
        af.colaborador?.nome_completo || af.colaborador_nome || "",
        af.cid || "",
        af.data_inicio || "",
        af.data_fim || "",
        af.dias ?? af.total_dias ?? "",
        af.tipo || af.motivo || "",
        af.status || "",
      ].map(csvEscape).join(";"));
    });

    const csv = "\uFEFF" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mod-gaf-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MOD-GAF</h1>
          <p className="text-muted-foreground">Gestão Inteligente de Atestados e Afastamentos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportar}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>

          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Afastamento
          </Button>
        </div>
      </header>

      <AtestadoForm 
        open={formOpen} 
        onOpenChange={setFormOpen} 
        onSubmit={handleCreateAtestado}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          <TabsList className="bg-muted/50 border">
            <TabsTrigger value="atestados" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Atestados
            </TabsTrigger>
            <TabsTrigger value="afastamentos" className="gap-2">
              <Calendar className="h-4 w-4" />
              Afastamentos
            </TabsTrigger>
            {permissions.podeVerDashboardsGerais && (
              <TabsTrigger value="absenteismo" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Absenteísmo
              </TabsTrigger>
            )}
            {permissions.podeVerDashboardsGerais && (
              <TabsTrigger value="saude-mental" className="gap-2 text-purple-600 dark:text-purple-400">
                <Brain className="h-4 w-4" />
                Saúde Mental
              </TabsTrigger>
            )}
            <TabsTrigger value="fap-rat" className="gap-2 text-orange-600 dark:text-orange-400">
              <ShieldAlert className="h-4 w-4" />
              FAP/RAT
            </TabsTrigger>
            <TabsTrigger value="pendencias" className="gap-2 text-red-600 dark:text-red-400">
              <ClipboardList className="h-4 w-4" />
              Pendências
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 ml-4">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Filter className="h-4 w-4" />
            </Button>
            <div className="relative w-64 hidden md:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar trabalhador, CID..."
                className="pl-8 h-9"
              />
            </div>
          </div>
        </div>

        <TabsContent value="atestados" className="space-y-6">
          <AtestadoList 
            atestados={atestados} 
            onDelete={deleteAtestado} 
            onDownload={getSignedUrl}
          />
        </TabsContent>

        <TabsContent value="afastamentos" className="space-y-6">
          <AfastamentoList 
            afastamentos={afastamentos} 
            onDelete={deleteAfastamento}
          />
        </TabsContent>

        <TabsContent value="absenteismo" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Afastamentos</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{absenteismoStats?.totalAfastamentos || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">+0% em relação ao mês anterior</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Dias Perdidos</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{absenteismoStats?.totalDiasPerdidos || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Impacto direto na produtividade</p>
              </CardContent>
            </Card>
            {/* Adicionar mais cards aqui */}
          </div>
          
          <Card className="min-h-[400px] flex items-center justify-center border-dashed">
            <div className="text-center p-8">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-medium">Gráficos de Absenteísmo</h3>
              <p className="text-sm text-muted-foreground">Implementando visualizações de IF/IS e custos...</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="saude-mental" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-400">Total Saúde Mental (CID F)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">{saudeMentalStats?.totalCIDF || 0}</div>
                <p className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-1">Acompanhamento preventivo necessário</p>
              </CardContent>
            </Card>
            {/* Setores com 3+ afastamentos em 90 dias */}
            <Card className={saudeMentalStats?.alertasPadraoColetivo.length > 0 ? "border-red-500 animate-pulse" : ""}>
               <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Alertas de Padrão Coletivo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{saudeMentalStats?.alertasPadraoColetivo.length || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Setores com alta concentração</p>
              </CardContent>
            </Card>
          </div>
          <Card className="min-h-[400px] flex items-center justify-center border-dashed border-purple-200 dark:border-purple-900">
             <div className="text-center p-8">
              <Brain className="h-12 w-12 text-purple-300 dark:text-purple-900 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium">Análise de Riscos Psicossociais</h3>
              <p className="text-sm text-muted-foreground">Cruzando dados de CID F com questionários de felicidade...</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="fap-rat" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-orange-200 dark:border-orange-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">CAT Pendente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{fapRatStats?.catsPendentes || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Risco de multa eSocial</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Impacto FAP Confirmado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{fapRatStats?.impactoFapConfirmado || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Custo tributário imediato</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pendencias" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pendências do MOD-GAF</CardTitle>
              <Badge variant="destructive">{pendenciasStats?.criticas || 0} Críticas</Badge>
            </CardHeader>
            <CardContent>
               {/* Lista de pendências aqui */}
               <div className="text-center py-12 text-muted-foreground">
                 <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-20" />
                 <p>Nenhuma pendência selecionada para visualização</p>
               </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CentralGaf;
