import { useState } from "react";
import { motion } from "framer-motion";
import { Compass, Target, Waves, Heart, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SwotSection } from "@/components/estrategia/SwotSection";
import { OceanoAzulSection } from "@/components/estrategia/OceanoAzulSection";
import { CulturaSection } from "@/components/estrategia/CulturaSection";
import { OrganogramaSection } from "@/components/estrategia/OrganogramaSection";
import { EstrategiaEscopoSelector, type EstrategiaEscopo } from "@/components/estrategia/EstrategiaEscopoSelector";

export default function Estrategia() {
  const [tab, setTab] = useState("swot");
  const [escopo, setEscopo] = useState<EstrategiaEscopo>({ tipo: "empresa", grupoId: null });

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
        <EstrategiaEscopoSelector escopo={escopo} onChange={setEscopo} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
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
    </motion.div>
  );
}