import { motion } from "framer-motion";
import { CalendarHeart, PartyPopper, Sparkles, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Props {
  datasAtivas: number;
  acoesPendentes: number;
  acoesConcluidas: number;
  rituaisAtivos: number;
}

const stats = (p: Props) => [
  { label: "Datas Ativas", value: p.datasAtivas, icon: CalendarHeart, color: "text-violet-600" },
  { label: "Ações Pendentes", value: p.acoesPendentes, icon: Sparkles, color: "text-amber-600" },
  { label: "Ações Concluídas", value: p.acoesConcluidas, icon: CheckCircle2, color: "text-emerald-600" },
  { label: "Rituais Ativos", value: p.rituaisAtivos, icon: PartyPopper, color: "text-blue-600" },
];

export const CulturaStats = (props: Props) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {stats(props).map((s, i) => (
      <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
        <Card className="p-4 flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-muted ${s.color}`}>
            <s.icon className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        </Card>
      </motion.div>
    ))}
  </div>
);
