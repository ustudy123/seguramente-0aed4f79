import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CpfInput } from "@/components/ui/cpf-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { useDepartamentos, useCargos, useFiliais } from "@/hooks/useCadastros";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { validateCpf, cleanCpf } from "@/lib/cpf";

const TIPOS_VINCULO = [
  { value: "clt", label: "CLT" },
  { value: "prolabore", label: "Pró-labore (Sócio)" },
  { value: "pj", label: "Pessoa Jurídica (PJ)" },
  { value: "estagiario", label: "Estagiário" },
  { value: "temporario", label: "Temporário" },
  { value: "autonomo", label: "Autônomo" },
];

const formSchema = z.object({
  nome_completo: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  cpf: z.string()
    .min(11, "CPF deve ter 11 dígitos")
    .refine((val) => cleanCpf(val).length === 11, "CPF deve ter 11 dígitos")
    .refine((val) => validateCpf(val), "CPF inválido - verifique os dígitos"),
  email: z.string().email("Email inválido"),
  celular: z.string().optional(),
  tipo_contrato: z.string().min(1, "Selecione o tipo de vínculo"),
  cargo: z.string().min(1, "Selecione um cargo"),
  departamento: z.string().optional(),
  filial: z.string().optional(),
  data_admissao: z.string().min(1, "Data de admissão é obrigatória"),
});

type FormData = z.infer<typeof formSchema>;

interface ColaboradorFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ColaboradorForm({ open, onOpenChange, onSuccess }: ColaboradorFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { tenantId, user } = useAuth();
  const queryClient = useQueryClient();
  const { departamentos } = useDepartamentos();
  const { cargos } = useCargos();
  const { filiais } = useFiliais();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome_completo: "",
      cpf: "",
      email: "",
      celular: "",
      tipo_contrato: "clt",
      cargo: "",
      departamento: "",
      filial: "",
      data_admissao: new Date().toISOString().split("T")[0],
    },
  });


  const onSubmit = async (data: FormData) => {
    if (!tenantId) {
      toast.error("Erro: Tenant não identificado");
      return;
    }

    setIsSubmitting(true);

    try {
      // Criar admissão diretamente como "concluido" (colaborador ativo)
      const { error } = await supabase.from("admissoes").insert({
        tenant_id: tenantId,
        nome_completo: data.nome_completo,
        cpf: cleanCpf(data.cpf),
        email: data.email,
        celular: data.celular || null,
        tipo_contrato: data.tipo_contrato,
        cargo: data.cargo,
        departamento: data.departamento || null,
        filial: data.filial || null,
        data_admissao: data.data_admissao,
        status: "concluido",
        criado_por: user?.id,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("CPF ou email já cadastrado");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Colaborador cadastrado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Erro ao cadastrar colaborador:", error);
      toast.error("Erro ao cadastrar colaborador");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Colaborador</DialogTitle>
          <DialogDescription>
            Preencha os dados para cadastrar um novo colaborador.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome_completo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo *</FormLabel>
                  <FormControl>
                    <Input placeholder="João da Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF *</FormLabel>
                    <FormControl>
                      <CpfInput
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="celular"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Celular</FormLabel>
                    <FormControl>
                      <PhoneInput
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="email@empresa.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo_contrato"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Vínculo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIPOS_VINCULO.map((tipo) => (
                          <SelectItem key={tipo.value} value={tipo.value}>
                            {tipo.label}
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
                name="cargo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cargos.map((cargo) => (
                          <SelectItem key={cargo.id} value={cargo.nome}>
                            {cargo.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="departamento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departamento</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departamentos.map((dept) => (
                          <SelectItem key={dept.id} value={dept.nome}>
                            {dept.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="filial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Filial</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filiais.map((filial) => (
                          <SelectItem key={filial.id} value={filial.nome}>
                            {filial.nome}
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
                name="data_admissao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Admissão *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Cadastrar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
