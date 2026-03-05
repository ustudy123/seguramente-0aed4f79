import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabasePublic } from "@/lib/supabasePublic";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Shield, Eye, EyeOff, CheckCircle2, Loader2, Building2,
  User, Mail, Lock, Phone, AlertCircle, ChevronRight, Sparkles
} from "lucide-react";
import authBg from "@/assets/auth-bg.jpg";

interface ClienteInfo {
  id: string;
  nome_empresa: string;
  poc_nome: string | null;
  poc_email: string | null;
  cnpj: string | null;
  onboarding_token: string | null;
  conta_ativada: boolean;
  activation_token_expires_at: string | null;
  tenant_id: string | null;
}

export default function AtivarConta() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [cliente, setCliente] = useState<ClienteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activated, setActivated] = useState(false);

  const [form, setForm] = useState({
    nome_completo: "",
    email: "",
    password: "",
    confirm_password: "",
    telefone: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [aceites, setAceites] = useState({
    termos: false,
    privacidade: false,
    dpa: false,
  });

  useEffect(() => {
    if (!token) {
      setError("Link de ativação inválido. Solicite um novo convite.");
      setLoading(false);
      return;
    }
    fetchCliente();
  }, [token]);

  async function fetchCliente() {
    setLoading(true);
    const { data, error } = await supabasePublic
      .from("programa_validador_clientes")
      .select("id, nome_empresa, poc_nome, poc_email, cnpj, onboarding_token, conta_ativada, activation_token_expires_at, tenant_id")
      .eq("activation_token", token!)
      .maybeSingle();

    if (error || !data) {
      setError("Token inválido ou expirado. Solicite um novo convite.");
      setLoading(false);
      return;
    }

    if (data.conta_ativada) {
      setError("Esta conta já foi ativada. Faça login normalmente.");
      setLoading(false);
      return;
    }

    if (data.activation_token_expires_at && new Date(data.activation_token_expires_at) < new Date()) {
      setError("Este link de ativação expirou. Solicite um novo convite.");
      setLoading(false);
      return;
    }

    setCliente(data as ClienteInfo);
    setForm(prev => ({
      ...prev,
      nome_completo: data.poc_nome || "",
      email: data.poc_email || "",
    }));
    setLoading(false);
  }

  const allAceitesChecked = aceites.termos && aceites.privacidade && aceites.dpa;

  const passwordStrength = () => {
    const p = form.password;
    if (p.length === 0) return 0;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };

  const strengthLabel = ["", "Fraca", "Razoável", "Boa", "Forte"][passwordStrength()];
  const strengthColor = ["", "bg-red-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"][passwordStrength()];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allAceitesChecked) {
      toast.error("Aceite todos os termos para continuar.");
      return;
    }
    if (form.password !== form.confirm_password) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (form.password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (!form.nome_completo || !form.email) {
      toast.error("Preencha nome completo e e-mail.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("activate-account", {
        body: {
          activation_token: token,
          nome_completo: form.nome_completo,
          email: form.email,
          password: form.password,
          telefone: form.telefone || undefined,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao ativar conta");
      }

      // Sign in the user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (signInError) throw signInError;

      setActivated(true);

      // Redirect to onboarding portal after 2s
      setTimeout(() => {
        if (cliente?.onboarding_token) {
          navigate(`/onboarding-cliente/${cliente.onboarding_token}`);
        } else {
          navigate("/");
        }
      }, 2500);
    } catch (err: any) {
      toast.error(err.message || "Erro ao ativar conta");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4">
        <div className="absolute inset-0 z-0">
          <img src={authBg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-primary/90" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center space-y-4"
        >
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Link Inválido</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => navigate("/login")}>
            Ir para Login
          </Button>
        </motion.div>
      </div>
    );
  }

  if (activated) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4">
        <div className="absolute inset-0 z-0">
          <img src={authBg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-primary/90" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center space-y-6"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto"
          >
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </motion.div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Conta Ativada!</h2>
            <p className="text-muted-foreground mt-2">
              Bem-vindo(a), <strong>{form.nome_completo}</strong>!<br />
              Você será redirecionado para o Portal de Implantação.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirecionando...
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img src={authBg} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-secondary/95" style={{ background: 'linear-gradient(135deg, hsl(262 40% 12% / 0.93), hsl(280 30% 10% / 0.96))' }} />
      </div>

      {/* Decorative blobs */}
      <div className="absolute inset-0 z-[1] overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-20 w-96 h-96 rounded-full blur-3xl opacity-10" style={{ background: 'hsl(24 90% 54%)' }} />
        <div className="absolute bottom-0 -right-20 w-80 h-80 rounded-full blur-3xl opacity-10" style={{ background: 'hsl(262 50% 50%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-5xl flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
        {/* Left branding */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex-1 text-center lg:text-left hidden lg:block"
        >
          <div className="bg-[hsl(262,40%,10%/0.75)] backdrop-blur-md rounded-2xl p-8 space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-white font-semibold text-lg">Seguramente</span>
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-bold text-white leading-tight">
                Ative sua conta
                <br />
                <span className="text-[hsl(24,90%,60%)]">e comece agora</span>
              </h1>
              <p className="text-white/80 text-base max-w-sm">
                Você foi convidado para implantar o sistema de gestão de pessoas na sua empresa.
              </p>
            </div>

            {/* Company card */}
            {cliente && (
              <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-white/60 text-xs uppercase tracking-wider">
                  <Building2 className="h-3 w-3" />
                  Empresa convidada
                </div>
                <p className="text-white font-semibold">{cliente.nome_empresa}</p>
                {cliente.cnpj && (
                  <p className="text-white/60 text-sm">CNPJ: {cliente.cnpj}</p>
                )}
              </div>
            )}

            <div className="space-y-3 pt-2">
              {[
                "Acesso completo ao sistema",
                "Dados protegidos por LGPD",
                "Suporte durante toda implantação",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-white/80 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-[hsl(24,90%,60%)] flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Right form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-[hsl(262,50%,45%)] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Ativação de Conta</h2>
                <p className="text-white/70 text-xs">Portal de Implantação Seguramente</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Company info pill */}
            {cliente && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center gap-3">
                <Building2 className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Empresa</p>
                  <p className="text-sm font-semibold text-foreground truncate">{cliente.nome_empresa}</p>
                </div>
              </div>
            )}

            {/* Nome completo */}
            <div className="space-y-1.5">
              <Label htmlFor="nome" className="text-sm font-medium">Nome completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="nome"
                  className="pl-9"
                  placeholder="Seu nome completo"
                  value={form.nome_completo}
                  onChange={e => setForm(f => ({ ...f, nome_completo: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">E-mail de acesso</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  className="pl-9"
                  placeholder="seu@email.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Telefone */}
            <div className="space-y-1.5">
              <Label htmlFor="telefone" className="text-sm font-medium">
                Telefone <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="telefone"
                  className="pl-9"
                  placeholder="(11) 99999-9999"
                  value={form.telefone}
                  onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Criar senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPass ? "text" : "password"}
                  className="pl-9 pr-10"
                  placeholder="Mínimo 8 caracteres"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPass(v => !v)}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.password.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${i <= passwordStrength() ? strengthColor : "bg-muted"}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Força: <span className="font-medium">{strengthLabel}</span></p>
                </div>
              )}
            </div>

            {/* Confirmar senha */}
            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-sm font-medium">Confirmar senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  className="pl-9 pr-10"
                  placeholder="Repita a senha"
                  value={form.confirm_password}
                  onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirm(v => !v)}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.confirm_password.length > 0 && form.password !== form.confirm_password && (
                <p className="text-xs text-red-500">As senhas não coincidem</p>
              )}
            </div>

            {/* Aceites legais */}
            <div className="space-y-2.5 pt-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aceites obrigatórios</p>

              {[
                { key: "termos", label: "Termos de Uso do Seguramente" },
                { key: "privacidade", label: "Política de Privacidade" },
                { key: "dpa", label: "DPA — Acordo de Processamento de Dados (LGPD)" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-start gap-2.5">
                  <Checkbox
                    id={key}
                    checked={aceites[key as keyof typeof aceites]}
                    onCheckedChange={v =>
                      setAceites(prev => ({ ...prev, [key]: !!v }))
                    }
                  />
                  <label
                    htmlFor={key}
                    className="text-sm text-muted-foreground leading-snug cursor-pointer select-none"
                  >
                    Li e aceito os{" "}
                    <span className="text-primary font-medium underline-offset-2 hover:underline cursor-pointer">
                      {label}
                    </span>
                  </label>
                </div>
              ))}
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-semibold gap-2"
              disabled={submitting || !allAceitesChecked}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ativando conta...
                </>
              ) : (
                <>
                  Ativar Conta
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground pt-1">
              Já tem acesso?{" "}
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="text-primary font-medium hover:underline"
              >
                Fazer login
              </button>
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
