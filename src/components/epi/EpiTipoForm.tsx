import { useEffect } from "react";
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
import { CATEGORIAS_EPI } from "@/types/epi";

const schema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  descricao: z.string().optional(),
  categoria: z.string().min(1, "Selecione uma categoria"),
  validade_meses: z.coerce.number().min(0).optional().nullable(),
  ca_numero: z.string().optional(),
  ca_validade: z.string().optional(),
  marca: z.string().optional(),
  fabricante: z.string().optional(),
  estoque_minimo: z.coerce.number().min(0).optional().nullable(),
  estoque_inicial: z.coerce.number().min(0).optional().nullable(),
});

type FormData = z.infer<typeof schema>;

interface EpiTipoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    nome: string;
    descricao?: string;
    categoria?: string;
    validade_meses?: number | null;
    ca_numero?: string;
    ca_validade?: string;
    marca?: string;
    fabricante?: string;
    estoque_minimo?: number | null;
    estoque_inicial?: number | null;
  }) => Promise<void>;
  isLoading?: boolean;
  defaultCategoria?: string;
}

export function EpiTipoForm({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  defaultCategoria,
}: EpiTipoFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: "",
      descricao: "",
      categoria: defaultCategoria || "",
      validade_meses: undefined,
      ca_numero: "",
      marca: "",
      fabricante: "",
      estoque_minimo: 5,
      estoque_inicial: 100,
    },
  });

  // Update categoria when defaultCategoria changes
  useEffect(() => {
    if (defaultCategoria) {
      form.setValue("categoria", defaultCategoria);
    }
  }, [defaultCategoria, form]);

  const handleSubmit = async (data: FormData) => {
    await onSubmit({
      nome: data.nome,
      descricao: data.descricao,
      categoria: data.categoria,
      validade_meses: data.validade_meses,
      ca_numero: data.ca_numero,
      ca_validade: data.ca_validade || undefined,
      marca: data.marca,
      fabricante: data.fabricante,
      estoque_minimo: data.estoque_minimo,
      estoque_inicial: data.estoque_inicial,
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo EPI</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Nome do EPI *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Protetor Auricular, Abafador, etc" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIAS_EPI.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
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
                name="ca_numero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>C.A. (Certificado de Aprovação)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 12345" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ca_validade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validade do C.A.</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} />
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
                      <Input placeholder="Ex: 3M" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fabricante"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fabricante</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 3M do Brasil" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="validade_meses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validade (meses)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Ex: 12"
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
                name="estoque_minimo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estoque Mínimo</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Ex: 5"
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
                name="estoque_inicial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estoque Inicial</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Ex: 100"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descrição do EPI"
                      {...field}
                    />
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
                {isLoading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}