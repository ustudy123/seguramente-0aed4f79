import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, ShieldCheck, Loader2, CheckCircle2, ChevronLeft, Send, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { COPSOQ_DIMENSOES } from "@/data/instrumentos/copsoq";
import { COPSOQ2BR_DIMENSOES } from "@/data/instrumentos/copsoq2br";
import { HSE_DIMENSOES } from "@/data/instrumentos/hse";
import { PROART_DIMENSOES } from "@/data/instrumentos/proart";
import { SIPRO_DIMENSOES } from "@/data/instrumentos/sipro";
import type { DimensaoInstrumento } from "@/data/instrumentos/copsoq";
import type { InstrumentoPsicossocial } from "@/types/psicossocial";
import { BLOCOS_DINAMICOS } from "@/types/psicossocial";
import { supabasePublic } from "@/lib/supabasePublic";
import { getEscalaOpcao } from "@/components/avaliacoes/psicossocial/escalas";

interface Props {
  instrumento: InstrumentoPsicossocial;
  blocosDinamicos?: string[];
  respostas: Record<string, number>;
  campanhaNome: string;
  tempoSegundos?: number;
  submitting: boolean;
  onVoltar: () => void;
  onConfirmar: () => void;
}

function getDimensoesCompletas(
  instrumento: InstrumentoPsicossocial,
  blocosDinamicos?: string[]
): DimensaoInstrumento[] {
  let base: DimensaoInstrumento[];
  switch (instrumento) {
    case "copsoq": base = COPSOQ_DIMENSOES; break;
    case "copsoq2br": base = COPSOQ2BR_DIMENSOES; break;
    case "hse": base = HSE_DIMENSOES; break;
    case "proart": base = PROART_DIMENSOES; break;
    case "sipro": base = SIPRO_DIMENSOES; break;
    default: base = [...COPSOQ_DIMENSOES, ...HSE_DIMENSOES];
  }
  if (blocosDinamicos && blocosDinamicos.length > 0) {
    const blocosCET = BLOCOS_DINAMICOS.filter((b) => blocosDinamicos.includes(b.id)).map(
      (b) =>
        ({
          id: b.id,
          nome: b.titulo,
          descricao: b.descricao,
          perguntas: b.perguntas.map((p) => ({ id: p.id, texto: p.texto, invertida: p.invertida })),
        } as DimensaoInstrumento)
    );
    return [...base, ...blocosCET];
  }
  return base;
}

export function ResumoQuestionario({
  instrumento,
  blocosDinamicos,
  respostas,
  campanhaNome,
  tempoSegundos,
  submitting,
  onVoltar,
  onConfirmar,
}: Props) {
  const [email, setEmail] = useState("");
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);

  const dimensoes = useMemo(
    () => getDimensoesCompletas(instrumento, blocosDinamicos),
    [instrumento, blocosDinamicos]
  );

  const totalPerguntas = dimensoes.reduce((acc, d) => acc + d.perguntas.length, 0);

  const resumoPayload = useMemo(
    () =>
      dimensoes.map((d) => ({
        dimensao: d.nome,
        perguntas: d.perguntas
          .filter((p) => respostas[p.id] !== undefined)
          .map((p) => {
            const v = respostas[p.id];
            const opcao = getEscalaOpcao(p.id, p.invertida, v);
            return { texto: p.texto, resposta: opcao?.label ?? String(v) };
          }),
      })),
    [dimensoes, respostas]
  );

  const handleEnviarEmail = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setEnviandoEmail(true);
    try {
      const { error } = await supabasePublic.functions.invoke("psicossocial-enviar-resumo", {
        body: {
          email: e,
          campanha_nome: campanhaNome,
          resumo: resumoPayload,
          total_perguntas: totalPerguntas,
          tempo_segundos: tempoSegundos,
        },
      });
      if (error) throw error;
      setEmailEnviado(true);
      toast.success("Resumo enviado para o seu e-mail.");
    } catch (err) {
      console.error("Erro ao enviar resumo:", err);
      toast.error("Não foi possível enviar agora. Você pode prosseguir e enviar suas respostas mesmo assim.");
    } finally {
      setEnviandoEmail(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-5"
    >
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-foreground">Confira suas respostas</h2>
        <p className="text-sm text-muted-foreground">
          Revise o que você respondeu antes de enviar. Você ainda pode voltar para ajustar qualquer item.
        </p>
      </div>

      {/* Resumo compacto por dimensão */}
      <Card className="border border-border shadow-sm">
        <CardContent className="p-0">
          {resumoPayload.map((d, di) => (
            <div key={di} className="border-b border-border/60 last:border-b-0">
              <div className="px-4 sm:px-5 py-3 bg-muted/30 flex items-center justify-between">
                <p className="font-semibold text-sm text-foreground">{d.dimensao}</p>
                <Badge variant="secondary" className="text-[10px]">{d.perguntas.length} respostas</Badge>
              </div>
              <ul className="divide-y divide-border/40">
                {d.perguntas.map((q, qi) => {
                  const dim = dimensoes[di];
                  const perg = dim.perguntas.find((p) => p.texto === q.texto);
                  const valor = perg ? respostas[perg.id] : 0;
                  const emoji = perg ? getEscalaOpcao(perg.id, perg.invertida, valor)?.emoji ?? "•" : "•";
                  return (
                    <li key={qi} className="px-4 sm:px-5 py-3 flex items-start gap-3">
                      <span
                        className="text-xl shrink-0 select-none"
                        style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}
                      >
                        {emoji}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-foreground leading-snug">{q.texto}</p>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          Resposta: <span className="font-medium text-foreground">{q.resposta}</span>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* E-mail (opcional) */}
      <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50/60 to-purple-50/60 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shrink-0 shadow">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Quer receber este resumo por e-mail?</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Enviamos uma cópia das suas respostas <strong>apenas para você</strong>. É opcional.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-emerald-900 text-xs leading-relaxed flex gap-2">
            <Lock className="h-4 w-4 mt-0.5 shrink-0 text-emerald-700" />
            <span>
              Envio sob conexão <strong>criptografada (TLS)</strong>. O e-mail informado{" "}
              <strong>não é armazenado</strong> em nossa base, <strong>não é vinculado às suas respostas</strong>{" "}
              e <strong>não é compartilhado</strong> com a empresa nem com terceiros. Suas respostas continuam
              100% anônimas.
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (emailEnviado) setEmailEnviado(false); }}
              disabled={enviandoEmail || submitting}
              className="flex-1"
              autoComplete="email"
              inputMode="email"
            />
            <Button
              type="button"
              onClick={handleEnviarEmail}
              disabled={!email || enviandoEmail || submitting || emailEnviado}
              className={cn(
                "gap-2",
                emailEnviado
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-violet-600 hover:bg-violet-700"
              )}
            >
              {enviandoEmail ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
              ) : emailEnviado ? (
                <><CheckCircle2 className="h-4 w-4" /> Enviado</>
              ) : (
                <><Send className="h-4 w-4" /> Enviar resumo</>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <EyeOff className="h-3 w-3" />
            <span>Após o envio, descartamos o endereço — nem a YourEyes nem a empresa têm acesso a ele.</span>
          </div>
        </CardContent>
      </Card>

      {/* Ações finais */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        <Button
          variant="outline"
          onClick={onVoltar}
          disabled={submitting}
          className="gap-2 w-full sm:w-auto"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar e ajustar
        </Button>
        <Button
          onClick={onConfirmar}
          disabled={submitting}
          size="lg"
          className="gap-2 w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
          ) : (
            <><ShieldCheck className="h-4 w-4" /> Confirmar e enviar respostas</>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
