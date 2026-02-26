import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, AlertTriangle, CheckCircle, ArrowRight, Clock, 
  Users, Brain, FileWarning, TrendingDown, Zap, Lock,
  ChevronDown, Star, Award, BarChart3, Heart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LandingDiagnostico } from "@/components/landing/LandingDiagnostico";

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
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 py-2 px-4 text-center text-sm font-bold animate-pulse">
        <Clock className="inline w-4 h-4 mr-1" />
        ⚠️ NR-01 ATUALIZADA — Riscos psicossociais agora são OBRIGATÓRIOS. Multas de até R$ 50.000 por infração.
        {vagasRestantes > 0 && (
          <span className="ml-2 bg-white/20 px-2 py-0.5 rounded text-xs">
            Apenas {vagasRestantes} vagas restantes para acesso completo
          </span>
        )}
      </div>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-4 min-h-screen flex items-center">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a1a] via-[#0d1117] to-[#0a0a0f]" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-96 h-96 bg-red-500 rounded-full blur-[128px]" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500 rounded-full blur-[128px]" />
        </div>
        
        <div className="relative max-w-6xl mx-auto text-center">
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.8 }}
          >
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

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="mt-16"
          >
            <ChevronDown className="w-8 h-8 mx-auto text-gray-600 animate-bounce" />
          </motion.div>
        </div>
      </section>

      {/* Pain Section - "The Problem" (Schwartz - Agitate) */}
      <section className="py-20 px-4 bg-gradient-to-b from-[#0a0a0f] to-[#111118]">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-5xl font-black text-center mb-4">
              O que acontece com quem{" "}
              <span className="text-red-500">ignora</span> a NR-01?
            </h2>
            <p className="text-gray-400 text-center max-w-2xl mx-auto mb-16">
              A fiscalização não avisa. Ela chega. E quando chega, o prejuízo é irreversível.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: FileWarning, title: "Multas de até R$ 50.000", desc: "Por infração. Reincidência dobra o valor. Uma única visita do MTE pode custar mais que 5 anos de prevenção.", color: "red" },
              { icon: Lock, title: "Interdição Total", desc: "Sua empresa pode ser PARADA. Sem produção, sem faturamento, sem folha. Até a adequação completa.", color: "orange" },
              { icon: TrendingDown, title: "Processos Trabalhistas", desc: "Burnout, assédio e danos morais. Um único processo pode ultrapassar R$ 200.000 em indenizações.", color: "yellow" },
              { icon: Users, title: "Perda de Talentos", desc: "Colaboradores adoecidos pedem demissão. O custo de turnover chega a 213% do salário anual do colaborador.", color: "purple" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="bg-[#16161d] border border-gray-800 rounded-2xl p-6 h-full hover:border-red-500/30 transition-colors">
                  <div className={`w-12 h-12 rounded-xl bg-${item.color}-500/10 flex items-center justify-center mb-4`}>
                    <item.icon className={`w-6 h-6 text-${item.color}-500`} />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Section - (Ogilvy - Facts & Benefits) */}
      <section className="py-20 px-4 bg-[#111118]">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
            <Badge className="mb-4 bg-green-500/20 text-green-400 border-green-500/30">
              <Shield className="w-4 h-4 mr-1" /> A SOLUÇÃO
            </Badge>
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              Conheça o <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">SeguraMente</span>
            </h2>
            <p className="text-gray-400 max-w-3xl mx-auto text-lg">
              A única plataforma que integra <strong className="text-white">gestão psicossocial, compliance NR-01, RH estratégico e SST</strong> em um só lugar. 
              Enquanto outros vendem planilhas disfarçadas, nós entregamos inteligência artificial real.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { 
                icon: Brain, title: "IA Psicossocial Avançada", 
                items: ["Questionário NR-01 completo (14 blocos)", "Detecção automática de sinais de burnout", "Indicadores IRP-S, IBO-S, IBD-S em tempo real", "Checklist de Detecção Observável automatizado"],
                highlight: "EXCLUSIVO"
              },
              { 
                icon: Shield, title: "Compliance Total SST", 
                items: ["PGR e GRO com riscos psicossociais integrados", "Gestão de EPIs com assinatura digital", "Controle de terceiros e documentação", "Matriz de risco 5 níveis (NR-01)"],
                highlight: "OBRIGATÓRIO"
              },
              { 
                icon: Heart, title: "RH Estratégico Completo", 
                items: ["Admissão digital com onboarding automático", "Avaliações 360° com 9-Box", "PDI gerado por IA", "Gestão de ponto, férias e benefícios"],
                highlight: "PRODUTIVIDADE"
              },
            ].map((block, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
              >
                <div className="bg-gradient-to-b from-[#1a1a24] to-[#16161d] border border-gray-800 rounded-2xl p-8 h-full relative overflow-hidden group hover:border-blue-500/30 transition-all">
                  <Badge className="absolute top-4 right-4 bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">
                    {block.highlight}
                  </Badge>
                  <block.icon className="w-10 h-10 text-blue-400 mb-4" />
                  <h3 className="text-xl font-bold mb-4">{block.title}</h3>
                  <ul className="space-y-3">
                    {block.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-gray-400">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof (Caples - Testimonial headlines) */}
      <section className="py-20 px-4 bg-gradient-to-b from-[#111118] to-[#0d0d14]">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black mb-16">
            Números que falam por si
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

      {/* CTA / Vagas Section (Halbert - Urgency + Scarcity) */}
      <section id="vagas" className="py-20 px-4 bg-[#0d0d14] relative">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-red-500 rounded-full blur-[200px]" />
        </div>
        <div className="relative max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
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
                  "Todos os módulos desbloqueados",
                  "IA Psicossocial NR-01 completa",
                  "Gestão de SST integrada",
                  "RH completo (admissão ao desligamento)",
                  "Marketplace de profissionais SST",
                  "Suporte prioritário",
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

      {/* Final urgency (Bencivenga - Close the sale) */}
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
