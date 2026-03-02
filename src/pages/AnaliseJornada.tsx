import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JornadaDashboard } from "@/components/jornada/JornadaDashboard";
import { JornadaImportacao } from "@/components/jornada/JornadaImportacao";
import { JornadaIndividual } from "@/components/jornada/JornadaIndividual";
import { JornadaColetiva } from "@/components/jornada/JornadaColetiva";
import { JornadaConformidade } from "@/components/jornada/JornadaConformidade";
import { JornadaAlertas } from "@/components/jornada/JornadaAlertas";
import { BarChart3, Upload, User, Users, Shield, Bell } from "lucide-react";

export default function AnaliseJornada() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Análise de Carga de Trabalho & Jornada</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitoramento analítico de jornada, conformidade legal e riscos organizacionais
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 h-auto">
          <TabsTrigger value="dashboard" className="flex items-center gap-1.5 text-xs py-2">
            <BarChart3 className="h-3.5 w-3.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="importacao" className="flex items-center gap-1.5 text-xs py-2">
            <Upload className="h-3.5 w-3.5" /> Importação
          </TabsTrigger>
          <TabsTrigger value="individual" className="flex items-center gap-1.5 text-xs py-2">
            <User className="h-3.5 w-3.5" /> Individual
          </TabsTrigger>
          <TabsTrigger value="coletiva" className="flex items-center gap-1.5 text-xs py-2">
            <Users className="h-3.5 w-3.5" /> Coletiva
          </TabsTrigger>
          <TabsTrigger value="conformidade" className="flex items-center gap-1.5 text-xs py-2">
            <Shield className="h-3.5 w-3.5" /> Conformidade
          </TabsTrigger>
          <TabsTrigger value="alertas" className="flex items-center gap-1.5 text-xs py-2">
            <Bell className="h-3.5 w-3.5" /> Alertas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><JornadaDashboard /></TabsContent>
        <TabsContent value="importacao"><JornadaImportacao /></TabsContent>
        <TabsContent value="individual"><JornadaIndividual /></TabsContent>
        <TabsContent value="coletiva"><JornadaColetiva /></TabsContent>
        <TabsContent value="conformidade"><JornadaConformidade /></TabsContent>
        <TabsContent value="alertas"><JornadaAlertas /></TabsContent>
      </Tabs>
    </div>
  );
}
