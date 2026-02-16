import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCultura } from "@/hooks/useCultura";
import { CulturaStats } from "@/components/cultura/CulturaStats";
import { AgendaCelebracoes } from "@/components/cultura/AgendaCelebracoes";
import { RituaisReconhecimento } from "@/components/cultura/RituaisReconhecimento";
import { ProximasCelebracoes } from "@/components/cultura/ProximasCelebracoes";

const CulturaCelebracoes = () => {
  const cultura = useCultura();

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-primary" />
            Cultura & Celebrações
          </h1>
          <p className="text-muted-foreground mt-1">
            Cultura não se improvisa. Se planeja, se executa e se acompanha.
          </p>
        </div>
      </motion.div>

      <CulturaStats
        datasAtivas={cultura.datasAtivas}
        acoesPendentes={cultura.acoesPendentes}
        acoesConcluidas={cultura.acoesConcluidas}
        rituaisAtivos={cultura.rituaisAtivos}
      />

      <ProximasCelebracoes
        acoes={cultura.acoes}
        onCreateAcao={cultura.createAcao}
      />

      <Tabs defaultValue="experiencia" className="space-y-4">
        <TabsList>
          <TabsTrigger value="experiencia">Experiência do Colaborador</TabsTrigger>
          <TabsTrigger value="rituais">Rituais e Reconhecimento</TabsTrigger>
        </TabsList>

        <TabsContent value="experiencia">
          <AgendaCelebracoes
            acoes={cultura.acoes}
            isLoading={cultura.isLoadingAcoes}
            onCreateAcao={cultura.createAcao}
            onUpdateStatus={cultura.updateAcaoStatus}
            onDelete={cultura.deleteAcao}
          />
        </TabsContent>

        <TabsContent value="rituais">
          <RituaisReconhecimento
            rituais={cultura.rituais}
            datas={cultura.datas}
            config={cultura.config ?? null}
            marcos={cultura.marcos}
            isLoadingRituais={cultura.isLoadingRituais}
            isLoadingDatas={cultura.isLoadingDatas}
            onCreateRitual={cultura.createRitual}
            onToggleRitual={cultura.toggleRitual}
            onDeleteRitual={cultura.deleteRitual}
            onCreateData={cultura.createData}
            onDeleteData={cultura.deleteData}
            onSaveConfig={cultura.saveConfig}
            onCreateMarco={cultura.createMarco}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CulturaCelebracoes;
