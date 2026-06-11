import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertTriangle, ChevronRight, ArrowUpRight, Clock, MapPin, User } from "lucide-react";
import type { DesvioSeguranca } from "@/hooks/useDesviosSeguranca";
import type { EventoSST } from "@/types/eventoSST";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatDateBR } from "@/lib/dataLocal";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  level: "desvio" | "incidente" | "acidente_sem" | "acidente_com" | "obito" | null;
  desvios: DesvioSeguranca[];
  eventos: EventoSST[];
  onNewDesvio?: () => void;
  onUpdateDesvio?: (id: string, payload: Partial<DesvioSeguranca>) => void;
}

const RISK_BADGE: Record<string, string> = {
  baixo: "bg-blue-100 text-blue-700 border-blue-300",
  medio: "bg-yellow-100 text-yellow-700 border-yellow-300",
  alto: "bg-orange-100 text-orange-700 border-orange-300",
  critico: "bg-destructive/10 text-destructive border-destructive/30",
};

const STATUS_BADGE: Record<string, string> = {
  aberto: "bg-muted text-muted-foreground",
  em_tratamento: "bg-blue-100 text-blue-700",
  resolvido: "bg-green-100 text-green-700",
  convertido_incidente: "bg-orange-100 text-orange-700",
  cancelado: "bg-muted text-muted-foreground line-through",
};

const TIPO_LABEL: Record<string, string> = {
  condicao_insegura: "⚠️ Condição Insegura",
  ato_inseguro: "🚶 Ato Inseguro",
  desvio_processo: "📋 Desvio de Processo",
};

const LEVEL_TITLES: Record<string, string> = {
  desvio: "🔵 Desvios de Segurança",
  incidente: "🟢 Incidentes / Quase-acidentes",
  acidente_sem: "🟡 Acidentes sem Afastamento",
  acidente_com: "🟠 Acidentes com Afastamento",
  obito: "🔴 Óbitos / Acidentes Graves",
};

export const PyramidLevelSheet = ({
  open, onOpenChange, level, desvios, eventos, onNewDesvio, onUpdateDesvio
}: Props) => {
  const [statusFilter, setStatusFilter] = useState("todos");

  const isDesvioLevel = level === "desvio";

  const filteredDesvios = isDesvioLevel
    ? desvios.filter((d) => statusFilter === "todos" || d.status === statusFilter)
    : [];

  const filteredEventos = !isDesvioLevel && level
    ? eventos.filter((e) => {
        if (level === "incidente") return e.tipo === "incidente";
        if (level === "acidente_sem") return e.tipo === "acidente" && (!e.afastamento || e.afastamento === "sem_afastamento") && !e.obito;
        if (level === "acidente_com") return e.tipo === "acidente" && e.afastamento && e.afastamento !== "sem_afastamento" && !e.obito;
        if (level === "obito") return e.tipo === "acidente" && e.obito;
        return false;
      })
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{level ? LEVEL_TITLES[level] : ""}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {isDesvioLevel && (
            <div className="flex gap-2 items-center justify-between">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="aberto">Aberto</SelectItem>
                  <SelectItem value="em_tratamento">Em Tratamento</SelectItem>
                  <SelectItem value="resolvido">Resolvido</SelectItem>
                  <SelectItem value="convertido_incidente">Convertido em Incidente</SelectItem>
                </SelectContent>
              </Select>
              {onNewDesvio && (
                <Button size="sm" onClick={onNewDesvio}>
                  + Novo Desvio
                </Button>
              )}
            </div>
          )}

          {isDesvioLevel ? (
            filteredDesvios.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum desvio registrado neste filtro.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDesvios.map((d) => (
                  <div key={d.id} className="rounded-lg border bg-card p-4 space-y-3 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">{d.codigo}</span>
                        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${RISK_BADGE[d.potencial_risco]}`}>
                          {d.potencial_risco === "baixo" ? "🔵" : d.potencial_risco === "medio" ? "🟡" : d.potencial_risco === "alto" ? "🟠" : "🔴"} {d.potencial_risco.charAt(0).toUpperCase() + d.potencial_risco.slice(1)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_BADGE[d.status]}`}>
                          {d.status.replace("_", " ")}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(d.data_desvio), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs text-primary font-medium">{TIPO_LABEL[d.tipo_desvio]}</p>
                      <p className="text-sm mt-1 text-foreground">{d.descricao}</p>
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {(d.unidade || d.setor) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {[d.unidade, d.setor].filter(Boolean).join(" / ")}
                        </span>
                      )}
                      {d.turno && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{d.turno}</span>}
                      {!d.reportante_anonimo && d.reportante_nome && (
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{d.reportante_nome}</span>
                      )}
                      {d.reportante_anonimo && (
                        <span className="flex items-center gap-1 italic"><User className="w-3 h-3" />Anônimo</span>
                      )}
                    </div>

                    {d.acao_imediata && (
                      <div className="text-xs bg-muted rounded p-2">
                        <span className="font-medium">Ação imediata:</span> {d.acao_imediata}
                      </div>
                    )}

                    {onUpdateDesvio && d.status !== "resolvido" && d.status !== "convertido_incidente" && (
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => onUpdateDesvio(d.id, { status: "em_tratamento" })}
                          disabled={d.status === "em_tratamento"}
                        >
                          ⚠️ Em Tratamento
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-green-700 border-green-200"
                          onClick={() => onUpdateDesvio(d.id, { status: "resolvido" })}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Resolver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-orange-700 border-orange-200"
                          onClick={() => onUpdateDesvio(d.id, { status: "convertido_incidente" })}
                        >
                          <ArrowUpRight className="w-3 h-3 mr-1" /> Converter
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            filteredEventos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma ocorrência neste nível.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEventos.map((e) => (
                  <div key={e.id} className="rounded-lg border bg-card p-4 space-y-1 hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground">{e.codigo}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateBR(e.data_evento, "dd/MM/yyyy")}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{e.colaborador_nome || "Colaborador não informado"}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{e.descricao}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                      {e.unidade && <span><MapPin className="w-3 h-3 inline mr-0.5" />{e.unidade}</span>}
                      {e.setor && <span>{e.setor}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
