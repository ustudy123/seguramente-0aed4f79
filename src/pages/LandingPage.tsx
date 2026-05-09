import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, AlertTriangle, CheckCircle, ArrowRight, Clock, 
  Users, Brain, FileWarning, TrendingDown, Zap, Lock,
  ChevronDown, Star, Award, BarChart3, Heart, Bot,
  FileText, ClipboardCheck, Stethoscope, Gavel, Eye,
  MessageSquare, Briefcase, GraduationCap, Target, 
  CalendarCheck, Fingerprint, Building2, Sparkles,
  ShieldCheck, LayoutDashboard, Cpu, Globe, Megaphone,
  TrendingUp, UserCheck, Lightbulb, Scale
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import mockupDashboard from "@/assets/landing/mockup-dashboard.png";
import mockupPsicossocial from "@/assets/landing/mockup-psicossocial.png";
import mockupGovernanca from "@/assets/landing/mockup-governanca.png";
import mockupConfiguracoes from "@/assets/landing/mockup-configuracoes.png";
import logoYoureyes from "@/assets/logo-youreyes.svg";

const WHATSAPP_NUMBER = "5546993375044";
const WHATSAPP_MESSAGE = encodeURIComponent(
  "Olá! Vim pelo site da YourEyes e gostaria de agendar uma demonstração da plataforma."
);
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`;
const openWhatsApp = () => window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer");

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

const pulseGlow = {
  initial: { boxShadow: '0 0 0 0px hsl(33 100% 50% / 0.4)' },
  animate: { 
    boxShadow: ['0 0 0 0px hsl(33 100% 50% / 0.4)', '0 0 0 15px hsl(33 100% 50% / 0)', '0 0 0 0px hsl(33 100% 50% / 0)'],
    transition: { duration: 2, repeat: Infinity }
  }
};

export default function LandingPage() {
  const navigate = useNavigate();
  const [vagasRestantes, setVagasRestantes] = useState(10);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [showFormulario, setShowFormulario] = useState(false);
  const [leadEnviado, setLeadEnviado] = useState(false);

  useEffect(() => {
    fetchVagas();
  }, []);

  const fetchVagas = async () => {
    const { data } = await supabase
      .from("landing_vagas")
      .select("*")
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();
    if (data) {
      setVagasRestantes(data.total_vagas - data.vagas_preenchidas);
    }
  };

  const formatWhatsapp = (v: string) => {
    const digits = v.replace(/\D/g, "").substring(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleSubmitLead = async () => {
    if (!nome.trim() || !email.trim() || !whatsapp.trim()) {
      toast.error("Preencha nome, e-mail e WhatsApp");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("E-mail inválido");
      return;
    }
    const digits = whatsapp.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11) {
      toast.error("WhatsApp inválido. Use DDD + número");
      return;
    }
    setLoading(true);
    try {
      await supabase.from("landing_leads").insert({
        nome: nome.trim().substring(0, 100),
        email: email.trim().substring(0, 255),
        telefone: digits,
      });
      setLeadEnviado(true);
      toast.success("Cadastro realizado! Garanta sua vaga agora.");
    } catch {
      toast.error("Erro ao enviar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#050d1a] text-white overflow-x-hidden">
      {/* Floating urgency bar */}
      <div className="fixed top-0 left-0 right-0 z-50 py-2 text-[11px] sm:text-sm font-bold shadow-lg overflow-hidden" style={{ background: 'linear-gradient(90deg, hsl(207 90% 25%), hsl(207 90% 38%), hsl(207 90% 25%))' }}>
        {/* Desktop: estático e centralizado */}
        <div className="hidden sm:flex items-center justify-center gap-3 px-3 leading-tight">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            ⚠️ NR-01 ATUALIZADA — Fatores de fatores de riscos psicossociais agora são OBRIGATÓRIOS. Multas de até R$ 50.000 por infração.
          </span>
          {vagasRestantes > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-black shrink-0" style={{ background: 'hsl(33 100% 50%)', color: '#fff' }}>
              🔥 {vagasRestantes} vagas
            </span>
          )}
        </div>
        {/* Mobile: marquee com texto completo */}
        <div className="sm:hidden relative w-full overflow-hidden">
          <div className="flex whitespace-nowrap animate-marquee">
            {[0, 1].map((i) => (
              <span key={i} className="flex items-center gap-2 px-4 shrink-0">
                <Clock className="w-3 h-3 shrink-0" />
                <span>⚠️ NR-01 ATUALIZADA — Fatores de fatores de riscos psicossociais agora são OBRIGATÓRIOS. Multas de até R$ 50.000 por infração.</span>
                {vagasRestantes > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black shrink-0" style={{ background: 'hsl(33 100% 50%)', color: '#fff' }}>
                    🔥 {vagasRestantes} vagas
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative pt-32 pb-16 px-4 min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, hsl(215 60% 12%) 0%, hsl(215 65% 7%) 100%)' }} />
        
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 animate-pulse" style={{ background: 'hsl(207 90% 45%)' }} />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 animate-pulse" style={{ background: 'hsl(33 100% 50%)', animationDelay: '1s' }} />
          
          {/* Grid Pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>
        
        <div className="relative max-w-6xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <motion.div
              animate={{ 
                scale: [1, 1.03, 1],
                transition: { duration: 3, repeat: Infinity }
              }}
            >
              <Badge className="mb-6 text-sm px-4 py-1.5 cursor-default select-none" style={{ background: 'hsl(33 100% 50% / 0.15)', color: 'hsl(33 100% 65%)', borderColor: 'hsl(33 100% 50% / 0.3)' }}>
                <AlertTriangle className="w-4 h-4 mr-2" />
                ALERTA: Sua empresa pode estar em risco AGORA
              </Badge>
            </motion.div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black leading-[1.1] mb-8 break-words tracking-tighter">
              Sua empresa está pronta para a{" "}
              <span className="relative inline-block">
                <span className="relative z-10" style={{ backgroundImage: 'linear-gradient(90deg, hsl(207 90% 65%), hsl(152 66% 60%), hsl(33 100% 60%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  maior fiscalização trabalhista
                </span>
                <motion.span 
                  className="absolute bottom-1 sm:bottom-2 left-0 w-full h-[30%] -z-0 opacity-20 rounded-sm"
                  style={{ background: 'linear-gradient(90deg, hsl(207 90% 55%), hsl(33 100% 50%))' }}
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  transition={{ delay: 0.8, duration: 1 }}
                />
              </span>{" "}
              dos últimos 20 anos?
            </h1>

            {/* MOCKUP - logo após o título principal */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="my-16 max-w-5xl mx-auto relative"
            >
              {/* Decorative elements around mockup */}
              <div className="absolute -top-6 -left-6 w-24 h-24 border-t-2 border-l-2 border-hsl(207 90% 45% / 0.3) rounded-tl-2xl hidden md:block" />
              <div className="absolute -bottom-6 -right-6 w-24 h-24 border-b-2 border-r-2 border-hsl(33 100% 50% / 0.3) rounded-br-2xl hidden md:block" />
              
              <div className="relative rounded-2xl overflow-hidden shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] border border-white/5 bg-white/5 backdrop-blur-sm p-1">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-transparent to-orange-500/10 pointer-events-none" />
                <img
                  src={mockupDashboard}
                  alt="Dashboard YourEyes - Painel de controle inteligente"
                  className="w-full h-auto rounded-xl shadow-2xl relative z-10"
                  loading="lazy"
                />
              </div>
              <p className="text-center text-[10px] uppercase tracking-widest text-gray-500 mt-6 font-bold opacity-60">
                Visualização real da plataforma YourEyes
              </p>
            </motion.div>

            <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-4">
              A NR-01 foi atualizada. Agora <strong className="text-white">fatores de riscos psicossociais são obrigatórios</strong> no GRO/PGR.
              Empresas que não se adequarem enfrentam <strong style={{ color: 'hsl(33 100% 60%)' }}>multas, interdições e processos trabalhistas</strong>.
            </p>

            <p className="text-base text-gray-500 max-w-2xl mx-auto mb-10">
              97% das empresas brasileiras NÃO estão preparadas. A sua está entre as 3% que vão se proteger — ou entre as 97% que vão pagar caro?
            </p>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
              <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4" style={{ color: 'hsl(152 50% 50%)' }} /> Sem cartão de crédito</span>
              <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4" style={{ color: 'hsl(152 50% 50%)' }} /> Resultado imediato</span>
              <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4" style={{ color: 'hsl(152 50% 50%)' }} /> 100% confidencial</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 1 }} className="mt-12">
            <ChevronDown className="w-8 h-8 mx-auto text-gray-600 animate-bounce" />
          </motion.div>
        </div>
      </section>

      {/* ═══════════ PAIN SECTION ═══════════ */}
      <section className="py-20 px-4" style={{ background: 'linear-gradient(180deg, hsl(215 65% 7%) 0%, hsl(215 60% 10%) 100%)' }}>
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp}>
            <h2 className="text-3xl md:text-5xl font-black text-center mb-4">
              O que acontece com quem <span style={{ color: 'hsl(33 100% 50%)' }}>ignora</span> a NR-01?
            </h2>
            <p className="text-gray-400 text-center max-w-2xl mx-auto mb-16">
              A fiscalização não avisa. Ela chega. E quando chega, o prejuízo é irreversível.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: FileWarning, title: "Multas de até R$ 50.000", desc: "Por infração. Reincidência dobra o valor. Uma única visita do MTE pode custar mais que 5 anos de prevenção.", color: "hsl(33 100% 50%)", bg: "hsl(33 100% 50% / 0.1)" },
              { icon: Lock, title: "Interdição Total", desc: "Sua empresa pode ser PARADA. Sem produção, sem faturamento, sem folha. Até a adequação completa.", color: "hsl(207 90% 55%)", bg: "hsl(207 90% 45% / 0.1)" },
              { icon: TrendingDown, title: "Processos Trabalhistas", desc: "Burnout, assédio e danos morais. Um único processo pode ultrapassar R$ 200.000 em indenizações.", color: "hsl(38 90% 55%)", bg: "hsl(38 90% 50% / 0.1)" },
              { icon: Users, title: "Perda de Talentos", desc: "Colaboradores adoecidos pedem demissão. O custo de turnover chega a 213% do salário anual.", color: "hsl(152 66% 50%)", bg: "hsl(152 66% 50% / 0.1)" },
            ].map((item, i) => (
              <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.1 }}>
                <div 
                  className="rounded-2xl p-8 h-full transition-all duration-300 hover:scale-[1.02] group relative overflow-hidden" 
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', 
                    border: '1px solid rgba(255,255,255,0.05)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-500" style={{ backgroundImage: `linear-gradient(135deg, ${item.color}, transparent)` }} />
                  
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg transition-transform group-hover:rotate-6" style={{ background: item.bg, border: `1px solid ${item.color}20` }}>
                    <item.icon className="w-7 h-7" style={{ color: item.color }} />
                  </div>
                  <h3 className="text-xl font-bold mb-3 tracking-tight group-hover:text-white transition-colors">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed group-hover:text-gray-300 transition-colors">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ IA SECTION ═══════════ */}
      <section className="py-20 px-4 relative overflow-hidden" style={{ background: 'hsl(215 60% 10%)' }}>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[200px]" style={{ background: 'hsl(207 90% 45% / 0.05)' }} />
        <div className="max-w-6xl mx-auto relative">
          {/* ═══════════ BIG NUMBERS SECTION ═══════════ */}
          <div className="mb-32">
            <motion.div {...fadeUp} className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-black mb-4">
                Números que tiram o <span style={{ color: 'hsl(33 100% 50%)' }}>sono</span> do empregador
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                Ignorar a conformidade legal não é uma economia. É um risco financeiro de proporções catastróficas.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              {[
                { number: "R$ 100 Bi", label: "Custos anuais das empresas com processos trabalhistas no Brasil", icon: TrendingDown, color: "hsl(33 100% 50%)" },
                { number: "213%", label: "Do salário anual é o custo médio para substituir um talento perdido por burnout", icon: Users, color: "hsl(207 90% 55%)" },
                { number: "R$ 50 Mil", label: "Multa máxima POR INFRAÇÃO em caso de descumprimento das NRs", icon: Scale, color: "hsl(152 66% 50%)" },
              ].map((stat, i) => (
                <motion.div 
                  key={stat.label}
                  {...fadeUp}
                  transition={{ delay: i * 0.1 }}
                  className="p-10 rounded-[2rem] relative overflow-hidden group transition-all duration-500 hover:-translate-y-2"
                  style={{ 
                    background: 'rgba(255,255,255,0.02)', 
                    border: '1px solid rgba(255,255,255,0.05)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                  }}
                >
                  <div className="absolute -right-4 -bottom-4 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity duration-500">
                    <stat.icon size={160} style={{ color: stat.color }} />
                  </div>
                  
                  <div className="relative z-10">
                    <motion.div 
                      className="text-6xl md:text-7xl font-black mb-6 tracking-tighter"
                      style={{ color: stat.color, textShadow: `0 0 30px ${stat.color}40` }}
                      initial={{ scale: 0.8 }}
                      whileInView={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 100 }}
                    >
                      {stat.number}
                    </motion.div>
                    <p className="text-gray-300 font-semibold text-lg leading-snug group-hover:text-white transition-colors">{stat.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div {...fadeUp} className="text-center mb-16">
            <Badge className="mb-4" style={{ background: 'hsl(207 90% 45% / 0.15)', color: 'hsl(152 66% 55%)', borderColor: 'hsl(207 90% 45% / 0.3)' }}>
              <Sparkles className="w-4 h-4 mr-1" /> INTELIGÊNCIA ARTIFICIAL
            </Badge>
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              IA que <span style={{ backgroundImage: 'linear-gradient(90deg, hsl(207 90% 55%), hsl(152 66% 55%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>trabalha por você</span> 24 horas por dia
            </h2>
            <p className="text-gray-400 max-w-3xl mx-auto text-lg">
              Enquanto seus concorrentes usam planilhas, o YourEyes usa <strong className="text-white">GPT-4o e visão computacional</strong> para automatizar 
              o que antes levava semanas. Isso não é marketing — é tecnologia real rodando agora.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Brain, title: "Psicossocial NR-01", desc: "O motor psicossocial cruza dados de Ponto, Atestados, Ouvidoria, Avaliações, Turnover e Ocorrências em tempo real para detectar burnout e assédio antes da fiscalização." },
              { icon: Fingerprint, title: "EPI com Facial", desc: "Cada entrega é validada por liveness + biometria facial — prova jurídica indiscutível para o eSocial S-2240 e auditorias trabalhistas." },
              { icon: Eye, title: "Leitura IA (OCR)", desc: "Foto de NF-e, atestado médico, ASO ou DANFE: a IA extrai CID, dias de afastamento, valores e classifica automaticamente." },
              { icon: MessageSquare, title: "Ouvidoria com IA", desc: "Classifica denúncias por sentimento, urgência e categoria (assédio, ética, segurança). Identifica reincidência e sugere encaminhamento." },
              { icon: Target, title: "PDI Inteligente", desc: "Planos de Desenvolvimento Individual gerados automaticamente após avaliações, com metas SMART personalizadas por cargo." },
              { icon: ClipboardCheck, title: "Detecção Automática", desc: "Monitora turnover, horas extras, atestados mentais e ocorrências disciplinares — gatilhos automáticos para campanhas extraordinárias." },
            ].map((item, i) => (
              <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.08 }}>
                <div className="rounded-2xl p-8 h-full transition-all duration-300 hover:bg-white/[0.05] group border border-white/5 bg-white/[0.02] backdrop-blur-md">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 bg-gradient-to-br from-blue-500/20 to-emerald-500/20 group-hover:scale-110 transition-transform">
                    <item.icon className="w-6 h-6" style={{ color: 'hsl(152 66% 55%)' }} />
                  </div>
                  <h3 className="text-lg font-bold mb-3 tracking-tight group-hover:text-emerald-400 transition-colors">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ PSYCHOSOCIAL DEEP DIVE ═══════════ */}
      <section className="py-20 px-4" style={{ background: 'linear-gradient(180deg, hsl(215 60% 10%) 0%, hsl(215 65% 8%) 100%)' }}>
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <Badge className="mb-4" style={{ background: 'hsl(33 100% 50% / 0.15)', color: 'hsl(33 100% 60%)', borderColor: 'hsl(33 100% 50% / 0.3)' }}>
              <AlertTriangle className="w-4 h-4 mr-1" /> NR-01 — OBRIGATÓRIO
            </Badge>
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              Gestão Psicossocial <span style={{ color: 'hsl(33 100% 50%)' }}>Completa</span> e Automatizada
            </h2>
            <p className="text-gray-400 max-w-3xl mx-auto text-lg">
              O YourEyes é a <strong className="text-white">única plataforma</strong> que cobre 100% dos fatores de riscos psicossociais exigidos pela NR-01 atualizada, 
              com questionários validados, indicadores automáticos e relatórios prontos para a fiscalização.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            <motion.div {...fadeUp} className="rounded-2xl p-8" style={{ background: 'hsl(215 55% 12%)', border: '1px solid hsl(215 40% 20%)' }}>
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <FileText className="w-6 h-6" style={{ color: 'hsl(207 90% 60%)' }} />
                Questionário NR-01 Completo
              </h3>
              <div className="space-y-3 text-sm text-gray-400">
                {[
                  "14 blocos temáticos cobrindo TODOS os fatores de risco",
                  "R01: Assédio e Violência no Trabalho",
                  "R02: Gestão de Mudanças Organizacionais",
                  "R08: Eventos Violentos e Traumáticos",
                  "R12: Comunicação Organizacional",
                  "Escala de 5 níveis (0 a 4) com matriz de risco NR-01",
                  "Modelo híbrido: anônimo com identificação opcional",
                  "Ciclos regulares e extraordinários por gatilhos",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'hsl(152 50% 50%)' }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div {...fadeUp} transition={{ delay: 0.15 }} className="rounded-2xl p-8" style={{ background: 'hsl(215 55% 12%)', border: '1px solid hsl(215 40% 20%)' }}>
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <BarChart3 className="w-6 h-6" style={{ color: 'hsl(152 66% 50%)' }} />
                Indicadores Automáticos
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { code: "IRP-S", name: "Índice de Risco Psicossocial" },
                  { code: "IBO-S", name: "Índice de Burnout Organizacional" },
                  { code: "IBD-S", name: "Índice de Bem-Estar e Desgaste" },
                  { code: "IREC-S", name: "Índice de Reconhecimento" },
                  { code: "ICOP-S", name: "Índice de Cooperação Social" },
                  { code: "INOT-S", name: "Índice de Notificações de Risco" },
                ].map((ind, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: 'hsl(215 65% 8%)', border: '1px solid hsl(215 40% 20%)' }}>
                    <p className="text-xs font-mono font-bold" style={{ color: 'hsl(152 66% 55%)' }}>{ind.code}</p>
                    <p className="text-xs text-gray-500 mt-1">{ind.name}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-4">
                Todos os indicadores são calculados em tempo real e exportáveis para relatórios de auditoria.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════ ALL MODULES ═══════════ */}
      <section className="py-20 px-4" style={{ background: 'hsl(215 65% 8%)' }}>
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <Badge className="mb-4" style={{ background: 'hsl(152 50% 42% / 0.15)', color: 'hsl(152 50% 55%)', borderColor: 'hsl(152 50% 42% / 0.3)' }}>
              <Shield className="w-4 h-4 mr-1" /> PLATAFORMA COMPLETA
            </Badge>
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              <span style={{ backgroundImage: 'linear-gradient(90deg, hsl(207 90% 55%), hsl(152 66% 50%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>+30 módulos</span> integrados em uma única plataforma
            </h2>
            <p className="text-gray-400 max-w-3xl mx-auto text-lg">
              Tudo que sua empresa precisa para SST, RH e compliance — sem precisar de 10 softwares diferentes.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { icon: Brain, name: "Psicossocial NR-01", tag: "IA" },
              { icon: Stethoscope, name: "Saúde Ocupacional" },
              { icon: Shield, name: "Gestão de EPIs" },
              { icon: FileText, name: "Atestados e ASOs" },
              { icon: ClipboardCheck, name: "PGR / GRO" },
              { icon: UserCheck, name: "Admissão Digital" },
              { icon: GraduationCap, name: "Onboarding Automático" },
              { icon: Target, name: "PDIs com IA", tag: "IA" },
              { icon: Star, name: "Avaliações 360°" },
              { icon: BarChart3, name: "9-Box / Talent Review" },
              { icon: CalendarCheck, name: "Controle de Ponto" },
              { icon: Fingerprint, name: "Ponto com Geolocalização" },
              { icon: Heart, name: "Bem-Estar e Clima" },
              { icon: Megaphone, name: "Ouvidoria com IA", tag: "IA" },
              { icon: Gavel, name: "Ocorrências e Advertências" },
              { icon: Scale, name: "Desligamento Estruturado" },
              { icon: Building2, name: "Gestão de Terceiros" },
              { icon: Globe, name: "Marketplace SST" },
              { icon: FileWarning, name: "Guias e Certidões" },
              { icon: TrendingUp, name: "Hub Contábil" },
              { icon: Briefcase, name: "Benefícios e Cargos" },
              { icon: GraduationCap, name: "Trilhas de Aprendizagem" },
              { icon: Award, name: "Certificados e Medalhas" },
              { icon: Lightbulb, name: "Cultura e Valores" },
              { icon: Eye, name: "OCR de Notas Fiscais", tag: "IA" },
              { icon: ShieldCheck, name: "Auditoria e Compliance" },
              { icon: LayoutDashboard, name: "Dashboards Inteligentes" },
              { icon: Users, name: "Multi-Tenant / Multi-Empresa" },
            ].map((mod, i) => (
              <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.03 }}>
                <div className="rounded-xl p-4 h-full transition-colors group relative" style={{ background: 'hsl(215 55% 12%)', border: '1px solid hsl(215 40% 20%)' }}>
                  {mod.tag && (
                    <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'hsl(33 100% 50% / 0.2)', color: 'hsl(33 100% 60%)' }}>
                      {mod.tag}
                    </span>
                  )}
                  <mod.icon className="w-6 h-6 mb-2 transition-colors" style={{ color: 'hsl(207 90% 60%)' }} />
                  <p className="text-sm font-medium text-gray-300">{mod.name}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeUp} className="text-center mt-10">
            <p className="text-gray-500 text-sm">
              E muito mais sendo adicionado toda semana. Quem entrar agora, leva <strong className="text-white">TUDO desbloqueado</strong>.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="py-20 px-4" style={{ background: 'linear-gradient(180deg, hsl(215 65% 8%) 0%, hsl(215 60% 10%) 100%)' }}>
        <div className="max-w-4xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              Comece em <span style={{ color: 'hsl(152 66% 55%)' }}>3 passos simples</span>
            </h2>
          </motion.div>
          <div className="space-y-8">
            {[
              { step: "01", title: "Diagnóstico Rápido", desc: "Responda 7 perguntas críticas e receba um relatório imediato do nível de exposição da sua empresa." },
              { step: "02", title: "Setup Inteligente", desc: "Nossa IA importa seus dados e configura departamentos e cargos automaticamente em minutos." },
              { step: "03", title: "Monitoramento Ativo", desc: "O sistema assume o controle, disparando alertas proativos e gerando conformidade automática." },
            ].map((s, i) => (
              <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.15 }} className="flex gap-8 items-start group">
                <div className="shrink-0 w-20 h-20 rounded-3xl flex items-center justify-center relative" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="absolute inset-0 bg-blue-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="text-3xl font-black relative z-10" style={{ backgroundImage: 'linear-gradient(135deg, hsl(207 90% 65%), hsl(152 66% 60%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{s.step}</span>
                </div>
                <div className="pt-2">
                  <h3 className="text-2xl font-black mb-2 tracking-tight group-hover:text-white transition-colors">{s.title}</h3>
                  <p className="text-gray-400 text-lg leading-relaxed group-hover:text-gray-300 transition-colors">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ SOCIAL PROOF ═══════════ */}
      <section className="py-20 px-4" style={{ background: 'hsl(215 60% 10%)' }}>
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black mb-16">
            Números que <span style={{ color: 'hsl(152 66% 55%)' }}>falam por si</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { num: "97%", label: "das empresas não estão adequadas à NR-01" },
              { num: "R$ 50mil", label: "multa média por infração identificada" },
              { num: "213%", label: "custo de turnover por burnout não tratado" },
              { num: "74%", label: "redução de riscos com gestão psicossocial" },
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <p className="text-3xl md:text-4xl font-black" style={{ backgroundImage: 'linear-gradient(90deg, hsl(207 90% 55%), hsl(33 100% 50%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{stat.num}</p>
                <p className="text-sm text-gray-500 mt-2">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ DIFFERENTIATORS ═══════════ */}
      <section className="py-20 px-4" style={{ background: 'linear-gradient(180deg, hsl(215 60% 10%) 0%, hsl(215 65% 8%) 100%)' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              Por que o YourEyes é <span style={{ color: 'hsl(33 100% 50%)' }}>diferente</span>?
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              { title: "Outros softwares", items: ["Planilhas disfarçadas de sistema", "Sem IA real — apenas formulários", "SST separado do RH", "Sem gestão psicossocial", "Sem compliance NR-01 atualizada", "Interface ultrapassada"], bad: true },
              { title: "YourEyes", items: ["Plataforma inteligente com IA real (GPT-4o)", "Detecção automática de riscos", "SST + RH + Psicossocial integrados", "100% compliance NR-01 atualizada", "Indicadores em tempo real", "Design moderno e intuitivo"], bad: false },
            ].map((col, i) => (
              <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.15 }}>
                <div className="rounded-2xl p-8 h-full" style={{ background: col.bad ? 'hsl(0 20% 10%)' : 'hsl(215 55% 12%)', border: `1px solid ${col.bad ? 'hsl(0 40% 25% / 0.3)' : 'hsl(152 50% 42% / 0.2)'}` }}>
                  <h3 className="text-xl font-bold mb-6" style={{ color: col.bad ? 'hsl(0 60% 60%)' : 'hsl(152 50% 55%)' }}>{col.title}</h3>
                  <div className="space-y-3">
                    {col.items.map((item, j) => (
                      <div key={j} className="flex items-center gap-2 text-sm text-gray-400">
                        {col.bad ? (
                          <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: 'hsl(0 40% 25% / 0.3)' }}>
                            <span style={{ color: 'hsl(0 60% 60%)' }} className="text-xs">✕</span>
                          </span>
                        ) : (
                          <CheckCircle className="w-4 h-4 shrink-0" style={{ color: 'hsl(152 50% 50%)' }} />
                        )}
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ MOCKUPS GALLERY ═══════════ */}
      <section className="py-20 px-4" style={{ background: 'hsl(215 65% 8%)' }}>
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-14">
            <Badge className="mb-4" style={{ background: 'hsl(152 66% 45% / 0.15)', color: 'hsl(152 66% 60%)', borderColor: 'hsl(152 66% 45% / 0.3)' }}>
              <LayoutDashboard className="w-4 h-4 mr-1" /> A PLATAFORMA POR DENTRO
            </Badge>
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              Veja o YourEyes <span style={{ color: 'hsl(152 66% 55%)' }}>em ação</span>
            </h2>
            <p className="text-gray-400 max-w-3xl mx-auto text-lg">
              Interface moderna, indicadores em tempo real e governança integrada — desenhado para quem decide.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              { src: mockupGovernanca, title: "Governança do Trabalho Humano", desc: "Visão integrada dos 4 pilares estratégicos com escore de maturidade em tempo real." },
              { src: mockupPsicossocial, title: "Gestão Psicossocial NR-01", desc: "IPS, Confiabilidade e campanhas anônimas com privacidade garantida (mín. 5 respondentes)." },
              { src: mockupConfiguracoes, title: "Configurações e Perfis de Acesso", desc: "Controle granular de papéis, vínculos e permissões por empresa e estabelecimento." },
              { src: mockupDashboard, title: "Dashboard Operacional", desc: "KPIs de Colaboradores, Admissões, EPIs, Documentos, Avaliações e Metas em um só lugar." },
            ].map((m, i) => (
              <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.08 }}>
                <div className="rounded-2xl overflow-hidden" style={{ background: 'hsl(215 55% 12%)', border: '1px solid hsl(215 40% 20%)' }}>
                  <img src={m.src} alt={m.title} loading="lazy" className="w-full h-auto" />
                  <div className="p-5">
                    <h3 className="font-bold text-lg mb-1">{m.title}</h3>
                    <p className="text-sm text-gray-400">{m.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ DIAGNÓSTICO RÁPIDO + LEAD ═══════════ */}
      <section id="diagnostico" className="py-20 px-4 relative overflow-hidden" style={{ background: 'hsl(215 65% 8%)' }}>
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[250px]" style={{ background: 'hsl(152 60% 40%)' }} />
        </div>
        <div className="relative max-w-3xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-8">
            <Brain className="w-14 h-14 mx-auto mb-4" style={{ color: 'hsl(152 60% 50%)' }} />
            <h2 className="text-3xl md:text-5xl font-black mb-3">
              Descubra em 60s o seu <span style={{ color: 'hsl(152 60% 50%)' }}>nível de risco SST</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Responda 5 perguntas e receba um diagnóstico personalizado.
              Em seguida, abrimos o <strong className="text-white">WhatsApp</strong> com o resultado pronto para conversarmos.
            </p>
          </motion.div>
          <motion.div {...fadeUp}>
            <DiagnosticoQuiz origem="lp" whatsappNumber={WHATSAPP_NUMBER} />
          </motion.div>
          <p className="text-xs text-gray-600 mt-4 text-center">Sem compromisso • Resposta em minutos durante o horário comercial</p>
        </div>
      </section>

      {/* ═══════════ CTA / VAGAS ═══════════ */}
      <section id="vagas" className="py-20 px-4 relative" style={{ background: 'linear-gradient(180deg, hsl(215 65% 8%) 0%, hsl(215 70% 5%) 100%)' }}>
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[200px]" style={{ background: 'hsl(207 90% 45%)' }} />
        </div>
        <div className="relative max-w-2xl mx-auto">
          <motion.div {...fadeUp}>
            <div className="text-center mb-10">
              <Badge className="mb-4 animate-pulse text-sm" style={{ background: 'hsl(33 100% 50% / 0.15)', color: 'hsl(33 100% 60%)', borderColor: 'hsl(33 100% 50% / 0.3)' }}>
                <Zap className="w-4 h-4 mr-1" />
                LANÇAMENTO EXCLUSIVO — VAGAS LIMITADAS
              </Badge>
              <h2 className="text-3xl md:text-5xl font-black mb-4">
                Apenas <span style={{ color: 'hsl(33 100% 50%)' }}>{vagasRestantes}</span> vagas para acesso{" "}
                <span style={{ backgroundImage: 'linear-gradient(90deg, hsl(33 100% 50%), hsl(207 90% 55%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>COMPLETO</span>
              </h2>
              <p className="text-gray-400 max-w-xl mx-auto">
                Estamos liberando <strong className="text-white">10 vagas exclusivas</strong> com acesso total a TODOS os módulos — 
                sem restrição de funcionalidades. Após as 10 vagas, o acesso será por planos com funcionalidades limitadas.
              </p>
            </div>

            {/* Vagas visual */}
            <div className="rounded-[2rem] p-8 mb-10 overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-orange-500/5 pointer-events-none" />
              <div className="flex items-center justify-between mb-4 relative z-10">
                <span className="text-sm font-bold uppercase tracking-widest text-gray-500">Status das Vagas</span>
                <span className="text-xl font-black px-3 py-1 rounded-lg" style={{ background: 'hsl(33 100% 50% / 0.1)', color: 'hsl(33 100% 50%)' }}>{10 - vagasRestantes}/10</span>
              </div>
              <div className="w-full rounded-full h-5 overflow-hidden p-1 relative z-10" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <motion.div
                  className="h-full rounded-full shadow-[0_0_20px_rgba(249,115,22,0.4)]"
                  style={{ background: 'linear-gradient(90deg, hsl(207 90% 45%), hsl(33 100% 50%))' }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${((10 - vagasRestantes) / 10) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, ease: "circOut" }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-4 text-center font-medium italic relative z-10">
                Atenção: Após o preenchimento total, a plataforma passará a cobrar por cada módulo individualmente.
              </p>
            </div>

            {/* What's included */}
            <div className="rounded-2xl p-6 mb-8" style={{ background: 'hsl(215 55% 12%)', border: '1px solid hsl(215 40% 20%)' }}>
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Award className="w-5 h-5" style={{ color: 'hsl(33 100% 50%)' }} />
                O que você recebe nas 10 primeiras vagas:
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  "Todos os +30 módulos desbloqueados",
                  "IA Psicossocial NR-01 completa",
                  "Gestão de SST integrada",
                  "RH completo (admissão ao desligamento)",
                  "Marketplace de profissionais SST",
                  "OCR de notas fiscais com IA",
                  "Sem limite de colaboradores",
                  "Atualizações vitalícias nesta fase",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle className="w-4 h-4 shrink-0" style={{ color: 'hsl(152 50% 50%)' }} />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* After plans warning */}
            <div className="rounded-2xl p-5 mb-8" style={{ background: 'hsl(38 20% 10%)', border: '1px solid hsl(38 50% 40% / 0.2)' }}>
              <p className="font-bold text-sm mb-2" style={{ color: 'hsl(38 90% 55%)' }}>⚠️ O que acontece depois das 10 vagas?</p>
              <div className="text-xs text-gray-500 space-y-1">
                <p>• <strong className="text-gray-400">Plano Essencial:</strong> Apenas módulos básicos (Ponto, Admissão, EPIs)</p>
                <p>• <strong className="text-gray-400">Plano Profissional:</strong> Módulos intermediários (+ Avaliações, PDI, Psicossocial básico)</p>
                <p>• <strong className="text-gray-400">Plano Enterprise:</strong> Acesso total (o que você recebe GRÁTIS agora)</p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {!showFormulario && !leadEnviado && (
                  <motion.div 
                    key="cta" 
                    exit={{ opacity: 0 }}
                    variants={pulseGlow}
                    initial="initial"
                    animate="animate"
                    className="rounded-xl"
                  >
                    <Button
                      size="lg"
                      onClick={() => setShowFormulario(true)}
                      className="w-full text-white text-sm sm:text-lg px-4 py-6 sm:py-7 rounded-xl shadow-2xl whitespace-normal h-auto transform transition-all active:scale-95"
                      style={{ background: 'linear-gradient(135deg, hsl(207 90% 45%), hsl(33 100% 50%))', boxShadow: '0 8px 32px hsl(207 90% 45% / 0.3)' }}
                      disabled={vagasRestantes <= 0}
                    >
                      {vagasRestantes > 0 ? (
                        <>
                          <Zap className="w-5 h-5 mr-2 shrink-0 animate-pulse" />
                          <span className="break-words font-black tracking-wide">QUERO GARANTIR MINHA VAGA AGORA</span>
                        </>
                      ) : (
                        <span className="break-words font-bold">Vagas esgotadas — Lista de espera em breve</span>
                      )}
                    </Button>
                  </motion.div>
              )}

              {showFormulario && !leadEnviado && (
                <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div 
                    className="rounded-[2.5rem] p-10 relative overflow-hidden" 
                    style={{ 
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      backdropFilter: 'blur(30px)',
                      boxShadow: '0 40px 100px -20px rgba(0,0,0,0.5)'
                    }}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px] rounded-full" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500/10 blur-[60px] rounded-full" />
                    
                    <h3 className="text-3xl font-black mb-2 text-center tracking-tight">Comece sua Proteção</h3>
                    <p className="text-gray-400 text-base text-center mb-10">Preencha os dados e garanta seu acesso <span className="text-white font-bold">Vitalício</span> à fase Alpha.</p>
                    
                    <div className="space-y-5 relative z-10">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Nome Completo</label>
                        <Input
                          placeholder="Ex: João Silva"
                          value={nome}
                          onChange={e => setNome(e.target.value)}
                          maxLength={100}
                          className="h-14 text-lg border-white/10 bg-black/20 focus:bg-black/40 transition-all rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">E-mail Corporativo</label>
                        <Input
                          type="email"
                          placeholder="joao@empresa.com.br"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          maxLength={255}
                          className="h-14 text-lg border-white/10 bg-black/20 focus:bg-black/40 transition-all rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">WhatsApp</label>
                        <Input
                          type="tel"
                          inputMode="tel"
                          placeholder="(00) 00000-0000"
                          value={whatsapp}
                          onChange={e => setWhatsapp(formatWhatsapp(e.target.value))}
                          maxLength={16}
                          className="h-14 text-lg border-white/10 bg-black/20 focus:bg-black/40 transition-all rounded-xl"
                        />
                      </div>
                      
                      <Button
                        size="lg"
                        onClick={handleSubmitLead}
                        disabled={loading}
                        className="w-full text-white text-xl font-black py-8 rounded-xl shadow-2xl mt-4 group overflow-hidden relative"
                        style={{ 
                          background: 'linear-gradient(90deg, hsl(207 90% 45%), hsl(152 66% 45%))',
                          boxShadow: '0 20px 40px -10px rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        <span className="relative z-10">{loading ? "PROCESSANDO..." : "GARANTIR MINHA VAGA AGORA →"}</span>
                      </Button>
                    </div>
                    <p className="text-[10px] text-gray-500 text-center mt-6 font-medium uppercase tracking-widest">
                      🔒 Ambiente criptografado e 100% seguro pela LGPD
                    </p>
                  </div>
                </motion.div>
              )}

              {leadEnviado && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                  <div className="rounded-2xl p-8" style={{ background: 'linear-gradient(180deg, hsl(152 20% 12%) 0%, hsl(215 55% 12%) 100%)', border: '1px solid hsl(152 50% 42% / 0.3)' }}>
                    <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: 'hsl(152 50% 50%)' }} />
                    <h3 className="text-2xl font-black mb-2">Parabéns! Sua vaga está quase garantida 🎉</h3>
                    <p className="text-gray-400 mb-2">
                      Restam apenas <strong style={{ color: 'hsl(33 100% 50%)' }}>{vagasRestantes} vagas</strong> para acesso completo.
                    </p>
                    <div className="rounded-xl p-4 my-6" style={{ background: 'hsl(215 65% 8%)', border: '1px solid hsl(33 100% 50% / 0.3)' }}>
                      <p className="font-bold text-sm mb-1" style={{ color: 'hsl(33 100% 50%)' }}>⚡ ATENÇÃO: Apenas 10 vagas com acesso TOTAL</p>
                      <p className="text-gray-500 text-xs">
                        Após as 10 vagas, novos usuários terão acesso apenas a módulos limitados conforme o plano contratado. 
                        Crie sua conta agora para garantir o acesso completo.
                      </p>
                    </div>
                    <Button
                      size="lg"
                      onClick={() => navigate("/register")}
                      className="w-full sm:w-auto text-white text-sm sm:text-lg px-4 sm:px-10 py-6 rounded-xl shadow-2xl whitespace-normal h-auto"
                      style={{ background: 'linear-gradient(135deg, hsl(207 90% 45%), hsl(152 66% 45%))', boxShadow: '0 8px 32px hsl(207 90% 45% / 0.3)' }}
                    >
                      <span className="break-words">CRIAR MINHA CONTA AGORA — É GRÁTIS</span>
                      <ArrowRight className="w-5 h-5 ml-2 shrink-0" />
                    </Button>
                    <p className="text-xs text-gray-600 mt-4">Cadastro rápido em menos de 2 minutos</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* ═══════════ FINAL URGENCY ═══════════ */}
      <section className="py-16 px-4" style={{ background: 'hsl(215 70% 5%)', borderTop: '1px solid hsl(215 40% 16%)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-black mb-4">
            A pergunta não é <em>"Quanto custa adequar?"</em>
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            A pergunta é: <strong style={{ color: 'hsl(33 100% 50%)' }}>"Quanto vai custar NÃO adequar?"</strong>
          </p>
          <p className="text-gray-500 text-sm mb-8">
            Uma única multa do MTE paga 5 anos de YourEyes. Um único processo por burnout paga 10 anos. 
            A escolha é sua: investir centavos em prevenção ou milhares em correção.
          </p>
          <Button
            size="lg"
            onClick={() => scrollToSection("vagas")}
            className="w-full sm:w-auto text-white px-4 sm:px-10 py-6 text-sm sm:text-lg rounded-xl whitespace-normal h-auto transform transition-all hover:scale-105 active:scale-95"
            style={{ 
              background: 'linear-gradient(135deg, hsl(207 90% 45%), hsl(33 100% 50%))',
              boxShadow: '0 8px 32px hsl(207 90% 45% / 0.4)' 
            }}
          >
            <span className="break-words font-black">PROTEGER MINHA EMPRESA AGORA →</span>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center text-sm" style={{ borderTop: '1px solid hsl(215 40% 16%)', color: 'hsl(215 15% 55%)' }}>
        <p>© {new Date().getFullYear()} YourEyes — Plataforma de Gestão Inteligente de SST e RH</p>
        <p className="mt-1 text-xs" style={{ color: 'hsl(215 15% 40%)' }}>Este site não é afiliado ao Ministério do Trabalho e Emprego (MTE).</p>
      </footer>

      {/* Floating WhatsApp button */}
      <button
        onClick={openWhatsApp}
        aria-label="Falar no WhatsApp"
        className="fixed bottom-6 right-6 z-50 rounded-full p-4 shadow-2xl transition-transform hover:scale-110"
        style={{ background: 'hsl(152 66% 39%)', boxShadow: '0 8px 32px hsl(152 70% 38% / 0.5)' }}
      >
        <MessageSquare className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}
