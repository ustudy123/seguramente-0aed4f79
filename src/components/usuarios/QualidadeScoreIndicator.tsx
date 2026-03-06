import { cn } from "@/lib/utils";
import { QualidadeScore } from "@/hooks/useUsuarios";

const SCORE_CONFIG: Record<QualidadeScore, { label: string; color: string; bg: string }> = {
  completo: { label: "Completo", color: "text-success", bg: "bg-success" },
  suficiente: { label: "Suficiente", color: "text-blue-600", bg: "bg-blue-500" },
  incompleto: { label: "Incompleto", color: "text-amber-600", bg: "bg-amber-500" },
  inconsistente: { label: "Inconsistente", color: "text-destructive", bg: "bg-destructive" },
};

export function QualidadeScoreIndicator({
  score, pct, showLabel = true,
}: {
  score: QualidadeScore;
  pct: number;
  showLabel?: boolean;
}) {
  const cfg = SCORE_CONFIG[score];
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-1.5 min-w-[60px]">
        <div
          className={cn("h-1.5 rounded-full transition-all", cfg.bg)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn("text-xs font-medium", cfg.color)}>
          {pct}%
        </span>
      )}
    </div>
  );
}
