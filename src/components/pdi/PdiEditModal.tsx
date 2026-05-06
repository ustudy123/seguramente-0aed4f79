import { useState, useEffect } from "react";
import { ResponsavelSelect } from "@/components/planoAcao/ResponsavelSelect";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GradientDialogHeader } from "./GradientDialogHeader";
import type { Pdi, PdiPeriodo, PdiStatus } from "@/types/pdi";
import { PDI_PERIODO_LABELS, PDI_STATUS_LABELS } from "@/types/pdi";

interface PdiEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdi: Pdi;
  onUpdate: (data: any) => Promise<any>;
}

export const PdiEditModal = ({ open, onOpenChange, pdi, onUpdate }: PdiEditModalProps) => {
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    periodo: "trimestral" as PdiPeriodo,
    status: "rascunho" as PdiStatus,
    data_inicio: "",
    data_fim: "",
    responsavel_nome: "",
    co_responsavel_nome: "",
    gatilho: "",
    observacoes: "",
  });
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState<"titulo" | "descricao" | "observacoes" | null>(null);

  const sugerir = async (campo: "titulo" | "descricao" | "observacoes") => {
    setAiLoading(campo);
    try {
      const { data, error } = await supabase.functions.invoke("ai-pdi-sugestao", {
        body: {
          campo,
          colaborador_nome: pdi.colaborador_nome,
          colaborador_cargo: pdi.colaborador_cargo,
          colaborador_departamento: pdi.colaborador_departamento,
          periodo: form.periodo,
          gatilho: form.gatilho,
          titulo: form.titulo,
          descricao: form.descricao,
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

  const aiBtn = (campo: "titulo" | "descricao" | "observacoes") => (
    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary" onClick={() => sugerir(campo)} disabled={aiLoading !== null}>
      {aiLoading === campo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
      Sugerir com I.A.
    </Button>
  );

  useEffect(() => {
    if (open && pdi) {
      setForm({
        titulo: pdi.titulo || "",
        descricao: pdi.descricao || "",
        periodo: pdi.periodo,
        status: pdi.status,
        data_inicio: pdi.data_inicio?.split("T")[0] || "",
        data_fim: pdi.data_fim?.split("T")[0] || "",
        responsavel_nome: pdi.responsavel_nome || "",
        co_responsavel_nome: pdi.co_responsavel_nome || "",
        gatilho: pdi.gatilho || "",
        observacoes: pdi.observacoes || "",
      });
    }
  }, [open, pdi]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onUpdate({
        id: pdi.id,
        titulo: form.titulo,
        descricao: form.descricao || undefined,
        periodo: form.periodo,
        status: form.status,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        responsavel_nome: form.responsavel_nome || undefined,
        co_responsavel_nome: form.co_responsavel_nome || undefined,
        gatilho: form.gatilho || undefined,
        observacoes: form.observacoes || undefined,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-6">
        <VisuallyHidden>
          <DialogTitle>Editar PDI</DialogTitle>
          <DialogDescription>Atualize as informações do plano de desenvolvimento</DialogDescription>
        </VisuallyHidden>
        <GradientDialogHeader
          icon={Pencil}
          title="Editar PDI"
          description="Atualize as informações do plano de desenvolvimento"
          gradient="from-sky-500 via-blue-500 to-indigo-600"
          glow="shadow-sky-500/40"
        />

        <div className="space-y-4">
          {/* Colaborador (read-only) */}
          <div>
            <Label className="text-muted-foreground">Colaborador</Label>
            <p className="text-sm font-medium mt-1">{pdi.colaborador_nome}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Título *</Label>
              {aiBtn("titulo")}
            </div>
            <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Descrição</Label>
              {aiBtn("descricao")}
            </div>
            <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Período</Label>
              <Select value={form.periodo} onValueChange={v => setForm(f => ({ ...f, periodo: v as PdiPeriodo }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PDI_PERIODO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as PdiStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PDI_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data início *</Label>
              <Input type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
            </div>
            <div>
              <Label>Data fim *</Label>
              <Input type="date" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
            </div>
          </div>

          <div>
            <Label>Gatilho</Label>
            <Select value={form.gatilho || "none"} onValueChange={v => setForm(f => ({ ...f, gatilho: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                <SelectItem value="admissao">Admissão</SelectItem>
                <SelectItem value="avaliacao">Avaliação</SelectItem>
                <SelectItem value="cargo">Mudança de cargo</SelectItem>
                <SelectItem value="ergonomia">Ergonomia</SelectItem>
                <SelectItem value="solicitacao">Solicitação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Responsável (líder)</Label>
              <ResponsavelSelect
                value={form.responsavel_nome}
                onChange={(nome) => setForm(f => ({ ...f, responsavel_nome: nome }))}
                placeholder="Selecione ou digite o líder"
              />
            </div>
            <div>
              <Label>Co-responsável</Label>
              <Input value={form.co_responsavel_nome} onChange={e => setForm(f => ({ ...f, co_responsavel_nome: e.target.value }))} placeholder="Opcional" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Observações</Label>
              {aiBtn("observacoes")}
            </div>
            <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} placeholder="Anotações gerais sobre o PDI" />
          </div>

          <Button onClick={handleSubmit} disabled={saving || !form.titulo || !form.data_inicio || !form.data_fim} className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:opacity-95 shadow-lg shadow-sky-500/30">
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};