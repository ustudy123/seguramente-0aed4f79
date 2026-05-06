import { useState } from "react";
import { ResponsavelSelect } from "@/components/planoAcao/ResponsavelSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Target } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useColaboradores } from "@/hooks/useColaboradores";
import type { PdiInsert, PdiPeriodo } from "@/types/pdi";
import { PDI_PERIODO_LABELS } from "@/types/pdi";
import { GradientDialogHeader } from "./GradientDialogHeader";

interface PdiFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: PdiInsert) => Promise<any>;
  isCreating: boolean;
}

export const PdiFormModal = ({ open, onOpenChange, onCreate, isCreating }: PdiFormModalProps) => {
  const { colaboradores } = useColaboradores();
  const [form, setForm] = useState({
    colaborador_id: "",
    titulo: "",
    descricao: "",
    periodo: "trimestral" as PdiPeriodo,
    data_inicio: new Date().toISOString().split("T")[0],
    data_fim: "",
    responsavel_nome: "",
    gatilho: "",
    observacoes: "",
  });

  const selectedColab = colaboradores.find(c => c.id === form.colaborador_id);
  const [aiLoading, setAiLoading] = useState<"titulo" | "descricao" | "observacoes" | null>(null);

  const sugerir = async (campo: "titulo" | "descricao" | "observacoes") => {
    if (!selectedColab) {
      toast.error("Selecione um colaborador antes de pedir sugestão");
      return;
    }
    setAiLoading(campo);
    try {
      const { data, error } = await supabase.functions.invoke("ai-pdi-sugestao", {
        body: {
          campo,
          colaborador_nome: selectedColab.nome_completo,
          colaborador_cargo: selectedColab.cargo,
          colaborador_departamento: selectedColab.departamento,
          periodo: form.periodo,
          gatilho: form.gatilho,
          titulo: form.titulo,
          descricao: form.descricao,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const sugestao = data?.sugestao?.trim();
      if (!sugestao) throw new Error("Sem sugestão");
      setForm(f => ({ ...f, [campo]: sugestao }));
      toast.success("Sugestão aplicada");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar sugestão");
    } finally {
      setAiLoading(null);
    }
  };

  const handleSubmit = async () => {
    if (!form.colaborador_id || !form.titulo || !form.data_inicio || !form.data_fim) return;
    await onCreate({
      colaborador_id: form.colaborador_id,
      colaborador_nome: selectedColab?.nome_completo || "",
      colaborador_cargo: selectedColab?.cargo,
      colaborador_departamento: selectedColab?.departamento || undefined,
      titulo: form.titulo,
      descricao: form.descricao || undefined,
      periodo: form.periodo,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim,
      responsavel_nome: form.responsavel_nome || undefined,
      gatilho: form.gatilho || undefined,
      observacoes: form.observacoes || undefined,
    });
    onOpenChange(false);
    setForm({ colaborador_id: "", titulo: "", descricao: "", periodo: "trimestral", data_inicio: new Date().toISOString().split("T")[0], data_fim: "", responsavel_nome: "", gatilho: "", observacoes: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-6">
        <GradientDialogHeader
          icon={Target}
          title="Novo PDI"
          description="Crie um plano de desenvolvimento estruturado para um colaborador"
          gradient="from-primary via-info to-purple-600"
          glow="shadow-primary/40"
        />

        <div className="space-y-4">
          <div>
            <Label>Colaborador *</Label>
            <Select value={form.colaborador_id} onValueChange={v => setForm(f => ({ ...f, colaborador_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent position="popper" className="max-h-60 overflow-y-auto z-[9999]">
                {colaboradores.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">Nenhum colaborador encontrado</div>
                ) : (
                  colaboradores.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome_completo} — {c.cargo}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Título *</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary" onClick={() => sugerir("titulo")} disabled={aiLoading !== null}>
                {aiLoading === "titulo" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Sugerir com I.A.
              </Button>
            </div>
            <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: PDI Q1 2026 — João Silva" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Descrição</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary" onClick={() => sugerir("descricao")} disabled={aiLoading !== null}>
                {aiLoading === "descricao" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Sugerir com I.A.
              </Button>
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
              <Label>Gatilho</Label>
              <Select value={form.gatilho} onValueChange={v => setForm(f => ({ ...f, gatilho: v }))}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admissao">Admissão</SelectItem>
                  <SelectItem value="avaliacao">Avaliação</SelectItem>
                  <SelectItem value="cargo">Mudança de cargo</SelectItem>
                  <SelectItem value="ergonomia">Ergonomia</SelectItem>
                  <SelectItem value="solicitacao">Solicitação</SelectItem>
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
            <Label>Responsável (líder)</Label>
            <ResponsavelSelect
              value={form.responsavel_nome}
              onChange={(nome) => setForm(f => ({ ...f, responsavel_nome: nome }))}
              placeholder="Selecione ou digite o líder responsável"
            />
          </div>

          <Button onClick={handleSubmit} disabled={isCreating || !form.colaborador_id || !form.titulo || !form.data_fim} className="w-full">
            {isCreating ? "Criando..." : "Criar PDI"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
