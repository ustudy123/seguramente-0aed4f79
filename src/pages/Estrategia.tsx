import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Compass, Target, Waves, Heart, Users, BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SwotSection } from "@/components/estrategia/SwotSection";
import { OceanoAzulSection } from "@/components/estrategia/OceanoAzulSection";
import { CulturaSection } from "@/components/estrategia/CulturaSection";
import { OrganogramaSection } from "@/components/estrategia/OrganogramaSection";
import { EstrategiaEscopoSelector, type EstrategiaEscopo } from "@/components/estrategia/EstrategiaEscopoSelector";
import { GuiaRapidoEstrategia } from "@/components/estrategia/GuiaRapidoEstrategia";

export default function Estrategia() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "swot");
  const [escopo, setEscopo] = useState<EstrategiaEscopo>({ tipo: "empresa", grupoId: null });
  const [showGuia, setShowGuia] = useState(false);

  useEffect(() => {
    const currentTab = searchParams.get("tab");
    if (currentTab && currentTab !== tab) {
      setTab(currentTab);
    }
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setTab(value);
    setSearchParams({ tab: value });
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Compass className="w-7 h-7 text-primary" />
            Estratégia & Governança
          </h1>
          <p className="text-muted-foreground mt-1">
            Planejamento estratégico, cultura organizacional e estrutura que viram ação
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            O módulo Estratégia e Governança é essencial para ajudar a planejar e organizar a direção da empresa. Ele fornece ferramentas para melhorar a cultura organizacional e a estrutura interna.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowGuia(true)}>
            <BookOpen className="w-4 h-4 mr-2" /> Guia Rapido
          </Button>
          <EstrategiaEscopoSelector escopo={escopo} onChange={setEscopo} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="swot" className="gap-1">
            <Target className="w-4 h-4" /> SWOT
          </TabsTrigger>
          <TabsTrigger value="oceano" className="gap-1">
            <Waves className="w-4 h-4" /> Oceano Azul
          </TabsTrigger>
          <TabsTrigger value="cultura" className="gap-1">
            <Heart className="w-4 h-4" /> Cultura
          </TabsTrigger>
          <TabsTrigger value="organograma" className="gap-1">
            <Users className="w-4 h-4" /> Organograma
          </TabsTrigger>
        </TabsList>

        <TabsContent value="swot" className="mt-4">
          <SwotSection escopo={escopo} />
        </TabsContent>

        <TabsContent value="oceano" className="mt-4">
          <OceanoAzulSection escopo={escopo} />
        </TabsContent>

        <TabsContent value="cultura" className="mt-4">
          <CulturaSection escopo={escopo} />
        </TabsContent>

        <TabsContent value="organograma" className="mt-4">
          <OrganogramaSection escopo={escopo} />
        </TabsContent>
      </Tabs>

      <GuiaRapidoEstrategia open={showGuia} onOpenChange={setShowGuia} />
    </motion.div>
  );
}
