import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Shield, Video, Building2 } from "lucide-react";
import type { MarketplaceServico } from "@/hooks/useMarketplace";

interface ContratacaoModalProps {
  servico: MarketplaceServico | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (data: {
    servico_id: string;
    profissional_id: string;
    modalidade: string;
    data_agendamento?: string;
    hora_agendamento?: string;
    observacoes?: string;
    valor?: number;
  }) => void;
  isLoading?: boolean;
}

export function ContratacaoModal({ servico, open, onClose, onConfirm, isLoading }: ContratacaoModalProps) {
  const [modalidade, setModalidade] = useState(servico?.modalidade || "presencial");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [termoAceito, setTermoAceito] = useState(false);

  if (!servico) return null;

  const handleConfirm = () => {
    if (!termoAceito) return;
    onConfirm({
      servico_id: servico.id,
      profissional_id: servico.profissional_id,
      modalidade,
      data_agendamento: data || undefined,
      hora_agendamento: hora || undefined,
      observacoes: observacoes || undefined,
      valor: servico.preco_referencia || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar Serviço</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Service summary */}
          <div className="p-3 bg-muted/50 rounded-xl">
            <p className="font-medium text-sm">{servico.nome}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {servico.profissional?.nome_completo} • {servico.profissional?.conselho}
            </p>
            {servico.preco_referencia && (
              <p className="text-sm font-semibold mt-1">R$ {servico.preco_referencia.toFixed(2)}</p>
            )}
          </div>

          {/* Modalidade */}
          <div className="space-y-2">
            <Label>Modalidade</Label>
            <Select value={modalidade} onValueChange={setModalidade}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="presencial">
                  <span className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Presencial</span>
                </SelectItem>
                <SelectItem value="online">
                  <span className="flex items-center gap-2"><Video className="h-4 w-4" /> Online</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date / Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data preferencial</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Horário</Label>
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
          </div>

          {/* Observacoes */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Informações adicionais sobre a necessidade..."
              rows={3}
            />
          </div>

          {/* Termo */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800">
                <p className="font-medium">Termo de Ciência</p>
                <p className="mt-1">
                  O YourEyes registra apenas que o atendimento ocorreu. Nenhum conteúdo
                  clínico, gravação ou prontuário será armazenado na plataforma, garantindo
                  total conformidade com a LGPD e ética profissional.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="termo"
                checked={termoAceito}
                onCheckedChange={(v) => setTermoAceito(!!v)}
              />
              <label htmlFor="termo" className="text-xs text-amber-800 cursor-pointer">
                Li e concordo com o termo acima
              </label>
            </div>
          </div>

          <Button
            onClick={handleConfirm}
            disabled={!termoAceito || isLoading}
            className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-0"
          >
            Confirmar Solicitação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
