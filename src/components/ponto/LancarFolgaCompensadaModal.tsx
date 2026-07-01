import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { usePontoBancoHoras } from "@/hooks/usePontoBancoHoras";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  colaborador: { id: string; nome: string; cpf: string } | null;
  /** Data do dia (yyyy-MM-dd) que originou o lançamento. */
  dataInicial: string;
}

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

/**
 * Lança uma folga compensada no Banco de Horas direto a partir do espelho de
 * ponto. Cria o banco de horas da competência se ainda não existir e registra
 * a movimentação (compensação = abate saldo positivo; débito = colaborador
 * repõe depois).
 */
export function LancarFolgaCompensadaModal({ open, onOpenChange, colaborador, dataInicial }: Props) {
  const [tipo, setTipo] = useState<"compensacao" | "debito">("compensacao");
  const [horas, setHoras] = useState("4");
  const [minutos, setMinutos] = useState("0");
  const [data, setData] = useState(dataInicial);
  const [descricao, setDescricao] = useState("Folga compensada");
  const [salvando, setSalvando] = useState(false);

  // Reinicia os campos ao (re)abrir para outro colaborador/dia.
  useEffect(() => {
    if (open) {
      setTipo("compensacao");
      setHoras("4");
      setMinutos("0");
      setData(dataInicial);
      setDescricao("Folga compensada");
    }
  }, [open, dataInicial, colaborador]);

  const competencia = (data || dataInicial || "").slice(0, 7);
  const { useBancoHorasPorCompetencia, adicionarMovimentacao, criarBancoHoras } = usePontoBancoHoras();
  const { data: bancos = [] } = useBancoHorasPorCompetencia(competencia);

  const totalMin = (Number(horas) || 0) * 60 + (Number(minutos) || 0);

  const handleSubmit = async () => {
    if (!colaborador) return;
    if (totalMin <= 0) { toast.error("Informe as horas da folga."); return; }
    setSalvando(true);
    try {
      const banco = bancos.find(
        (b) =>
          (b.colaborador_cpf && onlyDigits(b.colaborador_cpf) === onlyDigits(colaborador.cpf)) ||
          b.colaborador_id === colaborador.id
      );
      let bancoId = banco?.id;
      if (!bancoId) {
        const novo: any = await criarBancoHoras({
          colaborador_id: colaborador.id,
          colaborador_nome: colaborador.nome,
          colaborador_cpf: colaborador.cpf,
          tipo: "mensal",
          competencia,
        });
        bancoId = novo?.id;
      }
      if (!bancoId) throw new Error("Não foi possível preparar o banco de horas.");
      await adicionarMovimentacao({
        bancoHorasId: bancoId,
        colaboradorCpf: colaborador.cpf,
        dataReferencia: data,
        tipo,
        minutos: totalMin,
        descricao: descricao.trim() || "Folga compensada",
      });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao lançar folga compensada.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" /> Lançar folga compensada
          </DialogTitle>
          <DialogDescription>
            {colaborador ? colaborador.nome : ""} — registra a folga direto no Banco de Horas
            (competência {competencia}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as "compensacao" | "debito")}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compensacao">Compensação — abate do saldo de horas</SelectItem>
                <SelectItem value="debito">Débito — colaborador repõe depois</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              {tipo === "compensacao"
                ? "Usa horas que o colaborador já tinha no banco (saldo positivo)."
                : "O colaborador fica devendo estas horas (saldo negativo) até repor."}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Horas</Label>
              <Input type="number" min="0" max="24" value={horas} onChange={(e) => setHoras(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Minutos</Label>
              <Input type="number" min="0" max="59" value={minutos} onChange={(e) => setMinutos(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-9" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={200} className="h-9" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={salvando || totalMin <= 0 || !colaborador}>
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : `Lançar ${Math.floor(totalMin / 60)}h${totalMin % 60 ? ` ${totalMin % 60}min` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
