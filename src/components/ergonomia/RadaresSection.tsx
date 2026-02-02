import { motion } from "framer-motion";
import { RadarBurnout } from "./RadarBurnout";
import { RadarBoreout } from "./RadarBoreout";
import { RadarEnergia } from "./RadarEnergia";
import { Skeleton } from "@/components/ui/skeleton";
import type { RadarData } from "@/hooks/useErgonomiaInteligente";

interface RadaresSectionProps {
  radares: RadarData | null;
  isLoading: boolean;
}

export function RadaresSection({ radares, isLoading }: RadaresSectionProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[400px]" />
        ))}
      </div>
    );
  }

  if (!radares) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 md:grid-cols-3 gap-4"
    >
      <RadarBurnout 
        score={radares.burnout.score}
        nivel={radares.burnout.nivel}
        fatores={radares.burnout.fatores}
      />
      <RadarBoreout 
        score={radares.boreout.score}
        nivel={radares.boreout.nivel}
        fatores={radares.boreout.fatores}
      />
      <RadarEnergia 
        score={radares.energiaOrganizacional.score}
        nivel={radares.energiaOrganizacional.nivel}
        fatores={radares.energiaOrganizacional.fatores}
      />
    </motion.div>
  );
}
