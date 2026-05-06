import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface GradientDialogHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  gradient?: string;
  glow?: string;
  step?: { current: number; total: number; labels?: string[]; colors?: string[] };
}

export const GradientDialogHeader = ({
  icon: Icon,
  title,
  description,
  gradient = "from-primary via-info to-purple-600",
  glow = "shadow-primary/40",
  step,
}: GradientDialogHeaderProps) => {
  return (
    <div className="-mx-6 -mt-6 mb-2">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-t-lg bg-gradient-to-br ${gradient} px-6 py-5 shadow-lg ${glow}`}
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent pointer-events-none" />

        <div className="relative flex items-start gap-3 text-white">
          <motion.div
            whileHover={{ scale: 1.08, rotate: -5 }}
            style={{ transformStyle: "preserve-3d" }}
            className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 shadow-lg shrink-0"
          >
            <Icon className="w-5 h-5 drop-shadow" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold drop-shadow-sm leading-tight">{title}</h2>
            {description && (
              <p className="text-xs text-white/85 mt-0.5 leading-snug">{description}</p>
            )}
          </div>
        </div>

        {step && (
          <div className="relative mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-white/90 uppercase tracking-wider">
                Passo {step.current + 1} de {step.total}
                {step.labels?.[step.current] ? ` · ${step.labels[step.current]}` : ""}
              </span>
              <span className="text-[11px] font-medium text-white/75">
                {Math.round(((step.current + 1) / step.total) * 100)}%
              </span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: step.total }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scaleX: 0.4 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className={`h-1.5 flex-1 rounded-full origin-left ${
                    i <= step.current ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" : "bg-white/25"
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
