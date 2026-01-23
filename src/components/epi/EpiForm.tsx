import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { EpiTipoForm } from "./EpiTipoForm";
import type { EpiTipo, EpiCompleto } from "@/types/epi";

const schema = z.object({
  tipo_id: z.string().min(1, "Selecione o tipo de EPI"),
  codigo: z.string().optional(),
  ca: z.string().optional(),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  tamanho: z.string().optional(),
  data_fabricacao: z.string().optional(),
  data_validade: z.string().optional(),
  quantidade_estoque: z.coerce.number().min(0, "Quantidade deve ser maior ou igual a 0"),
  quantidade_minima: z.coerce.number().min(1, "Quantidade mínima deve ser pelo menos 1"),
  custo_unitario: z.coerce.number().min(0).optional(),
  localizacao: z.string().optional(),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface EpiFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FormData) => Promise<void>;
  onCreateTipo: (data: {
    nome: string;
    descricao?: string;
    categoria?: string;
    validade_meses?: number | null;
    ca_numero?: string;
    marca?: string;
    fabricante?: string;
    estoque_minimo?: number | null;
    estoque_inicial?: number | null;
  }) => Promise<void>;
  tipos: EpiTipo[];
  epi?: EpiCompleto | null;
  isLoading?: boolean;
}

export function EpiForm({
  open,
  onOpenChange,
  onSubmit,
  onCreateTipo,
  tipos,
  epi,
  isLoading,
}: EpiFormProps) {
  const [showTipoForm, setShowTipoForm] = useState(false);
  const [isCreatingTipo, setIsCreatingTipo] = useState(false);
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo_id: epi?.tipo_id || "",
      codigo: epi?.codigo || "",
      ca: epi?.ca || "",
      marca: epi?.marca || "",
      modelo: epi?.modelo || "",
      tamanho: epi?.tamanho || "",
      data_fabricacao: epi?.data_fabricacao || "",
      data_validade: epi?.data_validade || "",
      quantidade_estoque: epi?.quantidade_estoque || 0,
      quantidade_minima: epi?.quantidade_minima || 5,
      custo_unitario: epi?.custo_unitario ? Number(epi.custo_unitario) : undefined,
      localizacao: epi?.localizacao || "",
      observacoes: epi?.observacoes || "",
    },
  });

  const handleSubmit = async (data: FormData) => {
    await onSubmit(data);
    form.reset();
    onOpenChange(false);
  };

  const handleCreateTipo = async (data: Parameters<typeof onCreateTipo>[0]) => {
    setIsCreatingTipo(true);
    try {
      await onCreateTipo(data);
      setShowTipoForm(false);
    } finally {
      setIsCreatingTipo(false);
    }
  };

  const handleTipoChange = (value: string) => {
    if (value === "__new__") {
      setShowTipoForm(true);
    } else {
      form.setValue("tipo_id", value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{epi ? "Editar EPI" : "Cadastrar Novo EPI"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de EPI *</FormLabel>
                    <Select 
                      onValueChange={handleTipoChange} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tipos.filter(t => t.is_active !== false).map((tipo) => (
                          <SelectItem key={tipo.id} value={tipo.id}>
                            {tipo.nome}
                          </SelectItem>
                        ))}
                        <Separator className="my-1" />
                        <SelectItem value="__new__" className="text-primary font-medium">
                          <span className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Incluir novo tipo
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="codigo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código / Nº Série</FormLabel>
                    <FormControl>
                      <Input placeholder="Código único" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ca"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CA (Certificado de Aprovação)</FormLabel>
                    <FormControl>
                      <Input placeholder="Número do CA" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="marca"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca</FormLabel>
                    <FormControl>
                      <Input placeholder="Fabricante" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="modelo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo</FormLabel>
                    <FormControl>
                      <Input placeholder="Modelo do EPI" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tamanho"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tamanho</FormLabel>
                    <FormControl>
                      <Input placeholder="P, M, G, 38, etc" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_fabricacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Fabricação</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_validade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Validade</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantidade_estoque"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade em Estoque *</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantidade_minima"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade Mínima (Alerta)</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="custo_unitario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custo Unitário (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="0,00"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="localizacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Localização no Estoque</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Armário A, Prateleira 3" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                {isLoading ? "Salvando..." : epi ? "Salvar Alterações" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>

      {/* Modal para criar novo tipo de EPI */}
      <EpiTipoForm
        open={showTipoForm}
        onOpenChange={setShowTipoForm}
        onSubmit={handleCreateTipo}
        isLoading={isCreatingTipo}
      />
    </Dialog>
  );
}
