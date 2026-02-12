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
      gradient: "from-indigo-500 to-violet-600",
      shadow: "shadow-indigo-500/20",
    },
    {
      label: "Serviços Disponíveis",
      value: totalServicos,
      icon: Briefcase,
      gradient: "from-cyan-500 to-blue-600",
      shadow: "shadow-cyan-500/20",
    },
    {
      label: "Contratações Ativas",
      value: totalContratacoes,
      icon: Star,
      gradient: "from-amber-500 to-orange-600",
      shadow: "shadow-amber-500/20",
    },
    {
      label: "Serviços Concluídos",
      value: totalConcluidas,
      icon: CheckCircle2,
      gradient: "from-emerald-500 to-green-600",
      shadow: "shadow-emerald-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${stat.gradient} p-5 text-white shadow-lg ${stat.shadow}`}
        >
          <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />
          <div className="relative z-10">
            <stat.icon className="h-6 w-6 mb-2 opacity-80" />
            <p className="text-3xl font-bold">{stat.value}</p>
            <p className="text-sm opacity-80 mt-1">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
