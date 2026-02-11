import { useState } from "react";
import { motion } from "framer-motion";
import { ThumbsUp, Minus, ThumbsDown, AlertTriangle, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useColaboradores } from "@/hooks/useColaboradores";
import type { OcorrenciaTipo } from "@/types/feedback";
import { toast } from "sonner";

interface OcorrenciaFormProps {
  onSubmit: (data: {
    colaborador_id: string;
    colaborador_nome: string;
    colaborador_cargo?: string;
    colaborador_departamento?: string;
    colaborador_filial?: string;
    tipo: OcorrenciaTipo;
    descricao: string;
    is_advertencia?: boolean;
  }) => Promise<unknown>;
  onCreateAdvertenciaLink?: (data: {
    ocorrencia_id: string;
    destinatario_email: string;
    destinatario_nome?: string;
  }) => Promise<unknown>;
  isLoading: boolean;
}

const TIPOS: { value: OcorrenciaTipo; label: string; icon: React.ElementType; color: string }[] = [
  { value: "positiva", label: "Positiva", icon: ThumbsUp, color: "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" },
  { value: "neutra", label: "Neutra", icon: Minus, color: "border-gray-400 bg-gray-50 dark:bg-gray-950/30" },
  { value: "negativa", label: "Negativa", icon: ThumbsDown, color: "border-red-500 bg-red-50 dark:bg-red-950/30" },
];

export function OcorrenciaForm({ onSubmit, onCreateAdvertenciaLink, isLoading }: OcorrenciaFormProps) {
  const { colaboradores, isLoading: loadingColabs } = useColaboradores();
  const [colaboradorId, setColaboradorId] = useState("");
  const [tipo, setTipo] = useState<OcorrenciaTipo | "">("");
  const [descricao, setDescricao] = useState("");
  const [isAdvertencia, setIsAdvertencia] = useState(false);
  const [showConfirmAdv, setShowConfirmAdv] = useState(false);
  const [showAdvLinkDialog, setShowAdvLinkDialog] = useState(false);
  const [advEmail, setAdvEmail] = useState("");
  const [advNome, setAdvNome] = useState("");
  const [pendingOcorrenciaId, setPendingOcorrenciaId] = useState("");

  const selectedColab = colaboradores.find((c) => c.id === colaboradorId);

  const handleSubmit = async () => {
    if (!colaboradorId || !tipo || !descricao) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    if (isAdvertencia) {
      setShowConfirmAdv(true);
      return;
    }
    await doSubmit();
  };

  const doSubmit = async () => {
    const result = await onSubmit({
      colaborador_id: colaboradorId,
      colaborador_nome: selectedColab?.nome_completo || "",
      colaborador_cargo: selectedColab?.cargo,
      colaborador_departamento: selectedColab?.departamento || undefined,
      colaborador_filial: selectedColab?.filial || undefined,
      tipo: tipo as OcorrenciaTipo,
      descricao,
      is_advertencia: isAdvertencia,
    });

    if (isAdvertencia && result && (result as { id: string }).id) {
      setPendingOcorrenciaId((result as { id: string }).id);
      setShowAdvLinkDialog(true);
    }

    // Reset form
    setColaboradorId("");
    setTipo("");
    setDescricao("");
    setIsAdvertencia(false);
  };

  const handleConfirmAdv = async () => {
    setShowConfirmAdv(false);
    await doSubmit();
  };

  const handleSendAdvLink = async () => {
    if (!advEmail) {
      toast.error("Informe o e-mail do destinatário.");
      return;
    }
    if (onCreateAdvertenciaLink) {
      await onCreateAdvertenciaLink({
        ocorrencia_id: pendingOcorrenciaId,
        destinatario_email: advEmail,
        destinatario_nome: advNome || undefined,
      });
    }
    setShowAdvLinkDialog(false);
    setAdvEmail("");
    setAdvNome("");
    setPendingOcorrenciaId("");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Nova Ocorrência</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Colaborador */}
          <div className="space-y-2">
            <Label>Colaborador *</Label>
            <Select value={colaboradorId} onValueChange={setColaboradorId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingColabs ? "Carregando..." : "Selecione o colaborador"} />
              </SelectTrigger>
              <SelectContent>
                {colaboradores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome_completo} — {c.cargo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedColab && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 grid grid-cols-2 gap-1">
                <span>Função: {selectedColab.cargo}</span>
                <span>Depto: {selectedColab.departamento || "—"}</span>
                <span>Unidade: {selectedColab.filial || "—"}</span>
              </div>
            )}
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo de Ocorrência *</Label>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTipo(t.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                    tipo === t.value ? `${t.color} border-2` : "border-border hover:border-primary/50"
                  }`}
                >
                  <t.icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição do fato *</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva de forma objetiva o fato ocorrido..."
              rows={4}
            />
          </div>

          {/* Advertência */}
          {tipo === "negativa" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3 p-3 border border-destructive/30 rounded-lg bg-destructive/5">
              <Checkbox
                checked={isAdvertencia}
                onCheckedChange={(v) => setIsAdvertencia(!!v)}
              />
              <div>
                <p className="text-sm font-medium flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Esta ocorrência é uma advertência formal
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ao marcar, o registro será bloqueado para edição e um link seguro será gerado para formalização.
                </p>
              </div>
            </motion.div>
          )}

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <Button onClick={handleSubmit} disabled={isLoading || !colaboradorId || !tipo || !descricao}>
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Registrar Ocorrência
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de confirmação de advertência */}
      <Dialog open={showConfirmAdv} onOpenChange={setShowConfirmAdv}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Advertência Formal
            </DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. O registro será bloqueado para edição após a confirmação.
              Certifique-se de que o texto está correto e reflete fielmente o ocorrido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmAdv(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirmAdv}>Confirmar Advertência</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para enviar link de advertência */}
      <Dialog open={showAdvLinkDialog} onOpenChange={setShowAdvLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Link de Formalização</DialogTitle>
            <DialogDescription>
              Um link seguro será gerado para que o responsável (RH/Contabilidade) possa visualizar o relato e fazer upload da advertência formalizada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nome do destinatário</Label>
              <Input value={advNome} onChange={(e) => setAdvNome(e.target.value)} placeholder="Ex: Departamento RH" />
            </div>
            <div className="space-y-2">
              <Label>E-mail do destinatário *</Label>
              <Input value={advEmail} onChange={(e) => setAdvEmail(e.target.value)} placeholder="rh@empresa.com" type="email" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdvLinkDialog(false)}>Pular</Button>
            <Button onClick={handleSendAdvLink}>Enviar Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
