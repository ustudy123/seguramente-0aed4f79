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
      title: "Total de Atestados",
      value: stats.totalAtestados,
      subtitle: `${stats.atestadosAssistenciais} assistenciais · ${stats.atestadosOcupacionais} ocupacionais`,
      icon: FileText,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      title: "Afastamentos Ativos",
      value: stats.afastamentosAtivos,
      subtitle: `${stats.totalDiasAfastamento} dias no período`,
      icon: Calendar,
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
    },
    {
      title: "Alertas Pendentes",
      value: stats.alertasPendentes,
      subtitle: stats.afastamentos15Dias > 0 
        ? `${stats.afastamentos15Dias} próximos de 15 dias`
        : "Nenhum alerta crítico",
      icon: AlertTriangle,
      color: stats.alertasPendentes > 0 
        ? "text-red-600 dark:text-red-400" 
        : "text-green-600 dark:text-green-400",
      bgColor: stats.alertasPendentes > 0 
        ? "bg-red-100 dark:bg-red-900/30" 
        : "bg-green-100 dark:bg-green-900/30",
    },
    {
      title: "Saúde Mental",
      value: stats.saudeMental,
      subtitle: "Atestados com CID mental",
      icon: Brain,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
    },
    {
      title: "Benefícios INSS",
      value: stats.beneficiosAtivos,
      subtitle: `${stats.colaboradoresEstabilidade} em estabilidade`,
      icon: Shield,
      color: "text-teal-600 dark:text-teal-400",
      bgColor: "bg-teal-100 dark:bg-teal-900/30",
    },
    {
      title: "ASO Retorno Pendente",
      value: stats.asoRetornoPendente,
      subtitle: "Afastamentos ≥30 dias sem ASO",
      icon: Clock,
      color: stats.asoRetornoPendente > 0 
        ? "text-amber-600 dark:text-amber-400"
        : "text-gray-600 dark:text-gray-400",
      bgColor: stats.asoRetornoPendente > 0 
        ? "bg-amber-100 dark:bg-amber-900/30"
        : "bg-gray-100 dark:bg-gray-900/30",
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
