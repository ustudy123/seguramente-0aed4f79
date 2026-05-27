import { useState } from "react";
import { MessageSquare, ChevronDown, ChevronUp, Quote, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CriarAcaoAlertaModal } from "@/components/shared/CriarAcaoAlertaModal";
import { useEvidenciasEntrevista, type EvidenciaAgrupada } from "@/hooks/useEvidenciasEntrevista";
import { cn } from "@/lib/utils";

interface Props {
  campanhaIds: string[];
}

const NIVEL_COR: Record<string, string> = {
  baixo: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medio: "bg-amber-50 text-amber-700 border-amber-200",
  alto: "bg-orange-50 text-orange-700 border-orange-200",
  critico: "bg-rose-50 text-rose-700 border-rose-200",
};

const NIVEL_LABEL: Record<string, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
  critico: "Crítico",
};

export function EvidenciasEntrevistaPanel({ campanhaIds }: Props) {
  const { data: grupos = [], isLoading } = useEvidenciasEntrevista(campanhaIds);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [acao, setAcao] = useState<EvidenciaAgrupada | null>(null);

  if (isLoading || grupos.length === 0) return null;

  return (
    <>
      <Card className="border-purple-200 bg-purple-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-purple-600" />
            Evidências qualitativas — Entrevistas guiadas por IA
            <Badge variant="outline" className="text-xs">{grupos.length} riscos detectados</Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Trechos sempre anonimizados. Probabilidade × Severidade calculadas pela IA com base na fala dos entrevistados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {grupos.map((g) => {
            const isOpen = expandido === g.risco_nome;
            return (
              <Collapsible key={g.risco_nome} open={isOpen} onOpenChange={(o) => setExpandido(o ? g.risco_nome : null)}>
                <div className="rounded-lg border bg-background">
                  <div className="flex items-center justify-between gap-3 p-3">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 flex-1 text-left">
                        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        <span className="font-medium text-sm">{g.risco_nome}</span>
                        <Badge variant="outline" className={cn("text-xs", NIVEL_COR[g.nivel])}>
                          {NIVEL_LABEL[g.nivel]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          P {g.p_max} × S {g.s_max} · {g.count} {g.count === 1 ? "evidência" : "evidências"}
                        </span>
                      </button>
                    </CollapsibleTrigger>
                    <Button size="sm" variant="outline" onClick={() => setAcao(g)}>
                      <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                      Criar Ação 5W2H
                    </Button>
                  </div>
                  <CollapsibleContent>
                    <div className="border-t px-4 py-3 space-y-3 bg-muted/30">
                      {g.evidencias.map((ev) => (
                        <div key={ev.id} className="space-y-1.5">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>P {ev.probabilidade ?? "—"} × S {ev.severidade ?? "—"}</span>
                            {ev.nivel_risco && <Badge variant="outline" className="text-[10px]">{ev.nivel_risco}</Badge>}
                          </div>
                          {ev.justificativa && (
                            <p className="text-sm text-foreground">{ev.justificativa}</p>
                          )}
                          {ev.trechos_anonimizados?.length > 0 && (
                            <div className="space-y-1 pl-3 border-l-2 border-purple-300">
                              {ev.trechos_anonimizados.map((t, i) => (
                                <p key={i} className="text-xs italic text-muted-foreground flex gap-1.5">
                                  <Quote className="h-3 w-3 shrink-0 mt-0.5" />
                                  {t}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </CardContent>
      </Card>

      {acao && (
        <CriarAcaoAlertaModal
          open={!!acao}
          onOpenChange={(o) => !o && setAcao(null)}
          alertaTitulo={`Risco psicossocial: ${acao.risco_nome}`}
          alertaDescricao={`Detectado em ${acao.count} ${acao.count === 1 ? "entrevista guiada" : "entrevistas guiadas"} por IA. Probabilidade ${acao.p_max} × Severidade ${acao.s_max} — Nível ${NIVEL_LABEL[acao.nivel]}.`}
          origemModulo="psicossocial"
          contextoExtra={`Evidências qualitativas anonimizadas obtidas via entrevista guiada (ISO 45003 / NR-01).`}
        />
      )}
    </>
  );
}
