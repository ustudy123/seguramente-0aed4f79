import { Users, Briefcase, CheckCircle2, Star } from "lucide-react";

interface MarketplaceStatsProps {
  totalProfissionais: number;
  totalServicos: number;
  totalContratacoes: number;
  totalConcluidas: number;
}

export function MarketplaceStats({
  totalProfissionais,
  totalServicos,
  totalContratacoes,
  totalConcluidas,
}: MarketplaceStatsProps) {
  const stats = [
    {
      label: "Profissionais Ativos",
      value: totalProfissionais,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Serviços Disponíveis",
      value: totalServicos,
      icon: Briefcase,
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      label: "Contratações Ativas",
      value: totalContratacoes,
      icon: Star,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      label: "Serviços Concluídos",
      value: totalConcluidas,
      icon: CheckCircle2,
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl bg-card border p-5 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
