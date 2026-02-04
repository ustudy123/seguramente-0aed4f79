import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { useAvaliacoes } from "@/hooks/useAvaliacoes";
import type { AvaliacaoCicloInsert, Config360 } from "@/types/avaliacao";

const formSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  descricao: z.string().optional(),
  template_id: z.string().min(1, "Selecione um template"),
  data_inicio: z.string().min(1, "Data de início é obrigatória"),
  data_fim: z.string().min(1, "Data de fim é obrigatória"),
  auto: z.boolean().default(true),
  gestor: z.boolean().default(true),
  pares: z.number().min(0).max(5).default(0),
  subordinados: z.boolean().default(false),
});

type FormData = z.infer<typeof formSchema>;

interface CicloFormProps {
  onSuccess: () => void;
}

export function CicloForm({ onSuccess }: CicloFormProps) {
  const { templates, createCiclo, isCreatingCiclo } = useAvaliacoes();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      descricao: "",
      template_id: "",
      data_inicio: "",
      data_fim: "",
      auto: true,
      gestor: true,
      pares: 0,
      subordinados: false,
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
        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Ciclo</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Avaliação Anual 2025" {...field} />
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
                  {...field}
                />
              </FormControl>
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
                    <SelectValue placeholder="Selecione um template" />
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
                  : "Escolha o modelo de avaliação a ser utilizado"
                }
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="data_inicio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de Início</FormLabel>
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
                <FormLabel>Data de Término</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {is360 && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <h4 className="font-medium">Configuração 360°</h4>
            <p className="text-sm text-muted-foreground">
              Defina quais tipos de avaliadores participarão deste ciclo
            </p>

            <div className="grid gap-4">
              <FormField
                control={form.control}
                name="auto"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div>
                      <FormLabel>Autoavaliação</FormLabel>
                      <FormDescription>
                        O colaborador avalia a si mesmo
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gestor"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div>
                      <FormLabel>Avaliação do Gestor</FormLabel>
                      <FormDescription>
                        O gestor direto avalia o colaborador
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pares"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div>
                      <FormLabel>Avaliação de Pares</FormLabel>
                      <FormDescription>
                        Quantidade de colegas que avaliarão
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Select 
                        onValueChange={(v) => field.onChange(parseInt(v))} 
                        value={field.value.toString()}
                      >
                        <SelectTrigger className="w-24">
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
                  <FormItem className="flex items-center justify-between">
                    <div>
                      <FormLabel>Avaliação de Subordinados</FormLabel>
                      <FormDescription>
                        Subordinados avaliam o gestor
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isCreatingCiclo}>
            {isCreatingCiclo ? "Criando..." : "Criar Ciclo"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
