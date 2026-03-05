import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, ArrowLeft, ArrowRight, Search } from "lucide-react";
import { formatCnpj, cleanCnpj, buscarCnpj } from "@/lib/brasilapi";
import { translateError } from "@/lib/translateError";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";

const formatCpf = (value: string): string => {
  const n = value.replace(/\D/g, "");
  if (n.length <= 3) return n;
  if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
  if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9, 11)}`;
};

const registerSchema = z.object({
  // Step 1 - Company info
  tipoPessoa: z.enum(["pj", "pf"]),
  documento: z.string().min(1, "Documento é obrigatório"),
  tenantNome: z.string().min(2, "Nome da empresa deve ter pelo menos 2 caracteres").max(100),
  tenantSlug: z
    .string()
    .min(3, "Identificador deve ter pelo menos 3 caracteres")
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      "Apenas letras minúsculas, números e hífen"
    ),
  // Step 2 - User info
  nomeCompleto: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").max(100),
  email: z.string().email("E-mail inválido").max(255),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não conferem",
  path: ["confirmPassword"],
}).refine((data) => {
  const clean = data.documento.replace(/\D/g, "");
  if (data.tipoPessoa === "pj") return clean.length === 14;
  return clean.length === 11;
}, {
  message: "Documento inválido",
  path: ["documento"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function Register() {
  const navigate = useNavigate();
  const { signUp, loading } = useAuthContext();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      tipoPessoa: "pj",
      documento: "",
      tenantNome: "",
      tenantSlug: "",
      nomeCompleto: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onChange",
  });

  const tipoPessoa = form.watch("tipoPessoa");

  // translateErrorMessage now uses shared utility

  const handleBuscarCnpj = async () => {
    const doc = form.getValues("documento");
    const clean = cleanCnpj(doc);
    if (clean.length !== 14) {
      toast.error("Digite um CNPJ válido com 14 dígitos");
      return;
    }
    setBuscandoCnpj(true);
    try {
      const resultado = await buscarCnpj(doc);
      if (resultado) {
        const nome = resultado.razao_social || resultado.nome_fantasia || "";
        form.setValue("tenantNome", nome);
        form.setValue("tenantSlug", generateSlug(nome));
        toast.success("Dados do CNPJ carregados!");
      } else {
        toast.error("CNPJ não encontrado na base de dados");
      }
    } catch {
      toast.error("Erro ao buscar CNPJ");
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const onSubmit = async (data: RegisterFormData) => {
    const cleanDoc = data.documento.replace(/\D/g, "");
    const { error } = await signUp(data.email, data.password, {
      nomeCompleto: data.nomeCompleto,
      tenantNome: data.tenantNome,
      tenantSlug: data.tenantSlug,
      tipoPessoa: data.tipoPessoa,
      documento: cleanDoc,
    });

    if (error) {
      const translatedMessage = translateError(error.message || "");
      toast.error("Erro ao criar conta", {
        description: translatedMessage || "Tente novamente mais tarde.",
      });
      return;
    }

    toast.success("Conta criada com sucesso!", {
      description: "Verifique seu e-mail para confirmar o cadastro.",
    });
    navigate("/login");
  };

  const handleNextStep = async () => {
    const isValid = await form.trigger(["documento", "tenantNome", "tenantSlug"]);
    if (isValid) {
      setStep(2);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 50);
  };

  const handleDocumentoChange = (value: string) => {
    if (tipoPessoa === "pj") {
      form.setValue("documento", formatCnpj(value), { shouldValidate: true });
    } else {
      form.setValue("documento", formatCpf(value), { shouldValidate: true });
    }
  };

  return (
    <div className="space-y-6">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-center mb-6">
        <Logo size="lg" showText={false} />
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-bold">Cadastre sua empresa</h1>
        <p className="text-muted-foreground mt-1">
          {step === 1
            ? "Primeiro, informe os dados da sua empresa"
            : "Agora, crie sua conta de administrador"}
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        <div
          className={`flex-1 h-1 rounded-full ${
            step >= 1 ? "bg-primary" : "bg-muted"
          }`}
        />
        <div
          className={`flex-1 h-1 rounded-full ${
            step >= 2 ? "bg-primary" : "bg-muted"
          }`}
        />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {step === 1 && (
            <>
              <FormField
                control={form.control}
                name="tipoPessoa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Pessoa *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(val) => {
                        field.onChange(val);
                        form.setValue("documento", "");
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pj">Pessoa Jurídica (CNPJ)</SelectItem>
                        <SelectItem value="pf">Pessoa Física (CPF)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="documento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tipoPessoa === "pj" ? "CNPJ" : "CPF"} *</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input
                          placeholder={tipoPessoa === "pj" ? "00.000.000/0000-00" : "000.000.000-00"}
                          value={field.value}
                          onChange={(e) => handleDocumentoChange(e.target.value)}
                          maxLength={tipoPessoa === "pj" ? 18 : 14}
                        />
                        {tipoPessoa === "pj" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleBuscarCnpj}
                            disabled={buscandoCnpj}
                            title="Buscar dados do CNPJ"
                          >
                            {buscandoCnpj ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </FormControl>
                    {tipoPessoa === "pj" && (
                      <FormDescription>
                        Clique na lupa para preencher automaticamente
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tenantNome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Empresa *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Minha Empresa LTDA"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          const currentSlug = form.getValues("tenantSlug");
                          if (!currentSlug || currentSlug === generateSlug(field.value)) {
                            form.setValue("tenantSlug", generateSlug(e.target.value));
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tenantSlug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Identificador da Empresa *</FormLabel>
                    <FormControl>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                          rh360.app/
                        </span>
                        <Input
                          className="rounded-l-none"
                          placeholder="minha-empresa"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Este será o endereço da sua empresa no sistema
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="button"
                className="w-full"
                onClick={handleNextStep}
              >
                Continuar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <FormField
                control={form.control}
                name="nomeCompleto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seu Nome Completo *</FormLabel>
                    <FormControl>
                      <Input placeholder="João da Silva" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Eye className="w-4 h-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Senha *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Eye className="w-4 h-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Criar Conta"
                  )}
                </Button>
              </div>
            </>
          )}
        </form>
      </Form>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Já tem uma conta?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
