import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  Shield,
  Loader2,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PhoneInput, validatePhone, cleanPhone } from "@/components/ui/phone-input";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getSupabaseFunctionUrl } from "@/lib/supabaseFunctions";

interface VerificacaoTelefoneProps {
  campanhaId: string;
  campanhaNome: string;
  onVerificado: (telefoneHash: string) => void;
}

type Etapa = "telefone" | "codigo" | "verificado";

export function VerificacaoTelefone({
  campanhaId,
  campanhaNome,
  onVerificado,
}: VerificacaoTelefoneProps) {
  const [etapa, setEtapa] = useState<Etapa>("telefone");
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [jaRespondeu, setJaRespondeu] = useState(false);
  const [modoToken, setModoToken] = useState(false);
  const [tokenEmail, setTokenEmail] = useState("");
  const [tokenValor, setTokenValor] = useState("");
  const [validandoToken, setValidandoToken] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // ── BYPASS DE TESTE (uso restrito) ──
  // Permite que um usuário específico de testes pule a verificação WhatsApp.
  const TEST_BYPASS_EMAIL = "renata_sophia_cortereal@cafefrossard.com";
  const TEST_BYPASS_TOKEN = "PAULO2026";

  const sha256Hex = async (input: string) => {
    const buf = new TextEncoder().encode(input);
    const hashBuf = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  const validarTokenTeste = async () => {
    const emailNorm = tokenEmail.trim().toLowerCase();
    const tokenNorm = tokenValor.trim().toUpperCase();
    if (emailNorm !== TEST_BYPASS_EMAIL.toLowerCase() || tokenNorm !== TEST_BYPASS_TOKEN) {
      toast.error("Token ou email inválido para acesso de teste.");
      return;
    }
    setValidandoToken(true);
    try {
      // Hash determinístico por email+campanha — garante 1 resposta por campanha
      // mesmo no modo de teste, mantendo a integridade da campanha.
      const telefoneHash = await sha256Hex(`bypass:${emailNorm}:${campanhaId}`);
      setEtapa("verificado");
      toast.success("Acesso de teste autorizado!");
      setTimeout(() => onVerificado(telefoneHash), 800);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao validar token");
    } finally {
      setValidandoToken(false);
    }
  };

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const enviarCodigo = async () => {
    if (!validatePhone(telefone)) {
      toast.error("Informe um telefone válido com DDD");
      return;
    }

    setEnviando(true);
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        getSupabaseFunctionUrl("psicossocial-whatsapp-otp"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            action: "enviar",
            telefone: cleanPhone(telefone),
            campanha_id: campanhaId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data?.erro) {
        if (response.status === 409) {
          setJaRespondeu(true);
          return;
        }
        toast.error(data?.erro || "Erro ao enviar código");
        return;
      }

      toast.success("Código enviado via WhatsApp!");
      setEtapa("codigo");
      setCooldown(60);
    } catch (err: any) {
      console.error("Erro ao enviar código:", err);
      toast.error(err?.message || "Erro ao enviar código");
    } finally {
      setEnviando(false);
    }
  };

  const verificarCodigo = async () => {
    if (codigo.length !== 6) {
      toast.error("Informe o código de 6 dígitos");
      return;
    }

    setVerificando(true);
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        getSupabaseFunctionUrl("psicossocial-whatsapp-otp"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            action: "verificar",
            telefone: cleanPhone(telefone),
            campanha_id: campanhaId,
            codigo,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data?.erro) {
        toast.error(data?.erro || "Erro ao verificar código");
        return;
      }

      setEtapa("verificado");
      toast.success("Telefone verificado com sucesso!");
      setTimeout(() => onVerificado(data.telefone_hash), 1200);
    } catch (err: any) {
      console.error("Erro ao verificar:", err);
      toast.error(err?.message || "Erro ao verificar código");
    } finally {
      setVerificando(false);
    }
  };

  const reenviar = async () => {
    if (cooldown > 0) return;
    await enviarCodigo();
  };

  const handleCodigoChange = (value: string) => {
    const nums = value.replace(/\D/g, "").slice(0, 6);
    setCodigo(nums);
  };

  if (jaRespondeu) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="shadow-xl border-0 ring-1 ring-black/5">
            <CardContent className="pt-10 pb-10 text-center space-y-5">
              <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                <AlertCircle className="h-10 w-10 text-amber-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Questionário já respondido</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Este questionário só pode ser preenchido <strong>uma única vez</strong> por participante. 
                  Nossos registros indicam que este telefone já foi utilizado para responder a esta campanha.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-amber-600 text-sm bg-amber-50 rounded-lg p-3">
                <Shield className="h-4 w-4 shrink-0" />
                <span>Garantia de anonimato mantida</span>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  // Tenta fechar a aba; se não conseguir, redireciona para about:blank
                  window.close();
                  setTimeout(() => {
                    window.location.href = "about:blank";
                  }, 300);
                }}
                className="w-full"
              >
                Fechar
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={etapa}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="max-w-md w-full"
        >
          <Card className="shadow-xl border-0 ring-1 ring-black/5">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                  {etapa === "verificado" ? (
                    <CheckCircle2 className="h-7 w-7 text-white" />
                  ) : (
                    <Phone className="h-7 w-7 text-white" />
                  )}
                </div>
              </div>
              <CardTitle className="text-xl">
                {etapa === "verificado"
                  ? "Telefone Verificado!"
                  : "Verificação por WhatsApp"}
              </CardTitle>
              <CardDescription className="text-sm">
                {etapa === "telefone" &&
                  "Informe seu telefone para receber um código de verificação via WhatsApp."}
                {etapa === "codigo" &&
                  "Digite o código de 6 dígitos enviado para seu WhatsApp."}
                {etapa === "verificado" &&
                  "Seu telefone foi verificado. Iniciando questionário..."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Etapa 1: Telefone */}
              {etapa === "telefone" && !modoToken && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Número de telefone (com DDD)
                    </label>
                    <PhoneInput
                      value={telefone}
                      onChange={setTelefone}
                      className="text-center text-lg"
                    />
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <Shield className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-700 leading-relaxed">
                      Seu número é usado apenas para verificação e <strong>não será vinculado</strong> às suas respostas. Armazenamos apenas um hash criptografado para garantir uma única participação por campanha.
                    </p>
                  </div>

                  <Button
                    onClick={enviarCodigo}
                    disabled={enviando || !validatePhone(telefone)}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md gap-2"
                    size="lg"
                  >
                    {enviando ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        Enviar Código via WhatsApp
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setModoToken(true)}
                    className="w-full text-[11px] text-muted-foreground hover:text-violet-600 underline-offset-2 hover:underline transition"
                  >
                    Tenho um token de acesso de teste
                  </button>
                </>
              )}

              {/* Etapa 1b: Modo Token de Teste */}
              {etapa === "telefone" && modoToken && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email autorizado</label>
                    <Input
                      type="email"
                      value={tokenEmail}
                      onChange={(e) => setTokenEmail(e.target.value)}
                      placeholder="seuemail@dominio.com"
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Token de acesso</label>
                    <Input
                      type="text"
                      value={tokenValor}
                      onChange={(e) => setTokenValor(e.target.value.toUpperCase())}
                      placeholder="TOKEN"
                      className="font-mono tracking-wider"
                    />
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 leading-relaxed">
                      Modo restrito a usuários de teste autorizados. O acesso é registrado e
                      garante <strong>uma resposta por campanha</strong>.
                    </p>
                  </div>
                  <Button
                    onClick={validarTokenTeste}
                    disabled={validandoToken || !tokenEmail || !tokenValor}
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-md gap-2"
                    size="lg"
                  >
                    {validandoToken ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Validando...
                      </>
                    ) : (
                      <>
                        Acessar com Token
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setModoToken(false);
                      setTokenEmail("");
                      setTokenValor("");
                    }}
                    className="w-full text-[11px] text-muted-foreground hover:text-violet-600 underline-offset-2 hover:underline transition"
                  >
                    ← Voltar para verificação por WhatsApp
                  </button>
                </>
              )}

              {/* Etapa 2: Código */}
              {etapa === "codigo" && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Código de verificação
                    </label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={codigo}
                      onChange={(e) => handleCodigoChange(e.target.value)}
                      placeholder="000000"
                      className="text-center text-2xl tracking-[0.5em] font-mono"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      Código enviado para ({cleanPhone(telefone).slice(0, 2)}) •••••-••
                      {cleanPhone(telefone).slice(-2)}
                    </p>
                  </div>

                  <Button
                    onClick={verificarCodigo}
                    disabled={verificando || codigo.length !== 6}
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-md gap-2"
                    size="lg"
                  >
                    {verificando ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        Verificar Código
                        <CheckCircle2 className="h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEtapa("telefone");
                        setCodigo("");
                      }}
                      className="text-xs"
                    >
                      ← Alterar número
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={reenviar}
                      disabled={cooldown > 0}
                      className="text-xs gap-1"
                    >
                      <RefreshCw className="h-3 w-3" />
                      {cooldown > 0
                        ? `Reenviar em ${cooldown}s`
                        : "Reenviar código"}
                    </Button>
                  </div>
                </>
              )}

              {/* Etapa 3: Verificado */}
              {etapa === "verificado" && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
                  <p className="text-sm text-muted-foreground">
                    Carregando questionário...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
