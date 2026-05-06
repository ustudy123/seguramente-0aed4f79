import { useState } from "react";
import { motion } from "framer-motion";
import {
  Target,
  ClipboardCheck,
  LayoutGrid,
  FileText,
  Users,
  Settings,
  BarChart3,
  PenTool,
  Sparkles,
  Inbox,
  Lightbulb,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAvaliacoes } from "@/hooks/useAvaliacoes";
import { useMetas } from "@/hooks/useMetas";
import { useAvaliacaoPermissoes } from "@/hooks/useAvaliacaoPermissoes";
import { AvaliacaoInbox } from "@/components/avaliacoes/resposta/AvaliacaoInbox";
import { CicloList } from "@/components/avaliacoes/ciclos/CicloList";
import { MetasList } from "@/components/avaliacoes/metas/MetasList";
import { TemplateList } from "@/components/avaliacoes/templates/TemplateList";
import { Matriz9Box } from "@/components/avaliacoes/resultados/Matriz9Box";
import { AvaliacaoFormulario } from "@/components/avaliacoes/formulario/AvaliacaoFormulario";
import { ResultadosCiclo } from "@/components/avaliacoes/resultados/ResultadosCiclo";
import { AvaliacaoConfig } from "@/components/avaliacoes/config/AvaliacaoConfig";
import { AvaliacoesStats } from "@/components/avaliacoes/AvaliacoesStats";

const tabsInfo: Record<string, { title: string; desc: string; gradient: string; glow: string; icon: any }> = {
  inbox: {
    title: "Minha Caixa",
    desc: "Suas avaliações pendentes para responder. Tudo que precisa da sua ação aparece aqui — autoavaliações, avaliações de líder, pares e 360°.",
    gradient: "from-primary via-info to-purple-600",
    glow: "shadow-primary/40",
    icon: Inbox,
  },
  ciclos: {
    title: "Ciclos",
    desc: "Crie e gerencie ciclos de avaliação (trimestrais, semestrais, anuais). Defina período, participantes, modelo e acompanhe a taxa de conclusão.",
    gradient: "from-sky-500 via-blue-500 to-indigo-600",
    glow: "shadow-sky-500/40",
    icon: Users,
  },
  formulario: {
    title: "Formulário",
    desc: "Responda à avaliação selecionada. Visual guiado por competências, comportamentos e metas, com suporte da I.A. para estruturar comentários.",
    gradient: "from-violet-500 via-purple-500 to-fuchsia-600",
    glow: "shadow-violet-500/40",
    icon: PenTool,
  },
  metas: {
    title: "Metas",
    desc: "Defina metas SMART (Específicas, Mensuráveis, Atingíveis, Relevantes, Temporais) e acompanhe o progresso. Integradas ao PDI e ao 9-Box.",
    gradient: "from-pink-500 via-rose-500 to-fuchsia-600",
    glow: "shadow-pink-500/40",
    icon: Target,
  },
  templates: {
    title: "Templates",
    desc: "Modelos reutilizáveis de avaliação (90°, 180°, 360°, autoavaliação). Defina competências, escalas e perguntas padrão por cargo ou nível.",
    gradient: "from-amber-500 via-orange-500 to-rose-500",
    glow: "shadow-amber-500/40",
    icon: FileText,
  },
  resultados: {
    title: "Resultados",
    desc: "Consolidação dos ciclos: notas por dimensão, ranking, evolução por colaborador e indicadores de risco humano (burnout, boreout, psicossocial).",
    gradient: "from-emerald-500 via-teal-500 to-cyan-600",
    glow: "shadow-emerald-500/40",
    icon: BarChart3,
  },
  "9box": {
    title: "Matriz 9-Box",
    desc: "Cruzamento Performance × Potencial em 9 quadrantes. Identifique talentos, sucessores e pontos de atenção para decisões de carreira.",
    gradient: "from-indigo-500 via-purple-500 to-pink-500",
    glow: "shadow-indigo-500/40",
    icon: LayoutGrid,
  },
  config: {
    title: "Configurações",
    desc: "Parâmetros do módulo: pesos por dimensão, escalas, regras de visibilidade, integrações com PDI, Trilhas e Plano de Ação.",
    gradient: "from-slate-500 via-zinc-500 to-gray-700",
    glow: "shadow-slate-500/40",
    icon: Settings,
  },
};

export default function Avaliacoes() {
  const [activeTab, setActiveTab] = useState("inbox");
  const { podeVerCiclos, podeVerConfiguracoes, podeVerTemplates, podeVerResultados } = useAvaliacaoPermissoes();

  const { ciclosAtivos, avaliacoesPendentes, isLoadingCiclos } = useAvaliacoes();
  const { metasAtivas, progressoMedio, isLoadingMetas } = useMetas();

  const isLoading = isLoadingCiclos || isLoadingMetas;
  const current = tabsInfo[activeTab] ?? tabsInfo.inbox;

  return (
    <div className="space-y-6">
      {/* Hero header com gradiente vibrante */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-info to-purple-600 p-6 sm:p-8 shadow-[0_20px_50px_-20px_hsl(var(--primary)/0.5)]"
      >
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent pointer-events-none" />

        <div className="relative flex items-start gap-4 text-white">
          <motion.div
            whileHover={{ scale: 1.08, rotate: -5 }}
            className="p-3 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 shadow-lg shrink-0"
          >
            <ClipboardCheck className="w-7 h-7 drop-shadow" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold drop-shadow-sm">Avaliações de Desempenho</h1>
            <p className="text-white/90 text-sm sm:text-base mt-1">
              Performance · Desenvolvimento · Risco Humano · Decisão · Prova Organizacional
            </p>
            <p className="text-white/80 text-xs sm:text-sm mt-1.5 max-w-3xl">
              Gerencie ciclos, responda avaliações, defina metas SMART e tome decisões com a Matriz 9-Box.
              Tudo conectado ao PDI, Trilhas de Aprendizado e Plano de Ação.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-1.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full px-3 py-1.5 text-xs font-semibold text-white shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
            I.A. integrada
          </div>
        </div>
      </motion.div>

      {/* Stats 3D */}
      <AvaliacoesStats
        ciclosAtivos={isLoading ? "..." : ciclosAtivos}
        avaliacoesPendentes={isLoading ? "..." : avaliacoesPendentes}
        metasAtivas={isLoading ? "..." : metasAtivas}
        progressoMedio={isLoading ? "..." : progressoMedio}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-auto min-w-full sm:min-w-0">
            <TabsTrigger id="tab-aval-inbox" value="inbox" className="flex items-center gap-1.5">
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Minha Caixa</span>
              {avaliacoesPendentes > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5">
                  {avaliacoesPendentes}
                </Badge>
              )}
            </TabsTrigger>
            {podeVerCiclos && (
              <TabsTrigger id="tab-aval-ciclos" value="ciclos" className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Ciclos</span>
              </TabsTrigger>
            )}
            <TabsTrigger id="tab-aval-formulario" value="formulario" className="flex items-center gap-1.5">
              <PenTool className="h-4 w-4" />
              <span className="hidden sm:inline">Formulário</span>
            </TabsTrigger>
            <TabsTrigger id="tab-aval-metas" value="metas" className="flex items-center gap-1.5">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Metas</span>
            </TabsTrigger>
            {podeVerTemplates && (
              <TabsTrigger id="tab-aval-templates" value="templates" className="flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Templates</span>
              </TabsTrigger>
            )}
            {podeVerResultados && (
              <TabsTrigger id="tab-aval-resultados" value="resultados" className="flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Resultados</span>
              </TabsTrigger>
            )}
            {podeVerResultados && (
              <TabsTrigger id="tab-aval-9box" value="9box" className="flex items-center gap-1.5">
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">9-Box</span>
              </TabsTrigger>
            )}
            {podeVerConfiguracoes && (
              <TabsTrigger id="tab-aval-config" value="config" className="flex items-center gap-1.5">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Config</span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Banner explicativo da aba ativa, com glow colorido */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Card className={`relative overflow-hidden border-0 bg-gradient-to-br ${current.gradient} ${current.glow} text-white shadow-lg`}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-transparent pointer-events-none" />
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/15 rounded-full blur-3xl pointer-events-none" />
            <CardContent className="relative p-5 flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 shadow-inner shrink-0">
                <current.icon className="w-5 h-5 drop-shadow" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base drop-shadow-sm">{current.title}</h3>
                  <span className="text-[10px] uppercase tracking-wider bg-white/20 border border-white/30 rounded-full px-2 py-0.5 font-semibold flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" /> Para que serve
                  </span>
                </div>
                <p className="text-sm text-white/90 mt-1 leading-snug">{current.desc}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <TabsContent value="inbox" className="space-y-4">
          <AvaliacaoInbox />
        </TabsContent>
        <TabsContent value="ciclos" className="space-y-4">
          <CicloList />
        </TabsContent>
        <TabsContent value="formulario" className="space-y-4">
          <AvaliacaoFormulario />
        </TabsContent>
        <TabsContent value="metas" className="space-y-4">
          <MetasList />
        </TabsContent>
        <TabsContent value="templates" className="space-y-4">
          <TemplateList />
        </TabsContent>
        <TabsContent value="resultados" className="space-y-4">
          <ResultadosCiclo />
        </TabsContent>
        <TabsContent value="9box" className="space-y-4">
          <Matriz9Box />
        </TabsContent>
        <TabsContent value="config" className="space-y-4">
          <AvaliacaoConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
