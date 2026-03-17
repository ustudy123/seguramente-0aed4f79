import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Brain,
  Plus,
  BarChart3,
  TrendingUp,
  ShieldCheck,
  Activity,
  FileText,
  Flame,
  ClipboardList,
  Users,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  Circle,
  Lightbulb,
  Lock,
  Target,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GuiaRapidoPsicossocialProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PASSOS = [
  {
    id: "overview",
    icon: Brain,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    titulo: "Bem-vindo à Gestão Psicossocial",
    subtitulo: "NR-01 · NR-17 · ISO 45001 · ISO 45003",
    descricao:
      "O módulo de Gestão Psicossocial permite monitorar continuamente o bem-estar organizacional por meio de campanhas de avaliação anônimas, gerando índices científicos e alertas de risco para ação proativa.",
    destaques: [
      { icon: ShieldCheck, label: "Conformidade NR-01 / ISO 45003" },
      { icon: Activity, label: "IPS — Índice Psicossocial" },
      { icon: Lock, label: "Anonimato Garantido (mín. 5 respostas)" },
      { icon: Sparkles, label: "Instrumentos Validados (SIPRO, PHQ-9)" },
    ],
  },
  {
    id: "campanha",
    icon: Plus,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    titulo: "Passo 1 — Criar uma Campanha",
    subtitulo: "Seu ponto de partida",
    descricao:
      "Tudo começa com uma campanha de avaliação. Defina o instrumento adequado ao seu objetivo (rastreamento geral, burnout específico, retorno ao trabalho) e configure o período de coleta.",
    acoes: [
      "Clique no botão **Nova Campanha** no topo da página",
      "O **Assistente de Seleção** vai guiá-lo na escolha do instrumento ideal",
      "Configure o nome, objetivo e período de vigência",
      "Defina se a campanha é para toda a empresa ou setor específico",
      "Ative a campanha para começar a coletar respostas",
    ],
    dica: "Use o Assistente de Seleção para escolher entre SIPRO (geral), PHQ-9 (depressão), GAD-7 (ansiedade) e outros instrumentos validados.",
  },
  {
    id: "instrumentos",
    icon: FileText,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    titulo: "Passo 2 — Instrumentos Disponíveis",
    subtitulo: "Ferramentas validadas cientificamente",
    descricao:
      "O módulo oferece múltiplos instrumentos psicométricos validados. Cada um tem finalidade específica e gera índices automáticos ao atingir o mínimo de 5 respostas anônimas.",
    acoes: [
      "Acesse a aba **Instrumentos** para ver todos os disponíveis",
      "**SIPRO** — avaliação psicossocial completa com 10 eixos",
      "**PHQ-9** — rastreamento de sintomas depressivos",
      "**GAD-7** — escala de transtorno de ansiedade generalizada",
      "**MBI** — Inventário de Burnout de Maslach",
      "**AUDIT-C** — rastreamento de uso de álcool",
    ],
    dica: "O SIPRO é o instrumento principal do módulo. Ele gera o IPS (Índice Psicossocial) e todos os índices derivados (IBO-S, IBD-S, IREC-S, ICOP-S, INOT-S).",
  },
  {
    id: "ips",
    icon: Activity,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    titulo: "Passo 3 — Entendendo o IPS",
    subtitulo: "Índice Psicossocial Organizacional (0–100)",
    descricao:
      "O IPS é o indicador central do módulo. Calculado automaticamente ao atingir o mínimo de anonimato, ele classifica o ambiente organizacional em 5 níveis e orienta as ações prioritárias.",
    acoes: [
      "**0–34 — Crítico**: Intervenção urgente necessária",
      "**35–49 — Risco**: Ações corretivas prioritárias",
      "**50–64 — Atenção**: Monitoramento intensificado",
      "**65–79 — Estável**: Manutenção e melhorias pontuais",
      "**80–100 — Saudável**: Ambiente psicossocial favorável",
    ],
    dica: "Quando o IPS está abaixo de 65%, o Motor AET do módulo de Ergonomia é acionado automaticamente para indicar análise ergopsicossocial.",
  },
  {
    id: "burnout",
    icon: Flame,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    titulo: "Passo 4 — Burnout & Boreout",
    subtitulo: "Análise de esgotamento e desengajamento",
    descricao:
      "O radar de Burnout & Boreout oferece uma visão multidimensional do esgotamento profissional e do desengajamento por falta de desafios, cruzando dados de múltiplas campanhas.",
    acoes: [
      "Acesse a aba **Burnout & Boreout** para ver os radares",
      "Visualize os índices IBO-S (Burnout) e IBD-S (Boreout) por campanha",
      "Compare campanhas para identificar tendências",
      "Use o índice IREC-S para avaliar capacidade de recuperação",
      "Verifique INOT-S para riscos específicos do trabalho noturno",
    ],
    dica: "O Boreout é frequentemente subestimado. Colaboradores com muito baixo desafio têm risco similar ao Burnout em termos de turnover e produtividade.",
  },
  {
    id: "pgr",
    icon: ClipboardList,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    titulo: "Passo 5 — Inventário PGR",
    subtitulo: "Integração com o Programa de Gerenciamento de Riscos",
    descricao:
      "O Inventário PGR consolida os dados psicossociais de todas as campanhas encerradas em um único relatório auditável, com médias ponderadas pelo número de respondentes.",
    acoes: [
      "Acesse a aba **Inventário PGR**",
      "Visualize o consolidado de todas as campanhas encerradas",
      "O IPS médio é calculado por **média ponderada** (respondentes)",
      "Exporte o relatório em PDF para auditoria NR-01",
      "Use os filtros por período e instrumento para análises específicas",
    ],
    dica: "O PGR psicossocial deve ser revisado anualmente ou sempre que houver mudanças organizacionais significativas (reestruturação, fusão, mudança de liderança).",
  },
  {
    id: "alertas",
    icon: ShieldCheck,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    titulo: "Passo 6 — Alertas e Indicadores",
    subtitulo: "Ação proativa baseada em evidências",
    descricao:
      "O painel de Alertas Psicossociais gera notificações automáticas quando índices críticos são detectados, permitindo intervenção antes que os riscos se materializem em afastamentos.",
    acoes: [
      "Monitore o **Painel de Alertas** no topo do dashboard",
      "Alertas **Críticos** (vermelho) exigem ação imediata",
      "Alertas de **Atenção** (amarelo) requerem monitoramento próximo",
      "Vincule alertas a ações do Plano de Ação da Ergonomia",
      "Consulte o histórico de alertas na aba **Histórico IPS**",
    ],
    dica: "Configure notificações para que o RH e a liderança sejam alertados automaticamente quando o IPS cair abaixo de 65%, garantindo resposta rápida.",
  },
  {
    id: "historico",
    icon: TrendingUp,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
    titulo: "Passo 7 — Histórico e Evolução",
    subtitulo: "Tendências ao longo do tempo",
    descricao:
      "O gráfico de Histórico IPS mostra a evolução do índice psicossocial ao longo do tempo, permitindo avaliar o impacto de intervenções e campanhas de bem-estar.",
    acoes: [
      "Acesse a aba **Histórico IPS**",
      "Visualize a curva de evolução do IPS ao longo das campanhas",
      "Identifique quedas correlacionadas a eventos organizacionais",
      "Compare resultados antes e depois de intervenções",
      "Use os **Índices Derivados** para análise multidimensional",
    ],
    dica: "Realize campanhas trimestrais para ter um histórico significativo. Campanhas muito espaçadas dificultam a identificação de tendências e a demonstração de ROI das intervenções.",
  },
];

export function GuiaRapidoPsicossocial({ open, onOpenChange }: GuiaRapidoPsicossocialProps) {
  const [passo, setPasso] = useState(0);

  const atual = PASSOS[passo];
  const IconeAtual = atual.icon;
  const progresso = ((passo + 1) / PASSOS.length) * 100;

  const irPara = (idx: number) => {
    if (idx >= 0 && idx < PASSOS.length) setPasso(idx);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        {/* Header fixo */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b bg-background">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <BookOpen className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-bold text-base text-foreground">Guia Rápido — Gestão Psicossocial</h2>
              <p className="text-xs text-muted-foreground">
                {passo + 1} de {PASSOS.length} — {atual.titulo}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Barra de progresso roxa */}
        <div className="h-1 bg-muted">
          <motion.div
            className="h-full bg-purple-600"
            animate={{ width: `${progresso}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="flex min-h-[500px]">
          {/* Sidebar de navegação */}
          <div className="w-52 shrink-0 border-r bg-muted/30 py-4 hidden sm:block">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 mb-2">
              Navegação
            </p>
            {PASSOS.map((p, idx) => {
              const Icone = p.icon;
              const concluido = idx < passo;
              const ativo = idx === passo;
              return (
                <button
                  key={p.id}
                  onClick={() => irPara(idx)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-all text-sm",
                    ativo
                      ? "bg-purple-50 text-purple-700 font-medium border-r-2 border-purple-600"
                      : "text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  {concluido ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : ativo ? (
                    <Icone className={cn("h-4 w-4 shrink-0", p.color)} />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  )}
                  <span className="text-xs leading-tight">{p.titulo.replace(/^Passo \d+ — /, "")}</span>
                </button>
              );
            })}
          </div>

          {/* Conteúdo principal */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={passo}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="p-6 space-y-5"
              >
                {/* Cabeçalho do passo */}
                <div className="flex items-start gap-4">
                  <div className={cn("p-3 rounded-xl shrink-0", atual.bgColor)}>
                    <IconeAtual className={cn("h-6 w-6", atual.color)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg text-foreground">{atual.titulo}</h3>
                      {passo > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {atual.subtitulo}
                        </Badge>
                      )}
                    </div>
                    {passo === 0 && (
                      <p className="text-sm text-muted-foreground mt-0.5">{atual.subtitulo}</p>
                    )}
                  </div>
                </div>

                {/* Descrição */}
                <p className="text-sm text-foreground/80 leading-relaxed">{atual.descricao}</p>

                {/* Destaques (somente na overview) */}
                {atual.destaques && (
                  <div className="grid grid-cols-2 gap-3">
                    {atual.destaques.map(({ icon: Ic, label }) => (
                      <div
                        key={label}
                        className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/50 border border-border/50"
                      >
                        <Ic className="h-4 w-4 text-purple-600 shrink-0" />
                        <span className="text-xs font-medium text-foreground">{label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Ações passo a passo */}
                {atual.acoes && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Como fazer
                    </p>
                    <ol className="space-y-2">
                      {atual.acoes.map((acao, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center mt-0.5">
                            {i + 1}
                          </span>
                          <span
                            className="text-sm text-foreground/80"
                            dangerouslySetInnerHTML={{
                              __html: acao.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>'),
                            }}
                          />
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Dica */}
                {atual.dica && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <Lightbulb className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">{atual.dica}</p>
                  </div>
                )}

                {/* Indicadores de passo (mobile) */}
                <div className="flex justify-center gap-1.5 sm:hidden pt-2">
                  {PASSOS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => irPara(i)}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        i === passo ? "w-6 bg-purple-600" : "w-1.5 bg-muted-foreground/30"
                      )}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer de navegação */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-background">
          <Button
            variant="outline"
            size="sm"
            onClick={() => irPara(passo - 1)}
            disabled={passo === 0}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>

          <span className="text-xs text-muted-foreground hidden sm:block">
            {passo + 1} / {PASSOS.length}
          </span>

          {passo < PASSOS.length - 1 ? (
            <Button size="sm" onClick={() => irPara(passo + 1)} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={() => onOpenChange(false)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Concluir
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
