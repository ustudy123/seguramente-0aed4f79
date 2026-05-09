import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowRight, ArrowLeft, CheckCircle, AlertTriangle,
  Sparkles, MessageSquare, Brain, Zap,
} from "lucide-react";

type Step = 0 | 1 | 2 | 3 | 4 | 5; // 0..4 quiz, 5 = contato

interface Props {
  origem: string; // qual landing page
  whatsappNumber: string; // p/ CTA final
}

const FUNCIONARIOS = [
  { v: "ate_19",    l: "Até 19" },
  { v: "20_99",     l: "20 a 99" },
  { v: "100_499",   l: "100 a 499" },
  { v: "500_mais",  l: "500 ou mais" },
];

const SETORES = [
  "Indústria / Fábrica",
  "Construção Civil",
  "Saúde / Hospitalar",
  "Logística / Transporte",
  "Comércio / Varejo",
  "Serviços / Escritório",
  "Agronegócio",
  "Outro",
];

const URGENCIA = [
  { v: "imediata",  l: "Imediata (estou sob risco/fiscalização)", peso: 4 },
  { v: "30_60",     l: "Próximos 30 a 60 dias", peso: 3 },
  { v: "trimestre", l: "Neste trimestre", peso: 2 },
  { v: "explorando", l: "Apenas explorando", peso: 1 },
];

// ranking de dores (peso = quanto a YourEyes resolve = quanto vale como lead)
const DORES = [
  { v: "psicossocial",   l: "Psicossocial NR-1 / NR-17",                     peso: 4 },
  { v: "epi",            l: "EPI sem rastreabilidade / NR-6",                peso: 3 },
  { v: "esocial",        l: "eSocial / SST atrasado",                        peso: 4 },
  { v: "ponto_jornada",  l: "Ponto eletrônico e jornada (CLT)",              peso: 3 },
  { v: "documentacao",   l: "Documentação dispersa (PGR, PCMSO, ASO)",       peso: 3 },
  { v: "auditoria",      l: "Preparação para auditoria/fiscalização",        peso: 4 },
  { v: "outro",          l: "Outro",                                         peso: 2 },
];

const STATUS_HOJE = [
  { v: "planilha",  l: "Tudo em planilha / papel",            peso: 4 },
  { v: "parcial",   l: "Sistema parcial (alguns módulos)",    peso: 3 },
  { v: "terceiro",  l: "Terceirizado em consultoria/clínica", peso: 2 },
  { v: "integrado", l: "Já tenho sistema integrado",          peso: 1 },
];

function calcularPerfil(num: string, dorPeso: number, statusPeso: number, urgPeso: number) {
  // 0-100
  const tamanho = num === "ate_19" ? 1 : num === "20_99" ? 2 : num === "100_499" ? 3 : 4;
  const score = Math.min(
    100,
    Math.round((dorPeso * 6 + statusPeso * 6 + urgPeso * 6 + tamanho * 4) * 1.05)
  );
  let perfil: "explorador" | "qualificado" | "quente" | "critico" = "explorador";
  if (score >= 80) perfil = "critico";
  else if (score >= 60) perfil = "quente";
  else if (score >= 40) perfil = "qualificado";
  return { score, perfil };
}

const PERFIL_LABEL: Record<string, { l: string; cor: string; msg: string }> = {
  critico:    { l: "Crítico",    cor: "hsl(0 70% 55%)",    msg: "Cenário de alto risco. Precisa de plano de ação imediato — vamos priorizar seu atendimento." },
  quente:     { l: "Prioritário", cor: "hsl(33 100% 55%)", msg: "Você tem ganhos rápidos a obter. Faz sentido conversar agora para mapear o melhor caminho." },
  qualificado: { l: "Qualificado", cor: "hsl(207 90% 55%)", msg: "Bom momento para estruturar. Vamos te mostrar como o YourEyes acelera essa governança." },
  explorador: { l: "Explorador", cor: "hsl(152 60% 50%)",  msg: "Ótimo! Vamos te enviar materiais e tirar suas dúvidas pelo WhatsApp." },
};

export function DiagnosticoQuiz({ origem, whatsappNumber }: Props) {
  const [step, setStep] = useState<Step>(0);
  const [submitting, setSubmitting] = useState(false);
  const [resultado, setResultado] = useState<{ score: number; perfil: string } | null>(null);

  const [funcionarios, setFuncionarios] = useState("");
  const [setor, setSetor] = useState("");
  const [dor, setDor] = useState("");
  const [statusHoje, setStatusHoje] = useState("");
  const [urgencia, setUrgencia] = useState("");

  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");

  const next = () => setStep((s) => (s + 1) as Step);
  const prev = () => setStep((s) => Math.max(0, s - 1) as Step);

  const submit = async () => {
    if (!nome.trim() || !email.trim() || !telefone.trim() || !empresa.trim()) {
      toast.error("Preencha nome, empresa, e-mail e WhatsApp");
      return;
    }
    const tel = telefone.replace(/\D/g, "");
    if (tel.length < 10) {
      toast.error("WhatsApp inválido. Use DDD + número");
      return;
    }

    const dorObj = DORES.find((d) => d.v === dor)!;
    const stObj  = STATUS_HOJE.find((s) => s.v === statusHoje)!;
    const urgObj = URGENCIA.find((u) => u.v === urgencia)!;
    const { score, perfil } = calcularPerfil(funcionarios, dorObj.peso, stObj.peso, urgObj.peso);

    const diagnostico = {
      respostas: {
        num_funcionarios: funcionarios,
        setor, dor_principal: dor, status_atual: statusHoje, urgencia,
      },
      score,
      perfil,
      origem_landing: origem,
      capturado_em: new Date().toISOString(),
    };

    setSubmitting(true);
    try {
      const { error } = await supabase.from("landing_leads").insert({
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        telefone: tel,
        empresa: empresa.trim(),
        cargo: cargo.trim() || null,
        setor: setor || null,
        num_funcionarios: funcionarios || null,
        urgencia: urgencia || null,
        landing_page_origem: origem,
        perfil_diagnostico: perfil,
        pontuacao_diagnostico: score,
        diagnostico_resultado: diagnostico,
      } as any);
      if (error) throw error;

      setResultado({ score, perfil });

      // Abre WhatsApp com mensagem contextualizada
      const msg = encodeURIComponent(
        `Olá! Sou ${nome} da ${empresa}.\n` +
        `Acabei de fazer o diagnóstico no site (${origem}).\n` +
        `Perfil: ${PERFIL_LABEL[perfil].l} (${score}/100)\n` +
        `Funcionários: ${FUNCIONARIOS.find(f=>f.v===funcionarios)?.l}\n` +
        `Setor: ${setor}\n` +
        `Principal dor: ${dorObj.l}\n` +
        `Quero conversar sobre o YourEyes.`
      );
      setTimeout(() => {
        window.open(`https://wa.me/${whatsappNumber}?text=${msg}`, "_blank", "noopener,noreferrer");
      }, 600);
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar diagnóstico");
    } finally {
      setSubmitting(false);
    }
  };

  // ============== RESULTADO ==============
  if (resultado) {
    const cfg = PERFIL_LABEL[resultado.perfil];
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl p-8 text-center"
        style={{ background: 'hsl(215 55% 12%)', border: `1px solid ${cfg.cor}` }}
      >
        <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: cfg.cor }} />
        <h3 className="text-2xl font-black mb-2 text-white">Diagnóstico concluído!</h3>
        <div className="text-5xl font-black my-6" style={{ color: cfg.cor }}>
          {resultado.score}<span className="text-xl text-gray-400">/100</span>
        </div>
        <div className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-4"
             style={{ background: `${cfg.cor}20`, color: cfg.cor, border: `1px solid ${cfg.cor}40` }}>
          Perfil: {cfg.l}
        </div>
        <p className="text-gray-300 max-w-md mx-auto mb-6">{cfg.msg}</p>
        <p className="text-sm text-gray-500">
          Abrimos o WhatsApp para você. Caso não tenha aberto,&nbsp;
          <button onClick={() => window.open(`https://wa.me/${whatsappNumber}`, "_blank")} className="text-emerald-400 underline">
            clique aqui
          </button>.
        </p>
      </motion.div>
    );
  }

  // ============== STEPS ==============
  const totalSteps = 6;
  const pct = ((step + 1) / totalSteps) * 100;

  return (
    <div className="rounded-2xl p-6 md:p-8" style={{ background: 'hsl(215 55% 12%)', border: '1px solid hsl(215 40% 22%)' }}>
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-gray-400 font-bold">
            <Brain className="w-4 h-4" style={{ color: 'hsl(152 60% 50%)' }} />
            Diagnóstico Rápido · 60 segundos
          </div>
          <span className="text-xs text-gray-500">{step + 1} / {totalSteps}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(215 40% 18%)' }}>
          <motion.div
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4 }}
            className="h-full"
            style={{ background: 'linear-gradient(90deg, hsl(152 60% 45%), hsl(207 90% 55%))' }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <QuizStep key="0" titulo="Quantas pessoas trabalham na sua empresa?" subtitulo="Inclui CLT, terceirizados e estagiários">
            <OptionsGrid options={FUNCIONARIOS.map(f => ({ value: f.v, label: f.l }))} value={funcionarios} onChange={(v) => { setFuncionarios(v); next(); }} cols={2} />
          </QuizStep>
        )}

        {step === 1 && (
          <QuizStep key="1" titulo="Qual o setor da empresa?">
            <OptionsGrid options={SETORES.map(s => ({ value: s, label: s }))} value={setor} onChange={(v) => { setSetor(v); next(); }} cols={2} />
          </QuizStep>
        )}

        {step === 2 && (
          <QuizStep key="2" titulo="Qual sua principal dor hoje?" subtitulo="Onde dói mais no dia a dia">
            <OptionsGrid options={DORES.map(d => ({ value: d.v, label: d.l }))} value={dor} onChange={(v) => { setDor(v); next(); }} cols={1} />
          </QuizStep>
        )}

        {step === 3 && (
          <QuizStep key="3" titulo="Como você gerencia SST hoje?">
            <OptionsGrid options={STATUS_HOJE.map(s => ({ value: s.v, label: s.l }))} value={statusHoje} onChange={(v) => { setStatusHoje(v); next(); }} cols={1} />
          </QuizStep>
        )}

        {step === 4 && (
          <QuizStep key="4" titulo="Qual a urgência?">
            <OptionsGrid options={URGENCIA.map(u => ({ value: u.v, label: u.l }))} value={urgencia} onChange={(v) => { setUrgencia(v); next(); }} cols={1} />
          </QuizStep>
        )}

        {step === 5 && (
          <motion.div key="5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h3 className="text-2xl font-black text-white mb-1">Quase lá! Como falamos com você?</h3>
            <p className="text-sm text-gray-400 mb-5">Vamos abrir o WhatsApp já com seu diagnóstico em mãos.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nome*">     <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" /></Field>
              <Field label="Empresa*">  <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Nome da empresa" /></Field>
              <Field label="Cargo">     <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex: Gestor SST" /></Field>
              <Field label="E-mail*">   <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" /></Field>
              <div className="md:col-span-2">
                <Field label="WhatsApp*"><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" /></Field>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={prev} className="flex-1 sm:flex-none">
                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
              </Button>
              <Button
                onClick={submit}
                disabled={submitting}
                className="flex-1 text-white font-bold"
                style={{ background: 'linear-gradient(135deg, hsl(152 60% 38%), hsl(152 70% 30%))' }}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                {submitting ? "Enviando..." : "Ver meu diagnóstico"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {step > 0 && step < 5 && (
        <button onClick={prev} className="mt-4 text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Voltar
        </button>
      )}
    </div>
  );
}

function QuizStep({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <h3 className="text-xl md:text-2xl font-black text-white mb-1">{titulo}</h3>
      {subtitulo && <p className="text-sm text-gray-400 mb-5">{subtitulo}</p>}
      {children}
    </motion.div>
  );
}

function OptionsGrid({
  options, value, onChange, cols,
}: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; cols: 1 | 2 }) {
  return (
    <div className={`grid gap-2 ${cols === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
      {options.map((opt) => {
        const sel = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="text-left p-4 rounded-xl border transition-all hover:scale-[1.01]"
            style={{
              background: sel ? 'hsl(152 60% 45% / 0.15)' : 'hsl(215 40% 16%)',
              borderColor: sel ? 'hsl(152 60% 50%)' : 'hsl(215 30% 25%)',
              color: sel ? 'hsl(152 70% 70%)' : 'white',
            }}
          >
            <span className="font-medium">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
