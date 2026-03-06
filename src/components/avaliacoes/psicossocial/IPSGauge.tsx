import { type IPSClassificacao, getIPSLabel, getIPSColor, getIPSBgColor } from "@/types/psicossocial";
import { cn } from "@/lib/utils";

interface IPSGaugeProps {
  score: number;
  classificacao: IPSClassificacao;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function IPSGauge({ score, classificacao, size = 'md', showLabel = true }: IPSGaugeProps) {
  const sizeMap = {
    sm: { outer: 80, stroke: 8, fontSize: 'text-xl', labelSize: 'text-xs' },
    md: { outer: 120, stroke: 12, fontSize: 'text-3xl', labelSize: 'text-sm' },
    lg: { outer: 160, stroke: 16, fontSize: 'text-4xl', labelSize: 'text-base' },
  };
  const { outer, stroke, fontSize, labelSize } = sizeMap[size];
  const radius = (outer - stroke) / 2;
  const circumference = Math.PI * radius; // semicircle
  const offset = circumference - (score / 100) * circumference;

  const colorMap: Record<IPSClassificacao, string> = {
    saudavel: '#10b981',
    estavel: '#3b82f6',
    atencao: '#f59e0b',
    risco: '#f97316',
    critico: '#ef4444',
  };
  const color = colorMap[classificacao];

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: outer, height: outer / 2 + stroke }}>
        <svg
          width={outer}
          height={outer / 2 + stroke}
          viewBox={`0 0 ${outer} ${outer / 2 + stroke}`}
        >
          {/* Track */}
          <path
            d={`M ${stroke / 2} ${outer / 2} A ${radius} ${radius} 0 0 1 ${outer - stroke / 2} ${outer / 2}`}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          {/* Progress */}
          <path
            d={`M ${stroke / 2} ${outer / 2} A ${radius} ${radius} 0 0 1 ${outer - stroke / 2} ${outer / 2}`}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
          />
        </svg>
        {/* Score text */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-end pb-1"
        >
          <span className={cn("font-bold leading-none", fontSize)} style={{ color }}>
            {score}
          </span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      {showLabel && (
        <span className={cn(
          "font-semibold px-2 py-0.5 rounded-full",
          labelSize,
          getIPSColor(classificacao),
          getIPSBgColor(classificacao)
        )}>
          {getIPSLabel(classificacao)}
        </span>
      )}
    </div>
  );
}
