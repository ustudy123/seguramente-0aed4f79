import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowRight, ArrowLeft, CheckCircle, AlertTriangle,
  Sparkles, MessageSquare, Brain,
} from "lucide-react";

interface Props {
  origem: string;
}

const FUNCIONARIOS = [
  { v: "ate_19",   l: "Até 19" },
  { v: "20_99",    l: "20 a 99" },
  { v: "100_499", l: "100 a 499" },
  { v: "500_mais", l: "500 ou mais" },
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

// Respostas Likert: peso de RISCO (0 = conforme, 3 = não conforme)
type RespKey = "sim" | "parcial" | "nao" | "nao_sei";
const RESP_OPCOES: { v: RespKey; l: string; risco: number }[] = [
  { v: "sim",      l: "Sim, com evidência documental",   risco: 0 },
  { v: "parcial",  l: "Parcialmente / em construção",     risco: 2 },
  { v: "nao",      l: "Não",                              risco: 3 },
  { v: "nao_sei",  l: "Não sei dizer",                    risco: 2 },
];

// Dimensões avaliadas
type Dim = "documentacao" | "psicossocial" | "epi" | "esocial" | "jornada" | "auditoria";

interface Pergunta {
  id: string;
  dim: Dim;
  pergunta: string;
  ajuda?: string;
}

const PERGUNTAS: Pergunta[] = [
  { id: "q_pgr",  dim: "documentacao",  pergunta: "PGR (Programa de Gerenciamento de Riscos) está atualizado nos últimos 12 meses?", ajuda: "NR-1 exige revisão anual ou após mudanças relevantes." },
  { id: "q_aso",  dim: "documentacao",  pergunta: "Todos os colaboradores possuem ASO vigente e PCMSO ativo?", ajuda: "Admissionais, periódicos, demissionais e mudança de função." },
  { id: "q_psi",  dim: "psicossocial",  pergunta: "Riscos psicossociais (NR-1 / NR-17) já foram identificados e estão no inventário de riscos?", ajuda: "Vigência reforçada da NR-1 sobre riscos psicossociais em 2025/2026." },
  { id: "q_epi",  dim: "epi",           pergunta: "A entrega de EPIs é rastreável (assinatura, CA e validade) por colaborador?", ajuda: "NR-6 e Súmula 289 TST — sem prova, ônus é do empregador." },
  { id: "q_eso",  dim: "esocial",       pergunta: "Eventos eSocial de SST (S-2210 / S-2220 / S-2240) estão sendo enviados no prazo?", ajuda: "Atrasos geram multa por evento e bloqueio de CND." },
  { id: "q_pto",  dim: "jornada",       pergunta: "O ponto eletrônico é válido (REP-C/REP-P) e há acordo formal de banco de horas?", ajuda: "Súmula 338 TST presume jornada do empregado se o controle for inválido." },
  { id: "q_act",  dim: "auditoria",     pergunta: "Achados de auditoria/inspeção viram plano de ação 5W2H rastreável?", ajuda: "Reincidência sem ação documentada dobra multas e pesa em juízo." },
  { id: "q_doc",  dim: "documentacao",  pergunta: "A documentação de SST está centralizada digitalmente e acessível em uma fiscalização?", ajuda: "Planilhas e papel = perda de defesa em ação trabalhista." },
];

function calcularDiagnostico(respostas: Record<string, RespKey>) {
  // Score 0-100 (maior = mais risco)
  const total = PERGUNTAS.length;
  let somaRisco = 0;
  const porDim: Record<Dim, { soma: number; max: number }> = {
    documentacao: { soma: 0, max: 0 },
    psicossocial: { soma: 0, max: 0 },
    epi: { soma: 0, max: 0 },
    esocial: { soma: 0, max: 0 },
    jornada: { soma: 0, max: 0 },
    auditoria: { soma: 0, max: 0 },
  };
  PERGUNTAS.forEach((p) => {
    const r = respostas[p.id];
    const peso = RESP_OPCOES.find((o) => o.v === r)?.risco ?? 2;
    somaRisco += peso;
    porDim[p.dim].soma += peso;
    porDim[p.dim].max  += 3;
  });
  const score = Math.round((somaRisco / (total * 3)) * 100);

  // Não conformidades (perguntas com risco >= 2)
  const naoConformes = PERGUNTAS.filter((p) => {
    const r = respostas[p.id];
    const peso = RESP_OPCOES.find((o) => o.v === r)?.risco ?? 0;
    return peso >= 2;
  });

  // Dimensão mais crítica
  const dimsRanqueadas = (Object.entries(porDim) as [Dim, { soma: number; max: number }][])
    .map(([d, v]) => ({ dim: d, pct: v.max ? Math.round((v.soma / v.max) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct);

  let perfil: "critico" | "alto" | "moderado" | "controlado" = "controlado";
  if (score >= 70) perfil = "critico";
  else if (score >= 50) perfil = "alto";
  else if (score >= 30) perfil = "moderado";

  return { score, perfil, naoConformes, dimsRanqueadas, porDim };
}

const PERFIL_LABEL: Record<string, { l: string; cor: string; msg: string }> = {
  critico:    { l: "Crítico",    cor: "hsl(0 70% 55%)",    msg: "Cenário de exposição alta. Recomendamos priorizar plano de ação imediato. Um especialista da YourEyes vai entrar em contato para apresentar como estruturar." },
  alto:       { l: "Alto risco", cor: "hsl(33 100% 55%)",  msg: "Há lacunas relevantes que podem virar autuação ou passivo trabalhista. Vamos entrar em contato para apresentar caminhos de remediação." },
  moderado:   { l: "Moderado",   cor: "hsl(207 90% 55%)",  msg: "Bom momento para estruturar a governança de SST antes que vire risco. Um especialista entra em contato para uma apresentação." },
  controlado: { l: "Controlado", cor: "hsl(152 60% 50%)",  msg: "Cenário relativamente maduro. Mostramos como ganhar eficiência e blindagem documental adicional. Em breve entramos em contato." },
};

const DIM_LABEL: Record<Dim, string> = {
  documentacao: "Documentação SST",
  psicossocial: "Riscos psicossociais (NR-1/NR-17)",
  epi: "EPI / NR-6",
  esocial: "eSocial SST",
  jornada: "Ponto e jornada (CLT)",
  auditoria: "Plano de ação / Auditoria",
};

const RISCO_POR_PERGUNTA: Record<string, string> = {
  q_pgr: "PGR desatualizado — autuação NR-1 e perda de defesa em juízo.",
  q_aso: "ASO/PCMSO sem evidência — presunção de nexo em adoecimento.",
  q_psi: "Risco psicossocial não inventariado — não conformidade NR-1 (item 1.5.3.2).",
  q_epi: "EPI sem rastreabilidade — inversão do ônus da prova (Súmula 289 TST).",
  q_eso: "Eventos eSocial atrasados — multa por evento + bloqueio de CND.",
  q_pto: "Controle de jornada inválido — Súmula 338 TST presume jornada do empregado.",
  q_act: "Achados sem plano de ação — reincidência dobra multa e pesa em juízo.",
  q_doc: "Documentação dispersa — perda de defesa em fiscalização.",
};

const ACAO_POR_DIM: Record<Dim, string[]> = {
  documentacao: ["Dossiê digital por colaborador", "Auto-arquivamento por categoria", "Alertas de validade ASO/PGR/PCMSO"],
  psicossocial: ["Aplicar SIPRO (questionário psicossocial anônimo)", "Mapear GHE com riscos NR-17", "Plano de ação 5W2H por unidade"],
  epi:          ["Matriz EPI × Função × CET", "Entrega digital com selfie + geolocalização", "Estoque com validade e CA monitorado"],
  esocial:      ["Auditoria de eventos pendentes", "Calendário S-22XX automatizado", "Integração com folha e SST"],
  jornada:      ["REP-C/REP-P com OTP", "Fechamento mensal com banco de horas válido", "Análise de jornada × CLT"],
  auditoria:    ["Plano de ação 5W2H rastreável", "Evidência fotográfica e assinaturas digitais", "Dashboard de conformidade por unidade"],
};

export function DiagnosticoQuiz({ origem }: Props) {
  // Steps: 0 contexto-porte, 1 contexto-setor, 2..(2+N-1) perguntas, último contato
  const totalPerguntas = PERGUNTAS.length;
  const stepContato = 2 + totalPerguntas; // último
  const totalSteps = stepContato + 1;

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [resultado, setResultado] = useState<ReturnType<typeof calcularDiagnostico> | null>(null);

  const [funcionarios, setFuncionarios] = useState("");
  const [setor, setSetor] = useState("");
  const [respostas, setRespostas] = useState<Record<string, RespKey>>({});

  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");

  const next = () => setStep((s) => Math.min(stepContato, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const submit = async () => {
    if (!nome.trim() || !email.trim() || !telefone.trim() || !empresa.trim()) {
      toast.error("Preencha nome, empresa, e-mail e telefone");
      return;
    }
    const tel = telefone.replace(/\D/g, "");
    if (tel.length < 10) {
      toast.error("Telefone inválido. Use DDD + número");
      return;
    }

    const diag = calcularDiagnostico(respostas);

    const payload = {
      respostas,
      score: diag.score,
      perfil: diag.perfil,
      contexto: { num_funcionarios: funcionarios, setor },
      dimensoes: diag.porDim,
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
        urgencia: null,
        landing_page_origem: origem,
        perfil_diagnostico: diag.perfil,
        pontuacao_diagnostico: diag.score,
        diagnostico_resultado: payload,
      } as any);
      if (error) throw error;

      setResultado(diag);
      toast.success("Diagnóstico concluído. Nosso time entrará em contato.");
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar diagnóstico");
    } finally {
      setSubmitting(false);
    }
  };

  // ============== RESULTADO ==============
  if (resultado) {
    const cfg = PERFIL_LABEL[resultado.perfil];
    const tamLabel = FUNCIONARIOS.find((f) => f.v === funcionarios)?.l || "—";

    const Bar = ({ label, val, color }: { label: string; val: number; color: string }) => (
      <div className="text-left">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">{label}</span>
          <span className="font-bold" style={{ color }}>{val}/100</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'hsl(215 40% 18%)' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${val}%` }} transition={{ duration: 0.8 }} className="h-full" style={{ background: color }} />
        </div>
      </div>
    );

    const top3Dims = resultado.dimsRanqueadas.slice(0, 3);
    const acoesSugeridas = Array.from(new Set(top3Dims.flatMap((d) => ACAO_POR_DIM[d.dim]))).slice(0, 5);
    const riscos = resultado.naoConformes.slice(0, 5).map((p) => RISCO_POR_PERGUNTA[p.id]);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl p-6 md:p-8"
        style={{ background: 'hsl(215 55% 12%)', border: `1px solid ${cfg.cor}` }}
      >
        <div className="text-center mb-6">
          <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: cfg.cor }} />
          <h3 className="text-2xl font-black text-white mb-1">Seu Diagnóstico</h3>
          <p className="text-sm text-gray-400">{empresa} · {tamLabel} colaboradores · {setor}</p>
          <p className="text-[11px] text-gray-500 mt-1">Calculado a partir de {PERGUNTAS.length} verificações de conformidade SST.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="rounded-xl p-5 text-center" style={{ background: 'hsl(215 40% 16%)' }}>
            <div className="text-xs uppercase tracking-widest text-gray-500 mb-2">Índice de Risco SST</div>
            <div className="text-6xl font-black mb-2" style={{ color: cfg.cor }}>{resultado.score}<span className="text-xl text-gray-500">/100</span></div>
            <div className="inline-block px-3 py-1 rounded-full text-xs font-bold" style={{ background: `${cfg.cor}20`, color: cfg.cor, border: `1px solid ${cfg.cor}40` }}>
              Perfil: {cfg.l}
            </div>
            <p className="text-[11px] text-gray-500 mt-2">Quanto maior, maior a exposição.</p>
          </div>
          <div className="space-y-3">
            {top3Dims.map((d) => (
              <Bar key={d.dim} label={DIM_LABEL[d.dim]} val={d.pct} color={d.pct >= 60 ? "hsl(0 70% 55%)" : d.pct >= 30 ? "hsl(33 100% 55%)" : "hsl(152 60% 50%)"} />
            ))}
          </div>
        </div>

        <p className="text-gray-300 text-sm mb-5 text-center">{cfg.msg}</p>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl p-4" style={{ background: 'hsl(0 50% 15% / 0.4)', border: '1px solid hsl(0 60% 35%)' }}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'hsl(0 80% 70%)' }}>
              <AlertTriangle className="w-4 h-4" /> Não conformidades detectadas
            </div>
            {riscos.length === 0 ? (
              <p className="text-sm text-gray-300">Nenhuma não conformidade crítica identificada nas respostas.</p>
            ) : (
              <ul className="space-y-2 text-sm text-gray-200">
                {riscos.map((r, i) => (
                  <li key={i} className="flex gap-2"><span style={{ color: 'hsl(0 80% 65%)' }}>•</span><span>{r}</span></li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl p-4" style={{ background: 'hsl(152 40% 15% / 0.4)', border: '1px solid hsl(152 50% 30%)' }}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'hsl(152 70% 65%)' }}>
              <Sparkles className="w-4 h-4" /> Plano sugerido
            </div>
            <ul className="space-y-2 text-sm text-gray-200">
              {acoesSugeridas.map((a, i) => (
                <li key={i} className="flex gap-2"><span style={{ color: 'hsl(152 70% 60%)' }}>✓</span><span>{a}</span></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-xl p-4 text-center" style={{ background: 'hsl(152 40% 15% / 0.4)', border: '1px solid hsl(152 50% 30%)' }}>
          <p className="text-sm text-gray-200 mb-1 font-bold" style={{ color: 'hsl(152 70% 70%)' }}>
            ✓ Diagnóstico registrado com sucesso
          </p>
          <p className="text-sm text-gray-300">
            Um especialista da YourEyes vai entrar em contato em breve no telefone e e-mail informados para agendar uma <strong className="text-white">apresentação personalizada</strong>.
          </p>
        </div>
      </motion.div>
    );
  }

  // ============== STEPS ==============
  const pct = ((step + 1) / totalSteps) * 100;

  const renderStep = () => {
    if (step === 0) {
      return (
        <QuizStep key="s0" titulo="Quantas pessoas trabalham na sua empresa?" subtitulo="Inclui CLT, terceirizados e estagiários (contexto, não pontua)">
          <OptionsGrid options={FUNCIONARIOS.map((f) => ({ value: f.v, label: f.l }))} value={funcionarios} onChange={(v) => { setFuncionarios(v); next(); }} cols={2} />
        </QuizStep>
      );
    }
    if (step === 1) {
      return (
        <QuizStep key="s1" titulo="Qual o setor da empresa?" subtitulo="Usado para contextualizar riscos típicos do segmento">
          <OptionsGrid options={SETORES.map((s) => ({ value: s, label: s }))} value={setor} onChange={(v) => { setSetor(v); next(); }} cols={2} />
        </QuizStep>
      );
    }
    if (step >= 2 && step < stepContato) {
      const idx = step - 2;
      const p = PERGUNTAS[idx];
      return (
        <QuizStep key={p.id} titulo={p.pergunta} subtitulo={p.ajuda}>
          <OptionsGrid
            options={RESP_OPCOES.map((o) => ({ value: o.v, label: o.l }))}
            value={respostas[p.id] || ""}
            onChange={(v) => { setRespostas((prev) => ({ ...prev, [p.id]: v as RespKey })); next(); }}
            cols={1}
          />
        </QuizStep>
      );
    }
    // contato
    return (
      <motion.div key="contato" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
        <h3 className="text-2xl font-black text-white mb-1">Quase lá! Como falamos com você?</h3>
        <p className="text-sm text-gray-400 mb-5">Em seguida um especialista entra em contato para apresentar o diagnóstico completo.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(() => {
            const ic = "bg-[hsl(215_40%_18%)] border-[hsl(215_40%_28%)] text-white placeholder:text-gray-500";
            return (
              <>
                <Field label="Nome*"><Input className={ic} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" /></Field>
                <Field label="Empresa*"><Input className={ic} value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Nome da empresa" /></Field>
                <Field label="Cargo"><Input className={ic} value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex: Gestor SST" /></Field>
                <Field label="E-mail*"><Input className={ic} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" /></Field>
                <div className="md:col-span-2">
                  <Field label="Telefone*"><Input className={ic} value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" /></Field>
                </div>
              </>
            );
          })()}
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
    );
  };

  return (
    <div className="rounded-2xl p-6 md:p-8" style={{ background: 'hsl(215 55% 12%)', border: '1px solid hsl(215 40% 22%)' }}>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-gray-400 font-bold">
            <Brain className="w-4 h-4" style={{ color: 'hsl(152 60% 50%)' }} />
            Diagnóstico SST · {totalPerguntas} verificações
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

      <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>

      {step > 0 && step < stepContato && (
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
