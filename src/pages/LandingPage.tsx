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
import { LandingDiagnostico } from "@/components/landing/LandingDiagnostico";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

export default function LandingPage() {
  const navigate = useNavigate();
  const [vagasRestantes, setVagasRestantes] = useState(10);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDiagnostico, setShowDiagnostico] = useState(false);
  const [showFormulario, setShowFormulario] = useState(false);
  const [leadEnviado, setLeadEnviado] = useState(false);
  const [diagnosticoResultado, setDiagnosticoResultado] = useState<any>(null);

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

  const handleSubmitLead = async () => {
    if (!nome.trim() || !email.trim()) {
      toast.error("Preencha nome e e-mail");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("E-mail inválido");
      return;
    }
    setLoading(true);
    try {
      await supabase.from("landing_leads").insert({
        nome: nome.trim().substring(0, 100),
        email: email.trim().substring(0, 255),
        diagnostico_resultado: diagnosticoResultado,
        pontuacao_diagnostico: diagnosticoResultado?.pontuacao || null,
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
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {/* Floating urgency bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-red-900 via-red-700 to-red-900 py-2.5 px-4 text-center text-sm font-bold shadow-lg shadow-red-900/50">
        <Clock className="inline w-4 h-4 mr-1" />
        ⚠️ NR-01 ATUALIZADA — Riscos psicossociais agora são OBRIGATÓRIOS. Multas de até R$ 50.000 por infração.
        {vagasRestantes > 0 && (
          <span className="ml-2 bg-yellow-500/90 text-black px-3 py-0.5 rounded-full text-xs font-black">
            🔥 Apenas {vagasRestantes} vagas restantes
          </span>
        )}
      </div>

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative pt-28 pb-10 px-4 min-h-screen flex items-center">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a1a] via-[#0d1117] to-[#0a0a0f]" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-96 h-96 bg-red-500 rounded-full blur-[128px]" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500 rounded-full blur-[128px]" />
        </div>
        
        <div className="relative max-w-6xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <Badge className="mb-6 bg-red-500/20 text-red-400 border-red-500/30 text-sm px-4 py-1.5">
              <AlertTriangle className="w-4 h-4 mr-2" />
              ALERTA: Sua empresa pode estar em risco AGORA
            </Badge>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black leading-tight mb-6">
              Sua empresa está pronta para a{" "}
              <span className="bg-gradient-to-r from-red-500 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
                maior fiscalização trabalhista
              </span>{" "}
              dos últimos 20 anos?
            </h1>

            <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-4">
              A NR-01 foi atualizada. Agora <strong className="text-white">riscos psicossociais são obrigatórios</strong> no GRO/PGR.
              Empresas que não se adequarem enfrentam <strong className="text-red-400">multas, interdições e processos trabalhistas</strong>.
            </p>

            <p className="text-base text-gray-500 max-w-2xl mx-auto mb-10">
              97% das empresas brasileiras NÃO estão preparadas. A sua está entre as 3% que vão se proteger — ou entre as 97% que vão pagar caro?
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
              <Button
                size="lg"
                onClick={() => setShowDiagnostico(true)}
                className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white text-lg px-8 py-6 rounded-xl shadow-2xl shadow-red-500/25 group"
              >
                <Brain className="w-5 h-5 mr-2 group-hover:animate-pulse" />
                Faça o Diagnóstico GRÁTIS da Sua Empresa
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => scrollToSection("vagas")}
                className="border-gray-600 text-gray-300 hover:bg-white/5 text-lg px-8 py-6 rounded-xl"
              >
                Quero Garantir Minha Vaga →
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
              <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-green-500" /> Sem cartão de crédito</span>
              <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-green-500" /> Resultado imediato</span>
              <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-green-500" /> 100% confidencial</span>
            </div>
          </motion.div>

          {/* MOCKUP PLACEHOLDER */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="mt-16 max-w-5xl mx-auto"
          >
            <div className="relative rounded-2xl overflow-hidden border border-gray-700/50 bg-gradient-to-b from-[#16161d] to-[#0d0d14] shadow-2xl shadow-blue-500/10">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-[#1a1a24] border-b border-gray-800">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <div className="flex-1 mx-4 bg-[#0d0d14] rounded-lg px-4 py-1.5 text-xs text-gray-500 text-center">
                  app.seguramente.com.br
                </div>
              </div>
              {/* Mockup content area */}
              <div className="aspect-[16/9] flex items-center justify-center p-8 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-cyan-500/5" />
                <div className="relative text-center space-y-4">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <LayoutDashboard className="w-12 h-12 text-blue-400" />
                    <Cpu className="w-10 h-10 text-cyan-400" />
                    <Brain className="w-10 h-10 text-purple-400" />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black text-gray-300">Dashboard SeguraMente</h3>
                  <p className="text-gray-500 text-sm max-w-md mx-auto">
                    Visualize indicadores psicossociais, compliance NR-01, gestão de RH e SST — tudo em um painel inteligente com IA
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {["Psicossocial", "SST", "RH", "Ponto", "EPIs", "Avaliações", "IA"].map(m => (
                      <span key={m} className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-400">{m}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-gray-600 mt-3">* Imagem ilustrativa do painel de controle do SeguraMente</p>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 1 }} className="mt-12">
            <ChevronDown className="w-8 h-8 mx-auto text-gray-600 animate-bounce" />
          </motion.div>
        </div>
      </section>

      {/* ═══════════ PAIN SECTION ═══════════ */}
      <section className="py-20 px-4 bg-gradient-to-b from-[#0a0a0f] to-[#111118]">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp}>
            <h2 className="text-3xl md:text-5xl font-black text-center mb-4">
              O que acontece com quem <span className="text-red-500">ignora</span> a NR-01?
            </h2>
            <p className="text-gray-400 text-center max-w-2xl mx-auto mb-16">
              A fiscalização não avisa. Ela chega. E quando chega, o prejuízo é irreversível.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: FileWarning, title: "Multas de até R$ 50.000", desc: "Por infração. Reincidência dobra o valor. Uma única visita do MTE pode custar mais que 5 anos de prevenção.", color: "text-red-500", bg: "bg-red-500/10" },
              { icon: Lock, title: "Interdição Total", desc: "Sua empresa pode ser PARADA. Sem produção, sem faturamento, sem folha. Até a adequação completa.", color: "text-orange-500", bg: "bg-orange-500/10" },
              { icon: TrendingDown, title: "Processos Trabalhistas", desc: "Burnout, assédio e danos morais. Um único processo pode ultrapassar R$ 200.000 em indenizações.", color: "text-yellow-500", bg: "bg-yellow-500/10" },
              { icon: Users, title: "Perda de Talentos", desc: "Colaboradores adoecidos pedem demissão. O custo de turnover chega a 213% do salário anual.", color: "text-purple-500", bg: "bg-purple-500/10" },
            ].map((item, i) => (
              <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.1 }}>
                <div className="bg-[#16161d] border border-gray-800 rounded-2xl p-6 h-full hover:border-red-500/30 transition-colors">
                  <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center mb-4`}>
                    <item.icon className={`w-6 h-6 ${item.color}`} />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ IA SECTION ═══════════ */}
      <section className="py-20 px-4 bg-[#111118] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[200px]" />
        <div className="max-w-6xl mx-auto relative">
          <motion.div {...fadeUp} className="text-center mb-16">
            <Badge className="mb-4 bg-purple-500/20 text-purple-400 border-purple-500/30">
              <Sparkles className="w-4 h-4 mr-1" /> INTELIGÊNCIA ARTIFICIAL
            </Badge>
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              IA que <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">trabalha por você</span> 24 horas por dia
            </h2>
            <p className="text-gray-400 max-w-3xl mx-auto text-lg">
              Enquanto seus concorrentes usam planilhas, o SeguraMente usa <strong className="text-white">GPT-4o e visão computacional</strong> para automatizar 
              o que antes levava semanas. Isso não é marketing — é tecnologia real rodando agora.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Brain, title: "Análise Psicossocial com IA", desc: "Detecta automaticamente sinais de burnout, assédio e riscos psicossociais cruzando dados de atestados, ponto, denúncias e turnover." },
              { icon: Eye, title: "Leitura de Notas Fiscais (OCR)", desc: "Envie foto de NF-e, DANFE ou recibo e a IA extrai todos os dados automaticamente com GPT-4o Vision. Sem digitação manual." },
              { icon: MessageSquare, title: "Ouvidoria Inteligente", desc: "IA classifica denúncias por sentimento, urgência e categoria. Identifica riscos e sugere encaminhamento automático." },
              { icon: Target, title: "PDI Gerado por IA", desc: "Planos de Desenvolvimento Individual criados automaticamente após avaliações de desempenho, com metas SMART personalizadas." },
              { icon: ClipboardCheck, title: "Checklist de Detecção Observável", desc: "Monitora automaticamente turnover, horas extras, atestados mentais e ocorrências — sem precisar de pesquisa." },
              { icon: Bot, title: "Matching Inteligente NFs", desc: "IA cruza automaticamente XML de notas fiscais com guias de pagamento, identificando divergências e pendências." },
            ].map((item, i) => (
              <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.1 }}>
                <div className="bg-gradient-to-b from-[#1a1a28] to-[#16161d] border border-purple-500/10 rounded-2xl p-6 h-full hover:border-purple-500/30 transition-all">
                  <item.icon className="w-8 h-8 text-purple-400 mb-3" />
                  <h3 className="text-base font-bold mb-2">{item.title}</h3>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ PSYCHOSOCIAL DEEP DIVE ═══════════ */}
      <section className="py-20 px-4 bg-gradient-to-b from-[#111118] to-[#0d0d14]">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <Badge className="mb-4 bg-red-500/20 text-red-400 border-red-500/30">
              <AlertTriangle className="w-4 h-4 mr-1" /> NR-01 — OBRIGATÓRIO
            </Badge>
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              Gestão Psicossocial <span className="text-red-400">Completa</span> e Automatizada
            </h2>
            <p className="text-gray-400 max-w-3xl mx-auto text-lg">
              O SeguraMente é a <strong className="text-white">única plataforma</strong> que cobre 100% dos fatores psicossociais exigidos pela NR-01 atualizada, 
              com questionários validados, indicadores automáticos e relatórios prontos para a fiscalização.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            <motion.div {...fadeUp} className="bg-[#16161d] border border-gray-800 rounded-2xl p-8">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <FileText className="w-6 h-6 text-blue-400" />
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
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div {...fadeUp} transition={{ delay: 0.15 }} className="bg-[#16161d] border border-gray-800 rounded-2xl p-8">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-cyan-400" />
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
                  <div key={i} className="bg-[#0d0d14] rounded-xl p-3 border border-gray-800">
                    <p className="text-xs font-mono text-cyan-400 font-bold">{ind.code}</p>
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
      <section className="py-20 px-4 bg-[#0d0d14]">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <Badge className="mb-4 bg-green-500/20 text-green-400 border-green-500/30">
              <Shield className="w-4 h-4 mr-1" /> PLATAFORMA COMPLETA
            </Badge>
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">+30 módulos</span> integrados em uma única plataforma
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
                <div className="bg-[#16161d] border border-gray-800 rounded-xl p-4 h-full hover:border-blue-500/30 transition-colors group relative">
                  {mod.tag && (
                    <span className="absolute top-2 right-2 bg-purple-500/20 text-purple-400 text-[9px] font-bold px-1.5 py-0.5 rounded">
                      {mod.tag}
                    </span>
                  )}
                  <mod.icon className="w-6 h-6 text-blue-400 mb-2 group-hover:text-cyan-400 transition-colors" />
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
      <section className="py-20 px-4 bg-gradient-to-b from-[#0d0d14] to-[#111118]">
        <div className="max-w-4xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              Comece em <span className="text-cyan-400">3 passos simples</span>
            </h2>
          </motion.div>
          <div className="space-y-8">
            {[
              { step: "01", title: "Faça o Diagnóstico Gratuito", desc: "Responda 7 perguntas e descubra em 2 minutos o nível de risco psicossocial da sua empresa. Resultado imediato." },
              { step: "02", title: "Crie sua Conta e Configure", desc: "Cadastre sua empresa, departamentos e colaboradores. O SeguraMente já gera automaticamente os indicadores iniciais." },
              { step: "03", title: "Deixe a IA Trabalhar por Você", desc: "O sistema monitora continuamente atestados, ponto, denúncias e turnover. Você recebe alertas antes dos problemas virarem multas." },
            ].map((s, i) => (
              <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.15 }} className="flex gap-6 items-start">
                <div className="shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center">
                  <span className="text-2xl font-black text-blue-400">{s.step}</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">{s.title}</h3>
                  <p className="text-gray-400">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ SOCIAL PROOF ═══════════ */}
      <section className="py-20 px-4 bg-[#111118]">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black mb-16">
            Números que <span className="text-cyan-400">falam por si</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { num: "97%", label: "das empresas não estão adequadas à NR-01" },
              { num: "R$ 50mil", label: "multa média por infração identificada" },
              { num: "213%", label: "custo de turnover por burnout não tratado" },
              { num: "74%", label: "redução de riscos com gestão psicossocial" },
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <p className="text-3xl md:text-4xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{stat.num}</p>
                <p className="text-sm text-gray-500 mt-2">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ DIFFERENTIATORS ═══════════ */}
      <section className="py-20 px-4 bg-gradient-to-b from-[#111118] to-[#0d0d14]">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              Por que o SeguraMente é <span className="text-yellow-400">diferente</span>?
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              { title: "Outros softwares", items: ["Planilhas disfarçadas de sistema", "Sem IA real — apenas formulários", "SST separado do RH", "Sem gestão psicossocial", "Sem compliance NR-01 atualizada", "Interface ultrapassada"], bad: true },
              { title: "SeguraMente", items: ["Plataforma inteligente com IA real (GPT-4o)", "Detecção automática de riscos", "SST + RH + Psicossocial integrados", "100% compliance NR-01 atualizada", "Indicadores em tempo real", "Design moderno e intuitivo"], bad: false },
            ].map((col, i) => (
              <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.15 }}>
                <div className={`rounded-2xl p-8 h-full border ${col.bad ? "bg-[#1a1418] border-red-500/20" : "bg-[#141a1e] border-green-500/20"}`}>
                  <h3 className={`text-xl font-bold mb-6 ${col.bad ? "text-red-400" : "text-green-400"}`}>{col.title}</h3>
                  <div className="space-y-3">
                    {col.items.map((item, j) => (
                      <div key={j} className="flex items-center gap-2 text-sm text-gray-400">
                        {col.bad ? (
                          <span className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                            <span className="text-red-400 text-xs">✕</span>
                          </span>
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
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

      {/* ═══════════ DIAGNOSTIC CTA SECTION ═══════════ */}
      <section className="py-20 px-4 bg-[#0d0d14] relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-500 rounded-full blur-[250px]" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div {...fadeUp}>
            <Brain className="w-16 h-16 text-orange-400 mx-auto mb-6" />
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              Descubra o risco da sua empresa em <span className="text-orange-400">2 minutos</span>
            </h2>
            <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
              Nosso diagnóstico gratuito analisa 7 fatores críticos da NR-01 e mostra se sua empresa está em risco de multa, interdição ou processo trabalhista.
              <strong className="text-white"> 100% confidencial. Resultado imediato.</strong>
            </p>
            <Button
              size="lg"
              onClick={() => setShowDiagnostico(true)}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-lg px-10 py-7 rounded-xl shadow-2xl shadow-orange-500/25 group"
            >
              <Brain className="w-5 h-5 mr-2" />
              FAZER DIAGNÓSTICO GRÁTIS AGORA
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ═══════════ CTA / VAGAS ═══════════ */}
      <section id="vagas" className="py-20 px-4 bg-gradient-to-b from-[#0d0d14] to-[#0a0a0f] relative">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-red-500 rounded-full blur-[200px]" />
        </div>
        <div className="relative max-w-2xl mx-auto">
          <motion.div {...fadeUp}>
            <div className="text-center mb-10">
              <Badge className="mb-4 bg-red-500/20 text-red-400 border-red-500/30 animate-pulse text-sm">
                <Zap className="w-4 h-4 mr-1" />
                LANÇAMENTO EXCLUSIVO — VAGAS LIMITADAS
              </Badge>
              <h2 className="text-3xl md:text-5xl font-black mb-4">
                Apenas <span className="text-red-500">{vagasRestantes}</span> vagas para acesso{" "}
                <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">COMPLETO</span>
              </h2>
              <p className="text-gray-400 max-w-xl mx-auto">
                Estamos liberando <strong className="text-white">10 vagas exclusivas</strong> com acesso total a TODOS os módulos — 
                sem restrição de funcionalidades. Após as 10 vagas, o acesso será por planos com funcionalidades limitadas.
              </p>
            </div>

            {/* Vagas visual */}
            <div className="bg-[#16161d] border border-gray-800 rounded-2xl p-6 mb-8">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-gray-400">Vagas preenchidas</span>
                <span className="text-sm font-bold text-red-400">{10 - vagasRestantes}/10</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${((10 - vagasRestantes) / 10) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-2 text-center">
                Quando as 10 vagas forem preenchidas, novos acessos serão apenas por planos pagos com módulos limitados
              </p>
            </div>

            {/* What's included */}
            <div className="bg-[#16161d] border border-gray-800 rounded-2xl p-6 mb-8">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-400" />
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
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* After plans warning */}
            <div className="bg-[#1a1418] border border-yellow-500/20 rounded-2xl p-5 mb-8">
              <p className="text-yellow-400 font-bold text-sm mb-2">⚠️ O que acontece depois das 10 vagas?</p>
              <div className="text-xs text-gray-500 space-y-1">
                <p>• <strong className="text-gray-400">Plano Essencial:</strong> Apenas módulos básicos (Ponto, Admissão, EPIs)</p>
                <p>• <strong className="text-gray-400">Plano Profissional:</strong> Módulos intermediários (+ Avaliações, PDI, Psicossocial básico)</p>
                <p>• <strong className="text-gray-400">Plano Enterprise:</strong> Acesso total (o que você recebe GRÁTIS agora)</p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {!showFormulario && !leadEnviado && (
                <motion.div key="cta" exit={{ opacity: 0 }}>
                  <Button
                    size="lg"
                    onClick={() => setShowFormulario(true)}
                    className="w-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white text-lg py-7 rounded-xl shadow-2xl shadow-red-500/25"
                    disabled={vagasRestantes <= 0}
                  >
                    {vagasRestantes > 0 ? (
                      <>
                        <Zap className="w-5 h-5 mr-2" />
                        QUERO GARANTIR MINHA VAGA AGORA
                      </>
                    ) : (
                      "Vagas esgotadas — Lista de espera em breve"
                    )}
                  </Button>
                </motion.div>
              )}

              {showFormulario && !leadEnviado && (
                <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="bg-[#16161d] border border-gray-800 rounded-2xl p-8">
                    <h3 className="text-xl font-bold mb-1 text-center">Garanta sua vaga agora</h3>
                    <p className="text-gray-500 text-sm text-center mb-6">Preencha seus dados para reservar seu acesso completo</p>
                    <div className="space-y-4">
                      <Input
                        placeholder="Seu nome completo"
                        value={nome}
                        onChange={e => setNome(e.target.value)}
                        maxLength={100}
                        className="bg-[#0d0d14] border-gray-700 h-12 text-white placeholder:text-gray-600"
                      />
                      <Input
                        type="email"
                        placeholder="Seu melhor e-mail"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        maxLength={255}
                        className="bg-[#0d0d14] border-gray-700 h-12 text-white placeholder:text-gray-600"
                      />
                      <Button
                        size="lg"
                        onClick={handleSubmitLead}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white text-lg py-6 rounded-xl"
                      >
                        {loading ? "Enviando..." : "RESERVAR MINHA VAGA →"}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-600 text-center mt-4">
                      🔒 Seus dados estão seguros. Não enviamos spam.
                    </p>
                  </div>
                </motion.div>
              )}

              {leadEnviado && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                  <div className="bg-gradient-to-b from-[#1a2a1a] to-[#16161d] border border-green-500/30 rounded-2xl p-8">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-2xl font-black mb-2">Parabéns! Sua vaga está quase garantida 🎉</h3>
                    <p className="text-gray-400 mb-2">
                      Restam apenas <strong className="text-red-400">{vagasRestantes} vagas</strong> para acesso completo.
                    </p>
                    <div className="bg-[#0d0d14] border border-yellow-500/30 rounded-xl p-4 my-6">
                      <p className="text-yellow-400 font-bold text-sm mb-1">⚡ ATENÇÃO: Apenas 10 vagas com acesso TOTAL</p>
                      <p className="text-gray-500 text-xs">
                        Após as 10 vagas, novos usuários terão acesso apenas a módulos limitados conforme o plano contratado. 
                        Crie sua conta agora para garantir o acesso completo.
                      </p>
                    </div>
                    <Button
                      size="lg"
                      onClick={() => navigate("/register")}
                      className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white text-lg px-10 py-6 rounded-xl shadow-2xl"
                    >
                      CRIAR MINHA CONTA AGORA — É GRÁTIS
                      <ArrowRight className="w-5 h-5 ml-2" />
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
      <section className="py-16 px-4 bg-[#0a0a0f] border-t border-gray-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-black mb-4">
            A pergunta não é <em>"Quanto custa adequar?"</em>
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            A pergunta é: <strong className="text-red-400">"Quanto vai custar NÃO adequar?"</strong>
          </p>
          <p className="text-gray-500 text-sm mb-8">
            Uma única multa do MTE paga 5 anos de SeguraMente. Um único processo por burnout paga 10 anos. 
            A escolha é sua: investir centavos em prevenção ou milhares em correção.
          </p>
          <Button
            size="lg"
            onClick={() => scrollToSection("vagas")}
            className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white px-10 py-6 text-lg rounded-xl"
          >
            PROTEGER MINHA EMPRESA AGORA →
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-gray-900 text-center text-gray-600 text-sm">
        <p>© {new Date().getFullYear()} SeguraMente — Plataforma de Gestão Inteligente de SST e RH</p>
        <p className="mt-1 text-xs text-gray-700">Este site não é afiliado ao Ministério do Trabalho e Emprego (MTE).</p>
      </footer>

      {/* Diagnóstico Modal */}
      <AnimatePresence>
        {showDiagnostico && (
          <LandingDiagnostico
            onClose={() => setShowDiagnostico(false)}
            onComplete={(resultado) => {
              setDiagnosticoResultado(resultado);
              setShowDiagnostico(false);
              setShowFormulario(true);
              scrollToSection("vagas");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
