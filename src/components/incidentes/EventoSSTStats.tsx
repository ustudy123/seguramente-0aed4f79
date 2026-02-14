import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Shield, FileWarning, CheckCircle, Clock, FileText } from "lucide-react";

interface Props {
  stats: {
    total: number;
    incidentes: number;
    acidentes: number;
    emAberto: number;
    comAcoes: number;
    concluidos: number;
    acidentesComAfastamento: number;
    catPendentes: number;
  };
}

export const EventoSSTStats = ({ stats }: Props) => {
  const cards = [
    { title: "Total de Eventos", value: stats.total, icon: Shield, color: "text-primary" },
    { title: "Incidentes", value: stats.incidentes, icon: AlertTriangle, color: "text-warning" },
    { title: "Acidentes", value: stats.acidentes, icon: FileWarning, color: "text-destructive" },
    { title: "Em Aberto", value: stats.emAberto, icon: Clock, color: "text-muted-foreground" },
    { title: "Com Ações", value: stats.comAcoes, icon: CheckCircle, color: "text-info" },
    { title: "CATs Pendentes", value: stats.catPendentes, icon: FileText, color: "text-destructive" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((c) => (
        <Card key={c.title}>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <c.icon className={`w-4 h-4 ${c.color}`} />
              <span className="text-xs text-muted-foreground">{c.title}</span>
            </div>
            <p className="text-2xl font-bold">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
