import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Wand2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PdiMetaInsert, PdiMetaCategoria, PdiCheckinFrequencia } from "@/types/pdi";
import { PDI_META_CATEGORIA_LABELS, PDI_CHECKIN_FREQ_LABELS } from "@/types/pdi";

interface PdiMetaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdiId: string;
  onCreate: (data: PdiMetaInsert) => Promise<any>;
}

type StepField = "especifica" | "mensuravel" | "atingivel" | "relevante" | "temporal";

const STEP_FIELD_MAP: Record<number, StepField> = {
  1: "especifica",
  2: "mensuravel",
  3: "atingivel",
  4: "relevante",
  5: "temporal",
};

export const PdiMetaForm = ({ open, onOpenChange, pdiId, onCreate }: PdiMetaFormProps) => {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    titulo: "",
    categoria: "tecnica" as PdiMetaCategoria,
    especifica: "",
    mensuravel: "",
    atingivel: "",
    relevante: "",
    temporal: "",
    indicador_sucesso: "",
    valor_base: "",
    valor_alvo: "",
    unidade: "",
    data_inicio: "",
    data_fim: "",
    frequencia_checkin: "quinzenal" as PdiCheckinFrequencia,
    peso: "3",
    dependencias: "",
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [showSugestoes, setShowSugestoes] = useState(false);

  const steps = [
    { title: "Definição", fields: ["titulo", "categoria"] },
    { title: "S — Específica", fields: ["especifica"] },
    { title: "M — Mensurável", fields: ["mensuravel", "indicador_sucesso", "valor_base", "valor_alvo", "unidade"] },
    { title: "A — Atingível", fields: ["atingivel", "dependencias"] },
    { title: "R — Relevante", fields: ["relevante"] },
    { title: "T — Temporal", fields: ["temporal", "data_inicio", "data_fim", "frequencia_checkin", "peso"] },
  ];

  const currentField = STEP_FIELD_MAP[step];

  const callAi = async (mode: "sugestoes" | "melhorar") => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-pdi-smart", {
        body: {
          mode,
          step: currentField,
          titulo: form.titulo,
          categoria: form.categoria,
          texto: mode === "melhorar" ? form[currentField] : undefined,
        },
      });
      if (error) throw error;

      if (mode === "sugestoes") {
        setSugestoes(data.sugestoes || []);
        setShowSugestoes(true);
      } else if (mode === "melhorar" && data.texto_melhorado) {
        setForm(f => ({ ...f, [currentField]: data.texto_melhorado }));
        toast.success("Texto melhorado pela IA!");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao consultar IA");
    } finally {
      setAiLoading(false);
    }
  };

  const selectSugestao = (texto: string) => {
    if (currentField) {
      setForm(f => ({ ...f, [currentField]: texto }));
    }
    setShowSugestoes(false);
    setSugestoes([]);
  };

  const handleSubmit = async () => {
    if (!form.titulo) return;
    await onCreate({
      pdi_id: pdiId,
      titulo: form.titulo,
      categoria: form.categoria,
      especifica: form.especifica || undefined,
      mensuravel: form.mensuravel || undefined,
      atingivel: form.atingivel || undefined,
      relevante: form.relevante || undefined,
      temporal: form.temporal || undefined,
      indicador_sucesso: form.indicador_sucesso || undefined,
      valor_base: form.valor_base ? Number(form.valor_base) : undefined,
      valor_alvo: form.valor_alvo ? Number(form.valor_alvo) : undefined,
      data_inicio: form.data_inicio || undefined,
      data_fim: form.data_fim || undefined,
      frequencia_checkin: form.frequencia_checkin,
      peso: Number(form.peso),
      dependencias: form.dependencias || undefined,
    });
    onOpenChange(false);
    setStep(0);
    setSugestoes([]);
    setShowSugestoes(false);
    setForm({ titulo: "", categoria: "tecnica", especifica: "", mensuravel: "", atingivel: "", relevante: "", temporal: "", indicador_sucesso: "", valor_base: "", valor_alvo: "", unidade: "", data_inicio: "", data_fim: "", frequencia_checkin: "quinzenal", peso: "3", dependencias: "" });
  };

  const handleStepChange = (newStep: number) => {
    setStep(newStep);
    setShowSugestoes(false);
    setSugestoes([]);
  };

  const hasAiStep = step >= 1 && step <= 5;
  const fieldHasText = currentField ? form[currentField]?.trim().length > 0 : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Meta SMART — {steps[step].title}</DialogTitle>
          <DialogDescription>Passo {step + 1} de {steps.length}</DialogDescription>
        </DialogHeader>

        {/* Steps progress */}
        <div className="flex gap-1 mb-2">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        <div className="space-y-4 min-h-[180px]">
          {step === 0 && (
            <>
              <div>
                <Label>Título da Meta *</Label>
                <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Melhorar comunicação com equipe" />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v as PdiMetaCategoria }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PDI_META_CATEGORIA_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {step === 1 && (
            <div>
              <Label>O que exatamente será desenvolvido?</Label>
              <Textarea value={form.especifica} onChange={e => setForm(f => ({ ...f, especifica: e.target.value }))} rows={4} placeholder="Descreva de forma clara e específica o que o colaborador deve alcançar" />
            </div>
          )}

          {step === 2 && (
            <>
              <div>
                <Label>Como vamos medir que foi alcançada?</Label>
                <Textarea value={form.mensuravel} onChange={e => setForm(f => ({ ...f, mensuravel: e.target.value }))} rows={2} placeholder="Defina o critério de medição" />
              </div>
              <div>
                <Label>Indicador de sucesso (KPI)</Label>
                <Input value={form.indicador_sucesso} onChange={e => setForm(f => ({ ...f, indicador_sucesso: e.target.value }))} placeholder="Ex: NPS do time" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Valor base</Label><Input type="number" value={form.valor_base} onChange={e => setForm(f => ({ ...f, valor_base: e.target.value }))} /></div>
                <div><Label>Meta-alvo</Label><Input type="number" value={form.valor_alvo} onChange={e => setForm(f => ({ ...f, valor_alvo: e.target.value }))} /></div>
                <div><Label>Unidade</Label><Input value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))} placeholder="%, pts" /></div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <Label>Quais recursos a pessoa tem para alcançar?</Label>
                <Textarea value={form.atingivel} onChange={e => setForm(f => ({ ...f, atingivel: e.target.value }))} rows={3} placeholder="Recursos disponíveis: cursos, mentoria, ferramentas..." />
              </div>
              <div>
                <Label>Dependências</Label>
                <Input value={form.dependencias} onChange={e => setForm(f => ({ ...f, dependencias: e.target.value }))} placeholder="Materiais, cursos, mentorias necessárias" />
              </div>
            </>
          )}

          {step === 4 && (
            <div>
              <Label>Por que isso é importante para a função e empresa?</Label>
              <Textarea value={form.relevante} onChange={e => setForm(f => ({ ...f, relevante: e.target.value }))} rows={4} placeholder="Explique a relevância estratégica desta meta" />
            </div>
          )}

          {step === 5 && (
            <>
              <div>
                <Label>Até quando?</Label>
                <Textarea value={form.temporal} onChange={e => setForm(f => ({ ...f, temporal: e.target.value }))} rows={2} placeholder="Defina prazos e marcos intermediários" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Data início</Label><Input type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} /></div>
                <div><Label>Data fim</Label><Input type="date" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Frequência check-in</Label>
                  <Select value={form.frequencia_checkin} onValueChange={v => setForm(f => ({ ...f, frequencia_checkin: v as PdiCheckinFrequencia }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PDI_CHECKIN_FREQ_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Peso (1–5)</Label>
                  <Select value={form.peso} onValueChange={v => setForm(f => ({ ...f, peso: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* AI Buttons */}
          {hasAiStep && (
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => callAi("sugestoes")}
                disabled={aiLoading}
                className="gap-1.5 text-xs"
              >
                {aiLoading && !fieldHasText ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Sugestões IA
              </Button>
              {fieldHasText && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => callAi("melhorar")}
                  disabled={aiLoading}
                  className="gap-1.5 text-xs"
                >
                  {aiLoading && fieldHasText ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  Melhorar texto
                </Button>
              )}
            </div>
          )}

          {/* Suggestions Panel */}
          {showSugestoes && sugestoes.length > 0 && (
            <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">Selecione uma sugestão:</p>
              {sugestoes.map((s, i) => (
                <button
                  key={i}
                  onClick={() => selectSugestao(s)}
                  className="w-full text-left text-sm p-2.5 rounded-md border bg-background hover:bg-accent hover:border-primary/30 transition-colors cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={() => step > 0 ? handleStepChange(step - 1) : onOpenChange(false)}>
            {step > 0 ? "Voltar" : "Cancelar"}
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => handleStepChange(step + 1)} disabled={step === 0 && !form.titulo}>Próximo</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!form.titulo}>Criar Meta</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
