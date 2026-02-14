import { motion } from "framer-motion";
import { MessageCircle, Award, Target, TrendingUp, AlertOctagon, ThumbsUp, Minus, ThumbsDown } from "lucide-react";

interface FeedbackStatsProps {
  feedbackStats: {
    total: number;
    reconhecimento: number;
    alinhamento: number;
    desenvolvimento: number;
  };
  ocorrenciaStats: {
    total: number;
    positiva: number;
    neutra: number;
    negativa: number;
    advertencias: number;
  };
}

export function FeedbackStats({ feedbackStats, ocorrenciaStats }: FeedbackStatsProps) {
  const cards = [
    { label: "Feedbacks", value: feedbackStats.total, icon: MessageCircle, color: "text-primary" },
    { label: "Reconhecimentos", value: feedbackStats.reconhecimento, icon: Award, color: "text-success" },
    { label: "Alinhamentos", value: feedbackStats.alinhamento, icon: Target, color: "text-warning" },
    { label: "Desenvolvimento", value: feedbackStats.desenvolvimento, icon: TrendingUp, color: "text-info" },
    { label: "Ocorrências", value: ocorrenciaStats.total, icon: AlertOctagon, color: "text-muted-foreground" },
    { label: "Positivas", value: ocorrenciaStats.positiva, icon: ThumbsUp, color: "text-success" },
    { label: "Negativas", value: ocorrenciaStats.negativa, icon: ThumbsDown, color: "text-destructive" },
    { label: "Advertências", value: ocorrenciaStats.advertencias, icon: AlertOctagon, color: "text-destructive" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="bg-card rounded-xl border p-3 text-center"
        >
          <card.icon className={`w-5 h-5 mx-auto mb-1 ${card.color}`} />
          <p className="text-xl font-bold">{card.value}</p>
          <p className="text-xs text-muted-foreground truncate">{card.label}</p>
        </motion.div>
      ))}
    </div>
  );
}
