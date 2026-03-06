import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAvaliacoes } from "@/hooks/useAvaliacoes";
import type { AvaliacaoCicloInsert, Config360 } from "@/types/avaliacao";

const formSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  descricao: z.string().optional(),
  template_id: z.string().min(1, "Selecione um template"),
  tipo_ciclo: z.enum(["trimestral", "semestral", "anual", "extraordinario"]).default("semestral"),
  data_inicio: z.string().min(1, "Data de início é obrigatória"),
  data_fim: z.string().min(1, "Data de fim é obrigatória"),
  data_revisao: z.string().optional(),
  populacao: z.enum(["empresa", "unidade", "setor", "funcao", "grupo"]).default("empresa"),
  auto: z.boolean().default(true),
  gestor: z.boolean().default(true),
  pares: z.number().min(0).max(5).default(0),
  subordinados: z.boolean().default(false),
  cliente_interno: z.boolean().default(false),
  justificativa_extremas: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

interface CicloFormProps {
  onSuccess: () => void;
}

const TIPO_CICLO_LABELS: Record<string, string> = {
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  extraordinario: "Extraordinário",
};

const POPULACAO_LABELS: Record<string, string> = {
  empresa: "Empresa toda",
  unidade: "Por Unidade",
  setor: "Por Setor",
  funcao: "Por Função",
  grupo: "Grupos específicos",
};

export function CicloForm({ onSuccess }: CicloFormProps) {
  const { templates, createCiclo, isCreatingCiclo } = useAvaliacoes();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      descricao: "",
      template_id: "",
      tipo_ciclo: "semestral",
      data_inicio: "",
      data_fim: "",
      data_revisao: "",
      populacao: "empresa",
      auto: true,
      gestor: true,
      pares: 0,
      subordinados: false,
      justificativa_extremas: true,
    },
  });

  const selectedTemplateId = form.watch("template_id");
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const is360 = selectedTemplate?.tipo === "360";

  const onSubmit = async (data: FormData) => {
    const config360: Config360 = {
      auto: data.auto,
      gestor: data.gestor,
      pares: data.pares,
      subordinados: data.subordinados,
    };

    const cicloData: AvaliacaoCicloInsert = {
      nome: data.nome,
      descricao: data.descricao,
      template_id: data.template_id,
      data_inicio: data.data_inicio,
      data_fim: data.data_fim,
      config_360: config360,
    };

    await createCiclo(cicloData);
    onSuccess();
  };

  const activeTemplates = templates.filter(t => t.ativo);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Identificação */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Identificação</h4>
          
          <FormField
            control={form.control}
            name="nome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do Ciclo</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: 2026 – Semestre 1" {...field} />
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
                <FormLabel>Descrição</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Descreva os objetivos deste ciclo de avaliação..."
                    rows={2}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="tipo_ciclo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo do Ciclo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(TIPO_CICLO_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="template_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template de Avaliação</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.nome} ({template.tipo === "360" ? "360°" : "Simples"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {activeTemplates.length === 0 
                      ? "Crie um template primeiro na aba Templates"
                      : ""
                    }
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* Datas */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Datas</h4>
          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="data_inicio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Abertura</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="data_fim"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fechamento</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="data_revisao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Janela de Revisão</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription className="text-[10px]">Opcional</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* População */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">População</h4>
          <FormField
            control={form.control}
            name="populacao"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Abrangência</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(POPULACAO_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription className="text-xs">
                  Ao abrir o ciclo, o sistema gera automaticamente a lista de colaboradores elegíveis e atribui avaliadores
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        {/* Regras de Avaliação */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quem avalia quem</h4>
          
          <div className="grid gap-3">
            <FormField
              control={form.control}
              name="gestor"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <FormLabel className="text-sm">Gestor direto avalia</FormLabel>
                    <FormDescription className="text-[10px]">
                      Auto-vinculado via organograma/função
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="auto"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <FormLabel className="text-sm">Autoavaliação</FormLabel>
                    <FormDescription className="text-[10px]">
                      Colaborador avalia a si mesmo
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {is360 && (
              <>
                <FormField
                  control={form.control}
                  name="pares"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <FormLabel className="text-sm">Avaliação de Pares</FormLabel>
                        <FormDescription className="text-[10px]">
                          Colegas que avaliarão (auto-sugeridos por setor)
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Select 
                          onValueChange={(v) => field.onChange(parseInt(v))} 
                          value={field.value.toString()}
                        >
                          <SelectTrigger className="w-24 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 1, 2, 3, 4, 5].map((n) => (
                              <SelectItem key={n} value={n.toString()}>
                                {n === 0 ? "Nenhum" : n}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subordinados"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <FormLabel className="text-sm">Avaliação de Subordinados</FormLabel>
                        <FormDescription className="text-[10px]">
                          Subordinados avaliam o gestor (para líderes)
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </>
            )}

            <p className="text-[10px] text-muted-foreground px-3">
              💡 RH atua como moderador, não como avaliador. O sistema puxa automaticamente superior imediato e time do gestor.
            </p>
          </div>
        </div>

        <Separator />

        {/* Regras adicionais */}
        <FormField
          control={form.control}
          name="justificativa_extremas"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <FormLabel className="text-sm">Justificativa obrigatória em notas extremas</FormLabel>
                <FormDescription className="text-[10px]">
                  Se nota = 1 ou 5, exigir 1 frase de justificativa
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isCreatingCiclo}>
            {isCreatingCiclo ? "Criando..." : "Criar Ciclo"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
