import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Send, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

interface DenunciaFormProps {
  profissionalId: string;
  profissionalNome: string;
  contratacaoId?: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TIPOS = [
  { value: "conduta_inadequada", label: "Conduta Inadequada" },
  { value: "fora_escopo", label: "Atuação Fora do Escopo" },
  { value: "fraude_documental", label: "Fraude Documental" },
  { value: "nao_comparecimento", label: "Não Comparecimento" },
  { value: "qualidade_insuficiente", label: "Qualidade Insuficiente" },
  { value: "outro", label: "Outro" },
];

const GRAVIDADES = [
  { value: "baixa", label: "Baixa", desc: "Observação pontual, sem impacto grave" },
  { value: "media", label: "Média", desc: "Comprometeu parcialmente o serviço" },
  { value: "alta", label: "Alta", desc: "Comprometeu significativamente o serviço" },
  { value: "critica", label: "Crítica", desc: "Risco jurídico ou de segurança — suspensão imediata" },
];

export function DenunciaForm({ profissionalId, profissionalNome, contratacaoId, open, onClose, onSuccess }: DenunciaFormProps) {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const [tipo, setTipo] = useState("");
  const [gravidade, setGravidade] = useState("media");
  const [descricao, setDescricao] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!tipo || !descricao.trim()) {
      toast.error("Preencha o tipo e a descrição da denúncia");
      return;
    }
    if (!tenantId) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from("marketplace_denuncias").insert({
        tenant_id: tenantId,
        profissional_id: profissionalId,
        contratacao_id: contratacaoId || null,
        denunciante_id: user?.id || null,
        denunciante_nome: user?.email || null,
        tipo,
        gravidade,
        descricao: descricao.trim(),
      });
      if (error) throw error;

      toast.success("Denúncia registrada. Será analisada pela equipe.");
      setTipo("");
      setGravidade("media");
      setDescricao("");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar denúncia");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Denunciar Profissional
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-xl">
            <p className="font-medium text-sm">{profissionalNome}</p>
            <p className="text-[11px] text-muted-foreground">
              A denúncia será analisada pela equipe administrativa do Seguramente.
            </p>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">
              Denúncias graves (críticas) podem resultar em <strong>suspensão automática</strong> do profissional.
              3 ou mais denúncias abertas também ativam a suspensão.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo da Denúncia *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Gravidade</Label>
            <Select value={gravidade} onValueChange={setGravidade}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GRAVIDADES.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    <div>
                      <span className="font-medium">{g.label}</span>
                      <span className="text-muted-foreground ml-1 text-xs">— {g.desc}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição *</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Descreva objetivamente o ocorrido..."
              maxLength={1000}
            />
            <p className="text-[10px] text-muted-foreground text-right">{descricao.length}/1000</p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!tipo || !descricao.trim() || isLoading}
            className="w-full"
            variant="destructive"
          >
            <Send className="h-4 w-4 mr-1.5" />
            {isLoading ? "Enviando..." : "Enviar Denúncia"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
