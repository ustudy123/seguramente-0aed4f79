import { useState } from "react";
import { format } from "date-fns";
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
  const navigate = useNavigate();
  const { tenantId, user, profile } = useAuth();

  const handleGerarAcao = async (alerta: { tipo: string; colaborador_nome: string; descricao: string; id: string }) => {
    if (!tenantId || !user) {
      toast.error("Usuário não autenticado");
      return;
    }

    const isINSS = alerta.tipo === 'encaminhamento_inss' || alerta.tipo === 'aso_retorno';
    const titulo = alerta.tipo === 'aso_retorno'
      ? `Agendar ASO de Retorno ao Trabalho — ${alerta.colaborador_nome}`
      : alerta.tipo === 'encaminhamento_inss'
      ? `Encaminhamento ao INSS — ${alerta.colaborador_nome}`
      : `Ação de Saúde — ${alerta.colaborador_nome}`;

    const descricao = alerta.tipo === 'aso_retorno'
      ? `Agendar exame ASO de retorno ao trabalho para ${alerta.colaborador_nome}. Afastamento ≥30 dias requer exame antes do retorno às atividades (NR-7). ${alerta.descricao}`
      : `${alerta.descricao}`;

    const prazo = new Date();
    prazo.setDate(prazo.getDate() + 7);

    try {
      const { data: acao, error } = await supabase
        .from("plano_acoes")
        .insert({
          tenant_id: tenantId,
          titulo,
          descricao,
          o_que: titulo,
          por_que: alerta.tipo === 'aso_retorno'
            ? 'Exigência legal NR-7 — colaborador com afastamento ≥30 dias deve realizar ASO de retorno ao trabalho antes de reassumir atividades.'
            : 'Afastamento acumulado superior a 15 dias exige encaminhamento ao INSS para avaliação pericial.',
          onde: 'Medicina do Trabalho / Clínica Ocupacional',
          quando: prazo.toISOString().split("T")[0],
          como: alerta.tipo === 'aso_retorno'
            ? '1. Contactar clínica ocupacional\n2. Agendar ASO de retorno\n3. Encaminhar colaborador\n4. Registrar resultado no sistema'
            : '1. Orientar colaborador sobre documentação\n2. Preencher requerimento INSS\n3. Agendar perícia médica\n4. Acompanhar resultado',
          responsavel_id: user.id,
          responsavel_nome: profile?.nome_completo || 'Não definido',
          prazo: prazo.toISOString().split("T")[0],
          prioridade: 'alta',
          status: 'pendente',
          origem_modulo: 'atestados',
          origem_descricao: `Alerta: ${alerta.descricao}`,
          criado_por: user.id,
          criado_por_nome: profile?.nome_completo,
        } as never)
        .select("id")
        .single();

      if (error) throw error;

      // If it's a DB alert, mark as resolved with action linked
      if (alerta.id && !alerta.id.startsWith('aso-') && !alerta.id.startsWith('15dias-') && !alerta.id.startsWith('b91-')) {
        await supabase
          .from("alertas_saude" as never)
          .update({
            acao_gerada_id: (acao as any)?.id || null,
          } as never)
          .eq("id", alerta.id);
      }

      toast.success("Ação criada com sucesso!", {
        action: {
          label: "Ver Ação",
          onClick: () => navigate("/plano-acao"),
        },
      });
    } catch (err: any) {
      toast.error("Erro ao criar ação: " + err.message);
    }
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
        descricao: `${b.colaborador_nome} - Estabilidade até ${format(new Date(b.data_fim_estabilidade!), "dd/MM/yyyy", { locale: ptBR })}`,
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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alertas de Saúde
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum alerta pendente
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Alertas de Saúde
          <Badge variant="destructive" className="ml-auto">
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
                className={`p-3 rounded-lg border ${alerta.bgColor}`}
              >
                <div className="flex items-start gap-3">
                  <alerta.icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${alerta.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{alerta.titulo}</p>
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
                          onClick={() => handleGerarAcao(alerta)}
                        >
                          <ClipboardPlus className="h-3 w-3" />
                          Gerar Ação
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
  );
}
