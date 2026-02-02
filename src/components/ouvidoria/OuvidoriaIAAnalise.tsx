import { motion } from "framer-motion";
import { 
  Brain, 
  AlertTriangle, 
  ArrowRight, 
  TrendingUp,
  Tag,
  Target,
  CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type { AnaliseOuvidoria } from "@/hooks/useOuvidoriaIA";

interface OuvidoriaIAAnaliseProps {
  analise: AnaliseOuvidoria;
  onApplyPriority?: (prioridade: string) => void;
}

export function OuvidoriaIAAnalise({ analise, onApplyPriority }: OuvidoriaIAAnaliseProps) {
  const getSentimentoConfig = (sentimento: string) => {
    switch (sentimento) {
      case "positivo":
        return { color: "bg-green-500", icon: "😊", label: "Positivo" };
      case "negativo":
        return { color: "bg-red-500", icon: "😟", label: "Negativo" };
      case "urgente":
        return { color: "bg-red-600", icon: "🚨", label: "Urgente" };
      default:
        return { color: "bg-gray-500", icon: "😐", label: "Neutro" };
    }
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case "urgente": return "bg-red-500 text-white";
      case "alta": return "bg-orange-500 text-white";
      case "normal": return "bg-blue-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  const sentimentoConfig = getSentimentoConfig(analise.sentimento);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 p-4 bg-gradient-to-br from-primary/5 to-transparent rounded-xl border border-primary/20"
    >
      <div className="flex items-center gap-2 mb-3">
        <Brain className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Análise por IA</h3>
        <Badge variant="outline" className="ml-auto text-xs">
          {analise.confianca}% confiança
        </Badge>
      </div>

      {/* Sentimento e Prioridade */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-background rounded-lg border">
          <p className="text-xs text-muted-foreground mb-1">Sentimento</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{sentimentoConfig.icon}</span>
            <Badge className={sentimentoConfig.color}>{sentimentoConfig.label}</Badge>
          </div>
        </div>
        <div className="p-3 bg-background rounded-lg border">
          <p className="text-xs text-muted-foreground mb-1">Prioridade Sugerida</p>
          <div className="flex items-center gap-2">
            <Badge className={getPrioridadeColor(analise.prioridade)}>
              {analise.prioridade.toUpperCase()}
            </Badge>
            {onApplyPriority && (
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 px-2"
                onClick={() => onApplyPriority(analise.prioridade)}
              >
                <CheckCircle2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Risco Identificado */}
      {analise.riscoIdentificado && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-700 dark:text-red-400 font-medium">
            Risco de segurança, saúde ou compliance identificado
          </span>
        </div>
      )}

      {/* Resumo */}
      <div className="p-3 bg-background rounded-lg border">
        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
          <Target className="h-3 w-3" />
          Resumo
        </p>
        <p className="text-sm">{analise.resumo}</p>
      </div>

      {/* Categoria e Encaminhamento */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-background rounded-lg border">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Tag className="h-3 w-3" />
            Categoria
          </p>
          <p className="text-sm font-medium">{analise.categoria}</p>
          {analise.subcategorias && analise.subcategorias.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {analise.subcategorias.map((sub, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {sub}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="p-3 bg-background rounded-lg border">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <ArrowRight className="h-3 w-3" />
            Encaminhamento
          </p>
          <p className="text-sm font-medium">{analise.encaminhamento}</p>
        </div>
      </div>

      {/* Palavras-chave */}
      {analise.palavrasChave && analise.palavrasChave.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Palavras-chave</p>
          <div className="flex flex-wrap gap-1">
            {analise.palavrasChave.map((palavra, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {palavra}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Ação Sugerida */}
      {analise.acaoSugerida && (
        <div className="p-3 bg-primary/10 rounded-lg">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Ação Sugerida
          </p>
          <p className="text-sm">{analise.acaoSugerida}</p>
        </div>
      )}

      {/* Confiança */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Confiança da análise</span>
          <span>{analise.confianca}%</span>
        </div>
        <Progress value={analise.confianca} className="h-2" />
      </div>
    </motion.div>
  );
}
