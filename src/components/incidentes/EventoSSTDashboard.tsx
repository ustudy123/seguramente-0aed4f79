import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EventoSST } from "@/types/eventoSST";
import { FATORES_ERGONOMICOS } from "@/types/eventoSST";

interface Props {
  eventos: EventoSST[];
}

export const EventoSSTDashboard = ({ eventos }: Props) => {
  // Top sectors by incidents
  const setorCounts: Record<string, { incidentes: number; acidentes: number }> = {};
  eventos.forEach((e) => {
    const key = e.setor || "Não informado";
    if (!setorCounts[key]) setorCounts[key] = { incidentes: 0, acidentes: 0 };
    if (e.tipo === "incidente") setorCounts[key].incidentes++;
    else setorCounts[key].acidentes++;
  });
  const topSetores = Object.entries(setorCounts)
    .sort((a, b) => (b[1].incidentes + b[1].acidentes) - (a[1].incidentes + a[1].acidentes))
    .slice(0, 5);

  // Top categories
  const catCounts: Record<string, number> = {};
  eventos.forEach((e) => {
    if (e.categoria_principal) {
      catCounts[e.categoria_principal] = (catCounts[e.categoria_principal] || 0) + 1;
    }
  });
  const topCats = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Top ergonomic factors
  const fatorCounts: Record<string, number> = {};
  eventos.forEach((e) => {
    (e.fatores_ergonomicos || []).forEach((f) => {
      fatorCounts[f] = (fatorCounts[f] || 0) + 1;
    });
  });
  const topFatores = Object.entries(fatorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Turno analysis
  const turnoCounts: Record<string, number> = {};
  eventos.forEach((e) => {
    if (e.turno) turnoCounts[e.turno] = (turnoCounts[e.turno] || 0) + 1;
  });

  // Alerts
  const alerts: string[] = [];
  // Check subnotification
  Object.entries(setorCounts).forEach(([setor, counts]) => {
    if (counts.acidentes > 0 && counts.incidentes < counts.acidentes) {
      alerts.push(`Setor "${setor}" teve ${counts.acidentes} acidentes mas apenas ${counts.incidentes} incidentes. Possível subnotificação.`);
    }
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Setores */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Setores com Maior Concentração</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {topSetores.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados</p>
          ) : (
            topSetores.map(([setor, counts]) => (
              <div key={setor} className="flex items-center justify-between text-sm">
                <span>{setor}</span>
                <div className="flex gap-2">
                  <Badge variant="secondary">{counts.incidentes} inc.</Badge>
                  <Badge variant="destructive">{counts.acidentes} acid.</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Tipos Mais Recorrentes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {topCats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados</p>
          ) : (
            topCats.map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between text-sm">
                <span className="truncate flex-1">{cat}</span>
                <Badge variant="outline">{count}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Turno */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Distribuição por Turno</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {Object.keys(turnoCounts).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados</p>
          ) : (
            Object.entries(turnoCounts).map(([turno, count]) => (
              <div key={turno} className="flex items-center justify-between text-sm">
                <span>{turno}</span>
                <Badge variant="outline">{count}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Fatores */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Fatores Ergonômicos Mais Frequentes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {topFatores.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados</p>
          ) : (
            topFatores.map(([fator, count]) => (
              <div key={fator} className="flex items-center justify-between text-sm">
                <span className="truncate flex-1 mr-2">{fator}</span>
                <Badge variant="outline">{count}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="md:col-span-2 border-warning">
          <CardHeader><CardTitle className="text-sm text-warning">⚠️ Alertas e Insights</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a, i) => (
              <p key={i} className="text-sm">{a}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
