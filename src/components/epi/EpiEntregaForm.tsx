import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EpiCompleto } from "@/types/epi";
import { MOTIVOS_ENTREGA } from "@/types/epi";

const schema = z.object({
  epi_id: z.string().min(1, "Selecione o EPI"),
  colaborador_nome: z.string().min(2, "Nome é obrigatório"),
  colaborador_cpf: z.string().optional(),
  colaborador_cargo: z.string().optional(),
  colaborador_departamento: z.string().optional(),
  quantidade: z.coerce.number().min(1, "Quantidade deve ser pelo menos 1"),
  data_devolucao_prevista: z.string().optional(),
  motivo_entrega: z.string().optional(),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface EpiEntregaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { epi_id: string; colaborador_nome: string; quantidade: number; colaborador_cpf?: string; colaborador_cargo?: string; colaborador_departamento?: string; data_devolucao_prevista?: string; motivo_entrega?: string; observacoes?: string }) => Promise<void>;
  epis: EpiCompleto[];
  isLoading?: boolean;
}

export function EpiEntregaForm({
  open,
  onOpenChange,
  onSubmit,
  epis,
  isLoading,
}: EpiEntregaFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      epi_id: "",
      colaborador_nome: "",
      colaborador_cpf: "",
      colaborador_cargo: "",
      colaborador_departamento: "",
      quantidade: 1,
      data_devolucao_prevista: "",
      motivo_entrega: "",
      observacoes: "",
    },
  });

  const selectedEpiId = form.watch("epi_id");
  const selectedEpi = epis.find((e) => e.id === selectedEpiId);

  const handleSubmit = async (data: FormData) => {
    await onSubmit({
      epi_id: data.epi_id,
      colaborador_nome: data.colaborador_nome,
      quantidade: data.quantidade,
      colaborador_cpf: data.colaborador_cpf,
      colaborador_cargo: data.colaborador_cargo,
      colaborador_departamento: data.colaborador_departamento,
      data_devolucao_prevista: data.data_devolucao_prevista,
      motivo_entrega: data.motivo_entrega,
      observacoes: data.observacoes,
    });
    form.reset();
    onOpenChange(false);
  };

  const episDisponiveis = epis.filter((e) => e.quantidade_estoque > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Entrega de EPI</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="epi_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>EPI *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o EPI" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {episDisponiveis.map((epi) => (
                        <SelectItem key={epi.id} value={epi.id}>
                          <div className="flex items-center gap-2">
                            <span>{epi.tipo.nome}</span>
                            {epi.marca && <span className="text-muted-foreground">- {epi.marca}</span>}
                            {epi.tamanho && <span className="text-muted-foreground">({epi.tamanho})</span>}
                            <Badge variant="secondary" className="ml-2">
                              {epi.quantidade_estoque} em estoque
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedEpi && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p><strong>CA:</strong> {selectedEpi.ca || "Não informado"}</p>
                <p><strong>Modelo:</strong> {selectedEpi.modelo || "Não informado"}</p>
                <p><strong>Disponível:</strong> {selectedEpi.quantidade_estoque} unidades</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="colaborador_nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Colaborador *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="colaborador_cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <Input placeholder="000.000.000-00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="colaborador_cargo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo</FormLabel>
                    <FormControl>
                      <Input placeholder="Cargo do colaborador" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="colaborador_departamento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departamento</FormLabel>
                    <FormControl>
                      <Input placeholder="Setor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={selectedEpi?.quantidade_estoque || 999}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_devolucao_prevista"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Devolução Prevista</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="motivo_entrega"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo da Entrega</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o motivo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {MOTIVOS_ENTREGA.map((motivo) => (
                        <SelectItem key={motivo} value={motivo}>
                          {motivo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Observações adicionais" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Registrando..." : "Registrar Entrega"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
