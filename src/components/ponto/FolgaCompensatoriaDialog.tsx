/**
 * RN23 — registro da folga compensatória de feriado trabalhado.
 *
 * A existência da folga é o que afasta o pagamento em dobro (Lei 605/1949,
 * art. 9º; Súmula 146 do TST). Sem registro, o feriado trabalhado segue
 * para a folha com adicional de 100% sobre as horas do dia.
 */
import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFolgaCompensatoria } from "@/hooks/usePontoFeriados";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  colaboradorId: string;
  colaboradorCpf: string;
  dataFeriado: string;
  feriadoNome: string;
  trabalhadoMin: number;
}

function formatarMin(min: number): string {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return `${h}h ${String(m).padStart(2, "0")}min`;
}

export function FolgaCompensatoriaDialog({
  open, onOpenChange, colaboradorId, colaboradorCpf, dataFeriado, feriadoNome, trabalhadoMin,
}: Props) {
  const { registrar } = useFolgaCompensatoria();
  const [dataFolga, setDataFolga] = useState("");
  const [observacao, setObservacao] = useState("");

  const dataBR = dataFeriado.split("-").reverse().join("/");
  const invalida = !dataFolga || dataFolga === dataFeriado;

  const salvar = async () => {
    await registrar.mutateAsync({
      colaboradorId,
      colaboradorCpf,
      dataFeriado,
      dataFolga,
      observacao,
    });
    setDataFolga("");
    setObservacao("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Folga compensatória do feriado</DialogTitle>
          <DialogDescription>
            {feriadoNome} — {dataBR} · {formatarMin(trabalhadoMin)} trabalhados.
            Sem folga registrada, essas horas vão para a folha com adicional de
            100% (Lei 605/1949, art. 9º; Súmula 146 do TST).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Dia da folga concedida</Label>
            <Input type="date" value={dataFolga} onChange={(e) => setDataFolga(e.target.value)} />
            {dataFolga === dataFeriado && (
              <p className="text-xs text-destructive">
                A folga precisa ser em outro dia — não no próprio feriado trabalhado.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Observação (opcional)</Label>
            <Input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: acordo coletivo cláusula 12"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={invalida || registrar.isPending}>
            {registrar.isPending ? "Salvando…" : "Registrar folga"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
