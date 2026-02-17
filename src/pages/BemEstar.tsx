import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Shield, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useBemEstar, EIXOS_CONFIG, type BemEstarEixo } from "@/hooks/useBemEstar";
import { BemEstarRadar } from "@/components/bem-estar/BemEstarRadar";
import { EixoPanel } from "@/components/bem-estar/EixoPanel";

export default function BemEstar() {
  const {
    respostas,
    radarData,
    isLoading,
    salvarResposta,
    salvandoResposta,
    salvarGratidao,
    salvandoGratidao,
    getStatusLabel,
    getStatusColor,
  } = useBemEstar();

  const [selectedEixo, setSelectedEixo] = useState<BemEstarEixo | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
            <Heart className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Meu Bem-Estar no Trabalho</h1>
            <p className="text-sm text-muted-foreground">
              Autoconhecimento • Desenvolvimento • Equilíbrio
            </p>
          </div>
        </div>
      </motion.div>

      {/* Privacy notice */}
      <Alert className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800/30">
        <Shield className="h-4 w-4 text-emerald-600" />
        <AlertDescription className="text-sm text-emerald-800 dark:text-emerald-200">
          <strong>Espaço seguro:</strong> Nada que você registra aqui será usado para punição ou cobrança. 
          Este é um espaço de autopercepção — suas reflexões são pessoais.
        </AlertDescription>
      </Alert>

      {/* Radar Section */}
      <Card>
        <CardContent className="p-6">
          <div className="text-center mb-4">
            <h2 className="text-lg font-semibold">Meu Mapa de Bem-Estar</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Esse mapa não é um diagnóstico. Ele ajuda você a perceber como está vivendo o trabalho hoje.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-pulse text-muted-foreground">Carregando...</div>
            </div>
          ) : (
            <BemEstarRadar
              data={radarData}
              onEixoClick={setSelectedEixo}
              getStatusLabel={getStatusLabel}
              getStatusColor={getStatusColor}
            />
          )}

          <p className="text-center text-xs text-muted-foreground mt-4">
            Clique em qualquer eixo para interagir
          </p>
        </CardContent>
      </Card>

      {/* Eixo Panel */}
      <AnimatePresence mode="wait">
        {selectedEixo && (
          <EixoPanel
            key={selectedEixo}
            eixo={selectedEixo}
            respostas={respostas}
            onClose={() => setSelectedEixo(null)}
            onSalvarResposta={salvarResposta}
            onSalvarGratidao={selectedEixo === "gratidao" ? salvarGratidao : undefined}
            salvando={salvandoResposta || salvandoGratidao}
            getStatusLabel={getStatusLabel}
            getStatusColor={getStatusColor}
          />
        )}
      </AnimatePresence>

      {/* Footer phrase */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center py-4"
      >
        <p className="text-sm text-muted-foreground italic">
          "Não é sobre medir pessoas. É sobre ajudar pessoas a se perceberem melhor no trabalho."
        </p>
      </motion.div>
    </div>
  );
}
