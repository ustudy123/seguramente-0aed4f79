import { useState } from "react";
import { AlertTriangle, Check, Ban, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { usePontoExcedente, type DecisaoExcedente } from "@/hooks/usePontoExcedente";
import { formatarHoraMinuto, abreviacaoDiaSemana } from "@/lib/ponto/diaSemana";

interface Props {
  competencia: string;
}

/**
 * RN17 — fila de excedentes retidos aguardando decisão do RH.
 *
 * É esta lista que impede a retenção de virar limbo: mostra o que está
 * parado, há quanto tempo, e o motivo declarado no ajuste do dia (insumo do
 * relatório de motivo x evidência x recorrência pedido no chamado).
 */
export function ExcedenteRetidoPanel({ competencia }: Props) {
  const { pendentes, isLoading, decidir, totalRetidoMin } = usePontoExcedente(competencia);
  const [alvo, setAlvo] = useState<{
    cpf: string; nome: string; dia: string; minutos: number; decisao: DecisaoExcedente;
  } | null>(null);
  const [justificativa, setJustificativa] = useState("");

  if (isLoading || pendentes.length === 0) return null;

  const abrir = (p: typeof pendentes[number], decisao: DecisaoExcedente) => {
    setAlvo({
      cpf: p.colaborador_cpf,
      nome: p.colaborador_nome || p.colaborador_cpf,
      dia: p.dia,
      minutos: p.excedente_retido_min,
      decisao,
    });
    setJustificativa("");
  };

  const confirmar = () => {
    if (!alvo) return;
    decidir.mutate(
      { cpf: alvo.cpf, dia: alvo.dia, decisao: alvo.decisao, justificativa: justificativa.trim() },
      { onSuccess: () => setAlvo(null) },
    );
  };

  const ehLiberar = alvo?.decisao === "liberado";

  return (
    <>
      <Card className="border-red-200 bg-red-50/40">
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-900">
                  Excedente retido aguardando decisão — {pendentes.length} dia(s)
                </p>
                <p className="text-xs text-red-800/80 leading-relaxed max-w-3xl">
                  Horas acima da jornada + 2h suplementares (art. 59, caput, CLT) não entram no
                  banco automaticamente. Libere com justificativa de necessidade imperiosa ou força
                  maior (art. 61), ou marque como irregularidade — nesse caso as horas não são
                  creditadas no banco e seguem para pagamento.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-red-400 text-red-700 shrink-0">
              Total retido: {formatarHoraMinuto(totalRetidoMin)}
            </Badge>
          </div>

          <div className="space-y-1.5">
            {pendentes.map((p) => {
              const [y, m, d] = p.dia.split("-");
              return (
                <div
                  key={`${p.colaborador_cpf}-${p.dia}`}
                  className="flex items-center gap-3 rounded-md border border-red-200 bg-background p-2.5 flex-wrap"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {p.colaborador_nome || p.colaborador_cpf}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {d}/{m}/{y} {abreviacaoDiaSemana(p.dia)} · trabalhado{" "}
                      {formatarHoraMinuto(p.trabalhado_min)} · jornada{" "}
                      {formatarHoraMinuto(p.jornada_min)}
                      {p.motivo_ajuste ? ` · ajuste: "${p.motivo_ajuste}"` : ""}
                    </p>
                  </div>

                  <Badge variant="outline" className="border-red-400 text-red-700 shrink-0">
                    retido {formatarHoraMinuto(p.excedente_retido_min)}
                  </Badge>

                  {p.dias_parado > 0 && (
                    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 shrink-0">
                      <Clock className="h-3 w-3" />
                      {p.dias_parado}d parado
                    </span>
                  )}

                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                      onClick={() => abrir(p, "liberado")}>
                      <Check className="h-3.5 w-3.5" /> Liberar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-red-700"
                      onClick={() => abrir(p, "irregularidade")}>
                      <Ban className="h-3.5 w-3.5" /> Irregularidade
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!alvo} onOpenChange={(o) => !o && setAlvo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {ehLiberar ? "Liberar excedente — art. 61 CLT" : "Marcar como irregularidade"}
            </DialogTitle>
            <DialogDescription>
              {ehLiberar ? (
                <>
                  {alvo && formatarHoraMinuto(alvo.minutos)} de {alvo?.nome} serão creditados no
                  banco <strong>com data no próprio dia trabalhado</strong>. Registre a
                  justificativa de necessidade imperiosa ou força maior.
                </>
              ) : (
                <>
                  {alvo && formatarHoraMinuto(alvo.minutos)} de {alvo?.nome}{" "}
                  <strong>não serão creditados no banco</strong> e seguem para pagamento; o dia
                  fica marcado como excedente ao teto no relatório de conformidade.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label className="text-xs">Justificativa (obrigatória)</Label>
            <Input
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder={ehLiberar
                ? "Ex.: atendimento emergencial de cliente em parada de produção"
                : "Ex.: sem justificativa legal; horas encaminhadas para pagamento"}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAlvo(null)}>Cancelar</Button>
            <Button
              disabled={!justificativa.trim() || decidir.isPending}
              variant={ehLiberar ? "default" : "destructive"}
              onClick={confirmar}
            >
              {decidir.isPending ? "Registrando..." : ehLiberar ? "Liberar" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
