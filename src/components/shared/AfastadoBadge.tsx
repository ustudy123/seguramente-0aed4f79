import { AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import type { AfastamentoAtivo } from "@/hooks/useAfastamentosAtivos";

const MOTIVO_LABELS: Record<string, string> = {
  ortopedico: "Ortopédico",
  psiquiatrico: "Psiquiátrico",
  clinico_geral: "Clínico Geral",
  ginecologico: "Ginecológico",
  odontologico: "Odontológico",
  oftalmologico: "Oftalmológico",
  dermatologico: "Dermatológico",
  cardiologico: "Cardiológico",
  neurologico: "Neurológico",
  outro: "Outro",
};

interface AfastadoBadgeProps {
  afastamento: AfastamentoAtivo | undefined;
  compact?: boolean;
}

export function AfastadoBadge({ afastamento, compact = false }: AfastadoBadgeProps) {
  if (!afastamento) return null;

  const statusLabel = afastamento.status === "beneficio_inss" ? "Benefício INSS" : "Afastado";
  const motivo = afastamento.motivo_principal ? MOTIVO_LABELS[afastamento.motivo_principal] || afastamento.motivo_principal : null;
  const desde = afastamento.data_inicio ? format(new Date(afastamento.data_inicio + "T00:00:00"), "dd/MM/yyyy") : "";

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/15 text-orange-600 border border-orange-500/30 cursor-help">
            <AlertTriangle className="w-3 h-3" />
            {statusLabel}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[220px]">
          <p className="font-semibold">{statusLabel} desde {desde}</p>
          {motivo && <p className="text-muted-foreground">Motivo: {motivo}</p>}
          {afastamento.data_fim && <p className="text-muted-foreground">Previsão retorno: {format(new Date(afastamento.data_fim + "T00:00:00"), "dd/MM/yyyy")}</p>}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-700 dark:text-orange-400 text-sm">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <div>
        <span className="font-medium">{statusLabel}</span>
        {desde && <span className="text-muted-foreground"> desde {desde}</span>}
        {motivo && <span className="text-muted-foreground"> — {motivo}</span>}
        {afastamento.data_fim && (
          <span className="text-muted-foreground"> • Retorno previsto: {format(new Date(afastamento.data_fim + "T00:00:00"), "dd/MM/yyyy")}</span>
        )}
      </div>
    </div>
  );
}
