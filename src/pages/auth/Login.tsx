import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Logo } from "@/components/ui/Logo";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, loading } = useAuthContext();
  const [showPassword, setShowPassword] = useState(false);

  const from = location.state?.from?.pathname || "/";

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    const { error } = await signIn(data.email, data.password);
    
    if (error) {
      toast.error("Erro ao fazer login", {
        description: error.message || "Verifique suas credenciais e tente novamente.",
      });
      return;
    }

    toast.success("Login realizado com sucesso!");
    navigate(from, { replace: true });
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Logo - always visible */}
      <div className="flex items-center justify-center lg:justify-start mb-2 sm:mb-4">
        <Logo size="lg" showText={true} />
      </div>

      <div className="text-center lg:text-left space-y-1 sm:space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Bem-vindo de volta!</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Entre com suas credenciais para acessar o sistema
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
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
                <FormLabel>Senha</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="current-password"
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

          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              Esqueceu a senha?
            </Link>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>
      </Form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Ou
          </span>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Ainda não tem uma conta?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Cadastre sua empresa
          </Link>
        </p>
      </div>
    </div>
  );
}
