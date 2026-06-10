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
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Afastamentos Ativos",
      value: stats.afastamentosAtivos,
      subtitle: `${stats.totalDiasAfastamento} dias no período`,
      icon: Calendar,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Alertas Pendentes",
      value: stats.alertasPendentes,
      subtitle: stats.afastamentos15Dias > 0 
        ? `${stats.afastamentos15Dias} próximos de 15 dias`
        : "Nenhum alerta crítico",
      icon: AlertTriangle,
      color: stats.alertasPendentes > 0 
        ? "text-destructive" 
        : "text-success",
      bgColor: stats.alertasPendentes > 0 
        ? "bg-destructive/10" 
        : "bg-success/10",
    },
    {
      title: "Saúde Mental",
      value: stats.saudeMental,
      subtitle: "Registros com CID mental",
      icon: Brain,
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      title: "Benefícios INSS",
      value: stats.beneficiosAtivos,
      subtitle: `${stats.colaboradoresEstabilidade} em estabilidade`,
      icon: Shield,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "ASO Retorno Pendente",
      value: stats.asoRetornoPendente,
      subtitle: "Afastamentos ≥30 dias sem ASO",
      icon: Clock,
      color: stats.asoRetornoPendente > 0 
        ? "text-warning"
        : "text-muted-foreground",
      bgColor: stats.asoRetornoPendente > 0 
        ? "bg-warning/10"
        : "bg-muted",
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
          <Card className="h-full">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{stat.title}</p>
                  <p className="text-xl md:text-2xl font-bold mt-1">{stat.value}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-1 truncate">
                    {stat.subtitle}
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${stat.bgColor} flex-shrink-0`}>
                  <stat.icon className={`h-4 w-4 md:h-5 md:w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
