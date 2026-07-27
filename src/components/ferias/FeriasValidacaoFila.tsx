import { AlertTriangle, Check, RotateCcw, Loader2, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import type { PeriodoAquisitivo } from "@/hooks/useFeriasPeriodos";

interface Props {
  pendentes: PeriodoAquisitivo[];
  onResolver: (args: { periodoId: string; acao: "confirmar" | "contestar" }) => void;
  resolvendo: boolean;
}

/**
 * Fila de conferência das zeragens por excesso de faltas (art. 130 da CLT).
 * O motor NÃO zera sozinho — marca 'pendente_validacao' e o RH decide aqui:
 *  • Confirmar: as faltas procedem, o período fica com 0 dias de direito.
 *  • Contestar: as faltas não procedem (erro de apontamento, atestado não
 *    lançado); zera as faltas e recalcula o direito integral.
 * Separado das Solicitações de propósito — zeragem não é pedido de férias.
 */
export function FeriasValidacaoFila({ pendentes, onResolver, resolvendo }: Props) {
  if (pendentes.length === 0) return null;

  const fmt = (iso: string) => {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  return (
    <Accordion type="single" collapsible defaultValue="fila" className="mb-4">
      <AccordionItem value="fila" className="border border-amber-200 rounded-xl bg-amber-50/40 px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2 text-amber-800">
            <ShieldQuestion className="h-5 w-5" />
            <span className="font-semibold">
              {pendentes.length} período{pendentes.length > 1 ? "s" : ""} aguardando validação
            </span>
            <Badge variant="outline" className="border-amber-300 text-amber-700 text-[10px]">
              excesso de faltas
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-xs text-amber-800/80 mb-3">
            Estes períodos ultrapassaram 32 faltas e, pelo art. 130 da CLT, ficariam sem direito a
            férias. O sistema não zera automaticamente — confirme se as faltas procedem ou conteste
            se houver erro de apontamento (ex.: atestado não lançado).
          </p>
          <div className="space-y-2">
            {pendentes.map(p => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-amber-200 bg-white p-3"
              >
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{p.colaboradorNome}</p>
                  <p className="text-xs text-muted-foreground">
                    Período {fmt(p.aquisitivoInicio)} a {fmt(p.aquisitivoFim)} ·{" "}
                    <span className="text-amber-700 font-medium">
                      {p.faltasConsideradas} faltas
                    </span>{" "}
                    ({p.fonteFaltas === "ponto" ? "apuradas do ponto" : "informadas na carga"})
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8"
                    disabled={resolvendo}
                    onClick={() => onResolver({ periodoId: p.id, acao: "contestar" })}
                  >
                    {resolvendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    Contestar
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 h-8 bg-amber-600 hover:bg-amber-700"
                    disabled={resolvendo}
                    onClick={() => onResolver({ periodoId: p.id, acao: "confirmar" })}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Confirmar zeragem
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
