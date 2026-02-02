import { motion } from "framer-motion";
import { 
  Flame, 
  AlertTriangle, 
  TrendingDown, 
  Clock, 
  MessageSquareWarning, 
  Heart,
  Minus,
  RefreshCw,
  Target,
  Smile,
  Users,
  Zap,
  Sparkles,
  Activity,
  X
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { RadarData } from "@/hooks/useErgonomiaInteligente";

type RadarType = 'burnout' | 'boreout' | 'energia';

interface RadarDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: RadarType | null;
  radares: RadarData | null;
}

const BURNOUT_NIVEL_CONFIG = {
  baixo: {
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
    label: 'Baixo Risco',
    icon: '✓',
    ringColor: 'ring-success/30',
  },
  moderado: {
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/30',
    label: 'Atenção',
    icon: '⚠',
    ringColor: 'ring-warning/30',
  },
  alto: {
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    label: 'Alto Risco',
    icon: '🔥',
    ringColor: 'ring-orange-500/30',
  },
  critico: {
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
    label: 'Crítico',
    icon: '🚨',
    ringColor: 'ring-destructive/30',
  },
};

const ENERGIA_NIVEL_CONFIG = {
  baixo: {
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
    label: 'Crítico',
    icon: '⚠',
    ringColor: 'ring-destructive/30',
  },
  moderado: {
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/30',
    label: 'Regular',
    icon: '⚡',
    ringColor: 'ring-warning/30',
  },
  alto: {
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
    label: 'Bom',
    icon: '✓',
    ringColor: 'ring-success/30',
  },
  excelente: {
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/30',
    label: 'Excelente',
    icon: '⚡',
    ringColor: 'ring-primary/30',
  },
};

const BURNOUT_FATORES = [
  { key: 'sobrecargaCognitiva', label: 'Sobrecarga Cognitiva', icon: TrendingDown, description: 'Excesso de demandas mentais e complexidade das tarefas' },
  { key: 'ritmoTrabalho', label: 'Ritmo de Trabalho', icon: Clock, description: 'Velocidade e intensidade das atividades exigidas' },
  { key: 'faltaPausas', label: 'Falta de Pausas', icon: AlertTriangle, description: 'Ausência de intervalos adequados para recuperação' },
  { key: 'humorNegativo', label: 'Humor Negativo', icon: TrendingDown, description: 'Presença de estados emocionais negativos relatados' },
  { key: 'denuncias', label: 'Denúncias/Ocorrências', icon: MessageSquareWarning, description: 'Registros na ouvidoria relacionados ao ambiente' },
  { key: 'exigenciasEmocionais', label: 'Exigências Emocionais', icon: Heart, description: 'Demandas de controle emocional no trabalho' },
] as const;

const BOREOUT_FATORES = [
  { key: 'baixoDesafio', label: 'Baixo Desafio', icon: Target, description: 'Tarefas abaixo da capacidade do colaborador' },
  { key: 'repetitividade', label: 'Repetitividade', icon: RefreshCw, description: 'Monotonia e falta de variabilidade nas atividades' },
  { key: 'faltaSentido', label: 'Falta de Sentido', icon: Minus, description: 'Dificuldade em perceber propósito no trabalho' },
  { key: 'apatia', label: 'Apatia Emocional', icon: Smile, description: 'Indiferença e desinteresse pelas atividades' },
  { key: 'desconexao', label: 'Desconexão com Equipe', icon: Users, description: 'Isolamento e falta de pertencimento' },
] as const;

const ENERGIA_FATORES = [
  { key: 'vitalidade', label: 'Vitalidade da Equipe', icon: Heart, description: 'Energia física e mental para executar tarefas' },
  { key: 'engajamento', label: 'Engajamento', icon: Activity, description: 'Envolvimento ativo e comprometimento' },
  { key: 'presencaPsicologica', label: 'Presença Psicológica', icon: Sparkles, description: 'Atenção plena e foco nas atividades' },
  { key: 'sustentabilidade', label: 'Sustentabilidade', icon: Zap, description: 'Capacidade de manter o desempenho ao longo do tempo' },
] as const;

export function RadarDetailModal({ open, onOpenChange, type, radares }: RadarDetailModalProps) {
  if (!type || !radares) return null;

  const renderBurnoutDetail = () => {
    const { score, nivel, fatores } = radares.burnout;
    const config = BURNOUT_NIVEL_CONFIG[nivel];

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          {/* Score Principal */}
          <div className={cn("p-6 rounded-xl border-2 flex flex-col items-center justify-center", config.borderColor, config.bgColor)}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className={cn(
                "w-32 h-32 rounded-full border-4 flex items-center justify-center",
                config.borderColor,
                "bg-background"
              )}
            >
              <span className={cn("text-4xl font-bold", config.color)}>{score}%</span>
            </motion.div>
            <Badge className={cn("mt-4", config.bgColor, config.color)} variant="outline">
              {config.icon} {config.label}
            </Badge>
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Índice de Risco de Burnout
            </p>
          </div>

          {/* Fatores */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="font-semibold text-lg">Fatores de Risco</h3>
            <div className="grid grid-cols-1 gap-3">
              {BURNOUT_FATORES.map(({ key, label, icon: Icon, description }) => {
                const value = fatores[key];
                return (
                  <div key={key} className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{label}</span>
                      </div>
                      <span className={cn(
                        "font-bold text-lg",
                        value >= 70 ? "text-destructive" : 
                        value >= 40 ? "text-warning" : 
                        "text-success"
                      )}>
                        {Math.round(value)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{description}</p>
                    <Progress 
                      value={value} 
                      className={cn(
                        "h-2",
                        value >= 70 ? "[&>div]:bg-destructive" : 
                        value >= 40 ? "[&>div]:bg-warning" : 
                        "[&>div]:bg-success"
                      )}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recomendações */}
        <Separator className="my-6" />
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Recomendações</h3>
          <div className={cn("p-4 rounded-lg", config.bgColor)}>
            {nivel === 'baixo' && (
              <p className={cn("text-sm", config.color)}>
                ✓ Excelente! Os indicadores estão saudáveis. Continue monitorando e promovendo boas práticas de bem-estar.
              </p>
            )}
            {nivel === 'moderado' && (
              <ul className={cn("text-sm space-y-1", config.color)}>
                <li>• Implemente pausas ativas regulares durante a jornada</li>
                <li>• Monitore a carga de trabalho das equipes</li>
                <li>• Promova momentos de integração e descompressão</li>
              </ul>
            )}
            {nivel === 'alto' && (
              <ul className={cn("text-sm space-y-1", config.color)}>
                <li>• Ação necessária: Revise a distribuição de tarefas</li>
                <li>• Avalie a possibilidade de contratações ou redistribuição</li>
                <li>• Considere programas de apoio psicológico</li>
              </ul>
            )}
            {nivel === 'critico' && (
              <ul className={cn("text-sm space-y-1", config.color)}>
                <li>🚨 Ação imediata necessária!</li>
                <li>• Realize entrevistas individuais para mapear situações críticas</li>
                <li>• Revise urgentemente a organização do trabalho</li>
                <li>• Implemente suporte psicológico emergencial</li>
                <li>• Considere afastamentos preventivos se necessário</li>
              </ul>
            )}
          </div>
        </div>
      </>
    );
  };

  const renderBoreoutDetail = () => {
    const { score, nivel, fatores } = radares.boreout;
    const config = BURNOUT_NIVEL_CONFIG[nivel];

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          {/* Score Principal */}
          <div className={cn("p-6 rounded-xl border-2 flex flex-col items-center justify-center", config.borderColor, config.bgColor)}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className={cn(
                "w-32 h-32 rounded-full border-4 flex items-center justify-center",
                config.borderColor,
                "bg-background"
              )}
            >
              <span className={cn("text-4xl font-bold", config.color)}>{score}%</span>
            </motion.div>
            <Badge className={cn("mt-4", config.bgColor, config.color)} variant="outline">
              {config.icon} {config.label}
            </Badge>
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Índice de Subcarga/Desengajamento
            </p>
          </div>

          {/* Fatores */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="font-semibold text-lg">Fatores de Risco</h3>
            <div className="grid grid-cols-1 gap-3">
              {BOREOUT_FATORES.map(({ key, label, icon: Icon, description }) => {
                const value = fatores[key];
                return (
                  <div key={key} className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{label}</span>
                      </div>
                      <span className={cn(
                        "font-bold text-lg",
                        value >= 70 ? "text-destructive" : 
                        value >= 40 ? "text-warning" : 
                        "text-success"
                      )}>
                        {Math.round(value)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{description}</p>
                    <Progress 
                      value={value} 
                      className={cn(
                        "h-2",
                        value >= 70 ? "[&>div]:bg-destructive" : 
                        value >= 40 ? "[&>div]:bg-warning" : 
                        "[&>div]:bg-success"
                      )}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recomendações */}
        <Separator className="my-6" />
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Recomendações</h3>
          <div className={cn("p-4 rounded-lg", config.bgColor)}>
            {nivel === 'baixo' && (
              <p className={cn("text-sm", config.color)}>
                ✓ Os colaboradores demonstram engajamento adequado. Mantenha o acompanhamento.
              </p>
            )}
            {nivel === 'moderado' && (
              <ul className={cn("text-sm space-y-1", config.color)}>
                <li>• Implemente rodízio de tarefas para aumentar a variedade</li>
                <li>• Promova desafios e metas mais estimulantes</li>
                <li>• Avalie oportunidades de desenvolvimento para a equipe</li>
              </ul>
            )}
            {nivel === 'alto' && (
              <ul className={cn("text-sm space-y-1", config.color)}>
                <li>• Sinais de desengajamento detectados. Revise as atribuições.</li>
                <li>• Considere realocação de funções baseada em competências</li>
                <li>• Promova projetos especiais para estimular a equipe</li>
              </ul>
            )}
            {nivel === 'critico' && (
              <ul className={cn("text-sm space-y-1", config.color)}>
                <li>⚠ Situação crítica de desengajamento!</li>
                <li>• Realize mapeamento individual de competências e interesses</li>
                <li>• Revise urgentemente a estrutura de cargos</li>
                <li>• Implemente programa de job rotation</li>
              </ul>
            )}
          </div>
        </div>
      </>
    );
  };

  const renderEnergiaDetail = () => {
    const { score, nivel, fatores } = radares.energiaOrganizacional;
    const config = ENERGIA_NIVEL_CONFIG[nivel];

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          {/* Score Principal */}
          <div className={cn("p-6 rounded-xl border-2 flex flex-col items-center justify-center", config.borderColor, config.bgColor)}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className={cn(
                "w-32 h-32 rounded-full border-4 flex items-center justify-center",
                config.borderColor,
                "bg-background"
              )}
            >
              <span className={cn("text-4xl font-bold", config.color)}>{score}%</span>
            </motion.div>
            <Badge className={cn("mt-4", config.bgColor, config.color)} variant="outline">
              {config.icon} {config.label}
            </Badge>
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Índice de Energia Organizacional
            </p>
          </div>

          {/* Fatores */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="font-semibold text-lg">Componentes</h3>
            <div className="grid grid-cols-1 gap-3">
              {ENERGIA_FATORES.map(({ key, label, icon: Icon, description }) => {
                const value = fatores[key];
                return (
                  <div key={key} className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{label}</span>
                      </div>
                      <span className={cn(
                        "font-bold text-lg",
                        value >= 70 ? "text-success" : 
                        value >= 40 ? "text-warning" : 
                        "text-destructive"
                      )}>
                        {Math.round(value)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{description}</p>
                    <Progress 
                      value={value} 
                      className={cn(
                        "h-2",
                        value >= 70 ? "[&>div]:bg-success" : 
                        value >= 40 ? "[&>div]:bg-warning" : 
                        "[&>div]:bg-destructive"
                      )}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recomendações */}
        <Separator className="my-6" />
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Análise</h3>
          <div className={cn("p-4 rounded-lg", config.bgColor)}>
            {nivel === 'excelente' && (
              <p className={cn("text-sm", config.color)}>
                ⚡ Excelente! A organização demonstra alta energia e engajamento. Continue cultivando este ambiente positivo.
              </p>
            )}
            {nivel === 'alto' && (
              <p className={cn("text-sm", config.color)}>
                ✓ Bom nível de energia organizacional. Mantenha as práticas atuais e busque oportunidades de melhoria contínua.
              </p>
            )}
            {nivel === 'moderado' && (
              <ul className={cn("text-sm space-y-1", config.color)}>
                <li>• Promova ações de integração e team building</li>
                <li>• Revise os canais de comunicação interna</li>
                <li>• Implemente programas de reconhecimento</li>
              </ul>
            )}
            {nivel === 'baixo' && (
              <ul className={cn("text-sm space-y-1", config.color)}>
                <li>⚠ Energia organizacional baixa detectada!</li>
                <li>• Realize diagnóstico de clima organizacional</li>
                <li>• Revise a cultura de liderança</li>
                <li>• Implemente programa de bem-estar urgente</li>
              </ul>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {type === 'burnout' && renderBurnoutDetail()}
        {type === 'boreout' && renderBoreoutDetail()}
        {type === 'energia' && renderEnergiaDetail()}
      </DialogContent>
    </Dialog>
  );
}
