import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, TrendingDown } from "lucide-react";
import type { EventoSST } from "@/types/eventoSST";
import type { DesvioSeguranca } from "@/hooks/useDesviosSeguranca";
import { PyramidLevelSheet } from "./PyramidLevelSheet";
import { DesvioForm } from "./DesvioForm";
import { useDesviosSeguranca } from "@/hooks/useDesviosSeguranca";

interface Props {
  eventos: EventoSST[];
}

type Dimension = "global" | "unidade" | "setor" | "funcao" | "turno";
type LevelType = "desvio" | "incidente" | "acidente_sem" | "acidente_com" | "obito" | null;

const getDimensionValue = (e: EventoSST, dim: Dimension): string => {
  switch (dim) {
    case "unidade": return e.unidade || "Não informado";
    case "setor": return e.setor || "Não informado";
    case "funcao": return e.colaborador_funcao || "Não informado";
    case "turno": return e.turno || "Não informado";
    default: return "Global";
  }
};

const calcPyramid = (items: EventoSST[], desvios: DesvioSeguranca[]) => {
  const totalDesvios = desvios.filter((d) => d.status !== "cancelado").length;
  const incidentes = items.filter((e) => e.tipo === "incidente").length;
  const semAfastamento = items.filter(
    (e) => e.tipo === "acidente" && (!e.afastamento || e.afastamento === "sem_afastamento") && !e.obito
  ).length;
  const comAfastamento = items.filter(
    (e) => e.tipo === "acidente" && e.afastamento && e.afastamento !== "sem_afastamento" && !e.obito
  ).length;
  const obitos = items.filter((e) => e.tipo === "acidente" && e.obito).length;
  const totalAcidentes = semAfastamento + comAfastamento + obitos;
  const ratio = incidentes > 0 && totalAcidentes > 0 ? Math.round(incidentes / totalAcidentes) : null;
  return { totalDesvios, incidentes, semAfastamento, comAfastamento, obitos, ratio };
};

export const PiramideSeguranca = ({ eventos }: Props) => {
  const [dimension, setDimension] = useState<Dimension>("global");
  const [selectedValue, setSelectedValue] = useState<string>("todos");
  const [sheetLevel, setSheetLevel] = useState<LevelType>(null);
  const [showDesvioForm, setShowDesvioForm] = useState(false);

  const { desvios, createDesvio, updateDesvio } = useDesviosSeguranca();

  const uniqueValues = dimension === "global"
    ? ["Global"]
    : [...new Set(eventos.map((e) => getDimensionValue(e, dimension)))].sort();

  const filteredEventos = dimension === "global" || selectedValue === "todos"
    ? eventos
    : eventos.filter((e) => getDimensionValue(e, dimension) === selectedValue);

  const { totalDesvios, incidentes, semAfastamento, comAfastamento, obitos, ratio } =
    calcPyramid(filteredEventos, desvios);

  const layers: { label: string; value: number; level: LevelType; bg: string; text: string; width: number }[] = [
    { label: "Óbitos / Graves",            value: obitos,          level: "obito",        bg: "bg-destructive",     text: "text-destructive-foreground", width: 30 },
    { label: "Acidentes c/ afastamento",   value: comAfastamento,  level: "acidente_com", bg: "bg-warning",         text: "text-warning-foreground",     width: 46 },
    { label: "Acidentes s/ afastamento",   value: semAfastamento,  level: "acidente_sem", bg: "bg-secondary",       text: "text-secondary-foreground",   width: 62 },
    { label: "Incidentes / Quase-acid.",   value: incidentes,      level: "incidente",    bg: "bg-success",         text: "text-success-foreground",     width: 78 },
    { label: "Desvios de Segurança",       value: totalDesvios,    level: "desvio",       bg: "bg-primary",         text: "text-primary-foreground",     width: 94 },
  ];

  const handleUpdateDesvio = async (id: string, payload: Partial<DesvioSeguranca>) => {
    await updateDesvio.mutateAsync({ id, ...payload });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm">Pirâmide de Segurança — Bird</CardTitle>
            <div className="flex gap-2 items-center flex-wrap">
              <Select value={dimension} onValueChange={(v) => { setDimension(v as Dimension); setSelectedValue("todos"); }}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="unidade">Unidade</SelectItem>
                  <SelectItem value="setor">Setor</SelectItem>
                  <SelectItem value="funcao">Cargo</SelectItem>
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
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowDesvioForm(true)}>
                <Plus className="w-3 h-3 mr-1" /> Desvio
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Pirâmide */}
          <div className="flex flex-col items-center gap-1.5 py-4">
            {layers.map((l) => (
              <button
                key={l.label}
                type="button"
                onClick={() => setSheetLevel(l.level)}
                className={`${l.bg} ${l.text} rounded-sm flex items-center justify-center text-xs font-semibold py-3 transition-all hover:opacity-80 hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-sm`}
                style={{ width: `${l.width}%` }}
                title={`Ver ${l.label}`}
              >
                <span className="text-center select-none">
                  {l.value} — {l.label}
                </span>
              </button>
            ))}
          </div>

          {/* Indicadores abaixo */}
          <div className="grid grid-cols-3 gap-3 mt-3 text-center">
            <div className="rounded-lg bg-muted/50 p-2">
              <p className="text-lg font-bold text-primary">{totalDesvios}</p>
              <p className="text-xs text-muted-foreground">Desvios registrados</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2">
              <p className="text-lg font-bold">{desvios.filter((d) => d.status === "resolvido").length}</p>
              <p className="text-xs text-muted-foreground">Desvios resolvidos</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2">
              <p className="text-lg font-bold text-destructive">{desvios.filter((d) => d.potencial_risco === "critico" && d.status === "aberto").length}</p>
              <p className="text-xs text-muted-foreground">Críticos abertos</p>
            </div>
          </div>

          {ratio !== null && (
            <p className="text-center text-sm text-muted-foreground mt-3">
              Relação: <strong>{ratio} incidentes</strong> para cada acidente
            </p>
          )}

          <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-muted/40 border text-xs text-muted-foreground italic">
            <TrendingDown className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
            "Cada desvio registrado é uma chance de evitar o próximo incidente — e cada incidente, uma chance de evitar o próximo acidente."
          </div>
        </CardContent>
      </Card>

      {/* Sheet lateral por nível */}
      <PyramidLevelSheet
        open={sheetLevel !== null}
        onOpenChange={(v) => !v && setSheetLevel(null)}
        level={sheetLevel}
        desvios={desvios}
        eventos={filteredEventos}
        onNewDesvio={() => { setSheetLevel(null); setShowDesvioForm(true); }}
        onUpdateDesvio={handleUpdateDesvio}
      />

      {/* Form de registro de desvio */}
      <DesvioForm
        open={showDesvioForm}
        onOpenChange={setShowDesvioForm}
        onSubmit={async (data) => { await createDesvio.mutateAsync(data); }}
        isPending={createDesvio.isPending}
      />
    </>
  );
};
