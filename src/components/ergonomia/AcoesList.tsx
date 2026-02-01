import { motion } from "framer-motion";
import { ClipboardCheck, Clock, CheckCircle2, XCircle, PlayCircle, Calendar, User, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ErgonomiaAcao, AcaoStatus, AcaoPrioridade } from "@/types/ergonomia";
import {
  PRIORIDADE_LABELS,
  ACAO_STATUS_LABELS,
} from "@/types/ergonomia";

const STATUS_ICONS: Record<AcaoStatus, React.ElementType> = {
  pendente: Clock,
  em_andamento: PlayCircle,
  concluida: CheckCircle2,
  cancelada: XCircle,
};

const STATUS_COLORS: Record<AcaoStatus, string> = {
  pendente: 'bg-muted text-muted-foreground',
  em_andamento: 'bg-info/10 text-info',
  concluida: 'bg-success/10 text-success',
  cancelada: 'bg-destructive/10 text-destructive',
};

const PRIORIDADE_COLORS: Record<AcaoPrioridade, string> = {
  baixa: 'bg-success/10 text-success border-success/30',
  media: 'bg-warning/10 text-warning border-warning/30',
  alta: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  urgente: 'bg-destructive/10 text-destructive border-destructive/30',
};

const TIPO_COLORS = {
  corretiva: 'bg-destructive/10 text-destructive',
  preventiva: 'bg-info/10 text-info',
  melhoria: 'bg-success/10 text-success',
};

interface AcoesListProps {
  acoes: ErgonomiaAcao[];
  onUpdateStatus?: (id: string, status: AcaoStatus) => void;
}

export function AcoesList({ acoes, onUpdateStatus }: AcoesListProps) {
  // Calcular estatísticas
  const stats = {
    total: acoes.length,
    pendentes: acoes.filter(a => a.status === 'pendente').length,
    emAndamento: acoes.filter(a => a.status === 'em_andamento').length,
    concluidas: acoes.filter(a => a.status === 'concluida').length,
  };

  const progressPercent = stats.total > 0 
    ? Math.round((stats.concluidas / stats.total) * 100) 
    : 0;

  if (acoes.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12"
      >
        <ClipboardCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Nenhuma ação cadastrada</h3>
        <p className="text-muted-foreground">
          Cadastre ações corretivas e preventivas para mitigar riscos
        </p>
      </motion.div>
    );
  }

  // Agrupar por status
  const acoesPorStatus: Record<AcaoStatus, ErgonomiaAcao[]> = {
    pendente: [],
    em_andamento: [],
    concluida: [],
    cancelada: [],
  };

  acoes.forEach(acao => {
    acoesPorStatus[acao.status].push(acao);
  });

  return (
    <div className="space-y-6">
      {/* Resumo de Progresso */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Progresso do Plano de Ação</span>
            <span className="text-sm text-muted-foreground">
              {stats.concluidas} de {stats.total} ações concluídas
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <div className="flex justify-between mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-muted" />
              {stats.pendentes} Pendentes
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-info" />
              {stats.emAndamento} Em Andamento
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-success" />
              {stats.concluidas} Concluídas
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Ações por Status */}
      {(['pendente', 'em_andamento', 'concluida', 'cancelada'] as AcaoStatus[]).map((status) => {
        const acoesDoStatus = acoesPorStatus[status];
        if (acoesDoStatus.length === 0) return null;

        const StatusIcon = STATUS_ICONS[status];

        return (
          <Card key={status}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className={cn("p-2 rounded-lg", STATUS_COLORS[status])}>
                  <StatusIcon className="h-4 w-4" />
                </div>
                <span>{ACAO_STATUS_LABELS[status]}</span>
                <Badge variant="secondary" className="ml-auto">
                  {acoesDoStatus.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {acoesDoStatus.map((acao, index) => (
                <motion.div
                  key={acao.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 rounded-lg border bg-card hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-medium text-foreground">
                          {acao.titulo}
                        </h4>
                        <Badge className={cn("text-xs capitalize", TIPO_COLORS[acao.tipo])}>
                          {acao.tipo}
                        </Badge>
                        <Badge className={cn("text-xs", PRIORIDADE_COLORS[acao.prioridade])} variant="outline">
                          {PRIORIDADE_LABELS[acao.prioridade]}
                        </Badge>
                      </div>
                      
                      {acao.descricao && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {acao.descricao}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {acao.responsavel_nome && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {acao.responsavel_nome}
                          </span>
                        )}
                        {acao.prazo && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(acao.prazo), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                        {acao.custo_estimado && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(acao.custo_estimado)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botões de ação rápida */}
                    {onUpdateStatus && status !== 'concluida' && status !== 'cancelada' && (
                      <div className="flex gap-1">
                        {status === 'pendente' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => onUpdateStatus(acao.id, 'em_andamento')}
                          >
                            <PlayCircle className="h-4 w-4 mr-1" />
                            Iniciar
                          </Button>
                        )}
                        {status === 'em_andamento' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-success border-success/30"
                            onClick={() => onUpdateStatus(acao.id, 'concluida')}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Concluir
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
