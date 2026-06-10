import { motion } from "framer-motion";
import { 
  FileText, 
  Calendar, 
  AlertTriangle, 
  Heart, 
  Brain, 
  Clock,
  Shield,
  Users
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AtestadoStatsProps {
  stats: {
    totalAtestados: number;
    atestadosAssistenciais: number;
    atestadosOcupacionais: number;
    afastamentosAtivos: number;
    afastamentos15Dias: number;
    afastamentos30Dias: number;
    asoRetornoPendente: number;
    beneficiosAtivos: number;
    colaboradoresEstabilidade: number;
    alertasPendentes: number;
    saudeMental: number;
    totalDiasAfastamento: number;
  };
}

export function AtestadoStats({ stats }: AtestadoStatsProps) {
  const statCards = [
    {
      title: "Total de Registros",
      value: stats.totalAtestados,
      subtitle: "Afastamentos, Licenças e Ocupacionais",
      icon: FileText,
      gradient: "from-blue-500/10 via-blue-500/5 to-transparent",
      borderColor: "border-blue-500/20",
      iconColor: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      title: "Afastamentos Ativos",
      value: stats.afastamentosAtivos,
      subtitle: `${stats.totalDiasAfastamento} dias no período`,
      icon: Calendar,
      gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
      borderColor: "border-amber-500/20",
      iconColor: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
    },
    {
      title: "Alertas Pendentes",
      value: stats.alertasPendentes,
      subtitle: stats.afastamentos15Dias > 0 
        ? `${stats.afastamentos15Dias} próximos de 15 dias`
        : "Nenhum alerta crítico",
      icon: AlertTriangle,
      gradient: stats.alertasPendentes > 0 
        ? "from-red-500/10 via-red-500/5 to-transparent" 
        : "from-emerald-500/10 via-emerald-500/5 to-transparent",
      borderColor: stats.alertasPendentes > 0 
        ? "border-red-500/20" 
        : "border-emerald-500/20",
      iconColor: stats.alertasPendentes > 0 
        ? "text-red-600 dark:text-red-400" 
        : "text-emerald-600 dark:text-emerald-400",
      iconBg: stats.alertasPendentes > 0 
        ? "bg-red-100 dark:bg-red-900/30" 
        : "bg-emerald-100 dark:bg-emerald-900/30",
    },
    {
      title: "Saúde Mental",
      value: stats.saudeMental,
      subtitle: "Registros com CID mental",
      icon: Brain,
      gradient: "from-purple-500/10 via-purple-500/5 to-transparent",
      borderColor: "border-purple-500/20",
      iconColor: "text-purple-600 dark:text-purple-400",
      iconBg: "bg-purple-100 dark:bg-purple-900/30",
    },
    {
      title: "Benefícios INSS",
      value: stats.beneficiosAtivos,
      subtitle: `${stats.colaboradoresEstabilidade} em estabilidade`,
      icon: Shield,
      gradient: "from-indigo-500/10 via-indigo-500/5 to-transparent",
      borderColor: "border-indigo-500/20",
      iconColor: "text-indigo-600 dark:text-indigo-400",
      iconBg: "bg-indigo-100 dark:bg-indigo-900/30",
    },
    {
      title: "ASO Retorno Pendente",
      value: stats.asoRetornoPendente,
      subtitle: "Afastamentos ≥30 dias sem ASO",
      icon: Clock,
      gradient: stats.asoRetornoPendente > 0 
        ? "from-orange-500/10 via-orange-500/5 to-transparent"
        : "from-slate-500/10 via-slate-500/5 to-transparent",
      borderColor: stats.asoRetornoPendente > 0 
        ? "border-orange-500/20"
        : "border-slate-500/20",
      iconColor: stats.asoRetornoPendente > 0 
        ? "text-orange-600 dark:text-orange-400"
        : "text-slate-500 dark:text-slate-400",
      iconBg: stats.asoRetornoPendente > 0 
        ? "bg-orange-100 dark:bg-orange-900/30"
        : "bg-slate-100 dark:bg-slate-800/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
      {statCards.map((stat, index) => (
        <motion.div
          key={stat.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <Card className={cn(
            "h-full overflow-hidden border transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
            stat.borderColor,
            "bg-card shadow-sm"
          )}>
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", stat.gradient)} />
            <CardContent className="p-3 md:p-4 relative">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/80 truncate mb-1">
                    {stat.title}
                  </p>
                  <p className="text-xl md:text-3xl font-bold tracking-tight text-foreground">
                    {stat.value}
                  </p>
                  <p className="text-[10px] md:text-xs font-medium text-muted-foreground mt-2 truncate leading-tight">
                    {stat.subtitle}
                  </p>
                </div>
                <div className={cn(
                  "p-2.5 rounded-xl flex-shrink-0 shadow-sm transition-transform group-hover:scale-110 duration-300",
                  stat.iconBg
                )}>
                  <stat.icon className={cn("h-4 w-4 md:h-6 md:w-6", stat.iconColor)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
