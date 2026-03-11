import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IERM_CONFIG, type IermNivel } from "@/types/mea";
import { Shield } from "lucide-react";

interface IermBadgeProps {
  score: number;
  nivel: IermNivel;
  compact?: boolean;
}

export function IermBadge({ score, nivel, compact = false }: IermBadgeProps) {
  const config = IERM_CONFIG[nivel];

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge className={`${config.bgColor} ${config.color} border-0 gap-1`}>
              <Shield className="h-3 w-3" />
              {config.emoji} {score}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{config.label}</p>
            <p className="text-xs">Índice Ergonômico: {score}/100</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bgColor}`}>
      <Shield className={`h-5 w-5 ${config.color}`} />
      <div>
        <p className={`text-sm font-medium ${config.color}`}>
          {config.emoji} {config.label}
        </p>
        <p className="text-xs text-muted-foreground">IERM: {score}/100</p>
      </div>
    </div>
  );
}
