import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { HubContabilidade } from "@/hooks/useHubProcessos";

const schema = z.object({
  tipo: z.string().min(1, "Selecione o tipo"),
  titulo: z.string().min(3, "Título obrigatório"),
  descricao: z.string().optional(),
  colaborador_nome: z.string().optional(),
  colaborador_cpf: z.string().optional(),
  competencia: z.string().optional(),
  prioridade: z.string().default("normal"),
  contabilidade_id: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FormData) => Promise<void>;
  contabilidades: HubContabilidade[];
  tipoInicial?: string;
}

const TIPOS = [
  { value: "admissao", label: "Admissão" },
  { value: "demissao", label: "Demissão / Rescisão" },
  { value: "ferias", label: "Férias" },
  { value: "advertencia", label: "Advertência" },
  { value: "atestado_afastamento", label: "Atestado / Afastamento" },
  { value: "ponto_folha", label: "Ponto / Folha" },
  { value: "eventos_variaveis", label: "Eventos Variáveis" },
  { value: "alteracao_contratual", label: "Alteração Contratual" },
  { value: "mudanca_salarial", label: "Mudança Salarial" },
  { value: "cat", label: "CAT" },
  { value: "ppp_ltcat", label: "PPP / LTCAT" },
  { value: "pro_labore", label: "Pró-Labore" },
  { value: "solicitacao_geral", label: "Solicitação Geral" },
];

export function HubNovoProcessoModal({ open, onOpenChange, onSubmit, contabilidades, tipoInicial }: Props) {
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: tipoInicial || "",
      titulo: "",
      prioridade: "normal",
    },
  });

  const handleSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await onSubmit(data);
      form.reset();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Solicitação</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="tipo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Processo *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="prioridade" render={({ field }) => (
                <FormItem>
                  <FormLabel>Prioridade</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="titulo" render={({ field }) => (
              <FormItem>
                <FormLabel>Título *</FormLabel>
                <FormControl><Input placeholder="Ex: Admissão — João Silva" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="colaborador_nome" render={({ field }) => (
                <FormItem>
                  <FormLabel>Colaborador</FormLabel>
                  <FormControl><Input placeholder="Nome do colaborador" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="colaborador_cpf" render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF</FormLabel>
                  <FormControl><Input placeholder="000.000.000-00" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="competencia" render={({ field }) => (
                <FormItem>
                  <FormLabel>Competência</FormLabel>
                  <FormControl><Input placeholder="YYYY-MM" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {contabilidades.length > 0 && (
                <FormField control={form.control} name="contabilidade_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contabilidade</FormLabel>
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {contabilidades.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </div>

            <FormField control={form.control} name="descricao" render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição / Observações</FormLabel>
                <FormControl><Textarea placeholder="Informações adicionais..." rows={3} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Criando..." : "Criar Processo"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
