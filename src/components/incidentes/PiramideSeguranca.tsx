import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EventoSST } from "@/types/eventoSST";

interface Props {
  eventos: EventoSST[];
}

type Dimension = "global" | "unidade" | "setor" | "funcao" | "turno";

const getDimensionValue = (e: EventoSST, dim: Dimension): string => {
  switch (dim) {
    case "unidade": return e.unidade || "Não informado";
    case "setor": return e.setor || "Não informado";
    case "funcao": return e.colaborador_funcao || "Não informado";
    case "turno": return e.turno || "Não informado";
    default: return "Global";
  }
};

const calcPyramid = (items: EventoSST[]) => {
  const incidentes = items.filter((e) => e.tipo === "incidente").length;
  const semAfastamento = items.filter(
    (e) => e.tipo === "acidente" && (!e.afastamento || e.afastamento === "sem_afastamento")
  ).length;
  const comAfastamento = items.filter(
    (e) => e.tipo === "acidente" && e.afastamento && e.afastamento !== "sem_afastamento" && !e.obito
  ).length;
  const obitos = items.filter((e) => e.tipo === "acidente" && e.obito).length;
  const totalAcidentes = semAfastamento + comAfastamento + obitos;
  const ratio = incidentes > 0 && totalAcidentes > 0 ? Math.round(incidentes / totalAcidentes) : null;
  return { incidentes, semAfastamento, comAfastamento, obitos, ratio };
};

export const PiramideSeguranca = ({ eventos }: Props) => {
  const [dimension, setDimension] = useState<Dimension>("global");
  const [selectedValue, setSelectedValue] = useState<string>("todos");

  // Get unique values for dimension
  const uniqueValues = dimension === "global"
    ? ["Global"]
    : [...new Set(eventos.map((e) => getDimensionValue(e, dimension)))].sort();

  const filteredEventos = dimension === "global" || selectedValue === "todos"
    ? eventos
    : eventos.filter((e) => getDimensionValue(e, dimension) === selectedValue);

  const { incidentes, semAfastamento, comAfastamento, obitos, ratio } = calcPyramid(filteredEventos);

  const layers = [
    { label: "Óbitos / Graves", value: obitos, color: "bg-destructive", textColor: "text-destructive-foreground" },
    { label: "Acidentes c/ afastamento", value: comAfastamento, color: "bg-warning", textColor: "text-warning-foreground" },
    { label: "Acidentes s/ afastamento", value: semAfastamento, color: "bg-secondary", textColor: "text-secondary-foreground" },
    { label: "Incidentes / Quase-acidentes", value: incidentes, color: "bg-success", textColor: "text-success-foreground" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Pirâmide de Segurança</CardTitle>
          <div className="flex gap-2">
            <Select value={dimension} onValueChange={(v) => { setDimension(v as Dimension); setSelectedValue("todos"); }}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="unidade">Unidade</SelectItem>
                <SelectItem value="setor">Setor</SelectItem>
                <SelectItem value="funcao">Função</SelectItem>
                <SelectItem value="turno">Turno</SelectItem>
              </SelectContent>
            </Select>
            {dimension !== "global" && (
              <Select value={selectedValue} onValueChange={setSelectedValue}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {uniqueValues.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
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
        <p className="text-center text-xs text-muted-foreground mt-4 italic">
          "Cada incidente registrado é uma oportunidade de evitar o próximo acidente – e cada acidente é tratado com rastreabilidade completa, da investigação interna à CAT anexada."
        </p>
      </CardContent>
    </Card>
  );
};
