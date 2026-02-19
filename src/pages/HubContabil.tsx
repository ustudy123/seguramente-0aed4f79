import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, FileText, Receipt, ShieldCheck, History, LayoutDashboard } from "lucide-react";
import { HubDashboard } from "@/components/hub-contabil/HubDashboard";
import { HubCompetencias } from "@/components/hub-contabil/HubCompetencias";
import { HubDocumentos } from "@/components/hub-contabil/HubDocumentos";
import { HubGuias } from "@/components/hub-contabil/HubGuias";
import { HubCertidoes } from "@/components/hub-contabil/HubCertidoes";
import { HubHistorico } from "@/components/hub-contabil/HubHistorico";
import { useHubContabil } from "@/hooks/useHubContabil";

const HubContabil = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const hub = useHubContabil();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Hub Contábil Inteligente</h1>
        <p className="text-muted-foreground">Centro de Governança Trabalhista e Fiscal</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full max-w-4xl">
          <TabsTrigger value="dashboard" className="gap-1.5 text-xs">
            <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="competencias" className="gap-1.5 text-xs">
            <BarChart3 className="w-3.5 h-3.5" /> Competências
          </TabsTrigger>
          <TabsTrigger value="documentos" className="gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" /> Documentos
          </TabsTrigger>
          <TabsTrigger value="guias" className="gap-1.5 text-xs">
            <Receipt className="w-3.5 h-3.5" /> Guias
          </TabsTrigger>
          <TabsTrigger value="certidoes" className="gap-1.5 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" /> Certidões
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5 text-xs">
            <History className="w-3.5 h-3.5" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><HubDashboard hub={hub} /></TabsContent>
        <TabsContent value="competencias"><HubCompetencias hub={hub} /></TabsContent>
        <TabsContent value="documentos"><HubDocumentos hub={hub} /></TabsContent>
        <TabsContent value="guias"><HubGuias hub={hub} /></TabsContent>
        <TabsContent value="certidoes"><HubCertidoes hub={hub} /></TabsContent>
        <TabsContent value="historico"><HubHistorico hub={hub} /></TabsContent>
      </Tabs>
    </div>
  );
};

export default HubContabil;
