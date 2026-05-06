import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Wand2, Loader2, HelpCircle, Target } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PdiMetaInsert, PdiMetaCategoria, PdiCheckinFrequencia } from "@/types/pdi";
import { PDI_META_CATEGORIA_LABELS, PDI_CHECKIN_FREQ_LABELS } from "@/types/pdi";
import { GradientDialogHeader } from "./GradientDialogHeader";

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

const FieldHint = ({ text }: { text: string }) => (
  <p className="text-xs text-muted-foreground mt-0.5 mb-1">{text}</p>
);

const LabelWithHelp = ({ label, tooltip }: { label: string; tooltip: string }) => (
  <div className="flex items-center gap-1.5">
    <Label>{label}</Label>
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-[220px] text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
);

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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <VisuallyHidden>
          <DialogTitle>Nova Meta SMART — {steps[step].title}</DialogTitle>
          <DialogDescription>Passo {step + 1} de {steps.length}</DialogDescription>
        </VisuallyHidden>
        <GradientDialogHeader
          icon={Target}
          title={`Nova Meta SMART · ${steps[step].title}`}
          description="Específica · Mensurável · Atingível · Relevante · Temporal"
          gradient="from-pink-500 via-rose-500 to-fuchsia-600"
          glow="shadow-pink-500/40"
          step={{ current: step, total: steps.length, labels: steps.map(s => s.title) }}
        />

        <div className="space-y-4 min-h-[180px]">
          {/* STEP 0 — Definição */}
          {step === 0 && (
            <>
              <div>
                <Label>Nome da meta *</Label>
                <FieldHint text="Dê um nome curto e claro para identificar essa meta." />
                <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Melhorar comunicação com equipe" />
              </div>
              <div>
                <LabelWithHelp label="Área de desenvolvimento" tooltip="Escolha a área que mais se relaciona com essa meta: habilidade técnica, comportamento, liderança, etc." />
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

          {/* STEP 1 — Específica */}
          {step === 1 && (
            <div>
              <Label>O que exatamente será desenvolvido?</Label>
              <FieldHint text="Descreva com clareza o que a pessoa precisa aprender, melhorar ou entregar." />
              <Textarea value={form.especifica} onChange={e => setForm(f => ({ ...f, especifica: e.target.value }))} rows={4} placeholder="Ex: Realizar apresentações para clientes com confiança e clareza, dominando a estrutura de pitch e storytelling." />
            </div>
          )}

          {/* STEP 2 — Mensurável */}
          {step === 2 && (
            <>
              <div>
                <Label>Como saberemos que a meta foi alcançada?</Label>
                <FieldHint text="Defina um critério objetivo para medir o progresso. Ex: nota em prova, número de entregas, feedback positivo." />
                <Textarea value={form.mensuravel} onChange={e => setForm(f => ({ ...f, mensuravel: e.target.value }))} rows={2} placeholder="Ex: Aprovação com nota mínima de 80% na avaliação prática" />
              </div>
              <div>
                <LabelWithHelp label="O que será medido (indicador)" tooltip="O número ou dado que mostra se a pessoa está evoluindo. Ex: nota da avaliação, NPS, quantidade de entregas." />
                <Input value={form.indicador_sucesso} onChange={e => setForm(f => ({ ...f, indicador_sucesso: e.target.value }))} placeholder="Ex: Nota na avaliação prática" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <LabelWithHelp label="Situação atual" tooltip="O valor de hoje, o ponto de partida. Ex: se a nota atual é 50, coloque 50." />
                  <Input type="number" value={form.valor_base} onChange={e => setForm(f => ({ ...f, valor_base: e.target.value }))} placeholder="Ex: 50" />
                </div>
                <div>
                  <LabelWithHelp label="Onde queremos chegar" tooltip="O resultado esperado ao final da meta. Ex: se quer atingir nota 80, coloque 80." />
                  <Input type="number" value={form.valor_alvo} onChange={e => setForm(f => ({ ...f, valor_alvo: e.target.value }))} placeholder="Ex: 80" />
                </div>
              </div>
              <div>
                <Label>Unidade de medida</Label>
                <FieldHint text="Como esse número é medido: porcentagem (%), pontos (pts), horas, etc." />
                <Input value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))} placeholder="Ex: %, pontos, horas" />
              </div>
            </>
          )}

          {/* STEP 3 — Atingível */}
          {step === 3 && (
            <>
              <div>
                <Label>Quais recursos e apoio a pessoa terá?</Label>
                <FieldHint text="Liste o que está disponível para ajudar: cursos, mentoria, tempo dedicado, ferramentas, etc." />
                <Textarea value={form.atingivel} onChange={e => setForm(f => ({ ...f, atingivel: e.target.value }))} rows={3} placeholder="Ex: Acesso a plataforma de cursos, 2h semanais de mentoria com o líder técnico, licença do software X" />
              </div>
              <div>
                <LabelWithHelp label="O que precisa ser providenciado?" tooltip="Materiais, inscrições, acessos ou aprovações que ainda não foram garantidos." />
                <Input value={form.dependencias} onChange={e => setForm(f => ({ ...f, dependencias: e.target.value }))} placeholder="Ex: Inscrição no curso, acesso à ferramenta Y" />
              </div>
            </>
          )}

          {/* STEP 4 — Relevante */}
          {step === 4 && (
            <div>
              <Label>Por que essa meta é importante?</Label>
              <FieldHint text="Explique como essa meta contribui para o crescimento da pessoa e para os objetivos da empresa." />
              <Textarea value={form.relevante} onChange={e => setForm(f => ({ ...f, relevante: e.target.value }))} rows={4} placeholder="Ex: Essa competência é essencial para o próximo nível de carreira e está alinhada com a meta do time de aumentar a satisfação do cliente." />
            </div>
          )}

          {/* STEP 5 — Temporal */}
          {step === 5 && (
            <>
              <div>
                <Label>Qual o prazo e as etapas intermediárias?</Label>
                <FieldHint text="Defina quando começa, quando termina e se há marcos no meio do caminho." />
                <Textarea value={form.temporal} onChange={e => setForm(f => ({ ...f, temporal: e.target.value }))} rows={2} placeholder="Ex: Iniciar o curso no 1º mês, prática assistida no 2º mês, avaliação no 3º mês." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Início</Label>
                  <Input type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
                </div>
                <div>
                  <Label>Prazo final</Label>
                  <Input type="date" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Acompanhamento</Label>
                <FieldHint text="De quanto em quanto tempo você vai verificar o progresso dessa meta." />
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
                <Label>Importância (1–5)</Label>
                <FieldHint text="Quanto maior o número, mais essa meta influencia o progresso geral do PDI." />
                <Select value={form.peso} onValueChange={v => setForm(f => ({ ...f, peso: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
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
            <Button onClick={() => handleStepChange(step + 1)} disabled={step === 0 && !form.titulo} className="bg-gradient-to-r from-pink-500 to-fuchsia-600 hover:opacity-95 shadow-lg shadow-pink-500/30">Próximo</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!form.titulo} className="bg-gradient-to-r from-pink-500 to-fuchsia-600 hover:opacity-95 shadow-lg shadow-pink-500/30">Criar Meta</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
