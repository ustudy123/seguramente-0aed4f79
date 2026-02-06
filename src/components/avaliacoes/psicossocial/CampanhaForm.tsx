import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Brain, Calendar, Shield, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { usePsicossocial } from "@/hooks/usePsicossocial";
import { BLOCOS_DINAMICOS } from "@/types/psicossocial";
import { format, addDays } from "date-fns";

const formSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  descricao: z.string().optional(),
  data_inicio: z.string().min(1, "Data de início é obrigatória"),
  data_fim: z.string().min(1, "Data de término é obrigatória"),
  anonimo: z.boolean().default(true),
  blocos_dinamicos: z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof formSchema>;

interface CampanhaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CampanhaForm({ open, onOpenChange }: CampanhaFormProps) {
  const { criarCampanha } = usePsicossocial();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      descricao: "",
      data_inicio: format(new Date(), "yyyy-MM-dd"),
      data_fim: format(addDays(new Date(), 30), "yyyy-MM-dd"),
      anonimo: true,
      blocos_dinamicos: [],
    },
  });

  const onSubmit = async (data: FormValues) => {
    await criarCampanha.mutateAsync({
      nome: data.nome,
      descricao: data.descricao,
      data_inicio: data.data_inicio,
      data_fim: data.data_fim,
      anonimo: data.anonimo,
      blocos_dinamicos: data.blocos_dinamicos,
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            Nova Campanha Psicossocial
          </DialogTitle>
          <DialogDescription>
            Configure uma nova campanha de avaliação de riscos psicossociais
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Nome */}
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Campanha *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: Avaliação Psicossocial Q1 2026" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Descrição */}
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descreva o objetivo desta campanha..."
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Datas */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="data_inicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Início *</FormLabel>
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
                    <FormLabel>Data de Término *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Anonimato */}
            <FormField
              control={form.control}
              name="anonimo"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-emerald-600" />
                      <FormLabel className="text-base">Respostas Anônimas</FormLabel>
                    </div>
                    <FormDescription>
                      Colaboradores não serão identificados nas respostas individuais
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

            {/* Blocos Dinâmicos (CET) */}
            <FormField
              control={form.control}
              name="blocos_dinamicos"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Blocos Especiais (CET)
                  </FormLabel>
                  <FormDescription>
                    Selecione os blocos adicionais para condições especiais de trabalho
                  </FormDescription>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {BLOCOS_DINAMICOS.map((bloco) => (
                      <div
                        key={bloco.id}
                        className="flex items-start space-x-3 rounded-lg border p-3"
                      >
                        <Checkbox
                          id={bloco.id}
                          checked={field.value?.includes(bloco.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              field.onChange([...field.value, bloco.id]);
                            } else {
                              field.onChange(field.value.filter((id: string) => id !== bloco.id));
                            }
                          }}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <label
                            htmlFor={bloco.id}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {bloco.titulo}
                          </label>
                          <p className="text-xs text-muted-foreground">
                            {bloco.perguntas.length} perguntas adicionais
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={criarCampanha.isPending}>
                {criarCampanha.isPending ? "Criando..." : "Criar Campanha"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
