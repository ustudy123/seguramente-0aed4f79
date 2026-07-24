import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import logo from "@/assets/logo-youreyes.svg";
import mascot from "@/assets/mascot-ye.png.asset.json";
import {
  ShieldCheck,
  Brain,
  Users,
  Activity,
  BarChart3,
  FileCheck2,
  HardHat,
  GraduationCap,
  Building2,
  Scale,
  Lock,
  CheckCircle2,
  ArrowRight,
  Menu,
  X,
  Mail,
  Phone,
  MapPin,
  Sparkles,
} from "lucide-react";

// ---------------- Data ----------------
type Ciclo = "mensal" | "trimestral" | "semestral" | "anual";

const CICLOS: { key: Ciclo; label: string; badge?: string; discount: number }[] = [
  { key: "mensal", label: "Mensal", discount: 0 },
  { key: "trimestral", label: "Trimestral", badge: "−10%", discount: 0.1 },
  { key: "semestral", label: "Semestral", badge: "−50% lançamento", discount: 0.5 },
  { key: "anual", label: "Anual", badge: "−40%", discount: 0.4 },
];

type Plano = {
  id: string;
  tier: string;
  nome: string;
  base: number;
  publico: string;
  limite: string;
  modulos: string[];
  destaque?: boolean;
  consulta?: boolean;
};

const PLANOS: Plano[] = [
  {
    id: "starter",
    tier: "Tier 01",
    nome: "Starter",
    base: 197,
    publico: "Micro e pequenas empresas iniciando a jornada de conformidade.",
    limite: "Até 20 colaboradores",
    modulos: [
      "Estrutura Organizacional completa",
      "NR-1 básico e visão psicossocial",
      "Ponto simplificado",
      "Férias + Atestados",
      "Onboarding básico",
    ],
  },
  {
    id: "essential",
    tier: "Tier 02",
    nome: "Essential",
    base: 397,
    publico: "PMEs que precisam operacionalizar GRO, PGR e evidências.",
    limite: "Até 80 colaboradores",
    modulos: [
      "Tudo do Starter",
      "GRO + Inventário PGR automatizado",
      "Campanhas Psicossociais + Resultados",
      "EPIs + Ergonomia",
      "Análise de Jornada",
    ],
  },
  {
    id: "professional",
    tier: "Tier 03",
    nome: "Professional",
    base: 797,
    destaque: true,
    publico: "Operações estruturadas com múltiplas áreas e governança contínua.",
    limite: "Até 200 colaboradores",
    modulos: [
      "Tudo do Essential",
      "Benefícios + Documentos + Hub Contábil",
      "Metas + Plano de Ação (5W2H)",
      "Trilhas + Aprendizado & Competências",
      "Feedback, Ouvidoria e Cultura",
      "Contratos de Experiência",
    ],
  },
  {
    id: "business",
    tier: "Tier 04",
    nome: "Business",
    base: 1797,
    publico: "Empresas com múltiplas unidades e integrações corporativas.",
    limite: "Até 500 colaboradores",
    modulos: [
      "Tudo do Professional",
      "SSO + auditoria de acessos",
      "KPIs Operacionais avançados",
      "API TOTVS, SAP, Sênior, Gupy",
      "SLA 99,5% garantido",
      "CSM dedicado (1 sessão/mês)",
    ],
  },
  {
    id: "enterprise",
    tier: "Tier 05",
    nome: "Enterprise",
    base: 3500,
    consulta: true,
    publico: "Grandes operações com exigências máximas de segurança e governança.",
    limite: "300+ colaboradores · Banco isolado",
    modulos: [
      "Tudo do Business",
      "Banco de dados dedicado",
      "IA customizada por setor",
      "API dedicada + webhooks",
      "Assessoria jurídico-trabalhista",
      "DPO + LGPD avançado",
      "Workshop mensal NR-1",
    ],
  },
] as const;

const MODULOS = [
  { icon: ShieldCheck, titulo: "NR-1 & Compliance SST", desc: "GRO, PGR, PCMSO, LTCAT e evidências auditáveis alinhadas à Portaria MTE 1.419/2024." },
  { icon: Brain, titulo: "Riscos Psicossociais", desc: "Instrumentos validados (COPSOQ, HSE, PROART), IPS/IRP-S e planos de ação automáticos." },
  { icon: Users, titulo: "Gestão de Pessoas", desc: "Colaboradores, admissão, desligamento, contratos de experiência e ciclo completo do RH." },
  { icon: Activity, titulo: "Jornada & Ponto", desc: "REP-C/REP-P, geofence, banco de horas, escalas, férias e atestados com governança CLT." },
  { icon: BarChart3, titulo: "Metas & Performance", desc: "5W2H, GUT, PDI, avaliações 9-Box e OKRs conectados à estratégia da empresa." },
  { icon: HardHat, titulo: "Saúde & Segurança", desc: "EPIs, Ergonomia (AEP/AET), incidentes eSocial S-2210 e Ordem de Serviço NR-1." },
  { icon: GraduationCap, titulo: "Aprendizado & Cultura", desc: "Trilhas gamificadas, manuais de função por IA, feedback pedagógico e clima." },
  { icon: FileCheck2, titulo: "Documental & Contábil", desc: "Arquivamento automático, checklists, assinatura digital e Hub Contábil PDCA." },
  { icon: Sparkles, titulo: "IA aplicada", desc: "Extrações inteligentes, auditorias GPT-4o e insights convertidos em Ação 5W2H." },
];

const SOLUCOES = [
  {
    tag: "NR-1 & Psicossocial",
    titulo: "Da norma à evidência auditável",
    desc: "A NR-1 exige processo contínuo, inventário de riscos, plano de ação e participação dos trabalhadores. A YourEyes operacionaliza cada exigência com trilha auditável e evidência documental.",
    pontos: ["GRO unificado NR-1 + NR-17", "IPS/IRP-S calculados automaticamente", "Anonimato mínimo de 5 respondentes", "Ação corretiva em 5W2H"],
  },
  {
    tag: "RH & Departamento Pessoal",
    titulo: "Ciclo completo do colaborador",
    desc: "Da admissão ao desligamento CLT, com validações de ASO (90/135 dias), férias, banco de horas, benefícios e integração ao eSocial.",
    pontos: ["Folha 2025 com 10 tipos de contrato", "CCT, INSS/IRRF atualizados", "Insalubridade/Periculosidade não-cumulativas", "Assinatura digital de recibos"],
  },
  {
    tag: "Inteligência & Governança",
    titulo: "Da incerteza à decisão",
    desc: "Escore de Maturidade calculado por 4 pilares estratégicos, dashboards executivos e IA que traduz risco em ação priorizada.",
    pontos: ["Dashboard de Maturidade", "Matriz GUT e Pirâmide de Bird", "Hub Contábil com SLAs", "Auditorias GPT-4o de PGR e LTCAT"],
  },
];

const CONFIANCA = [
  { titulo: "LGPD", desc: "Dados de saúde em bucket privado com grupos clínicos" },
  { titulo: "RLS Multi-tenant", desc: "Isolamento por tenant_id e empresa_id" },
  { titulo: "Assinatura digital", desc: "Injeção HTML com carimbo de auditoria" },
  { titulo: "Trilha auditável", desc: "Todo alerta convertível em Ação 5W2H" },
];

const FAQ = [
  { q: "A oferta de 50% é permanente?", a: "É exclusiva de lançamento, válida por 6 meses. Clientes que assinarem o semestral neste período mantêm o desconto durante todo o ciclo contratado." },
  { q: "Quanto tempo para estar em conformidade com a NR-1?", a: "Nos planos Essential ou superior, o GRO fica operacional em até 1 dia útil após o onboarding. Inventário PGR e plano de ação são gerados automaticamente." },
  { q: "Posso mudar de plano durante o semestral?", a: "Upgrades são imediatos com crédito proporcional. Downgrades entram no próximo período." },
  { q: "O Financeiro e a Rede de Parceiros estão em qual plano?", a: "A partir do plano Business (Tier 04), que exige estrutura multi-unidades e integrações de API." },
  { q: "O que garante o banco de dados dedicado do Enterprise?", a: "Infraestrutura completamente isolada — seus dados nunca compartilham servidor com outros clientes, com LGPD avançada e auditoria independente." },
  { q: "Existe trial ou demonstração?", a: "O Professional inclui trial de 14 dias com onboarding assistido. Para Enterprise, oferecemos demonstração guiada com especialista em NR-1." },
];

// ---------------- Component ----------------
export default function Site() {
  const [ciclo, setCiclo] = useState<Ciclo>("semestral");
  const [menuOpen, setMenuOpen] = useState(false);

  const cicloAtual = useMemo(() => CICLOS.find((c) => c.key === ciclo)!, [ciclo]);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "YourEyes — Governança do Trabalho Humano | NR-1, Psicossocial e RH";
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute("content") || "";
    meta?.setAttribute(
      "content",
      "Plataforma corporativa YourEyes: NR-1, riscos psicossociais, SST, RH e IA em governança contínua e auditável do trabalho humano.",
    );
    return () => {
      document.title = prevTitle;
      meta?.setAttribute("content", prevDesc);
    };
  }, []);

  const formatarPreco = (base: number) => {
    const preco = Math.round(base * (1 - cicloAtual.discount));
    return preco.toLocaleString("pt-BR");
  };

  return (
    <div className="min-h-screen bg-[#0B1D34] text-slate-100">


      {/* NAV */}
      <header className="sticky top-0 z-40 bg-[#0B1D34]/85 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="#topo" className="flex items-center gap-3">
            <img src={logo} alt="YourEyes" className="h-9 w-9" />
            <div className="leading-tight">
              <div className="font-bold text-[#0B1D34] tracking-tight">YourEyes</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Governança do Trabalho Humano</div>
            </div>
          </a>
          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-slate-200">
            <a href="#plataforma" className="hover:text-[#0A6BBF]">Plataforma</a>
            <a href="#solucoes" className="hover:text-[#0A6BBF]">Soluções</a>
            <a href="#planos" className="hover:text-[#0A6BBF]">Planos</a>
            <a href="#seguranca" className="hover:text-[#0A6BBF]">Segurança</a>
            <a href="#sobre" className="hover:text-[#0A6BBF]">Sobre</a>
            <a href="#contato" className="hover:text-[#0A6BBF]">Contato</a>
          </nav>
          <div className="hidden lg:flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-slate-700 hover:text-[#0A6BBF]">
              Entrar
            </Link>
            <a
              href="#contato"
              className="inline-flex items-center gap-2 bg-[#0A6BBF] hover:bg-[#0959a3] text-white text-sm font-semibold px-4 py-2 rounded-md transition"
            >
              Agendar diagnóstico <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          <button
            className="lg:hidden text-slate-700"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {menuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-[#0B1D34] px-6 py-4 space-y-3 text-sm text-slate-200">
            {["plataforma", "solucoes", "planos", "seguranca", "sobre", "contato"].map((s) => (
              <a key={s} href={`#${s}`} className="block text-slate-700 capitalize" onClick={() => setMenuOpen(false)}>
                {s === "solucoes" ? "Soluções" : s === "seguranca" ? "Segurança" : s}
              </a>
            ))}
            <Link to="/login" className="block text-[#0A6BBF] font-semibold">Entrar na plataforma →</Link>
          </div>
        )}
      </header>

      {/* HERO */}
      <section id="topo" className="relative overflow-hidden bg-gradient-to-b from-[#0B1D34] to-[#0F2647] text-white">
        <div className="max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#FFA033] mb-6">
              <span className="w-8 h-px bg-[#FFA033]" /> Portaria MTE 1.419/2024
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
              Governança contínua do <span className="text-[#60ABEF]">trabalho humano</span> — da norma à evidência.
            </h1>
            <p className="mt-6 text-lg text-slate-300 max-w-2xl leading-relaxed">
              A YourEyes operacionaliza NR-1, riscos psicossociais, SST, RH e desempenho em uma única plataforma auditável,
              com inteligência artificial aplicada e trilha documental para segurança jurídica do empregador.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#contato"
                className="inline-flex items-center gap-2 bg-[#FF8A00] hover:bg-[#e67a00] text-white font-semibold px-6 py-3 rounded-md transition"
              >
                Agendar diagnóstico <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#planos"
                className="inline-flex items-center gap-2 border border-white/30 hover:border-white text-white font-semibold px-6 py-3 rounded-md transition"
              >
                Ver planos e preços
              </a>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-6 max-w-xl">
              {[
                { n: "1 dia", l: "GRO operacional" },
                { n: "70+", l: "módulos integrados" },
                { n: "99,5%", l: "SLA garantido" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="text-2xl font-bold text-white">{s.n}</div>
                  <div className="text-xs uppercase tracking-wider text-slate-400 mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="relative rounded-lg border border-white/10 bg-white/5 backdrop-blur p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF8A00]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFA033]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#21A365]" />
                <span className="ml-2 text-xs text-slate-400">Painel de Maturidade</span>
              </div>
              <div className="space-y-4">
                {[
                  { l: "Conformidade NR-1", v: 92, c: "#21A365" },
                  { l: "Riscos Psicossociais", v: 78, c: "#0A6BBF" },
                  { l: "Gestão de Pessoas", v: 85, c: "#60ABEF" },
                  { l: "SST & Ergonomia", v: 68, c: "#FF8A00" },
                ].map((k) => (
                  <div key={k.l}>
                    <div className="flex justify-between text-xs text-slate-300 mb-1.5">
                      <span>{k.l}</span>
                      <span className="font-mono text-white">{k.v}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${k.v}%`, background: k.c }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-6 border-t border-white/10 text-xs text-slate-400">
                Dashboard executivo · Escore de Maturidade calculado por 4 pilares estratégicos.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTEXTO / URGÊNCIA */}
      <section className="bg-white/[0.03] border-y border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-8 text-center md:text-left">
          {[
            { n: "472k+", l: "afastamentos por transtornos mentais em 2024" },
            { n: "+67%", l: "aumento anual em benefícios por saúde mental" },
            { n: "R$ 6k+", l: "por infração à NR-1" },
            { n: "Contínuo", l: "processo exigido pela Portaria MTE 1.419/2024" },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-3xl font-bold text-white">{s.n}</div>
              <div className="text-sm text-slate-300 mt-2 leading-snug">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PLATAFORMA / MÓDULOS */}
      <section id="plataforma" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mb-14">
            <div className="text-xs font-semibold uppercase tracking-widest text-[#0A6BBF] mb-3">A plataforma</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
              Um sistema único para RH, SST, Compliance e Liderança.
            </h2>
            <p className="mt-4 text-slate-300 text-lg leading-relaxed">
              Nove famílias de módulos conectadas entre si, com dados normalizados por tenant e evidência
              documental em cada ação executada.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MODULOS.map((m) => (
              <div
                key={m.titulo}
                className="border border-white/10 rounded-lg p-6 hover:border-[#60ABEF] hover:bg-white/[0.06] transition group bg-white/[0.03] backdrop-blur"
              >
                <div className="w-11 h-11 rounded-md bg-[#0A6BBF]/10 text-[#0A6BBF] flex items-center justify-center mb-4 group-hover:bg-[#0A6BBF] group-hover:text-white transition">
                  <m.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-white mb-2">{m.titulo}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUÇÕES */}
      <section id="solucoes" className="py-24 bg-transparent border-y border-white/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mb-14">
            <div className="text-xs font-semibold uppercase tracking-widest text-[#0A6BBF] mb-3">Soluções</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
              Três frentes que convergem em uma única governança.
            </h2>
          </div>
          <div className="space-y-8">
            {SOLUCOES.map((s, i) => {
              const gradients = [
                "from-[#0B1D34] via-[#0A6BBF] to-[#60ABEF]",
                "from-[#0B4A2E] via-[#21A365] to-[#5FD39A]",
                "from-[#5B2A86] via-[#0A6BBF] to-[#FF8A00]",
              ];
              const glows = [
                "shadow-[0_20px_60px_-15px_rgba(10,107,191,0.55)]",
                "shadow-[0_20px_60px_-15px_rgba(33,163,101,0.55)]",
                "shadow-[0_20px_60px_-15px_rgba(255,138,0,0.45)]",
              ];
              return (
                <div
                  key={s.titulo}
                  className={`group relative bg-white border border-slate-200 rounded-2xl overflow-hidden grid md:grid-cols-12 gap-0 transition-all duration-500 hover:-translate-y-1 ${glows[i % 3]} hover:shadow-[0_30px_80px_-15px_rgba(11,29,52,0.4)]`}
                >
                  <div
                    className={`md:col-span-4 relative p-8 flex flex-col justify-between text-white bg-gradient-to-br ${gradients[i % 3]} overflow-hidden`}
                  >
                    {/* 3D glow orbs */}
                    <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/20 blur-3xl" />
                    <div className="absolute -bottom-20 -left-10 w-48 h-48 rounded-full bg-black/20 blur-3xl" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.25),transparent_60%)]" />

                    <div className="relative z-10">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-white/80 mb-4 font-semibold">
                        {s.tag}
                      </div>
                      <div className="text-6xl font-black text-white/25 drop-shadow-lg leading-none">
                        0{i + 1}
                      </div>
                    </div>
                    <h3 className="relative z-10 text-2xl md:text-3xl font-bold mt-8 leading-tight drop-shadow-md">
                      {s.titulo}
                    </h3>
                  </div>
                  <div className="md:col-span-8 p-8 bg-gradient-to-br from-white to-slate-50">
                    <p className="text-slate-600 leading-relaxed mb-6">{s.desc}</p>
                    <ul className="grid sm:grid-cols-2 gap-3">
                      {s.pontos.map((p) => (
                        <li
                          key={p}
                          className="flex items-start gap-2 text-sm text-slate-700 p-2 rounded-lg transition hover:bg-white hover:shadow-sm"
                        >
                          <CheckCircle2 className="w-4 h-4 text-[#21A365] flex-shrink-0 mt-0.5" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mb-10">
            <div className="text-xs font-semibold uppercase tracking-widest text-[#0A6BBF] mb-3">Planos & Preços</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
              Cinco tiers para diferentes maturidades de operação.
            </h2>
            <p className="mt-4 text-slate-300 text-lg">
              Oferta de lançamento: <strong>50% de desconto</strong> no semestral, exclusiva para os primeiros clientes.
            </p>
          </div>

          {/* Toggle ciclos */}
          <div className="inline-flex bg-white/10 rounded-lg p-1 mb-10 border border-white/10">
            {CICLOS.map((c) => (
              <button
                key={c.key}
                onClick={() => setCiclo(c.key)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition ${
                  ciclo === c.key ? "bg-white shadow text-[#0B1D34]" : "text-slate-300 hover:text-white"
                }`}
              >
                {c.label}
                {c.badge && (
                  <span className={`ml-2 text-[10px] font-bold ${c.key === "semestral" ? "text-[#FF8A00]" : "text-[#21A365]"}`}>
                    {c.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
            {PLANOS.map((p) => (
              <div
                key={p.id}
                className={`rounded-lg border ${
                  p.destaque ? "border-[#60ABEF] shadow-2xl shadow-[#60ABEF]/20 ring-1 ring-[#60ABEF]/30 relative" : "border-white/10"
                } bg-white flex flex-col text-[#0B1D34]`}
              >
                {p.destaque && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0A6BBF] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded">
                    Recomendado
                  </div>
                )}
                <div className="p-6 border-b border-slate-200">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{p.tier}</div>
                  <div className="text-xl font-bold text-[#0B1D34] mt-1">{p.nome}</div>
                  <div className="text-xs text-slate-500 mt-1">{p.limite}</div>
                </div>
                <div className="p-6 border-b border-slate-200">
                  {p.consulta ? (
                    <div>
                      <div className="text-sm text-slate-500 mb-1">Sob consulta</div>
                      <div className="text-2xl font-bold text-[#0B1D34]">A partir de R$ 3.500</div>
                      <div className="text-xs text-slate-500 mt-1">Contrato personalizado</div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm text-slate-500">R$</span>
                        <span className="text-3xl font-bold text-[#0B1D34]">{formatarPreco(p.base)}</span>
                        <span className="text-sm text-slate-500">/mês</span>
                      </div>
                      {cicloAtual.discount > 0 && (
                        <div className="text-xs text-slate-400 line-through mt-1">R$ {p.base.toLocaleString("pt-BR")}/mês regular</div>
                      )}
                      {ciclo === "semestral" && (
                        <div className="text-xs font-semibold text-[#FF8A00] mt-2">🔥 Preço de lançamento</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="p-6 flex-1">
                  <ul className="space-y-2.5 text-sm">
                    {p.modulos.map((m) => (
                      <li key={m} className="flex items-start gap-2 text-slate-200">
                        <CheckCircle2 className="w-4 h-4 text-[#21A365] flex-shrink-0 mt-0.5" />
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-6 pt-0">
                  <a
                    href="#contato"
                    className={`w-full inline-flex items-center justify-center gap-2 font-semibold text-sm py-2.5 rounded-md transition ${
                      p.destaque
                        ? "bg-[#0A6BBF] hover:bg-[#0959a3] text-white"
                        : p.id === "enterprise"
                        ? "bg-[#0B1D34] hover:bg-[#132a4b] text-white"
                        : "border border-slate-300 hover:border-[#0A6BBF] hover:text-[#0A6BBF] text-slate-700"
                    }`}
                  >
                    {p.consulta ? "Falar com especialista" : `Assinar ${p.nome}`}
                  </a>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500 mt-8 max-w-3xl">
            * Descontos de ciclo e indicação são acumuláveis. Combinando o semestral de lançamento (−50%) com programa de indicação
            (−10%), o desconto pode chegar a −60% durante o período contratado.
          </p>
        </div>
      </section>

      {/* SEGURANÇA */}
      <section id="seguranca" className="py-24 bg-[#0B1D34] text-white">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-12">
          <div className="lg:col-span-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-[#60ABEF] mb-3">Segurança & LGPD</div>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight">
              Dados sensíveis exigem arquitetura à altura.
            </h2>
            <p className="mt-4 text-slate-300 leading-relaxed">
              Multi-tenancy com Row-Level Security, dados de saúde em bucket privado com classificação por grupos clínicos e
              trilha auditável de cada acesso ou alteração.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <Lock className="w-5 h-5 text-[#21A365]" />
              <span className="text-sm text-slate-300">RLS ativo em 100% das tabelas públicas.</span>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <Scale className="w-5 h-5 text-[#21A365]" />
              <span className="text-sm text-slate-300">Assinatura digital com carimbo de auditoria e geolocalização.</span>
            </div>
          </div>
          <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
            {CONFIANCA.map((c) => (
              <div key={c.titulo} className="border border-white/10 rounded-lg p-6 bg-white/5">
                <div className="text-lg font-semibold text-white mb-2">{c.titulo}</div>
                <div className="text-sm text-slate-300 leading-relaxed">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOBRE */}
      <section id="sobre" className="py-24">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-[#0A6BBF] mb-3">Sobre a YourEyes</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
              A norma orienta. O sistema operacionaliza.
            </h2>
          </div>
          <div className="lg:col-span-7 space-y-6 text-slate-300 leading-relaxed text-lg">
            <p>
              A YourEyes nasceu no cruzamento entre inteligência organizacional, RH, SST e compliance, com ênfase em NR-1,
              riscos psicossociais e saúde mental no trabalho. Não somos apenas um software de RH nem uma consultoria de
              compliance: somos a plataforma confiável que transforma risco ocupacional em <strong>evidência, decisão e
              ação coordenada</strong> entre RH, SST, jurídico e liderança.
            </p>
            <p>
              Nosso propósito é entregar <strong>segurança jurídica ao empregador</strong> por meio de um sistema que gera
              contra-prova documental automática. Cada alerta pode ser convertido em Plano de Ação 5W2H. Cada análise
              alimenta o Escore de Maturidade da organização.
            </p>
            <div className="grid sm:grid-cols-3 gap-6 pt-6 border-t border-white/10">
              <div>
                <Building2 className="w-6 h-6 text-[#0A6BBF] mb-2" />
                <div className="font-semibold text-white">Multi-tenant</div>
                <div className="text-sm text-slate-400 mt-1">Isolamento estrito por empresa e unidade</div>
              </div>
              <div>
                <Brain className="w-6 h-6 text-[#0A6BBF] mb-2" />
                <div className="font-semibold text-white">IA First</div>
                <div className="text-sm text-slate-400 mt-1">GPT-4o em extrações e auditorias</div>
              </div>
              <div>
                <ShieldCheck className="w-6 h-6 text-[#0A6BBF] mb-2" />
                <div className="font-semibold text-white">Auditável</div>
                <div className="text-sm text-slate-400 mt-1">Trilha documental em cada ação</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-transparent border-y border-white/10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-[#0A6BBF] mb-3 text-center">Perguntas frequentes</div>
          <h2 className="text-3xl font-bold text-white text-center mb-12">Tire suas dúvidas</h2>
          <div className="space-y-3">
            {FAQ.map((f, i) => (
              <details key={i} className="group bg-white/[0.04] backdrop-blur border border-white/10 rounded-lg">
                <summary className="cursor-pointer list-none px-6 py-4 flex items-center justify-between font-medium text-white">
                  <span>{f.q}</span>
                  <span className="text-[#0A6BBF] group-open:rotate-180 transition text-lg">▾</span>
                </summary>
                <div className="px-6 pb-5 text-sm text-slate-300 leading-relaxed border-t border-white/10 pt-4">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CONTATO */}
      <section id="contato" className="py-24 bg-white/[0.02] border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-12">
          <div className="lg:col-span-5">
            <div className="text-xs font-semibold uppercase tracking-widest text-[#0A6BBF] mb-3">Contato</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
              Leve sua operação da incerteza à evidência.
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              Agende um diagnóstico com um especialista em NR-1 e governança do trabalho humano. Em 30 minutos, mapeamos
              onde sua operação está exposta e como estruturar a conformidade.
            </p>
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3 text-slate-200">
                <Mail className="w-5 h-5 text-[#0A6BBF]" />
                <a href="mailto:contato@youreyes.com.br" className="hover:text-[#0A6BBF]">contato@youreyes.com.br</a>
              </div>
              <div className="flex items-center gap-3 text-slate-200">
                <Phone className="w-5 h-5 text-[#0A6BBF]" />
                <span>Atendimento comercial via WhatsApp</span>
              </div>
              <div className="flex items-center gap-3 text-slate-200">
                <MapPin className="w-5 h-5 text-[#0A6BBF]" />
                <span>Brasil · SLA 99,5% garantido</span>
              </div>
            </div>
          </div>
          <div className="lg:col-span-7">
            <form
              className="border border-white/10 rounded-lg p-8 bg-white/[0.04] backdrop-blur shadow-2xl space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                const params = new URLSearchParams();
                data.forEach((v, k) => params.append(k, String(v)));
                window.location.href = `mailto:contato@youreyes.com.br?subject=Diagnóstico YourEyes&body=${encodeURIComponent(
                  Array.from(data.entries())
                    .map(([k, v]) => `${k}: ${v}`)
                    .join("\n"),
                )}`;
              }}
            >
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Nome</label>
                  <input name="nome" required className="w-full mt-1 border border-white/15 bg-white/5 text-white placeholder:text-slate-400 rounded-md px-3 py-2 text-sm focus:border-[#0A6BBF] focus:ring-1 focus:ring-[#0A6BBF] outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Empresa</label>
                  <input name="empresa" required className="w-full mt-1 border border-white/15 bg-white/5 text-white placeholder:text-slate-400 rounded-md px-3 py-2 text-sm focus:border-[#0A6BBF] focus:ring-1 focus:ring-[#0A6BBF] outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">E-mail corporativo</label>
                  <input type="email" name="email" required className="w-full mt-1 border border-white/15 bg-white/5 text-white placeholder:text-slate-400 rounded-md px-3 py-2 text-sm focus:border-[#0A6BBF] focus:ring-1 focus:ring-[#0A6BBF] outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Nº de colaboradores</label>
                  <select name="colaboradores" className="w-full mt-1 border border-white/15 bg-white/5 text-white placeholder:text-slate-400 rounded-md px-3 py-2 text-sm focus:border-[#0A6BBF] focus:ring-1 focus:ring-[#0A6BBF] outline-none">
                    <option>Até 20</option>
                    <option>21 a 80</option>
                    <option>81 a 200</option>
                    <option>201 a 500</option>
                    <option>500+</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Necessidade principal</label>
                <textarea name="mensagem" rows={4} className="w-full mt-1 border border-white/15 bg-white/5 text-white placeholder:text-slate-400 rounded-md px-3 py-2 text-sm focus:border-[#0A6BBF] focus:ring-1 focus:ring-[#0A6BBF] outline-none" placeholder="NR-1, riscos psicossociais, folha, ponto..." />
              </div>
              <button
                type="submit"
                className="w-full bg-[#0A6BBF] hover:bg-[#0959a3] text-white font-semibold py-3 rounded-md transition inline-flex items-center justify-center gap-2"
              >
                Solicitar diagnóstico <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-xs text-slate-500 text-center">
                Ao enviar, você concorda com nossa{" "}
                <Link to="/politica-de-privacidade" className="underline">Política de Privacidade</Link>.
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0B1D34] text-slate-300 py-16">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src={logo} alt="YourEyes" className="h-8 w-8" />
              <div className="font-bold text-white">YourEyes</div>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              Plataforma de Governança do Trabalho Humano. NR-1 · Psicossocial · RH · IA.
            </p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-white font-semibold mb-4">Plataforma</div>
            <ul className="space-y-2 text-sm">
              <li><a href="#plataforma" className="hover:text-white">Módulos</a></li>
              <li><a href="#solucoes" className="hover:text-white">Soluções</a></li>
              <li><a href="#planos" className="hover:text-white">Planos</a></li>
              <li><a href="#seguranca" className="hover:text-white">Segurança</a></li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-white font-semibold mb-4">Empresa</div>
            <ul className="space-y-2 text-sm">
              <li><a href="#sobre" className="hover:text-white">Sobre</a></li>
              <li><a href="#contato" className="hover:text-white">Contato</a></li>
              <li><Link to="/login" className="hover:text-white">Entrar na plataforma</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-white font-semibold mb-4">Legal</div>
            <ul className="space-y-2 text-sm">
              <li><Link to="/termos-de-uso" className="hover:text-white">Termos de Uso</Link></li>
              <li><Link to="/politica-de-privacidade" className="hover:text-white">Política de Privacidade</Link></li>
              <li><span className="text-slate-500">LGPD compliant</span></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between gap-4 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} YourEyes. Todos os direitos reservados.</span>
          <span>A norma orienta. O sistema operacionaliza.</span>
        </div>
      </footer>
    </div>
  );
}
