import { useState, forwardRef } from "react";
import { motion } from "framer-motion";
import { LucideIcon, TrendingUp, TrendingDown, Minus, ChevronRight, Expand } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { IndicatorDetailModal, IndicatorType } from "./IndicatorDetailModal";

interface PilarMetric {
  label: string;
  value: string | number;
  change?: number;
  link?: string;
  indicatorType?: IndicatorType;
}

interface PilarCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  score: number;
  metrics: PilarMetric[];
  color: "navy" | "green" | "purple" | "amber";
  delay?: number;
  pilarIndicator?: IndicatorType;
  hasData?: boolean;
}

const colorClasses = {
  navy: {
    bg: "bg-gradient-to-br from-primary to-primary/80",
    icon: "bg-white/15 text-white",
    badge: "bg-white/15 text-white",
    progress: "bg-white/20",
    progressFill: "bg-white",
  },
  green: {
    bg: "bg-gradient-to-br from-success to-success/80",
    icon: "bg-white/15 text-white",
    badge: "bg-white/15 text-white",
    progress: "bg-white/20",
    progressFill: "bg-white",
  },
  purple: {
    bg: "bg-gradient-to-br from-info to-info/80",
    icon: "bg-white/15 text-white",
    badge: "bg-white/15 text-white",
    progress: "bg-white/20",
    progressFill: "bg-white",
  },
  amber: {
    bg: "bg-gradient-to-br from-warning to-warning/80",
    icon: "bg-white/15 text-white",
    badge: "bg-white/15 text-white",
    progress: "bg-white/20",
    progressFill: "bg-white",
  },
};

export const PilarCard = forwardRef<HTMLDivElement, PilarCardProps>(({
  title,
  description,
  icon: Icon,
  score,
  metrics,
  color,
  delay = 0,
  pilarIndicator,
  hasData = true,
}, ref) => {
  const colors = colorClasses[color];
  const [selectedIndicator, setSelectedIndicator] = useState<{
    type: IndicatorType;
    title: string;
    value: string | number;
  } | null>(null);
  
  const getScoreLabel = (score: number, hasData: boolean) => {
    if (!hasData) return "—";
    if (score >= 80) return "Excelente";
    if (score >= 60) return "Bom";
    if (score >= 40) return "Regular";
    if (score >= 20) return "Atenção";
    return "Crítico";
  };

  const handleMetricClick = (metric: PilarMetric, e: React.MouseEvent) => {
    if (metric.indicatorType) {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndicator({
        type: metric.indicatorType,
        title: metric.label,
        value: metric.value,
      });
    }
  };

  const handleCardClick = () => {
    if (pilarIndicator) {
      setSelectedIndicator({
        type: pilarIndicator,
        title: title,
        value: `${score}%`,
      });
    }
  };

  return (
    <>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay }}
        onClick={handleCardClick}
        className={cn(
          "rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-all cursor-pointer group",
          colors.bg
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-lg", colors.icon)}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{title}</h3>
              <p className="text-white/70 text-xs">{description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn("px-2.5 py-1 rounded-full text-xs font-medium", colors.badge)}>
              {getScoreLabel(score, hasData)}
            </div>
            <Expand className="w-4 h-4 text-white/50 group-hover:text-white transition-colors" />
          </div>
        </div>

        {/* Score Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-white/80">Maturidade</span>
            <span className="text-lg font-bold">{score}%</span>
          </div>
          <div className={cn("h-2 rounded-full overflow-hidden", colors.progress)}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.8, delay: delay + 0.2 }}
              className={cn("h-full rounded-full", colors.progressFill)}
            />
          </div>
        </div>

        {/* Metrics */}
        <div className="space-y-2">
          {metrics.map((metric, index) => (
            <div
              key={index}
              onClick={(e) => handleMetricClick(metric, e)}
              className={cn(
                "flex items-center justify-between py-2 border-t border-white/10",
                metric.indicatorType && "hover:bg-white/10 -mx-2 px-2 rounded transition-colors"
              )}
            >
              <span className="text-sm text-white/80">{metric.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{metric.value}</span>
                {metric.change !== undefined && (
                  <span
                    className={cn(
                      "flex items-center text-xs",
                      metric.change > 0
                        ? "text-white/90"
                        : metric.change < 0
                        ? "text-white/70"
                        : "text-white/50"
                    )}
                  >
                    {metric.change > 0 ? (
                      <TrendingUp className="w-3 h-3 mr-0.5" />
                    ) : metric.change < 0 ? (
                      <TrendingDown className="w-3 h-3 mr-0.5" />
                    ) : (
                      <Minus className="w-3 h-3 mr-0.5" />
                    )}
                    {Math.abs(metric.change)}%
                  </span>
                )}
                {metric.link && !metric.indicatorType && (
                  <Link 
                    to={metric.link} 
                    className="text-white/60 hover:text-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
                {metric.indicatorType && (
                  <Expand className="w-3 h-3 text-white/40" />
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Detail Modal */}
      {selectedIndicator && (
        <IndicatorDetailModal
          open={!!selectedIndicator}
          onOpenChange={(open) => !open && setSelectedIndicator(null)}
          indicator={selectedIndicator.type}
          title={selectedIndicator.title}
          currentValue={selectedIndicator.value}
        />
      )}
    </>
  );
});
PilarCard.displayName = "PilarCard";
