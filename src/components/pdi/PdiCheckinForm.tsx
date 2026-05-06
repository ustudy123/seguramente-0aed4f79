import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarCheck, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GradientDialogHeader } from "./GradientDialogHeader";
import type { PdiMeta, PdiCheckinInsert } from "@/types/pdi";

interface PdiCheckinFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metas: PdiMeta[];
  onCreate: (data: PdiCheckinInsert) => Promise<any>;
}

type CampoIA = "avancos" | "bloqueios" | "proximo_passo";

export const PdiCheckinForm = ({ open, onOpenChange, metas, onCreate }: PdiCheckinFormProps) => {
  const [form, setForm] = useState({
    meta_id: "",
    avancos: "",
    bloqueios: "",
    proximo_passo: "",
    valor_atualizado: "",
  });
  const [aiLoading, setAiLoading] = useState<CampoIA | null>(null);

  const metaSelecionada = metas.find(m => m.id === form.meta_id);

  const sugerir = async (campo: CampoIA) => {
    if (!metaSelecionada) {
      toast.error("Selecione a meta antes de pedir sugestão");
      return;
    }
    setAiLoading(campo);
    try {
      const { data, error } = await supabase.functions.invoke("ai-pdi-sugestao", {
        body: {
          campo,
          meta_titulo: metaSelecionada.titulo,
          contexto_extra: `Avanços: ${form.avancos}. Bloqueios: ${form.bloqueios}. Próx: ${form.proximo_passo}`,
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

  const handleSubmit = async () => {
    if (!form.meta_id) return;
    await onCreate({
      meta_id: form.meta_id,
      avancos: form.avancos || undefined,
      bloqueios: form.bloqueios || undefined,
      proximo_passo: form.proximo_passo || undefined,
      valor_atualizado: form.valor_atualizado ? Number(form.valor_atualizado) : undefined,
    });
    onOpenChange(false);
    setForm({ meta_id: "", avancos: "", bloqueios: "", proximo_passo: "", valor_atualizado: "" });
  };

  const renderCampo = (label: string, campo: CampoIA, placeholder?: string) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label>{label}</Label>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-emerald-600 hover:text-emerald-700" onClick={() => sugerir(campo)} disabled={aiLoading !== null}>
          {aiLoading === campo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          Sugerir com I.A.
        </Button>
      </div>
      <Textarea value={form[campo]} onChange={e => setForm(f => ({ ...f, [campo]: e.target.value }))} rows={2} placeholder={placeholder} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <VisuallyHidden>
          <DialogTitle>Novo Check-in</DialogTitle>
          <DialogDescription>Registre o progresso de uma meta</DialogDescription>
        </VisuallyHidden>
        <GradientDialogHeader
          icon={CalendarCheck}
          title="Novo Check-in"
          description="Registre avanços, bloqueios e próximos passos da meta"
          gradient="from-emerald-500 via-teal-500 to-cyan-600"
          glow="shadow-emerald-500/40"
        />
        <div className="space-y-4">
          <div>
            <Label>Meta *</Label>
            <Select value={form.meta_id} onValueChange={v => setForm(f => ({ ...f, meta_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione a meta" /></SelectTrigger>
              <SelectContent>
                {metas.map(m => <SelectItem key={m.id} value={m.id}>{m.titulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {renderCampo("O que avancei desde o último check-in?", "avancos", "Ex: concluí módulo 1 do curso e apliquei na reunião…")}
          {renderCampo("O que me travou?", "bloqueios", "Ex: falta de tempo, dependência de aprovação…")}
          {renderCampo("Próximo passo", "proximo_passo", "Ex: agendar mentoria com líder na próxima semana")}
          <div>
            <Label>Atualizar valor do indicador</Label>
            <Input type="number" value={form.valor_atualizado} onChange={e => setForm(f => ({ ...f, valor_atualizado: e.target.value }))} placeholder="Opcional" />
          </div>
          <Button onClick={handleSubmit} disabled={!form.meta_id} className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 shadow-lg shadow-emerald-500/30">
            Registrar Check-in
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
