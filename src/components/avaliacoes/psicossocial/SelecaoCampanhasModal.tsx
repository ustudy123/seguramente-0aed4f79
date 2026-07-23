import { useMemo, useState, useEffect } from "react";
import { BarChart3, Lock, Info, CheckCheck, X, Repeat2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type CampanhaPsicossocial,
  type InstrumentoPsicossocial,
  getMinimoRespostas,
  isEntrevistaInstrumento,
} from "@/types/psicossocial";
import { cn } from "@/lib/utils";

const LABEL_INSTRUMENTO: Record<string, string> = {
  copsoq: "COPSOQ",
  copsoq2br: "COPSOQ II-BR",
  hse: "HSE Management Standards",
  proart: "ProART",
  sipro: "SIPRO / IRP-S",
  customizado: "Customizado",
};

const labelInstrumento = (i?: string) => LABEL_INSTRUMENTO[i || "copsoq"] ?? (i || "—");

interface SelecaoCampanhasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campanhas: CampanhaPsicossocial[];
  /** Pré-seleção (ex.: campanha destacada no banner). */
  preSelecionadas?: string[];
  onConfirmar: (selecionadas: CampanhaPsicossocial[]) => void;
}

/**
 * Seletor de campanhas para a tela de Resultados.
 *
 * Regras de negócio embutidas:
 * 1. Só é selecionável campanha que atingiu o mínimo de respostas para
 *    anonimato (ISO 45003 / NR-01). As demais aparecem bloqueadas com o motivo.
 * 2. Multi-seleção só é permitida DENTRO do mesmo instrumento. Somar COPSOQ com
 *    SIPRO produziria um índice sem significado — as escalas são invertidas
 *    (no SIPRO maior = pior; nos demais maior = melhor) e as dimensões não são
 *    equivalentes. Ao marcar a primeira, as incompatíveis são desabilitadas.
 */
export function SelecaoCampanhasModal({
  open,
  onOpenChange,
  campanhas,
  preSelecionadas = [],
  onConfirmar,
}: SelecaoCampanhasModalProps) {
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set(preSelecionadas));

  useEffect(() => {
    if (open) setSelecionadas(new Set(preSelecionadas));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const temResultado = (c: CampanhaPsicossocial) =>
    (c.total_respostas || 0) >= getMinimoRespostas(c);

  // Instrumento travado pela seleção atual
  const instrumentoAtivo = useMemo(() => {
    const primeira = campanhas.find(c => selecionadas.has(c.id));
    return primeira ? (primeira.instrumento || "copsoq") : null;
  }, [selecionadas, campanhas]);

  // Campanhas agrupadas por instrumento.
  // O grupo do instrumento em uso vem PRIMEIRO — senão o usuário vê uma lista
  // toda bloqueada sem enxergar o que causou o bloqueio.
  const grupos = useMemo(() => {
    const mapa = new Map<string, CampanhaPsicossocial[]>();
    for (const c of campanhas) {
      const chave = (c.instrumento || "copsoq") as InstrumentoPsicossocial;
      const arr = mapa.get(chave) ?? [];
      arr.push(c);
      mapa.set(chave, arr);
    }
    for (const arr of mapa.values()) {
      arr.sort((a, b) => (b.data_inicio || "").localeCompare(a.data_inicio || ""));
    }
    return Array.from(mapa.entries()).sort((a, b) => {
      if (instrumentoAtivo) {
        if (a[0] === instrumentoAtivo) return -1;
        if (b[0] === instrumentoAtivo) return 1;
      }
      return b[1].length - a[1].length;
    });
  }, [campanhas, instrumentoAtivo]);

  /** Bloqueio duro: sem respostas suficientes, não há o que mostrar. */
  const bloqueioAnonimato = (c: CampanhaPsicossocial): string | null => {
    if (temResultado(c)) return null;
    const min = getMinimoRespostas(c);
    const atual = c.total_respostas || 0;
    return `Precisa de ${min} resposta${min !== 1 ? "s" : ""} para liberar a análise sem quebrar o anonimato — tem ${atual}.`;
  };

  /** Instrumento incompatível: não bloqueia o clique, apenas troca o recorte. */
  const instrumentoIncompativel = (c: CampanhaPsicossocial) =>
    !!instrumentoAtivo &&
    !selecionadas.has(c.id) &&
    (c.instrumento || "copsoq") !== instrumentoAtivo;

  const toggle = (c: CampanhaPsicossocial) => {
    if (bloqueioAnonimato(c)) return;

    // Clicar numa campanha de outro instrumento TROCA o recorte em vez de não
    // fazer nada. Misturar instrumentos continua proibido, mas o usuário não
    // fica preso sem entender o motivo.
    if (instrumentoIncompativel(c)) {
      setSelecionadas(new Set([c.id]));
      toast.info(
        `Recorte trocado para ${labelInstrumento(c.instrumento)} — a seleção anterior foi limpa.`,
        { description: "Instrumentos diferentes não podem ser somados no mesmo índice." },
      );
      return;
    }

    setSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(c.id)) next.delete(c.id);
      else next.add(c.id);
      return next;
    });
  };

  const selecionarGrupo = (lista: CampanhaPsicossocial[]) => {
    const elegiveis = lista.filter(temResultado);
    const todasMarcadas = elegiveis.length > 0 && elegiveis.every(c => selecionadas.has(c.id));
    setSelecionadas(todasMarcadas ? new Set() : new Set(elegiveis.map(c => c.id)));
  };

  const selecionadasArr = campanhas.filter(c => selecionadas.has(c.id));
  const totalRespostas = selecionadasArr.reduce((a, c) => a + (c.total_respostas || 0), 0);
  const totalElegivel = campanhas.filter(temResultado).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Quais campanhas você quer analisar?
          </DialogTitle>
          <DialogDescription>
            Selecione uma, várias ou todas. Ao selecionar mais de uma, o IPS é recalculado
            a partir das respostas de todas elas — e não pela média das médias.
          </DialogDescription>
        </DialogHeader>

        {/* Barra do recorte atual — deixa visível o que travou o instrumento */}
        {instrumentoAtivo && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
            <div className="flex-1 min-w-0 text-xs">
              <span className="text-muted-foreground">Recorte atual: </span>
              <strong>{labelInstrumento(instrumentoAtivo)}</strong>
              <span className="text-muted-foreground">
                {" · "}
                {selecionadas.size} campanha{selecionadas.size !== 1 ? "s" : ""} marcada
                {selecionadas.size !== 1 ? "s" : ""}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5 shrink-0"
              onClick={() => setSelecionadas(new Set())}
            >
              <Repeat2 className="h-3.5 w-3.5" />
              Trocar instrumento
            </Button>
          </div>
        )}

        {totalElegivel === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Nenhuma campanha liberada ainda</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              As campanhas precisam atingir o mínimo de respostas antes de a análise ser
              liberada, para que ninguém possa ser reidentificado.
            </p>
          </div>
        ) : (
          <TooltipProvider>
            <ScrollArea className="flex-1 -mx-2 px-2">
              <div className="space-y-5 py-1">
                {grupos.map(([instrumento, lista]) => {
                  const elegiveis = lista.filter(temResultado);
                  const bloqueadoPorInstrumento =
                    !!instrumentoAtivo && instrumento !== instrumentoAtivo;
                  return (
                    <div key={instrumento} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-xs font-semibold uppercase tracking-wide",
                              bloqueadoPorInstrumento ? "text-muted-foreground" : "text-foreground",
                            )}
                          >
                            {labelInstrumento(instrumento)}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {lista.length}
                          </Badge>
                          {bloqueadoPorInstrumento && elegiveis.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              clique para trocar o recorte
                            </span>
                          )}
                        </div>
                        {elegiveis.length > 1 && !bloqueadoPorInstrumento && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => selecionarGrupo(lista)}
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                            Selecionar todas
                          </Button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {lista.map(c => {
                          const semRespostas = bloqueioAnonimato(c);
                          const trocaRecorte = !semRespostas && instrumentoIncompativel(c);
                          const marcada = selecionadas.has(c.id);
                          const linha = (
                            <div
                              key={c.id}
                              role="button"
                              tabIndex={semRespostas ? -1 : 0}
                              onClick={() => toggle(c)}
                              onKeyDown={e => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  toggle(c);
                                }
                              }}
                              className={cn(
                                "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                                semRespostas
                                  ? "opacity-55 cursor-not-allowed bg-muted/30"
                                  : "cursor-pointer hover:bg-accent/50",
                                trocaRecorte && "opacity-80",
                                marcada && "border-primary bg-primary/5",
                              )}
                            >
                              <Checkbox
                                checked={marcada}
                                disabled={!!semRespostas}
                                className="mt-0.5 pointer-events-none"
                                tabIndex={-1}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium truncate">{c.nome}</p>
                                  <Badge
                                    variant={c.status === "ativa" ? "default" : "secondary"}
                                    className="text-[10px] px-1.5 py-0 capitalize"
                                  >
                                    {c.status}
                                  </Badge>
                                  {isEntrevistaInstrumento(c.tipo_instrumento) && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                      Entrevista
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {c.total_respostas || 0} resposta
                                  {(c.total_respostas || 0) !== 1 ? "s" : ""}
                                  {c.data_inicio && (
                                    <> · desde {new Date(c.data_inicio).toLocaleDateString("pt-BR")}</>
                                  )}
                                </p>
                                {semRespostas && (
                                  <p className="text-[11px] text-amber-700 mt-1 flex items-start gap-1">
                                    <Lock className="h-3 w-3 mt-0.5 shrink-0" />
                                    {semRespostas}
                                  </p>
                                )}
                                {trocaRecorte && (
                                  <p className="text-[11px] text-muted-foreground mt-1 flex items-start gap-1">
                                    <Repeat2 className="h-3 w-3 mt-0.5 shrink-0" />
                                    Outro instrumento — clicar troca o recorte para{" "}
                                    {labelInstrumento(c.instrumento)}.
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                          return semRespostas ? (
                            <Tooltip key={c.id}>
                              <TooltipTrigger asChild>{linha}</TooltipTrigger>
                              <TooltipContent className="max-w-xs">{semRespostas}</TooltipContent>
                            </Tooltip>
                          ) : (
                            linha
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TooltipProvider>
        )}

        {selecionadasArr.length > 1 && (
          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-800">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              <strong>{selecionadasArr.length} campanhas</strong> · {totalRespostas} respostas
              somadas. O recorte agregado usa o mesmo instrumento
              ({labelInstrumento(instrumentoAtivo || undefined)}), e a aba{" "}
              <strong>Comparativo</strong> mostra a evolução campanha a campanha.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {selecionadas.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelecionadas(new Set())}
              className="mr-auto gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              Limpar seleção
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={selecionadasArr.length === 0}
            onClick={() => {
              onConfirmar(selecionadasArr);
              onOpenChange(false);
            }}
            className="gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Ver resultados
            {selecionadasArr.length > 0 && ` (${selecionadasArr.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
