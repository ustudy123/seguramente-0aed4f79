import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Users, Flame, BarChart3 } from "lucide-react";
import { IndicesDerivadosDashboard } from "./IndicesDerivadosDashboard";
import { ResultadosPorGHEPanel } from "./ResultadosPorGHEPanel";
import { RadaresPsicossocialSection } from "./RadaresPsicossocialSection";
import { IPSHistoricoChart } from "./IPSHistoricoChart";
import type { CampanhaPsicossocial } from "@/types/psicossocial";

interface Props {
  campanhas: CampanhaPsicossocial[];
}

const SUB_TABS = [
  { value: "geral", label: "Visão Geral", icon: BarChart3, desc: "Panorama executivo dos índices psicossociais." },
  { value: "ghe", label: "Por GHE", icon: Users, desc: "Resultados agrupados por Grupo Homogêneo de Exposição." },
  { value: "burnout", label: "Burnout & Boreout", icon: Flame, desc: "Indicadores de esgotamento e desengajamento." },
  { value: "historico", label: "Histórico IPS", icon: LineChart, desc: "Evolução do Índice Psicossocial ao longo do tempo." },
];

export function ResultadosPsicossociaisHub({ campanhas }: Props) {
  const [tab, setTab] = useState<string>("geral");
  const current = SUB_TABS.find((t) => t.value === tab) ?? SUB_TABS[0];

  return (
    <div className="space-y-4">
      <Card className="border-purple-200/60 bg-gradient-to-r from-purple-50/60 to-fuchsia-50/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-purple-900">
            📊 Resultados Psicossociais
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tudo o que o gestor tático precisa para enxergar o clima psicossocial em um só lugar.
          </p>
        </CardHeader>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto bg-muted/60 p-1">
          {SUB_TABS.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm py-2"
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{t.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <p className="text-xs text-muted-foreground mt-2 px-1">{current.desc}</p>

        <TabsContent value="geral" className="mt-4">
          <IndicesDerivadosDashboard campanhas={campanhas} />
        </TabsContent>

        <TabsContent value="ghe" className="mt-4">
          <ResultadosPorGHEPanel />
        </TabsContent>

        <TabsContent value="burnout" className="mt-4">
          <RadaresPsicossocialSection campanhas={campanhas} />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <IPSHistoricoChart campanhas={campanhas} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
