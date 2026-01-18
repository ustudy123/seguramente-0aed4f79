import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Clock, User, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { HistoricoAprovacao } from '@/types/admissao';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface WorkflowTimelineProps {
  historico: HistoricoAprovacao[];
  onAprovar?: (etapaId: string, observacao?: string) => void;
  onRejeitar?: (etapaId: string, observacao: string) => void;
  isAdmin?: boolean;
}

export function WorkflowTimeline({ 
  historico, 
  onAprovar, 
  onRejeitar,
  isAdmin = false 
}: WorkflowTimelineProps) {
  const [activeEtapa, setActiveEtapa] = useState<string | null>(null);
  const [observacao, setObservacao] = useState('');

  const getStatusIcon = (status: HistoricoAprovacao['status']) => {
    switch (status) {
      case 'aprovado': return CheckCircle;
      case 'rejeitado': return XCircle;
      default: return Clock;
    }
  };

  const getStatusColor = (status: HistoricoAprovacao['status']) => {
    switch (status) {
      case 'aprovado': return 'bg-success text-success-foreground';
      case 'rejeitado': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleAction = (etapaId: string, aprovado: boolean) => {
    if (aprovado) {
      onAprovar?.(etapaId, observacao);
    } else {
      onRejeitar?.(etapaId, observacao);
    }
    setActiveEtapa(null);
    setObservacao('');
  };

  // Find the next pending step
  const proximaEtapaPendente = historico.find(e => e.status === 'pendente');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Fluxo de Aprovação</h3>
        <Badge variant="outline">
          {historico.filter(e => e.status === 'aprovado').length}/{historico.length} etapas
        </Badge>
      </div>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

        <div className="space-y-6">
          {historico.map((etapa, index) => {
            const StatusIcon = getStatusIcon(etapa.status);
            const isCurrentStep = etapa.id === proximaEtapaPendente?.id;
            const isActive = activeEtapa === etapa.id;

            return (
              <motion.div
                key={etapa.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative pl-14"
              >
                {/* Status circle */}
                <div className={cn(
                  "absolute left-2.5 w-5 h-5 rounded-full flex items-center justify-center",
                  getStatusColor(etapa.status),
                  isCurrentStep && "ring-4 ring-primary/20"
                )}>
                  <StatusIcon className="h-3 w-3" />
                </div>

                <div className={cn(
                  "bg-card rounded-lg border p-4 transition-all",
                  isCurrentStep ? "border-primary shadow-md" : "border-border",
                  etapa.status === 'rejeitado' && "border-destructive/30"
                )}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-foreground">{etapa.etapa}</h4>
                        {isCurrentStep && (
                          <Badge className="bg-primary/10 text-primary">Atual</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        <span>{etapa.responsavel}</span>
                      </div>
                    </div>

                    {etapa.dataAcao && (
                      <span className="text-xs text-muted-foreground">
                        {format(etapa.dataAcao, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    )}
                  </div>

                  {etapa.observacao && (
                    <div className="mt-3 p-2 rounded bg-muted flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <p className="text-sm text-muted-foreground">{etapa.observacao}</p>
                    </div>
                  )}

                  {/* Actions for admin on pending steps */}
                  {isAdmin && etapa.status === 'pendente' && isCurrentStep && (
                    <div className="mt-4 space-y-3">
                      {isActive ? (
                        <>
                          <Textarea
                            placeholder="Adicione uma observação (opcional para aprovação, obrigatório para rejeição)"
                            value={observacao}
                            onChange={(e) => setObservacao(e.target.value)}
                            className="min-h-[80px]"
                          />
                          <div className="flex gap-2">
                            <Button 
                              size="sm"
                              onClick={() => handleAction(etapa.id, true)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Aprovar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => handleAction(etapa.id, false)}
                              disabled={!observacao.trim()}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Rejeitar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => setActiveEtapa(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setActiveEtapa(etapa.id)}
                        >
                          Analisar Etapa
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
