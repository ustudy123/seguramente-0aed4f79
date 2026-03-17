import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useColaboradores } from "@/hooks/useColaboradores";
import { useAfastamentosAtivos } from "@/hooks/useAfastamentosAtivos";
import { AfastadoBadge } from "@/components/shared/AfastadoBadge";
import {
  CATEGORIAS_PRINCIPAIS,
  ORIGENS_PREDOMINANTES,
  FATORES_ERGONOMICOS,
  TURNOS,
  type EventoSST,
  type EventoSSTTipo,
} from "@/types/eventoSST";
import {
  Shield,
  AlertTriangle,
  CalendarDays,
  MapPin,
  User,
  Tag,
  FileText,
  Brain,
  Stethoscope,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: EventoSST | null;
  onSubmit: (data: Partial<EventoSST>) => Promise<void>;
  isPending: boolean;
}

const STEPS = [
  { id: 0, label: "Tipo & Local", icon: MapPin },
  { id: 1, label: "Envolvidos", icon: User },
  { id: 2, label: "Classificação", icon: Tag },
  { id: 3, label: "Descrição", icon: FileText },
  { id: 4, label: "Fatores", icon: Brain },
];

const STEPS_ACIDENTE = [
  { id: 0, label: "Tipo & Local", icon: MapPin },
  { id: 1, label: "Envolvidos", icon: User },
  { id: 2, label: "Classificação", icon: Tag },
  { id: 3, label: "Gravidade", icon: Stethoscope },
  { id: 4, label: "CAT", icon: FileCheck },
  { id: 5, label: "Descrição", icon: FileText },
  { id: 6, label: "Fatores", icon: Brain },
];

export const EventoSSTForm = ({ open, onOpenChange, initial, onSubmit, isPending }: Props) => {
  const { colaboradores } = useColaboradores();
  const [tipo, setTipo] = useState<EventoSSTTipo>(initial?.tipo || "incidente");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Record<string, any>>({});

  const steps = tipo === "acidente" ? STEPS_ACIDENTE : STEPS;
  const maxStep = steps.length - 1;

  useEffect(() => {
    setTipo(initial?.tipo || "incidente");
    setStep(0);
    setForm({
      data_evento: initial?.data_evento || new Date().toISOString().split("T")[0],
      hora_evento: initial?.hora_evento || "",
      unidade: initial?.unidade || "",
      setor: initial?.setor || "",
      local_especifico: initial?.local_especifico || "",
      turno: initial?.turno || "",
      colaborador_id: initial?.colaborador_id || "",
      colaborador_nome: initial?.colaborador_nome || "",
      colaborador_funcao: initial?.colaborador_funcao || "",
      colaborador_tempo_empresa: initial?.colaborador_tempo_empresa || "",
      outros_envolvidos: initial?.outros_envolvidos || "",
      categoria_principal: initial?.categoria_principal || "",
      origem_predominante: initial?.origem_predominante || "",
      descricao: initial?.descricao || "",
      percepcao_causa: initial?.percepcao_causa || "",
      gravidade_lesao: initial?.gravidade_lesao || "",
      afastamento: initial?.afastamento || "",
      obito: initial?.obito || false,
      atendimento: initial?.atendimento || "",
      cat_emitida: initial?.cat_emitida || false,
      cat_numero: initial?.cat_numero || "",
      cat_data_emissao: initial?.cat_data_emissao || "",
      cat_tipo: initial?.cat_tipo || "",
      cat_observacoes: initial?.cat_observacoes || "",
      fatores_ergonomicos: initial?.fatores_ergonomicos || [],
    });
  }, [initial, open]);

  // When tipo changes, reset step if it overflows
  useEffect(() => {
    const max = tipo === "acidente" ? STEPS_ACIDENTE.length - 1 : STEPS.length - 1;
    if (step > max) setStep(max);
  }, [tipo]);

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const handleSelectColaborador = (colaboradorId: string) => {
    const col = colaboradores.find((c) => c.id === colaboradorId);
    if (!col) return;
    set("colaborador_id", col.id);
    set("colaborador_nome", col.nome_completo);
    set("colaborador_funcao", col.cargo);
    set("colaborador_tempo_empresa", "");
  };

  const toggleFator = (f: string) => {
    const arr = form.fatores_ergonomicos as string[];
    set("fatores_ergonomicos", arr.includes(f) ? arr.filter((x: string) => x !== f) : [...arr, f]);
  };

  const handleSubmit = async () => {
    const cleaned = { ...form, tipo };
    const enumFields = ["gravidade_lesao", "afastamento", "atendimento", "turno", "categoria_principal", "origem_predominante", "cat_tipo"];
    for (const key of [...enumFields, "hora_evento", "cat_data_emissao"]) {
      if (cleaned[key] === "") cleaned[key] = null;
    }
    for (const key of Object.keys(cleaned)) {
      if (cleaned[key] === "" && key !== "tipo") cleaned[key] = null;
    }
    await onSubmit(cleaned);
    onOpenChange(false);
  };

  // Determine which step content to render based on step id label
  const currentStepLabel = steps[step]?.label;

  const renderStepContent = () => {
    switch (currentStepLabel) {
      case "Tipo & Local":
        return (
          <div className="space-y-5">
            {/* Tipo selection */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Tipo de Evento</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTipo("incidente")}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                    tipo === "incidente"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <Shield className={cn("w-8 h-8", tipo === "incidente" ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn("font-semibold text-sm", tipo === "incidente" ? "text-primary" : "text-muted-foreground")}>
                    Incidente
                  </span>
                  <span className="text-xs text-muted-foreground text-center leading-tight">
                    Quase-acidente, sem lesão
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTipo("acidente")}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                    tipo === "acidente"
                      ? "border-destructive bg-destructive/5 shadow-sm"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <AlertTriangle className={cn("w-8 h-8", tipo === "acidente" ? "text-destructive" : "text-muted-foreground")} />
                  <span className={cn("font-semibold text-sm", tipo === "acidente" ? "text-destructive" : "text-muted-foreground")}>
                    Acidente
                  </span>
                  <span className="text-xs text-muted-foreground text-center leading-tight">
                    Com lesão ou dano
                  </span>
                </button>
              </div>
            </div>

            {/* Date & Time */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Quando aconteceu?</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Data *</Label>
                  <Input type="date" value={form.data_evento} onChange={(e) => set("data_evento", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm">Hora</Label>
                  <Input type="time" value={form.hora_evento} onChange={(e) => set("hora_evento", e.target.value)} />
                </div>
              </div>
            </div>

            {/* Location */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Onde aconteceu?</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Unidade / Estabelecimento</Label>
                  <Input value={form.unidade} onChange={(e) => set("unidade", e.target.value)} placeholder="Ex: Matriz, Filial SP" />
                </div>
                <div>
                  <Label className="text-sm">Setor / Área</Label>
                  <Input value={form.setor} onChange={(e) => set("setor", e.target.value)} placeholder="Ex: Produção, Almoxarifado" />
                </div>
                <div>
                  <Label className="text-sm">Local Específico</Label>
                  <Input value={form.local_especifico} onChange={(e) => set("local_especifico", e.target.value)} placeholder="Ex: Linha 3, próximo ao refeitório" />
                </div>
                <div>
                  <Label className="text-sm">Turno</Label>
                  <Select value={form.turno} onValueChange={(v) => set("turno", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione o turno" /></SelectTrigger>
                    <SelectContent>
                      {TURNOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        );

      case "Envolvidos":
        return (
          <div className="space-y-5">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Colaborador Principal</Label>
              <Select
                value={form.colaborador_id || "manual"}
                onValueChange={(v) => {
                  if (v === "manual") {
                    set("colaborador_id", "");
                    set("colaborador_nome", "");
                    set("colaborador_funcao", "");
                  } else {
                    handleSelectColaborador(v);
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione do cadastro ou digite" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">✏️ Digitar manualmente</SelectItem>
                  {colaboradores.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome_completo} — {c.cargo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!form.colaborador_id ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Nome do Colaborador</Label>
                  <Input value={form.colaborador_nome} onChange={(e) => set("colaborador_nome", e.target.value)} placeholder="Nome completo" />
                </div>
                <div>
                  <Label className="text-sm">Função / Cargo</Label>
                  <Input value={form.colaborador_funcao} onChange={(e) => set("colaborador_funcao", e.target.value)} placeholder="Ex: Operador" />
                </div>
              </div>
            ) : (
              <div className="bg-muted/50 border rounded-xl p-4 space-y-1">
                <p className="text-sm"><strong>Nome:</strong> {form.colaborador_nome}</p>
                <p className="text-sm"><strong>Função:</strong> {form.colaborador_funcao}</p>
                {form.colaborador_tempo_empresa && (
                  <p className="text-sm"><strong>Tempo de empresa:</strong> {form.colaborador_tempo_empresa}</p>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Testemunhas / Outros envolvidos</Label>
              <Textarea
                value={form.outros_envolvidos}
                onChange={(e) => set("outros_envolvidos", e.target.value)}
                rows={3}
                placeholder="Nomes de outros envolvidos ou testemunhas do ocorrido..."
              />
            </div>
          </div>
        );

      case "Classificação":
        return (
          <div className="space-y-5">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Categoria Principal</Label>
              <p className="text-xs text-muted-foreground mb-2">O que melhor descreve o tipo de evento?</p>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIAS_PRINCIPAIS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("categoria_principal", c)}
                    className={cn(
                      "text-left text-sm px-3 py-2.5 rounded-lg border transition-all",
                      form.categoria_principal === c
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-border hover:border-muted-foreground/30 text-foreground"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Origem Predominante</Label>
              <p className="text-xs text-muted-foreground mb-2">Qual a causa raiz mais provável?</p>
              <div className="grid grid-cols-1 gap-2">
                {ORIGENS_PREDOMINANTES.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => set("origem_predominante", o)}
                    className={cn(
                      "text-left text-sm px-3 py-2.5 rounded-lg border transition-all",
                      form.origem_predominante === o
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-border hover:border-muted-foreground/30 text-foreground"
                    )}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case "Gravidade":
        return (
          <div className="space-y-5">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Gravidade da Lesão</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "sem_lesao", label: "Sem lesão aparente", color: "text-green-600" },
                  { value: "leve", label: "Lesão leve", color: "text-yellow-600" },
                  { value: "moderada", label: "Lesão moderada", color: "text-orange-600" },
                  { value: "grave", label: "Lesão grave", color: "text-destructive" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set("gravidade_lesao", opt.value)}
                    className={cn(
                      "text-left text-sm px-3 py-3 rounded-lg border-2 transition-all font-medium",
                      form.gravidade_lesao === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Afastamento</Label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { value: "sem_afastamento", label: "Não houve afastamento" },
                  { value: "ate_15_dias", label: "Sim, até 15 dias" },
                  { value: "mais_15_dias", label: "Sim, mais de 15 dias" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set("afastamento", opt.value)}
                    className={cn(
                      "text-left text-sm px-3 py-2.5 rounded-lg border transition-all",
                      form.afastamento === opt.value
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Atendimento Médico</Label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { value: "nao_necessario", label: "Não foi necessário" },
                  { value: "ambulatorial", label: "Ambulatorial" },
                  { value: "hospitalar", label: "Hospitalar" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set("atendimento", opt.value)}
                    className={cn(
                      "text-left text-sm px-3 py-2.5 rounded-lg border transition-all",
                      form.atendimento === opt.value
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
              <Checkbox checked={form.obito} onCheckedChange={(v) => set("obito", v)} id="obito" />
              <Label htmlFor="obito" className="text-sm font-medium cursor-pointer">Houve óbito</Label>
            </div>
          </div>
        );

      case "CAT":
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-4 rounded-xl border bg-muted/30">
              <Checkbox checked={form.cat_emitida} onCheckedChange={(v) => set("cat_emitida", v)} id="cat_emitida" />
              <div>
                <Label htmlFor="cat_emitida" className="text-sm font-medium cursor-pointer">Houve emissão de CAT?</Label>
                <p className="text-xs text-muted-foreground">Comunicação de Acidente de Trabalho</p>
              </div>
            </div>

            {form.cat_emitida && (
              <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">Número da CAT</Label>
                    <Input value={form.cat_numero} onChange={(e) => set("cat_numero", e.target.value)} placeholder="Número" />
                  </div>
                  <div>
                    <Label className="text-sm">Data de Emissão</Label>
                    <Input type="date" value={form.cat_data_emissao} onChange={(e) => set("cat_data_emissao", e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-sm">Tipo de CAT</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {[
                      { value: "inicial", label: "Inicial" },
                      { value: "reabertura", label: "Reabertura" },
                      { value: "comunicacao_obito", label: "Comunicação de Óbito" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => set("cat_tipo", opt.value)}
                        className={cn(
                          "text-sm px-3 py-2.5 rounded-lg border transition-all text-center",
                          form.cat_tipo === opt.value
                            ? "border-primary bg-primary/5 text-primary font-medium"
                            : "border-border hover:border-muted-foreground/30"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-sm">Observações sobre a CAT</Label>
                  <Textarea value={form.cat_observacoes} onChange={(e) => set("cat_observacoes", e.target.value)} rows={2} />
                </div>
              </div>
            )}

            {!form.cat_emitida && (
              <div className="text-center py-6 text-muted-foreground">
                <FileCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Marque acima se a CAT foi emitida para preencher os dados.</p>
              </div>
            )}
          </div>
        );

      case "Descrição":
        return (
          <div className="space-y-5">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">O que aconteceu? *</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => set("descricao", e.target.value)}
                rows={6}
                placeholder="Descreva o que aconteceu, em ordem cronológica:&#10;&#10;• Atividade realizada no momento&#10;• Local exato e condições do ambiente&#10;• Como ocorreu o evento&#10;• Consequências imediatas"
                className="resize-none"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Percepção Inicial da Causa</Label>
              <Textarea
                value={form.percepcao_causa}
                onChange={(e) => set("percepcao_causa", e.target.value)}
                rows={3}
                placeholder="Na sua percepção, o que pode ter causado este evento?"
                className="resize-none"
              />
            </div>
          </div>
        );

      case "Fatores":
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Fatores Ergonômicos e Psicossociais</Label>
              <p className="text-xs text-muted-foreground mb-3">Selecione todos os fatores que podem ter contribuído para o evento.</p>
              {(form.fatores_ergonomicos as string[] || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(form.fatores_ergonomicos as string[]).map((f) => (
                    <Badge key={f} variant="secondary" className="text-xs cursor-pointer" onClick={() => toggleFator(f)}>
                      {f} ✕
                    </Badge>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 gap-1.5">
                {FATORES_ERGONOMICOS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFator(f)}
                    className={cn(
                      "flex items-center gap-2.5 text-left text-sm px-3 py-2 rounded-lg border transition-all",
                      (form.fatores_ergonomicos as string[] || []).includes(f)
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-muted-foreground/30 text-foreground"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      (form.fatores_ergonomicos as string[] || []).includes(f)
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/30"
                    )}>
                      {(form.fatores_ergonomicos as string[] || []).includes(f) && (
                        <Check className="w-3 h-3 text-primary-foreground" />
                      )}
                    </div>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="text-lg">
            {initial ? "Editar Evento" : "Registrar Novo Evento SST"}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === step;
              const isDone = i < step;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStep(i)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap shrink-0",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isDone
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {isDone ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 max-h-[55vh] px-6">
          <div className="pb-4">
            {renderStepContent()}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-3 border-t bg-muted/30">
          <div className="text-xs text-muted-foreground">
            Etapa {step + 1} de {steps.length}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
              </Button>
            )}
            {step < maxStep ? (
              <Button size="sm" onClick={() => setStep(step + 1)}>
                Próximo <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleSubmit} disabled={isPending || !form.data_evento}>
                {isPending ? "Salvando..." : initial ? "Salvar Alterações" : "Registrar Evento"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
