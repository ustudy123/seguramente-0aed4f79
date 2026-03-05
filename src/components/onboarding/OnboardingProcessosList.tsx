import { motion } from "framer-motion";
import {
  Loader2, User, Clock, CheckCircle2, XCircle, PlayCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useOnboardingProcessos } from "@/hooks/useOnboarding";
import { PROCESSO_STATUS_LABELS, type OnboardingProcesso } from "@/types/onboarding";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusConfig: Record<string, { icon: any; color: string }> = {
  pendente: { icon: Clock, color: "bg-muted text-muted-foreground" },
  em_andamento: { icon: PlayCircle, color: "bg-primary/10 text-primary" },
  concluido: { icon: CheckCircle2, color: "bg-green-100 text-green-700" },
  cancelado: { icon: XCircle, color: "bg-destructive/10 text-destructive" },
};

export function OnboardingProcessosList() {
  const { processos, isLoading } = useOnboardingProcessos();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Stats
  const stats = {
    total: processos.length,
    pendentes: processos.filter((p) => p.status === "pendente").length,
    emAndamento: processos.filter((p) => p.status === "em_andamento").length,
    concluidos: processos.filter((p) => p.status === "concluido").length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <User className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Clock className="w-5 h-5 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.pendentes}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10">
              <PlayCircle className="w-5 h-5 text-info" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.emAndamento}</p>
              <p className="text-xs text-muted-foreground">Em andamento</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle2 className="w-5 h-5 text-success" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.concluidos}</p>
              <p className="text-xs text-muted-foreground">Concluídos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      <div className="space-y-3">
        {processos.map((p, i) => {
          const cfg = statusConfig[p.status] || statusConfig.pendente;
          const StatusIcon = cfg.icon;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="border-border">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${cfg.color}`}>
                    <StatusIcon className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground text-sm">{p.colaborador_nome}</h4>
                    <p className="text-xs text-muted-foreground">
                      Iniciado em {format(new Date(p.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="w-32">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{p.progresso}%</span>
                      <span className="text-muted-foreground">{p.pontos_obtidos}pts</span>
                    </div>
                    <Progress value={p.progresso} className="h-1.5" />
                  </div>
                  <Badge className={`text-[10px] ${cfg.color}`}>
                    {PROCESSO_STATUS_LABELS[p.status]}
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
