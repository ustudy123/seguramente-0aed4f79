import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles, Loader2, Lightbulb, Target, MapPin, Calendar, User, DollarSign, Wrench, HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePlanoAcao } from "@/hooks/usePlanoAcao";
import { cn } from "@/lib/utils";
import type { PlanoAcao } from "@/types/planoAcao";
import { ResponsavelSelect } from "./ResponsavelSelect";

const formSchema = z.object({
  titulo: z.string().min(3, "Mínimo 3 caracteres"),
  descricao: z.string().optional(),
  porque: z.string().optional(),
  onde: z.string().optional(),
  prazo: z.string().optional(),
  responsavel_nome: z.string().optional(),
  como: z.string().optional(),
  custo_estimado: z.string().optional(),
  tipo: z.enum(["corretiva", "preventiva", "melhoria"]),
  origem_modulo: z.enum(["manual", "ergonomia", "ouvidoria", "epi", "ponto", "humor", "psicossocial", "atestados", "sst", "compliance_sst", "compliance", "documentos", "avaliacoes", "estrategia", "gro"]),
  gravidade: z.number().min(1).max(5),
  urgencia: z.number().min(1).max(5),
  tendencia: z.number().min(1).max(5),
  exige_evidencia: z.boolean().default(false),
});

type FormData = z.infer<typeof formSchema>;

interface PlanoAcaoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  origem?: { modulo: string; id?: string; descricao?: string };
  editData?: PlanoAcao;
}

const GUT_LABELS: Record<number, string> = {
  1: "Muito baixo", 2: "Baixo", 3: "Médio", 4: "Alto", 5: "Muito alto",
};

interface AIButtonProps {
  campo: string;
  getContext: () => { titulo: string; descricao: string; origem: string; valorAtual: string };
  onResult: (texto: string) => void;
  hint?: string;
}

function AIFieldButton({ campo, getContext, onResult, hint }: AIButtonProps) {
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    const ctx = getContext();
    if (!ctx.titulo && campo !== "titulo") {
      toast.info("Preencha o título antes para a IA ter contexto");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-plano-acao", {
        body: {
          tipo: "sugerir_campo",
          contexto: ctx.titulo || campo,
          dados: { campo, ...ctx },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const texto = (data?.sugestao || data?.resumo || "").toString().trim();
      if (!texto) throw new Error("Sem sugestão");
      onResult(texto);
      toast.success("Sugestão aplicada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar sugestão");
    } finally {
      setLoading(false);
    }
  };
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-violet-600 hover:text-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30"
            onClick={handle}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[220px]">
          {hint || "Sugerir com IA"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const FieldLabel = ({ icon: Icon, color, children, ai }: { icon: any; color: string; children: React.ReactNode; ai?: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-2 mb-1">
    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
      <Icon className={cn("h-3.5 w-3.5", color)} />
      <span>{children}</span>
    </div>
    {ai}
  </div>
);

export function PlanoAcaoFormModal({ open, onOpenChange, origem, editData }: PlanoAcaoFormModalProps) {
  const { createAcao, isCreatingAcao, updateAcao, isUpdatingAcao } = usePlanoAcao();
  const isEditing = !!editData;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: "", descricao: "", porque: "", onde: "", prazo: "",
      responsavel_nome: "", como: "", custo_estimado: "",
      tipo: "corretiva",
      origem_modulo: (origem?.modulo as any) || "manual",
      gravidade: 3, urgencia: 3, tendencia: 3, exige_evidencia: false,
    },
  });

  useEffect(() => {
    if (editData && open) {
      form.reset({
        titulo: editData.titulo || "",
        descricao: editData.descricao || "",
        porque: editData.porque || "",
        onde: editData.onde || "",
        prazo: editData.prazo || "",
        responsavel_nome: editData.responsavel_nome || "",
        como: editData.como || "",
        custo_estimado: editData.custo_estimado?.toString() || "",
        tipo: (editData.tipo as any) || "corretiva",
        origem_modulo: (editData.origem_modulo as any) || "manual",
        gravidade: editData.gravidade || 3,
        urgencia: editData.urgencia || 3,
        tendencia: editData.tendencia || 3,
        exige_evidencia: editData.exige_evidencia || false,
      });
    }
  }, [editData, open, form]);

  const g = form.watch("gravidade");
  const u = form.watch("urgencia");
  const t = form.watch("tendencia");
  const gutScore = g * u * t;
  const prioridade = gutScore >= 64 ? "Imediato" : gutScore >= 27 ? "Urgente" : gutScore >= 8 ? "Médio" : "Baixo";
  const prioridadeColor =
    gutScore >= 64 ? "bg-red-500 text-white" :
    gutScore >= 27 ? "bg-orange-500 text-white" :
    gutScore >= 8 ? "bg-yellow-500 text-white" : "bg-emerald-500 text-white";

  const getCtx = () => ({
    titulo: form.getValues("titulo") || "",
    descricao: form.getValues("descricao") || "",
    origem: form.getValues("origem_modulo") || "manual",
    valorAtual: "",
  });

  const onSubmit = async (data: FormData) => {
    const payload = {
      titulo: data.titulo,
      descricao: data.descricao || undefined,
      porque: data.porque || undefined,
      onde: data.onde || undefined,
      prazo: data.prazo || undefined,
      responsavel_nome: data.responsavel_nome || undefined,
      como: data.como || undefined,
      custo_estimado: data.custo_estimado ? parseFloat(data.custo_estimado) : undefined,
      tipo: data.tipo,
      origem_modulo: data.origem_modulo,
      origem_id: origem?.id,
      origem_descricao: origem?.descricao,
      gravidade: data.gravidade,
      urgencia: data.urgencia,
      tendencia: data.tendencia,
      prioridade: gutScore >= 64 ? 'imediato' as const : gutScore >= 27 ? 'urgente' as const : gutScore >= 8 ? 'medio' as const : 'baixo' as const,
      exige_evidencia: data.exige_evidencia,
    };
    if (isEditing && editData) {
      await updateAcao({ id: editData.id, data: payload });
    } else {
      await createAcao(payload);
    }
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden">
        {/* Header com gradiente */}
        <DialogHeader className="px-6 py-4 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 text-white">
          <DialogTitle className="flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5" />
            {isEditing ? "Editar Ação" : "Nova Ação 5W2H"}
            <Badge className="ml-2 bg-white/20 text-white border-white/30 hover:bg-white/30">
              IA disponível em cada campo
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-white/80 text-xs">
            Preencha os campos do plano. Use o ✨ para sugestões automáticas com IA.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="px-6 py-4 space-y-3">
            {/* Linha 1: Título + Tipo + Origem */}
            <div className="grid grid-cols-12 gap-3">
              <FormField
                control={form.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem className="col-span-6">
                    <FieldLabel icon={Target} color="text-violet-600" ai={
                      <AIFieldButton
                        campo="titulo"
                        getContext={() => ({ ...getCtx(), valorAtual: field.value || "" })}
                        onResult={(t) => field.onChange(t)}
                        hint="Sugerir título com base na descrição/origem"
                      />
                    }>O QUÊ * (Título)</FieldLabel>
                    <FormControl>
                      <Input placeholder="Ex: Implementar pausas ativas obrigatórias" {...field} className="h-9" />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem className="col-span-3">
                    <FieldLabel icon={Wrench} color="text-slate-500">Tipo</FieldLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-9"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="corretiva">Corretiva</SelectItem>
                        <SelectItem value="preventiva">Preventiva</SelectItem>
                        <SelectItem value="melhoria">Melhoria</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="origem_modulo"
                render={({ field }) => (
                  <FormItem className="col-span-3">
                    <FieldLabel icon={Lightbulb} color="text-slate-500">Origem</FieldLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-9"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="ergonomia">Ergonomia</SelectItem>
                        <SelectItem value="ouvidoria">Ouvidoria</SelectItem>
                        <SelectItem value="epi">EPIs</SelectItem>
                        <SelectItem value="ponto">Ponto</SelectItem>
                        <SelectItem value="humor">Humor</SelectItem>
                        <SelectItem value="psicossocial">Psicossocial</SelectItem>
                        <SelectItem value="sst">SST</SelectItem>
                        <SelectItem value="estrategia">Estratégia</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            {/* Linha 2: Descrição + Por quê */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel icon={HelpCircle} color="text-blue-600" ai={
                      <AIFieldButton campo="descricao" getContext={() => ({ ...getCtx(), valorAtual: field.value || "" })} onResult={(t) => field.onChange(t)} />
                    }>Descrição</FieldLabel>
                    <FormControl>
                      <Textarea placeholder="Escopo e resultados esperados..." rows={2} {...field} className="resize-none text-sm" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="porque"
                render={({ field }) => (
                  <FormItem>
                    <FieldLabel icon={HelpCircle} color="text-amber-600" ai={
                      <AIFieldButton campo="porque" getContext={() => ({ ...getCtx(), valorAtual: field.value || "" })} onResult={(t) => field.onChange(t)} />
                    }>POR QUÊ (Justificativa)</FieldLabel>
                    <FormControl>
                      <Textarea placeholder="Qual problema resolve ou oportunidade aproveita?" rows={2} {...field} className="resize-none text-sm" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Linha 3: Onde + Quando + Quem + Quanto */}
            <div className="grid grid-cols-12 gap-3">
              <FormField
                control={form.control}
                name="onde"
                render={({ field }) => (
                  <FormItem className="col-span-3">
                    <FieldLabel icon={MapPin} color="text-rose-600" ai={
                      <AIFieldButton campo="onde" getContext={() => ({ ...getCtx(), valorAtual: field.value || "" })} onResult={(t) => field.onChange(t)} />
                    }>ONDE</FieldLabel>
                    <FormControl><Input placeholder="Setor / processo" {...field} className="h-9" /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prazo"
                render={({ field }) => (
                  <FormItem className="col-span-3">
                    <FieldLabel icon={Calendar} color="text-emerald-600">QUANDO</FieldLabel>
                    <FormControl><Input type="date" {...field} className="h-9" /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="responsavel_nome"
                render={({ field }) => (
                  <FormItem className="col-span-4">
                    <FieldLabel icon={User} color="text-indigo-600">QUEM</FieldLabel>
                    <FormControl>
                      <ResponsavelSelect value={field.value || ""} onChange={(nome) => field.onChange(nome)} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="custo_estimado"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FieldLabel icon={DollarSign} color="text-green-600" ai={
                      <AIFieldButton campo="custo_estimado" getContext={() => ({ ...getCtx(), valorAtual: field.value || "" })} onResult={(t) => field.onChange(t.replace(/[^0-9.]/g, ""))} hint="Estimar custo com IA" />
                    }>QUANTO (R$)</FieldLabel>
                    <FormControl><Input type="number" step="0.01" min="0" placeholder="0,00" {...field} className="h-9" /></FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Linha 4: Como (full) */}
            <FormField
              control={form.control}
              name="como"
              render={({ field }) => (
                <FormItem>
                  <FieldLabel icon={Wrench} color="text-cyan-600" ai={
                    <AIFieldButton campo="como" getContext={() => ({ ...getCtx(), valorAtual: field.value || "" })} onResult={(t) => field.onChange(t)} />
                  }>COMO será executada</FieldLabel>
                  <FormControl>
                    <Textarea placeholder="Estratégia, passos ou método..." rows={2} {...field} className="resize-none text-sm" />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Matriz GUT compacta */}
            <div className="rounded-lg border bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/40 dark:to-slate-800/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-semibold">Matriz GUT — Priorização</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">Score {gutScore}</Badge>
                  <Badge className={cn("text-[10px]", prioridadeColor)}>{prioridade}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {(["gravidade", "urgencia", "tendencia"] as const).map((name) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-medium capitalize text-muted-foreground">{name}</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">{field.value} · {GUT_LABELS[field.value]}</Badge>
                        </div>
                        <FormControl>
                          <Slider min={1} max={5} step={1} value={[field.value]} onValueChange={(v) => field.onChange(v[0])} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button
                type="submit"
                disabled={isCreatingAcao || isUpdatingAcao}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white"
              >
                {(isCreatingAcao || isUpdatingAcao) ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Ação"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
