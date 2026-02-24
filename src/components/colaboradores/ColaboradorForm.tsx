import { useState, useEffect } from "react";
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
import { EmpresaAtivaBanner } from "@/components/ui/empresa-ativa-banner";

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

export interface ColaboradorEditData {
  id: string;
  nome_completo: string;
  cpf: string;
  email: string;
  celular: string | null;
  tipo_contrato: string | null;
  cargo: string;
  departamento: string | null;
  filial: string | null;
  data_admissao: string | null;
}

interface ColaboradorFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  colaborador?: ColaboradorEditData | null;
}

export function ColaboradorForm({ open, onOpenChange, onSuccess, colaborador }: ColaboradorFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { tenantId, user } = useAuth();
  const queryClient = useQueryClient();
  const { departamentos } = useDepartamentos();
  const { cargos } = useCargos();
  const { filiais } = useFiliais();

  const isEditMode = !!colaborador;

  // Radix Select não permite SelectItem com value="".
  // Como esses cadastros podem vir com nome vazio (ex.: importação/registro incompleto),
  // filtramos antes de renderizar.
  const cargosOptions = cargos.filter(
    (c) => typeof c?.nome === "string" && c.nome.trim().length > 0,
  );
  const departamentosOptions = departamentos.filter(
    (d) => typeof d?.nome === "string" && d.nome.trim().length > 0,
  );
  const filiaisOptions = filiais.filter(
    (f) => typeof f?.nome === "string" && f.nome.trim().length > 0,
  );

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

  // Preencher formulário quando em modo edição
  useEffect(() => {
    if (open && colaborador) {
      form.reset({
        nome_completo: colaborador.nome_completo || "",
        cpf: colaborador.cpf || "",
        email: colaborador.email || "",
        celular: colaborador.celular || "",
        tipo_contrato: colaborador.tipo_contrato || "clt",
        cargo: colaborador.cargo || "",
        departamento: colaborador.departamento || "",
        filial: colaborador.filial || "",
        data_admissao: colaborador.data_admissao || "",
      });
    } else if (open && !colaborador) {
      form.reset({
        nome_completo: "",
        cpf: "",
        email: "",
        celular: "",
        tipo_contrato: "clt",
        cargo: "",
        departamento: "",
        filial: "",
        data_admissao: new Date().toISOString().split("T")[0],
      });
    }
  }, [open, colaborador, form]);

  const onSubmit = async (data: FormData) => {
    if (!tenantId) {
      toast.error("Erro: Tenant não identificado");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && colaborador) {
        // Modo EDIÇÃO - UPDATE
        const { error } = await supabase
          .from("admissoes")
          .update({
            nome_completo: data.nome_completo,
            cpf: cleanCpf(data.cpf),
            email: data.email,
            celular: data.celular || null,
            tipo_contrato: data.tipo_contrato,
            cargo: data.cargo,
            departamento: data.departamento || null,
            filial: data.filial || null,
            data_admissao: data.data_admissao,
          })
          .eq("id", colaborador.id)
          .eq("tenant_id", tenantId);

        if (error) {
          if (error.code === "23505") {
            toast.error("CPF ou email já cadastrado para outro colaborador");
          } else {
            throw error;
          }
          return;
        }

        toast.success("Colaborador atualizado com sucesso!");
      } else {
        // Modo CRIAÇÃO - INSERT
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
      }

      queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
      queryClient.invalidateQueries({ queryKey: ["colaboradores-list"] });
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Erro ao salvar colaborador:", error);
      toast.error(isEditMode ? "Erro ao atualizar colaborador" : "Erro ao cadastrar colaborador");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Editar Colaborador" : "Novo Colaborador"}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Atualize os dados do colaborador." 
              : "Preencha os dados para cadastrar um novo colaborador."}
          </DialogDescription>
        </DialogHeader>

        <EmpresaAtivaBanner />

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
                    <FormLabel>Função *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cargosOptions.map((cargo) => (
                          <SelectItem key={cargo.id} value={cargo.nome.trim()}>
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
                        {departamentosOptions.map((dept) => (
                          <SelectItem key={dept.id} value={dept.nome.trim()}>
                            {dept.nome}
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
                        {filiaisOptions.map((filial) => (
                          <SelectItem key={filial.id} value={filial.nome.trim()}>
                            {filial.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                {isEditMode ? "Salvar Alterações" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
