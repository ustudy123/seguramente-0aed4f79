import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { 
  AlertTriangle, 
  Clock, 
  Shield,
  CheckCircle2,
  Bell,
  FileWarning,
  Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GerarAcaoModal } from "./GerarAcaoModal";
import type { AlertaSaude, Afastamento, BeneficioINSS } from "@/types/atestado";

interface AtestadoAlertasProps {
  alertas: AlertaSaude[];
  afastamentos: Afastamento[];
  beneficios: BeneficioINSS[];
  onResolveAlerta: (alertaId: string) => Promise<void>;
}

export function AtestadoAlertas({ 
  alertas, 
  afastamentos, 
  beneficios,
  onResolveAlerta 
}: AtestadoAlertasProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [alertaSelecionado, setAlertaSelecionado] = useState<{
    id: string; tipo: string; titulo: string; descricao: string; colaborador_nome: string;
  } | null>(null);

  const handleAbrirModal = (alerta: { id: string; tipo: string; titulo: string; descricao: string; colaborador_nome: string }) => {
    setAlertaSelecionado(alerta);
    setModalOpen(true);
  };

  // Build alerts from data
  const alertasCalculados = [
    ...afastamentos
      .filter(a => a.alerta_15_dias && a.status === 'ativo' && !a.alerta_30_dias)
      .map(a => ({
        id: `15dias-${a.id}`,
        tipo: '15_dias',
        titulo: 'Afastamento próximo de 15 dias',
        descricao: `${a.colaborador_nome} - ${a.dias_totais} dias de afastamento`,
        prioridade: 'alta' as const,
        colaborador_nome: a.colaborador_nome,
        icon: Clock,
        color: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-100 dark:bg-amber-900/30',
        canGenerateAction: false,
      })),
    
    ...afastamentos
      .filter(a => a.aso_retorno_pendente)
      .map(a => ({
        id: `aso-${a.id}`,
        tipo: 'aso_retorno',
        titulo: 'ASO de Retorno Pendente',
        descricao: `${a.colaborador_nome} - Afastamento ≥30 dias requer ASO de retorno ao trabalho`,
        prioridade: 'critica' as const,
        colaborador_nome: a.colaborador_nome,
        icon: AlertTriangle,
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        canGenerateAction: true,
      })),
    
    ...beneficios
      .filter(b => b.gera_estabilidade && b.data_fim_estabilidade && new Date(b.data_fim_estabilidade) > new Date())
      .map(b => ({
        id: `b91-${b.id}`,
        tipo: 'estabilidade',
        titulo: 'Colaborador em Estabilidade',
        descricao: `${b.colaborador_nome} - Estabilidade até ${format(parseISO(b.data_fim_estabilidade!), "dd/MM/yyyy", { locale: ptBR })}`,
        prioridade: 'alta' as const,
        colaborador_nome: b.colaborador_nome,
        icon: Shield,
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
        canGenerateAction: false,
      })),
    
    ...alertas.map(a => ({
      id: a.id,
      tipo: a.tipo,
      titulo: a.titulo,
      descricao: a.descricao || '',
      prioridade: a.prioridade,
      colaborador_nome: a.colaborador_nome,
      icon: a.tipo === 'encaminhamento_inss' ? FileWarning : Bell,
      color: a.tipo === 'encaminhamento_inss' 
        ? 'text-red-600 dark:text-red-400' 
        : 'text-blue-600 dark:text-blue-400',
      bgColor: a.tipo === 'encaminhamento_inss'
        ? 'bg-red-100 dark:bg-red-900/30'
        : 'bg-blue-100 dark:bg-blue-900/30',
      fromDb: true,
      canGenerateAction: a.tipo === 'encaminhamento_inss' && !a.acao_gerada_id,
    })),
  ];

  const prioridadeOrder = { critica: 0, alta: 1, media: 2, baixa: 3 };
  const sortedAlertas = alertasCalculados.sort((a, b) => 
    prioridadeOrder[a.prioridade] - prioridadeOrder[b.prioridade]
  );

  if (sortedAlertas.length === 0) {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
        <CardHeader className="pb-3 border-b border-emerald-500/10">
          <CardTitle className="text-base flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <Bell className="h-4 w-4" />
            Alertas de Saúde
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10">
            <div className="bg-emerald-100 dark:bg-emerald-900/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h4 className="font-semibold text-emerald-900 dark:text-emerald-100">Tudo em dia!</h4>
            <p className="text-sm text-emerald-700/70 dark:text-emerald-400/70 mt-1 max-w-[200px] mx-auto">
              Nenhum alerta crítico ou pendente no momento
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-t-4 border-t-destructive shadow-md overflow-hidden bg-card/50">
        <CardHeader className="pb-3 bg-muted/30 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-destructive animate-pulse" />
            <span className="font-bold tracking-tight">Alertas Críticos</span>
            <Badge variant="destructive" className="ml-auto rounded-full px-2 py-0 h-5 flex items-center justify-center min-w-[20px]">
              {sortedAlertas.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[300px]">
            <div className="space-y-2 p-4 pt-0">
              {sortedAlertas.map((alerta, index) => (
                <motion.div
                  key={alerta.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-3.5 rounded-xl border-l-4 transition-all hover:scale-[1.02] duration-200 shadow-sm ${alerta.bgColor} border border-transparent`}
                >
                  <div className="flex items-start gap-3">
                    <alerta.icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${alerta.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold tracking-tight">{alerta.titulo}</p>
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] ${
                            alerta.prioridade === 'critica' 
                              ? 'border-red-500 text-red-600' 
                              : alerta.prioridade === 'alta'
                              ? 'border-amber-500 text-amber-600'
                              : 'border-gray-500 text-gray-600'
                          }`}
                        >
                          {alerta.prioridade}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {alerta.descricao}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {alerta.canGenerateAction && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleAbrirModal(alerta)}
                          >
                            <Sparkles className="h-3 w-3" />
                            Criar ação
                          </Button>
                        )}
                        {'fromDb' in alerta && alerta.fromDb && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onResolveAlerta(alerta.id)}
                          >
                            Resolver
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <GerarAcaoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        alerta={alertaSelecionado}
      />
    </>
  );
}
