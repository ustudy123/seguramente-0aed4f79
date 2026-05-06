import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trash2, ChevronRight, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Pdi, PdiStatus } from "@/types/pdi";
import { PDI_STATUS_LABELS, PDI_PERIODO_LABELS } from "@/types/pdi";
import { useAfastamentosAtivos } from "@/hooks/useAfastamentosAtivos";
import { AfastadoBadge } from "@/components/shared/AfastadoBadge";

interface PdiListProps {
  pdis: Pdi[];
  isLoading: boolean;
  onSelect: (pdi: Pdi) => void;
  onDelete: (id: string) => void;
}

const statusVariant: Record<PdiStatus, "default" | "secondary" | "destructive" | "outline"> = {
  rascunho: "secondary",
  ativo: "default",
  pausado: "outline",
  concluido: "default",
  cancelado: "destructive",
};

const statusStyle: Record<PdiStatus, { card: string; accent: string; badge: string; progress: string }> = {
  rascunho: {
    card: "bg-gradient-to-br from-slate-50 to-slate-100/60 dark:from-slate-900/40 dark:to-slate-800/20 border-slate-300 dark:border-slate-700",
    accent: "border-l-slate-400",
    badge: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100 border-slate-300",
    progress: "[&>div]:bg-slate-500",
  },
  ativo: {
    card: "bg-gradient-to-br from-primary/10 via-background to-info/10 border-primary/30",
    accent: "border-l-primary",
    badge: "bg-primary text-primary-foreground border-transparent",
    progress: "[&>div]:bg-primary",
  },
  pausado: {
    card: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border-amber-300 dark:border-amber-800",
    accent: "border-l-amber-500",
    badge: "bg-amber-500 text-white border-transparent",
    progress: "[&>div]:bg-amber-500",
  },
  concluido: {
    card: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 border-emerald-300 dark:border-emerald-800",
    accent: "border-l-emerald-500",
    badge: "bg-emerald-600 text-white border-transparent",
    progress: "[&>div]:bg-emerald-600",
  },
  cancelado: {
    card: "bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/20 border-rose-300 dark:border-rose-800",
    accent: "border-l-rose-500",
    badge: "bg-rose-600 text-white border-transparent",
    progress: "[&>div]:bg-rose-500",
  },
};

export const PdiList = ({ pdis, isLoading, onSelect, onDelete }: PdiListProps) => {
  const { getAfastamento } = useAfastamentosAtivos();
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse"><CardContent className="p-6 h-32" /></Card>
        ))}
      </div>
    );
  }

  if (pdis.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          Nenhum PDI encontrado. Crie o primeiro plano de desenvolvimento!
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {pdis.map((pdi, i) => {
        const st = statusStyle[pdi.status];
        return (
        <motion.div key={pdi.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
          <Card className={`hover:shadow-lg transition-all cursor-pointer group border-l-4 ${st.card} ${st.accent}`} onClick={() => onSelect(pdi)}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3 gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{pdi.titulo}</h3>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <User className="w-3.5 h-3.5" />
                    <span className="truncate">{pdi.colaborador_nome}</span>
                    <AfastadoBadge afastamento={getAfastamento({ nome: pdi.colaborador_nome })} compact />
                  </div>
                </div>
                <Badge className={st.badge}>{PDI_STATUS_LABELS[pdi.status]}</Badge>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(pdi.data_inicio), "dd/MM/yy", { locale: ptBR })} — {format(new Date(pdi.data_fim), "dd/MM/yy", { locale: ptBR })}
                <Badge variant="outline" className="text-[10px] ml-auto bg-background/60">{PDI_PERIODO_LABELS[pdi.periodo]}</Badge>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{pdi.metas?.length || 0} metas</span>
                  <span className="font-medium text-foreground">{pdi.progresso}%</span>
                </div>
                <Progress value={pdi.progresso} className={`h-2 ${st.progress}`} />
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2"
                  onClick={(e) => { e.stopPropagation(); onDelete(pdi.id); }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
        );
      })}
    </div>
  );
};
