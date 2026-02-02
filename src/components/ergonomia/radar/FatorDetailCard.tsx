import { useState } from "react";
import { Plus, Info, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FatorActionForm } from "./FatorActionForm";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { AcaoPrioridade } from "@/types/ergonomia";

interface FatorDetailCardProps {
  fatorKey: string;
  label: string;
  icon: LucideIcon;
  description: string;
  detailedAnalysis: string;
  dataSource: readonly string[];
  value: number;
  sugestoes: readonly string[];
  radarType: 'burnout' | 'boreout' | 'energia';
  inverseColors?: boolean; // For energia, higher is better
  existingActions: { titulo: string; status: string }[];
  onCreateAction: (acao: {
    titulo: string;
    descricao: string;
    tipo: 'corretiva' | 'preventiva' | 'melhoria';
    prioridade: AcaoPrioridade;
    fator_radar: string;
    radar_type: string;
  }) => Promise<void>;
  isCreatingAction?: boolean;
}

export function FatorDetailCard({
  fatorKey,
  label,
  icon: Icon,
  description,
  detailedAnalysis,
  dataSource,
  value,
  sugestoes,
  radarType,
  inverseColors = false,
  existingActions,
  onCreateAction,
  isCreatingAction = false,
}: FatorDetailCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActionForm, setShowActionForm] = useState(false);

  const getColorClass = (val: number, inverse: boolean) => {
    if (inverse) {
      // Higher is better (energia)
      if (val >= 70) return { text: "text-success", bg: "bg-success", progressClass: "[&>div]:bg-success" };
      if (val >= 40) return { text: "text-warning", bg: "bg-warning", progressClass: "[&>div]:bg-warning" };
      return { text: "text-destructive", bg: "bg-destructive", progressClass: "[&>div]:bg-destructive" };
    } else {
      // Lower is better (burnout, boreout)
      if (val >= 70) return { text: "text-destructive", bg: "bg-destructive", progressClass: "[&>div]:bg-destructive" };
      if (val >= 40) return { text: "text-warning", bg: "bg-warning", progressClass: "[&>div]:bg-warning" };
      return { text: "text-success", bg: "bg-success", progressClass: "[&>div]:bg-success" };
    }
  };

  const colors = getColorClass(value, inverseColors);

  const handleCreateAction = async (acao: Parameters<typeof onCreateAction>[0]) => {
    await onCreateAction(acao);
    setShowActionForm(false);
  };

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        {/* Header - Always visible */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 flex-1">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium">{label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn("font-bold text-lg", colors.text)}>
                {Math.round(value)}%
              </span>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{description}</p>
          <Progress value={value} className={cn("h-2", colors.progressClass)} />
        </div>

        {/* Expanded content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4 border-t pt-4 bg-muted/30">
            {/* Análise detalhada */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Info className="h-4 w-4 text-primary" />
                O que analisamos
              </div>
              <p className="text-sm text-muted-foreground">{detailedAnalysis}</p>
              
              <div className="flex flex-wrap gap-2 mt-2">
                {dataSource.map((source, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {source}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Ações existentes */}
            {existingActions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Ações vinculadas ({existingActions.length})
                </div>
                <div className="space-y-1">
                  {existingActions.map((acao, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-card rounded border">
                      <span className="flex-1">{acao.titulo}</span>
                      <Badge variant="outline" className="text-xs">
                        {acao.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botão ou form de ação */}
            {showActionForm ? (
              <FatorActionForm
                fatorKey={fatorKey}
                fatorLabel={label}
                radarType={radarType}
                sugestoes={sugestoes}
                onSubmit={handleCreateAction}
                onCancel={() => setShowActionForm(false)}
                isLoading={isCreatingAction}
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowActionForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Ação para este Fator
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
