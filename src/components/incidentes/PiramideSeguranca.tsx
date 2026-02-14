import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EventoSST } from "@/types/eventoSST";

interface Props {
  eventos: EventoSST[];
}

export const PiramideSeguranca = ({ eventos }: Props) => {
  const incidentes = eventos.filter((e) => e.tipo === "incidente").length;
  const semAfastamento = eventos.filter(
    (e) => e.tipo === "acidente" && (!e.afastamento || e.afastamento === "sem_afastamento")
  ).length;
  const comAfastamento = eventos.filter(
    (e) =>
      e.tipo === "acidente" &&
      e.afastamento &&
      e.afastamento !== "sem_afastamento" &&
      !e.obito
  ).length;
  const obitos = eventos.filter((e) => e.tipo === "acidente" && e.obito).length;
  const total = Math.max(incidentes + semAfastamento + comAfastamento + obitos, 1);

  const layers = [
    { label: "Óbitos / Graves", value: obitos, color: "bg-destructive", textColor: "text-destructive-foreground" },
    { label: "Acidentes c/ afastamento", value: comAfastamento, color: "bg-warning", textColor: "text-warning-foreground" },
    { label: "Acidentes s/ afastamento", value: semAfastamento, color: "bg-secondary", textColor: "text-secondary-foreground" },
    { label: "Incidentes / Quase-acidentes", value: incidentes, color: "bg-success", textColor: "text-success-foreground" },
  ];

  const ratio = incidentes > 0 && (semAfastamento + comAfastamento + obitos) > 0
    ? Math.round(incidentes / (semAfastamento + comAfastamento + obitos))
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Pirâmide de Segurança</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-1 py-4">
          {layers.map((l, i) => {
            const widthPct = 30 + i * 20;
            return (
              <div
                key={l.label}
                className={`${l.color} ${l.textColor} rounded flex items-center justify-center text-xs font-medium py-3 transition-all`}
                style={{ width: `${widthPct}%` }}
              >
                <span className="text-center">
                  {l.value} — {l.label}
                </span>
              </div>
            );
          })}
        </div>
        {ratio !== null && (
          <p className="text-center text-sm text-muted-foreground mt-2">
            Relação: <strong>{ratio} incidentes</strong> para cada acidente
          </p>
        )}
      </CardContent>
    </Card>
  );
};
