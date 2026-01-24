import { motion } from "framer-motion";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  MinusCircle,
  Activity,
  AlertOctagon,
  ClipboardList
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  MATURIDADE_LABELS, 
  MATURIDADE_COLORS,
  type ErgonomiaMaturidade 
} from "@/types/ergonomia";

interface ErgonomiaStatsProps {
  estatisticas: {
    total: number;
    atendidos: number;
    parciais: number;
    naoAtendidos: number;
    naoAplicaveis: number;
    riscosCriticos: number;
    riscosAltos: number;
    acoesPendentes: number;
    acoesEmAndamento: number;
  };
  percentualConformidade: number;
  nivelMaturidade: ErgonomiaMaturidade['nivel'];
}

export function ErgonomiaStats({ 
  estatisticas, 
  percentualConformidade, 
  nivelMaturidade 
}: ErgonomiaStatsProps) {
  const stats = [
    {
      label: "Atendidos",
      value: estatisticas.atendidos,
      icon: CheckCircle2,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      label: "Parciais",
      value: estatisticas.parciais,
      icon: AlertTriangle,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      label: "Não Atendidos",
      value: estatisticas.naoAtendidos,
      icon: XCircle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
    {
      label: "Não Aplicáveis",
      value: estatisticas.naoAplicaveis,
      icon: MinusCircle,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
    },
  ];

  const alertStats = [
    {
      label: "Riscos Críticos",
      value: estatisticas.riscosCriticos,
      icon: AlertOctagon,
      color: "text-destructive",
    },
    {
      label: "Riscos Altos",
      value: estatisticas.riscosAltos,
      icon: AlertTriangle,
      color: "text-orange-500",
    },
    {
      label: "Ações Pendentes",
      value: estatisticas.acoesPendentes,
      icon: ClipboardList,
      color: "text-warning",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Conformidade Geral */}
      <Card className="border-border/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Conformidade NR-17</h3>
              <p className="text-sm text-muted-foreground">
                Status geral de atendimento aos requisitos normativos
              </p>
            </div>
            <div className="text-right">
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-4xl font-bold text-primary"
              >
                {percentualConformidade}%
              </motion.span>
            </div>
          </div>
          
          <Progress 
            value={percentualConformidade} 
            className="h-3 mb-4"
          />

          <div className="flex items-center gap-2 mt-4">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Nível de Maturidade:</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MATURIDADE_COLORS[nivelMaturidade]}`}>
              {MATURIDADE_LABELS[nivelMaturidade]}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Grid de Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="border-border/50 hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Alertas */}
      {(estatisticas.riscosCriticos > 0 || estatisticas.riscosAltos > 0 || estatisticas.acoesPendentes > 0) && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-6 flex-wrap">
              {alertStats.map((alert) => (
                alert.value > 0 && (
                  <div key={alert.label} className="flex items-center gap-2">
                    <alert.icon className={`h-4 w-4 ${alert.color}`} />
                    <span className="text-sm font-medium">{alert.value}</span>
                    <span className="text-sm text-muted-foreground">{alert.label}</span>
                  </div>
                )
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
