import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Clock,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  PieChart,
  Activity,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { FeriasSolicitacao } from "@/hooks/useFerias";
import { calcularPeriodoFerias } from "@/lib/feriasPeriodo";

interface FeriasRelatoriosProps {
  solicitacoes: FeriasSolicitacao[];
  colaboradores: any[];
}

export function FeriasRelatorios({ solicitacoes, colaboradores }: FeriasRelatoriosProps) {
  // 1. Relatório de Tempo: planejado vs real
  const tempoReport = useMemo(() => {
    const concluidas = solicitacoes.filter((s) => s.status === "concluido");
    const totalDias = concluidas.reduce((s, f) => s + f.dias_solicitados, 0);
    const mediaHist = concluidas.length > 0 ? Math.round(totalDias / concluidas.length) : 0;
    return { concluidas: concluidas.length, totalDias, mediaHist };
  }, [solicitacoes]);

  // 2. Férias por tipo de ação
  const tipoReport = useMemo(() => {
    const preventivas = solicitacoes.filter((s) => s.acao_preventiva);
    const regulares = solicitacoes.filter((s) => !s.acao_preventiva);
    return {
      preventivas: preventivas.length,
      regulares: regulares.length,
      pctPreventivas: solicitacoes.length > 0 ? Math.round((preventivas.length / solicitacoes.length) * 100) : 0,
    };
  }, [solicitacoes]);

  // 3. Sobrecarga: férias vencidas vs concedidas
  const sobrecargaReport = useMemo(() => {
    let vencidas = 0;
    let alerta = 0;
    let ok = 0;
    colaboradores.forEach((c) => {
      const diasUsados = solicitacoes
        .filter((f) => f.colaborador_nome === c.nome_completo && ["aprovado", "em_gozo", "concluido"].includes(f.status))
        .reduce((sum, f) => sum + f.dias_solicitados, 0);
      const periodo = calcularPeriodoFerias(c.data_admissao || null, diasUsados);
      if (periodo?.statusVencimento === "vencido") vencidas++;
      else if (periodo?.statusVencimento === "alerta") alerta++;
      else ok++;
    });
    return { vencidas, alerta, ok, total: colaboradores.length };
  }, [colaboradores, solicitacoes]);

  // 4. Efetividade
  const efetividadeReport = useMemo(() => {
    const total = solicitacoes.length;
    const concluidas = solicitacoes.filter((s) => s.status === "concluido").length;
    const recusadas = solicitacoes.filter((s) => s.status === "recusado").length;
    const canceladas = solicitacoes.filter((s) => s.status === "cancelado").length;
    return { total, concluidas, recusadas, canceladas, taxa: total > 0 ? Math.round((concluidas / total) * 100) : 0 };
  }, [solicitacoes]);

  // 5. Risco por setor
  const setorReport = useMemo(() => {
    const map: Record<string, { total: number; vencidos: number; dias: number; custo: number }> = {};
    colaboradores.forEach((c) => {
      const dept = c.departamento || "Sem Departamento";
      if (!map[dept]) map[dept] = { total: 0, vencidos: 0, dias: 0, custo: 0 };
      map[dept].total++;
      const feriasColab = solicitacoes.filter((f) => f.colaborador_nome === c.nome_completo);
      const diasUsados = feriasColab.filter((f) => ["aprovado", "em_gozo", "concluido"].includes(f.status)).reduce((s, f) => s + f.dias_solicitados, 0);
      map[dept].dias += diasUsados;
      map[dept].custo += feriasColab.reduce((s, f) => s + (f.valor_total_bruto || 0), 0);
      const periodo = calcularPeriodoFerias(c.data_admissao || null, diasUsados);
      if (periodo?.statusVencimento === "vencido") map[dept].vencidos++;
    });
    return Object.entries(map).sort((a, b) => b[1].vencidos - a[1].vencidos);
  }, [colaboradores, solicitacoes]);

  // 6. INR correlação
  const inrReport = useMemo(() => {
    const comINR = solicitacoes.filter((s) => s.inr_score_momento != null);
    const mediaINR = comINR.length > 0 ? Math.round(comINR.reduce((s, f) => s + (f.inr_score_momento || 0), 0) / comINR.length) : 0;
    const criticos = comINR.filter((s) => s.inr_nivel_momento === "critico").length;
    return { total: comINR.length, mediaINR, criticos };
  }, [solicitacoes]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <BarChart3 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Relatórios Estratégicos de Férias</h2>
          <p className="text-xs text-muted-foreground">Dados para decisão inteligente — tempo, custo, risco e impacto</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Efetividade */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Efetividade das Férias</h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-foreground">{efetividadeReport.taxa}%</span>
            <span className="text-xs text-muted-foreground mb-1">taxa de conclusão</span>
          </div>
          <Progress value={efetividadeReport.taxa} className="h-2" />
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="bg-success/5 rounded-lg p-2">
              <p className="font-bold text-success">{efetividadeReport.concluidas}</p>
              <p className="text-muted-foreground">Concluídas</p>
            </div>
            <div className="bg-destructive/5 rounded-lg p-2">
              <p className="font-bold text-destructive">{efetividadeReport.recusadas}</p>
              <p className="text-muted-foreground">Recusadas</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="font-bold text-foreground">{efetividadeReport.canceladas}</p>
              <p className="text-muted-foreground">Canceladas</p>
            </div>
          </div>
        </div>

        {/* Card 2: Tempo */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Tempo de Execução</h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-foreground">{tempoReport.mediaHist}</span>
            <span className="text-xs text-muted-foreground mb-1">dias / férias (média)</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
            <div className="bg-primary/5 rounded-lg p-2">
              <p className="font-bold text-foreground">{tempoReport.concluidas}</p>
              <p className="text-muted-foreground">Ciclos concluídos</p>
            </div>
            <div className="bg-primary/5 rounded-lg p-2">
              <p className="font-bold text-foreground">{tempoReport.totalDias}</p>
              <p className="text-muted-foreground">Total de dias</p>
            </div>
          </div>
        </div>

        {/* Card 3: Sobrecarga */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <h3 className="font-semibold text-sm">Sobrecarga Oculta</h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-foreground">{sobrecargaReport.vencidas}</span>
            <span className="text-xs text-destructive mb-1">férias vencidas</span>
          </div>
          {sobrecargaReport.total > 0 && (
            <Progress
              value={((sobrecargaReport.ok) / sobrecargaReport.total) * 100}
              className="h-2"
            />
          )}
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="bg-destructive/5 rounded-lg p-2">
              <p className="font-bold text-destructive">{sobrecargaReport.vencidas}</p>
              <p className="text-muted-foreground">Vencidas</p>
            </div>
            <div className="bg-warning/5 rounded-lg p-2">
              <p className="font-bold text-warning">{sobrecargaReport.alerta}</p>
              <p className="text-muted-foreground">Alerta</p>
            </div>
            <div className="bg-success/5 rounded-lg p-2">
              <p className="font-bold text-success">{sobrecargaReport.ok}</p>
              <p className="text-muted-foreground">OK</p>
            </div>
          </div>
          {sobrecargaReport.vencidas > 0 && (
            <p className="text-[10px] text-destructive/80">
              ⚠ Férias vencidas geram multa de pagamento em dobro (Art. 137, CLT)
            </p>
          )}
        </div>

        {/* Card 4: Ação Preventiva vs Regular */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-success" />
            <h3 className="font-semibold text-sm">Férias Preventivas vs Regulares</h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-foreground">{tipoReport.pctPreventivas}%</span>
            <span className="text-xs text-muted-foreground mb-1">preventivas</span>
          </div>
          <Progress value={tipoReport.pctPreventivas} className="h-2" />
          <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
            <div className="bg-success/5 rounded-lg p-2">
              <p className="font-bold text-success">{tipoReport.preventivas}</p>
              <p className="text-muted-foreground">Preventivas</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="font-bold text-foreground">{tipoReport.regulares}</p>
              <p className="text-muted-foreground">Regulares</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Férias preventivas são geradas pelo INR™ como ação de recuperação
          </p>
        </div>

        {/* Card 5: Risco por Setor */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Risco por Setor</h3>
          </div>
          <div className="divide-y divide-border max-h-[200px] overflow-y-auto">
            {setorReport.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Sem dados</p>
            ) : (
              setorReport.slice(0, 6).map(([setor, data]) => (
                <div key={setor} className="py-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-foreground">{setor}</p>
                    <p className="text-[10px] text-muted-foreground">{data.total} colabs · {data.dias}d concedidos</p>
                  </div>
                  {data.vencidos > 0 ? (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">
                      {data.vencidos} vencido(s)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px]">OK</Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Card 6: Correlação INR™ */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Correlação INR™ × Férias</h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-foreground">{inrReport.mediaINR}</span>
            <span className="text-xs text-muted-foreground mb-1">INR médio ao solicitar</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
            <div className="bg-primary/5 rounded-lg p-2">
              <p className="font-bold text-foreground">{inrReport.total}</p>
              <p className="text-muted-foreground">Com INR registrado</p>
            </div>
            <div className="bg-destructive/5 rounded-lg p-2">
              <p className="font-bold text-destructive">{inrReport.criticos}</p>
              <p className="text-muted-foreground">INR crítico</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            O INR™ é capturado no momento da solicitação para análise histórica
          </p>
        </div>
      </div>
    </motion.div>
  );
}
