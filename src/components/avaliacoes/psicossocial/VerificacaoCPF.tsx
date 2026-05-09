import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Loader2, ArrowRight, Lock, EyeOff, AlertCircle, FileCheck2, UserCheck, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CpfInput } from "@/components/ui/cpf-input";
import { cleanCpf, validateCpf } from "@/lib/cpf";
import { supabasePublic } from "@/lib/supabasePublic";
import { toast } from "sonner";

interface VerificacaoCPFProps {
  campanhaId: string;
  campanhaNome: string;
  onVerificado: (cpfHash: string) => void;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function VerificacaoCPF({ campanhaId, campanhaNome, onVerificado }: VerificacaoCPFProps) {
  const [cpf, setCpf] = useState("");
  const [cpfValido, setCpfValido] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [jaRespondeu, setJaRespondeu] = useState(false);
  const [aceiteLgpd, setAceiteLgpd] = useState(false);

  const handleConfirmar = async () => {
    if (!aceiteLgpd) {
      toast.error("Você precisa concordar com o uso do CPF conforme a LGPD para continuar.");
      return;
    }
    const cleaned = cleanCpf(cpf);
    if (!validateCpf(cleaned)) {
      toast.error("CPF inválido. Verifique os dígitos e tente novamente.");
      return;
    }

    setProcessando(true);
    setJaRespondeu(false);
    try {
      // Hash do CPF + campanha — não trafega nem armazena CPF em texto puro
      const hash = await sha256Hex(`${cleaned}::${campanhaId}`);

      // Checagem prévia: este CPF já respondeu esta campanha?
      const { data: jaUsado, error: rpcErr } = await supabasePublic
        .rpc("verificar_hash_ja_respondeu", {
          p_campanha_id: campanhaId,
          p_hash: hash,
        });

      if (rpcErr) throw rpcErr;

      if (jaUsado === true) {
        setJaRespondeu(true);
        toast.error("Este CPF já respondeu esta campanha.");
        return;
      }

      onVerificado(hash);
    } catch (err) {
      console.error("Erro ao processar verificação:", err);
      toast.error("Não foi possível validar agora. Tente novamente.");
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full"
      >
        <Card className="shadow-xl border-0 ring-1 ring-black/5">
          <CardHeader className="text-center pb-3">
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <ShieldCheck className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">Verificação de Participação</CardTitle>
            <CardDescription className="text-sm">{campanhaNome}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Banner de Anonimato — bem destacado */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-emerald-50 to-teal-50 p-5 shadow-sm">
              <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-emerald-200/40 blur-2xl" />
              <div className="relative flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-md">
                  <Lock className="h-5 w-5 text-white" />
                </div>
                <div className="space-y-1.5">
                  <p className="font-bold text-emerald-900 text-base leading-tight">
                    Formulário 100% anônimo — privacidade garantida
                  </p>
                  <p className="text-sm text-emerald-800 leading-relaxed">
                    Seu CPF é usado <strong>apenas para evitar respostas duplicadas</strong>.
                    Ele é convertido em um código irreversível antes de sair do seu dispositivo
                    e <strong>nunca é vinculado às suas respostas</strong>.
                  </p>
                  <div className="flex items-center gap-1.5 pt-1 text-xs text-emerald-700 font-medium">
                    <EyeOff className="h-3.5 w-3.5" />
                    <span>Ninguém — nem a empresa, nem a YourEyes — consegue identificar você.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Input CPF */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Informe seu CPF para iniciar
              </label>
              <CpfInput
                value={cpf}
                onChange={(v) => { setCpf(v); if (jaRespondeu) setJaRespondeu(false); }}
                onValidChange={setCpfValido}
                placeholder="000.000.000-00"
                autoFocus
              />
              {jaRespondeu && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p className="text-xs leading-relaxed">
                    <strong>Este CPF já respondeu esta campanha.</strong> Para preservar a integridade
                    dos resultados, cada pessoa pode responder apenas uma vez.
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Validamos apenas a estrutura matemática do CPF (dígitos verificadores).
                Não consultamos a Receita Federal nem armazenamos o número.
              </p>
            </div>

            <Button
              onClick={handleConfirmar}
              disabled={!cpfValido || processando}
              className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-md disabled:opacity-50"
              size="lg"
            >
              {processando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validando...
                </>
              ) : (
                <>
                  Iniciar questionário
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
