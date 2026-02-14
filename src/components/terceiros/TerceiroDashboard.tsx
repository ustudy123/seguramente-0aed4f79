import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import type { Terceiro } from "@/types/terceiros";

interface Props {
  terceiros: Terceiro[];
}

export function TerceiroDashboard({ terceiros }: Props) {
  const ativos = terceiros.length;
  const liberados = terceiros.filter((t) => t.status === "liberado").length;
  const restritos = terceiros.filter((t) => t.status === "restrito").length;
  const bloqueados = terceiros.filter((t) => t.status === "bloqueado").length;
  const comRisco = terceiros.filter((t) => t.atividade_risco).length;

  const pctConforme = ativos > 0 ? Math.round((liberados / ativos) * 100) : 0;

  const stats = [
    { label: "Terceiros Ativos", value: ativos, icon: Building2, color: "text-primary" },
    { label: "Conformes", value: `${pctConforme}%`, icon: CheckCircle, color: "text-green-600" },
    { label: "Com Restrição", value: restritos, icon: Clock, color: "text-yellow-600" },
    { label: "Bloqueados", value: bloqueados, icon: XCircle, color: "text-destructive" },
    { label: "Atividade de Risco", value: comRisco, icon: AlertTriangle, color: "text-orange-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
