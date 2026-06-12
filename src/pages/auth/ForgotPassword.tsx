import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Building2, ArrowLeft, Mail } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { translateError } from "@/lib/translateError";

const forgotPasswordSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setLoading(true);

    try {
      const { data: resp, error } = await supabase.functions.invoke("send-recovery-email", {
        body: { email: data.email },
      });

      // A função retorna { error } com status 4xx/5xx quando o envio falha de
      // verdade (Resend rejeitou, rede caiu). Tratamos como falha real em vez
      // de mostrar "E-mail enviado!" para um e-mail que nunca sairá.
      const erroFuncao = (resp as any)?.error;
      if (error || erroFuncao) {
        toast.error("Erro ao enviar e-mail", {
          description: translateError(erroFuncao || error?.message || ""),
        });
        setLoading(false);
        return;
      }

      setEmailSent(true);
      toast.success("E-mail enviado!", {
        description: "Verifique sua caixa de entrada.",
      });
    } catch (err: any) {
      toast.error("Erro ao enviar e-mail", {
        description: "Tente novamente mais tarde.",
      });
    }

    setLoading(false);
  };

  if (emailSent) {
    return (
      <div className="space-y-6 text-center">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold">RH360</span>
        </div>

        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <Mail className="w-8 h-8 text-primary" />
        </div>

        <div>
          <h1 className="text-2xl font-bold">Verifique seu e-mail</h1>
          <p className="text-muted-foreground mt-2">
            Enviamos um link de recuperação para{" "}
            <strong>{form.getValues("email")}</strong>
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Não recebeu o e-mail? Verifique a pasta de spam ou
          </p>
          <Button
            variant="outline"
            onClick={() => setEmailSent(false)}
            className="w-full"
          >
            Tentar novamente
          </Button>
        </div>

        <Link
          to="/login"
          className="inline-flex items-center text-sm text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
          <Building2 className="w-6 h-6 text-primary-foreground" />
        </div>
        <span className="text-2xl font-bold">RH360</span>
      </div>

      <div className="text-center lg:text-left">
        <h1 className="text-2xl font-bold">Recuperar senha</h1>
        <p className="text-muted-foreground mt-1">
          Informe seu e-mail para receber um link de recuperação
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

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar link de recuperação"
            )}
          </Button>
        </form>
      </Form>

      <div className="text-center">
        <Link
          to="/login"
          className="inline-flex items-center text-sm text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
