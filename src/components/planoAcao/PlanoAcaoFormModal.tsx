import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { HelpCircle, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { usePlanoAcao } from "@/hooks/usePlanoAcao";
import { cn } from "@/lib/utils";
import type { PlanoAcao } from "@/types/planoAcao";

const formSchema = z.object({
  // 5W2H
  titulo: z.string().min(3, "Título deve ter pelo menos 3 caracteres"),
  descricao: z.string().optional(),
  porque: z.string().optional(),
  onde: z.string().optional(),
  prazo: z.string().optional(),
  responsavel_nome: z.string().optional(),
  como: z.string().optional(),
  custo_estimado: z.string().optional(),
  
  // Tipo e origem
  tipo: z.enum(["corretiva", "preventiva", "melhoria"]),
  origem_modulo: z.enum(["manual", "ergonomia", "ouvidoria", "epi", "ponto", "humor", "psicossocial", "atestados", "sst", "compliance_sst", "compliance", "documentos", "avaliacoes", "estrategia", "gro"]),
  
  // GUT
  gravidade: z.number().min(1).max(5),
  urgencia: z.number().min(1).max(5),
  tendencia: z.number().min(1).max(5),
  
  // Exigência
  exige_evidencia: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface PlanoAcaoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  origem?: {
    modulo: string;
    id?: string;
    descricao?: string;
  };
  editData?: PlanoAcao;
}

const GUT_LABELS: Record<number, string> = {
  1: "Muito baixo",
  2: "Baixo",
  3: "Médio",
  4: "Alto",
  5: "Muito alto",
};

const LabelWithTooltip = ({ label, tooltip, required = false }: { label: string; tooltip: string; required?: boolean }) => (
  <div className="flex items-center gap-1">
    <span>{label}{required && ' *'}</span>
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[250px]">
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
);

export function PlanoAcaoFormModal({ open, onOpenChange, origem, editData }: PlanoAcaoFormModalProps) {
  const { createAcao, isCreatingAcao, updateAcao, isUpdatingAcao } = usePlanoAcao();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isEditing = !!editData;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      porque: "",
      onde: "",
      prazo: "",
      responsavel_nome: "",
      como: "",
      custo_estimado: "",
      tipo: "corretiva",
      origem_modulo: (origem?.modulo as any) || "manual",
      gravidade: 3,
      urgencia: 3,
      tendencia: 3,
      exige_evidencia: false,
    },
  });

  // Preencher formulário quando editData mudar
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
      // Expandir GUT se já tem valores
      if (editData.pontuacao_gut) {
        setShowAdvanced(true);
      }
    }
  }, [editData, open, form]);

  const gutScore = form.watch("gravidade") * form.watch("urgencia") * form.watch("tendencia");

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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? "Editar Ação" : "Nova Ação Estratégica"}
            <Badge variant="outline" className="ml-2">5W2H</Badge>
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* What - O QUÊ */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2 text-primary">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">W</span>
                O QUÊ será feito?
              </h3>
              
              <FormField
                control={form.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <LabelWithTooltip 
                        label="Título da Ação" 
                        tooltip="Descreva de forma clara e objetiva a ação a ser executada"
                        required
                      />
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Implementar pausas ativas obrigatórias" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição detalhada</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Detalhe a ação, escopo e resultados esperados..."
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Why - POR QUÊ */}
            <FormField
              control={form.control}
              name="porque"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <div className="flex items-center gap-2 text-primary">
                      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">W</span>
                      POR QUÊ será feito?
                    </div>
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Justificativa: qual problema resolve ou oportunidade aproveita?"
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Where - ONDE */}
              <FormField
                control={form.control}
                name="onde"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <LabelWithTooltip 
                        label="ONDE será aplicada?" 
                        tooltip="Área, setor, departamento ou processo afetado"
                      />
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Departamento de Produção" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* When - QUANDO */}
              <FormField
                control={form.control}
                name="prazo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <LabelWithTooltip 
                        label="QUANDO será executada?" 
                        tooltip="Prazo final para conclusão da ação"
                      />
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Who - QUEM */}
              <FormField
                control={form.control}
                name="responsavel_nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <LabelWithTooltip 
                        label="QUEM é o responsável?" 
                        tooltip="Pessoa responsável pela execução e acompanhamento"
                      />
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do responsável" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* How Much */}
              <FormField
                control={form.control}
                name="custo_estimado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <LabelWithTooltip 
                        label="QUANTO custará?" 
                        tooltip="Custo estimado para implementação (opcional)"
                      />
                    </FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" placeholder="R$ 0,00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* How - COMO */}
            <FormField
              control={form.control}
              name="como"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <div className="flex items-center gap-2 text-primary">
                      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">H</span>
                      COMO será executada?
                    </div>
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Estratégia de execução, passos ou método..."
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Tipo e Origem */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Ação</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="corretiva">Corretiva</SelectItem>
                        <SelectItem value="preventiva">Preventiva</SelectItem>
                        <SelectItem value="melhoria">Melhoria</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="origem_modulo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origem</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="ergonomia">Ergonomia</SelectItem>
                        <SelectItem value="ouvidoria">Ouvidoria</SelectItem>
                        <SelectItem value="epi">EPIs</SelectItem>
                        <SelectItem value="ponto">Ponto</SelectItem>
                        <SelectItem value="humor">Humor</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Matriz GUT */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between" type="button">
                  <span className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Matriz GUT - Priorização
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant={gutScore >= 64 ? "destructive" : gutScore >= 27 ? "default" : "secondary"}>
                      Score: {gutScore}
                    </Badge>
                    {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="gravidade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center justify-between">
                          <span>Gravidade</span>
                          <Badge variant="outline" className="text-xs">{field.value}</Badge>
                        </FormLabel>
                        <FormControl>
                          <Slider
                            min={1}
                            max={5}
                            step={1}
                            value={[field.value]}
                            onValueChange={(v) => field.onChange(v[0])}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground text-center">
                          {GUT_LABELS[field.value]}
                        </p>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="urgencia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center justify-between">
                          <span>Urgência</span>
                          <Badge variant="outline" className="text-xs">{field.value}</Badge>
                        </FormLabel>
                        <FormControl>
                          <Slider
                            min={1}
                            max={5}
                            step={1}
                            value={[field.value]}
                            onValueChange={(v) => field.onChange(v[0])}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground text-center">
                          {GUT_LABELS[field.value]}
                        </p>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tendencia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center justify-between">
                          <span>Tendência</span>
                          <Badge variant="outline" className="text-xs">{field.value}</Badge>
                        </FormLabel>
                        <FormControl>
                          <Slider
                            min={1}
                            max={5}
                            step={1}
                            value={[field.value]}
                            onValueChange={(v) => field.onChange(v[0])}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground text-center">
                          {GUT_LABELS[field.value]}
                        </p>
                      </FormItem>
                    )}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreatingAcao}>
                {isCreatingAcao ? "Salvando..." : "Criar Ação"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
