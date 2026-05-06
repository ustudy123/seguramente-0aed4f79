import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Wand2, MessageSquareHeart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GradientDialogHeader } from "./GradientDialogHeader";
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

type CampoFb = "ponto_forte" | "ponto_melhorar" | "recomendacao" | "comentario";

export const PdiFeedbackForm = ({ open, onOpenChange, pdiId, pdiTitulo, colaboradorId, colaboradorNome, onCreate }: PdiFeedbackFormProps) => {
  const [form, setForm] = useState({
    tipo: "lider",
    ponto_forte: "",
    ponto_melhorar: "",
    recomendacao: "",
    comentario: "",
  });
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const sugerir = async (campo: CampoFb) => {
    setAiLoading(`s-${campo}`);
    try {
      const { data, error } = await supabase.functions.invoke("ai-pdi-sugestao", {
        body: {
          campo,
          colaborador_nome: colaboradorNome,
          titulo: pdiTitulo,
          contexto_extra: `Tipo: ${form.tipo}. Ponto forte atual: ${form.ponto_forte}. Melhorar: ${form.ponto_melhorar}. Recomendação: ${form.recomendacao}.`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setForm(f => ({ ...f, [campo]: data?.sugestao || "" }));
      toast.success("Sugestão aplicada");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar sugestão");
    } finally {
      setAiLoading(null);
    }
  };

  const estruturar = async (campo: CampoFb) => {
    const texto = form[campo];
    if (!texto || texto.trim().length < 5) {
      toast.error("Escreva algumas palavras antes de estruturar.");
      return;
    }
    setAiLoading(`e-${campo}`);
    try {
      const { data, error } = await supabase.functions.invoke("ai-feedback", {
        body: { descricao: texto, categoria: "desenvolvimento", colaborador_nome: colaboradorNome },
      });
      if (error) throw error;
      if (data?.texto_estruturado) {
        setForm(f => ({ ...f, [campo]: data.texto_estruturado }));
        toast.success("Texto estruturado pela IA!");
      }
    } catch {
      toast.error("Erro ao gerar texto com IA.");
    } finally {
      setAiLoading(null);
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

  const renderCampo = (label: string, campo: CampoFb) => (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
        <Label>{label}</Label>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-violet-600 hover:text-violet-700" onClick={() => sugerir(campo)} disabled={aiLoading !== null}>
            {aiLoading === `s-${campo}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Sugerir
          </Button>
          {form[campo]?.trim().length >= 5 && (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-violet-600 hover:text-violet-700" onClick={() => estruturar(campo)} disabled={aiLoading !== null}>
              {aiLoading === `e-${campo}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              Estruturar
            </Button>
          )}
        </div>
      </div>
      <Textarea value={form[campo]} onChange={e => setForm(f => ({ ...f, [campo]: e.target.value }))} rows={2} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-6">
        <VisuallyHidden>
          <DialogTitle>Novo Feedback</DialogTitle>
          <DialogDescription>Registre um feedback estruturado</DialogDescription>
        </VisuallyHidden>
        <GradientDialogHeader
          icon={MessageSquareHeart}
          title="Novo Feedback"
          description="Estruturado e visível também em Feedback & Ocorrências"
          gradient="from-violet-500 via-purple-500 to-fuchsia-600"
          glow="shadow-violet-500/40"
        />
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
          {renderCampo("Ponto forte", "ponto_forte")}
          {renderCampo("Ponto a melhorar", "ponto_melhorar")}
          {renderCampo("Recomendação", "recomendacao")}
          {renderCampo("Comentário geral", "comentario")}
          <Button onClick={handleSubmit} className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:opacity-95 shadow-lg shadow-violet-500/30">
            Registrar Feedback
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
