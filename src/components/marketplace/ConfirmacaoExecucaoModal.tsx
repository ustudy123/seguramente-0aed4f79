import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CheckCircle2, AlertTriangle, Clock, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MarketplaceContratacao } from "@/hooks/useMarketplace";
import { Badge } from "@/components/ui/badge";

interface ConfirmacaoExecucaoModalProps {
  contratacao: MarketplaceContratacao | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConfirmacaoExecucaoModal({ contratacao, open, onClose, onSuccess }: ConfirmacaoExecucaoModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [duracaoMinutos, setDuracaoMinutos] = useState(contratacao?.duracao_minutos?.toString() || "60");
  const [observacoes, setObservacoes] = useState("");

  if (!contratacao) return null;

  const handleConfirmar = async () => {
    setIsLoading(true);
    try {
      // 1. Update contratacao status
      const { error: updateError } = await supabase
        .from("marketplace_contratacoes")
        .update({
          status: "concluida" as "concluida",
          profissional_confirmou: true,
          data_conclusao: new Date().toISOString(),
          duracao_minutos: parseInt(duracaoMinutos) || null,
          observacoes: observacoes || contratacao.observacoes,
        })
        .eq("id", contratacao.id);
      if (updateError) throw updateError;

      // 2. If linked to an action, conclude it
      if ((contratacao as any).acao_vinculada_id) {
        await supabase
          .from("plano_acoes")
          .update({
            status: "concluida" as any,
            progresso: 100,
            data_conclusao: new Date().toISOString().split("T")[0],
          })
          .eq("id", (contratacao as any).acao_vinculada_id);
      }

      // 3. Audit log
      await supabase.from("marketplace_audit_log").insert({
        tenant_id: contratacao.tenant_id,
        contratacao_id: contratacao.id,
        profissional_id: contratacao.profissional_id,
        acao: "execucao_confirmada",
        descricao: `Serviço "${contratacao.servico?.nome}" concluído. Duração: ${duracaoMinutos} min.`,
        dados: {
          duracao_minutos: parseInt(duracaoMinutos),
          modalidade: contratacao.modalidade,
          data_conclusao: new Date().toISOString(),
        },
      });

      toast.success("Execução confirmada com sucesso!");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao confirmar execução");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Confirmar Execução
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="p-3 bg-muted/50 rounded-xl space-y-1">
            <p className="font-medium text-sm">{contratacao.servico?.nome || "Serviço"}</p>
            <p className="text-xs text-muted-foreground">Contratante: {contratacao.solicitante_nome || "—"}</p>
            <Badge variant="secondary" className="text-xs mt-1">
              {contratacao.modalidade}
            </Badge>
          </div>

          {/* Disclaimer */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-800">
              <p className="font-medium">Registro administrativo</p>
              <p className="mt-1">
                Esta confirmação registra apenas que o atendimento foi realizado.
                Nenhum conteúdo clínico ou sensível é armazenado.
              </p>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Duração aproximada (minutos)
            </Label>
            <Input
              type="number"
              value={duracaoMinutos}
              onChange={(e) => setDuracaoMinutos(e.target.value)}
            />
          </div>

          {/* Observações administrativas */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> Observações administrativas (opcional)
            </Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              placeholder="Apenas dados administrativos, sem conteúdo clínico..."
            />
          </div>

          <Button
            onClick={handleConfirmar}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0"
          >
            {isLoading ? "Confirmando..." : "Confirmar Execução do Serviço"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
