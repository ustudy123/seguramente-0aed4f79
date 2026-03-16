import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  Shield,
  Loader2,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PhoneInput, validatePhone, cleanPhone } from "@/components/ui/phone-input";
import { Input } from "@/components/ui/input";
import { supabasePublic } from "@/lib/supabasePublic";
import { toast } from "sonner";

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
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

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
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 
        (import.meta.env.VITE_SUPABASE_URL || '').replace('https://', '').split('.')[0];
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/psicossocial-whatsapp-otp`,
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
      const { data, error } = await supabasePublic.functions.invoke(
        "psicossocial-whatsapp-otp",
        {
          body: {
            action: "verificar",
            telefone: cleanPhone(telefone),
            campanha_id: campanhaId,
            codigo,
          },
        }
      );

      if (error) throw new Error(error.message);

      if (data?.erro) {
        toast.error(data.erro);
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
              {etapa === "telefone" && (
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
