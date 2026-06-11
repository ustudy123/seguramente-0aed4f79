import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { 
  Calendar, 
  User, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  Trash2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Afastamento } from "@/types/atestado";
import { 
  AFASTAMENTO_STATUS_LABELS,
  GRUPO_CLINICO_LABELS,
  GRUPO_CLINICO_COLORS,
} from "@/types/atestado";

interface AfastamentoListProps {
  afastamentos: Afastamento[];
  onDelete?: (id: string) => Promise<void>;
  deleting?: boolean;
}

export function AfastamentoList({ afastamentos, onDelete, deleting }: AfastamentoListProps) {
  if (afastamentos.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">Nenhum afastamento registrado</h3>
        <p className="text-muted-foreground mt-1">
          Afastamentos são criados automaticamente ao cadastrar atestados
        </p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'encerrado':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'beneficio_inss':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const get15DaysProgress = (dias: number) => {
    return Math.min((dias / 15) * 100, 100);
  };

  return (
    <div className="space-y-3">
      {afastamentos.map((afastamento, index) => (
        <motion.div
          key={afastamento.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.03 }}
        >
          <Card className={`${afastamento.aso_retorno_pendente ? 'border-red-300 dark:border-red-700' : ''}`}>
            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{afastamento.colaborador_nome}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getStatusColor(afastamento.status)}>
                      {AFASTAMENTO_STATUS_LABELS[afastamento.status]}
                    </Badge>
                    {afastamento.motivo_principal && (
                      <Badge 
                        variant="outline"
                        className={GRUPO_CLINICO_COLORS[afastamento.motivo_principal]}
                      >
                        {GRUPO_CLINICO_LABELS[afastamento.motivo_principal]}
                      </Badge>
                    )}
                    {onDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir afastamento?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. O afastamento de {afastamento.colaborador_nome} será permanentemente removido.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onDelete(afastamento.id)}
                              disabled={deleting}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {deleting ? "Excluindo..." : "Excluir"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>

                {/* Dates and duration */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {format(parseISO(afastamento.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
                      {afastamento.data_fim && (
                        <> - {format(parseISO(afastamento.data_fim), "dd/MM/yyyy", { locale: ptBR })}</>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className={`font-medium ${
                      afastamento.dias_totais >= 30 
                        ? 'text-red-600 dark:text-red-400' 
                        : afastamento.dias_totais >= 13
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-foreground'
                    }`}>
                      {afastamento.dias_totais} dias
                    </span>
                  </div>
                </div>

                {/* Progress bar for 15 days rule */}
                {afastamento.status === 'ativo' && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Regra 15 dias (empresa x INSS)</span>
                      <span>{Math.min(afastamento.dias_totais, 15)}/15</span>
                    </div>
                    <Progress 
                      value={get15DaysProgress(afastamento.dias_totais)} 
                      className="h-2"
                    />
                  </div>
                )}

                {/* Alerts */}
                {afastamento.aso_retorno_pendente && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <span className="text-xs text-red-700 dark:text-red-300">
                      ASO de Retorno ao Trabalho pendente - Afastamento ≥30 dias
                    </span>
                  </div>
                )}

                {afastamento.alerta_15_dias && !afastamento.alerta_30_dias && afastamento.status === 'ativo' && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs text-amber-700 dark:text-amber-300">
                      Afastamento próximo de 15 dias - Verificar necessidade de encaminhamento INSS
                    </span>
                  </div>
                )}

                {afastamento.aso_retorno_id && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-xs text-green-700 dark:text-green-300">
                      ASO de Retorno ao Trabalho vinculado
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
