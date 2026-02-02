import { motion } from "framer-motion";
import { Flame, Minus, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadarChart } from "./radar/RadarChart";
import { FatorDetailCard } from "./radar/FatorDetailCard";
import {
  BURNOUT_NIVEL_CONFIG,
  ENERGIA_NIVEL_CONFIG,
  BURNOUT_FATORES,
  BOREOUT_FATORES,
  ENERGIA_FATORES,
} from "./radar/radarConfig";
import { cn } from "@/lib/utils";
import { useErgonomia } from "@/hooks/useErgonomia";
import { toast } from "sonner";
import type { RadarData } from "@/hooks/useErgonomiaInteligente";
import type { AcaoPrioridade } from "@/types/ergonomia";

type RadarType = 'burnout' | 'boreout' | 'energia';

interface RadarDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: RadarType | null;
  radares: RadarData | null;
}

export function RadarDetailModal({ open, onOpenChange, type, radares }: RadarDetailModalProps) {
  const { createAcao, isCreatingAcao, acoes } = useErgonomia();

  if (!type || !radares) return null;

  const handleCreateAction = async (acao: {
    titulo: string;
    descricao: string;
    tipo: 'corretiva' | 'preventiva' | 'melhoria';
    prioridade: AcaoPrioridade;
    fator_radar: string;
    radar_type: string;
    responsavel_nome: string;
    prazo: string;
    onde: string;
    porque: string;
    como: string;
    custo_estimado: string;
  }) => {
    try {
      // Build comprehensive description with 5W2H
      const radarLabel = acao.radar_type === 'burnout' ? 'Burnout' : acao.radar_type === 'boreout' ? 'Boreout' : 'Energia';
      let descricao = `**Origem:** Radar de ${radarLabel} - Fator: ${acao.fator_radar}\n\n`;
      
      if (acao.porque) descricao += `**Por quê:** ${acao.porque}\n`;
      if (acao.onde) descricao += `**Onde:** ${acao.onde}\n`;
      if (acao.como) descricao += `**Como:** ${acao.como}\n`;
      if (acao.descricao) descricao += `\n**Observações:** ${acao.descricao}`;

      await createAcao({
        titulo: `[${acao.radar_type.toUpperCase()}/${acao.fator_radar}] ${acao.titulo}`,
        descricao: descricao.trim(),
        tipo: acao.tipo,
        prioridade: acao.prioridade,
        status: 'pendente',
        responsavel_nome: acao.responsavel_nome || undefined,
        prazo: acao.prazo || undefined,
        custo_estimado: acao.custo_estimado ? parseFloat(acao.custo_estimado) : undefined,
      });
      toast.success("Ação cadastrada com sucesso!");
    } catch (error) {
      console.error("Erro ao criar ação:", error);
      toast.error("Erro ao cadastrar ação");
    }
  };

  // Filter existing actions for a specific factor
  const getActionsForFator = (radarType: string, fatorKey: string) => {
    const prefix = `[${radarType.toUpperCase()}/${fatorKey}]`;
    return acoes
      .filter(a => a.titulo.startsWith(prefix))
      .map(a => ({ titulo: a.titulo.replace(prefix, '').trim(), status: a.status }));
  };

  const renderBurnoutDetail = () => {
    const { score, nivel, fatores } = radares.burnout;
    const config = BURNOUT_NIVEL_CONFIG[nivel];

    const chartData = BURNOUT_FATORES.map(f => ({
      subject: f.label.length > 15 ? f.label.substring(0, 12) + '...' : f.label,
      value: fatores[f.key],
      fullMark: 100,
    }));

    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className={cn("p-2 rounded-full", config.bgColor)}>
              <Flame className={cn("h-6 w-6", config.color)} />
            </div>
            <div>
              <span>Radar de Burnout</span>
              <p className="text-sm font-normal text-muted-foreground">
                Análise detalhada dos fatores de risco para esgotamento
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {/* Left column - Score and Chart */}
          <div className="space-y-4">
            <div className={cn("p-6 rounded-xl border-2", config.borderColor, config.bgColor)}>
              <div className="flex items-center justify-between mb-4">
                <div className="text-center flex-1">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className={cn(
                      "w-28 h-28 mx-auto rounded-full border-4 flex items-center justify-center",
                      config.borderColor,
                      "bg-background"
                    )}
                  >
                    <span className={cn("text-3xl font-bold", config.color)}>{score}%</span>
                  </motion.div>
                  <Badge className={cn("mt-3", config.bgColor, config.color)} variant="outline">
                    {config.icon} {config.label}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    Índice de Risco de Burnout
                  </p>
                </div>
              </div>
            </div>
            
            {/* Radar Chart */}
            <div className="border rounded-xl p-4 bg-card">
              <h3 className="font-semibold text-sm mb-2 text-center">Distribuição dos Fatores</h3>
              <RadarChart data={chartData} color={config.chartColor} />
            </div>
          </div>

          {/* Right column - Factors */}
          <div className="space-y-3">
            <h3 className="font-semibold">Fatores de Risco</h3>
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {BURNOUT_FATORES.map((fator) => (
                  <FatorDetailCard
                    key={fator.key}
                    fatorKey={fator.key}
                    label={fator.label}
                    icon={fator.icon}
                    description={fator.description}
                    detailedAnalysis={fator.detailedAnalysis}
                    dataSource={fator.dataSource}
                    value={fatores[fator.key]}
                    sugestoes={fator.sugestoes}
                    radarType="burnout"
                    existingActions={getActionsForFator('burnout', fator.key)}
                    onCreateAction={handleCreateAction}
                    isCreatingAction={isCreatingAcao}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </>
    );
  };

  const renderBoreoutDetail = () => {
    const { score, nivel, fatores } = radares.boreout;
    const config = BURNOUT_NIVEL_CONFIG[nivel];

    const chartData = BOREOUT_FATORES.map(f => ({
      subject: f.label.length > 15 ? f.label.substring(0, 12) + '...' : f.label,
      value: fatores[f.key],
      fullMark: 100,
    }));

    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className={cn("p-2 rounded-full", config.bgColor)}>
              <Minus className={cn("h-6 w-6", config.color)} />
            </div>
            <div>
              <span>Radar de Boreout</span>
              <p className="text-sm font-normal text-muted-foreground">
                Análise de subcarga e desengajamento
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {/* Left column - Score and Chart */}
          <div className="space-y-4">
            <div className={cn("p-6 rounded-xl border-2", config.borderColor, config.bgColor)}>
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className={cn(
                    "w-28 h-28 mx-auto rounded-full border-4 flex items-center justify-center",
                    config.borderColor,
                    "bg-background"
                  )}
                >
                  <span className={cn("text-3xl font-bold", config.color)}>{score}%</span>
                </motion.div>
                <Badge className={cn("mt-3", config.bgColor, config.color)} variant="outline">
                  {config.icon} {config.label}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  Índice de Subcarga/Desengajamento
                </p>
              </div>
            </div>
            
            {/* Radar Chart */}
            <div className="border rounded-xl p-4 bg-card">
              <h3 className="font-semibold text-sm mb-2 text-center">Distribuição dos Fatores</h3>
              <RadarChart data={chartData} color={config.chartColor} />
            </div>
          </div>

          {/* Right column - Factors */}
          <div className="space-y-3">
            <h3 className="font-semibold">Fatores de Risco</h3>
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {BOREOUT_FATORES.map((fator) => (
                  <FatorDetailCard
                    key={fator.key}
                    fatorKey={fator.key}
                    label={fator.label}
                    icon={fator.icon}
                    description={fator.description}
                    detailedAnalysis={fator.detailedAnalysis}
                    dataSource={fator.dataSource}
                    value={fatores[fator.key]}
                    sugestoes={fator.sugestoes}
                    radarType="boreout"
                    existingActions={getActionsForFator('boreout', fator.key)}
                    onCreateAction={handleCreateAction}
                    isCreatingAction={isCreatingAcao}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </>
    );
  };

  const renderEnergiaDetail = () => {
    const { score, nivel, fatores } = radares.energiaOrganizacional;
    const config = ENERGIA_NIVEL_CONFIG[nivel];

    const chartData = ENERGIA_FATORES.map(f => ({
      subject: f.label.length > 15 ? f.label.substring(0, 12) + '...' : f.label,
      value: fatores[f.key],
      fullMark: 100,
    }));

    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className={cn("p-2 rounded-full", config.bgColor)}>
              <Zap className={cn("h-6 w-6", config.color)} />
            </div>
            <div>
              <span>Energia Organizacional</span>
              <p className="text-sm font-normal text-muted-foreground">
                Análise de vitalidade e engajamento da equipe
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {/* Left column - Score and Chart */}
          <div className="space-y-4">
            <div className={cn("p-6 rounded-xl border-2", config.borderColor, config.bgColor)}>
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className={cn(
                    "w-28 h-28 mx-auto rounded-full border-4 flex items-center justify-center",
                    config.borderColor,
                    "bg-background"
                  )}
                >
                  <span className={cn("text-3xl font-bold", config.color)}>{score}%</span>
                </motion.div>
                <Badge className={cn("mt-3", config.bgColor, config.color)} variant="outline">
                  {config.icon} {config.label}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  Índice de Energia Organizacional
                </p>
              </div>
            </div>
            
            {/* Radar Chart */}
            <div className="border rounded-xl p-4 bg-card">
              <h3 className="font-semibold text-sm mb-2 text-center">Distribuição dos Componentes</h3>
              <RadarChart data={chartData} color={config.chartColor} />
            </div>
          </div>

          {/* Right column - Factors */}
          <div className="space-y-3">
            <h3 className="font-semibold">Componentes de Energia</h3>
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {ENERGIA_FATORES.map((fator) => (
                  <FatorDetailCard
                    key={fator.key}
                    fatorKey={fator.key}
                    label={fator.label}
                    icon={fator.icon}
                    description={fator.description}
                    detailedAnalysis={fator.detailedAnalysis}
                    dataSource={fator.dataSource}
                    value={fatores[fator.key]}
                    sugestoes={fator.sugestoes}
                    radarType="energia"
                    inverseColors={true}
                    existingActions={getActionsForFator('energia', fator.key)}
                    onCreateAction={handleCreateAction}
                    isCreatingAction={isCreatingAcao}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <ScrollArea className="max-h-[calc(90vh-2rem)]">
          <div className="pr-4">
            {type === 'burnout' && renderBurnoutDetail()}
            {type === 'boreout' && renderBoreoutDetail()}
            {type === 'energia' && renderEnergiaDetail()}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
