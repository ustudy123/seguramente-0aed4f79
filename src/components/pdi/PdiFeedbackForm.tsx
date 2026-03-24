import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PdiFeedbackInsert } from "@/types/pdi";

interface PdiFeedbackFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdiId: string;
  pdiTitulo?: string;
  colaboradorId?: string;
  colaboradorNome?: string;
  onCreate: (data: PdiFeedbackInsert & { colaborador_id?: string; colaborador_nome?: string; pdi_titulo?: string }) => Promise<any>;
}

export const PdiFeedbackForm = ({ open, onOpenChange, pdiId, pdiTitulo, colaboradorId, colaboradorNome, onCreate }: PdiFeedbackFormProps) => {
  const [form, setForm] = useState({
    tipo: "lider",
    ponto_forte: "",
    ponto_melhorar: "",
    recomendacao: "",
    comentario: "",
  });
  const [gerandoIA, setGerandoIA] = useState<string | null>(null);

  const handleGerarIA = async (campo: "ponto_forte" | "ponto_melhorar" | "recomendacao" | "comentario") => {
    const texto = form[campo];
    if (!texto || texto.trim().length < 5) {
      toast.error("Escreva pelo menos algumas palavras antes de usar a IA.");
      return;
    }
    setGerandoIA(campo);
    try {
      const { data, error } = await supabase.functions.invoke("ai-feedback", {
        body: {
          descricao: texto,
          categoria: "desenvolvimento",
          colaborador_nome: colaboradorNome,
        },
      });
      if (error) throw error;
      if (data?.texto_estruturado) {
        setForm(f => ({ ...f, [campo]: data.texto_estruturado }));
        toast.success("Texto estruturado pela IA!");
      }
    } catch {
      toast.error("Erro ao gerar texto com IA.");
    } finally {
      setGerandoIA(null);
    }
  };

  const handleSubmit = async () => {
    await onCreate({
      pdi_id: pdiId,
      tipo: form.tipo,
      ponto_forte: form.ponto_forte || undefined,
      ponto_melhorar: form.ponto_melhorar || undefined,
      recomendacao: form.recomendacao || undefined,
      comentario: form.comentario || undefined,
      colaborador_id: colaboradorId,
      colaborador_nome: colaboradorNome,
      pdi_titulo: pdiTitulo,
    });
    onOpenChange(false);
    setForm({ tipo: "lider", ponto_forte: "", ponto_melhorar: "", recomendacao: "", comentario: "" });
  };

  const renderCampoComIA = (label: string, campo: "ponto_forte" | "ponto_melhorar" | "recomendacao" | "comentario") => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label>{label}</Label>
        {form[campo]?.trim().length >= 5 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-primary"
            onClick={() => handleGerarIA(campo)}
            disabled={gerandoIA !== null}
          >
            {gerandoIA === campo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Estruturar com IA
          </Button>
        )}
      </div>
      <Textarea value={form[campo]} onChange={e => setForm(f => ({ ...f, [campo]: e.target.value }))} rows={2} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Feedback</DialogTitle>
          <DialogDescription>Registre um feedback estruturado. Ele também será visível no módulo Feedback & Ocorrências.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="autoavaliacao">Autoavaliação</SelectItem>
                <SelectItem value="lider">Líder</SelectItem>
                <SelectItem value="par">Par</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {renderCampoComIA("Ponto forte", "ponto_forte")}
          {renderCampoComIA("Ponto a melhorar", "ponto_melhorar")}
          {renderCampoComIA("Recomendação", "recomendacao")}
          {renderCampoComIA("Comentário geral", "comentario")}
          <Button onClick={handleSubmit} className="w-full">Registrar Feedback</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
