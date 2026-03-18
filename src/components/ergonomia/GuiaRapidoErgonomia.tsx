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
  Activity,
  ShieldCheck,
  RotateCcw,
  Zap,
  Brain,
  FileText,
  AlertTriangle,
  ClipboardCheck,
  Map,
  BarChart3,
  Database,
  Users,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  Circle,
  Lightbulb,
  Target,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GuiaRapidoErgonomiaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PASSOS = [
  {
    id: "overview",
    icon: Activity,
    color: "text-primary",
    bgColor: "bg-primary/10",
    titulo: "Bem-vindo ao Módulo de Ergonomia",
    subtitulo: "Análise ergonômica integrada para conformidade NR-17",
    descricao:
      "O módulo de Ergonomia Inteligente centraliza toda a gestão de riscos ergonômicos da sua organização, desde a identificação e análise até a geração de documentos técnicos e planos de ação.",
    destaques: [
      { icon: ShieldCheck, label: "Conformidade NR-17 / NR-01" },
      { icon: Target, label: "Gestão de Riscos GRO" },
      { icon: TrendingUp, label: "Ciclo PDCA Integrado" },
      { icon: Brain, label: "Análise com Inteligência Artificial" },
    ],
  },
  {
    id: "gro",
    icon: ShieldCheck,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    titulo: "Passo 1 — GRO / Inventário",
    subtitulo: "Gerenciamento de Riscos Ocupacionais",
    descricao:
      "Comece pelo GRO. Aqui você cadastra e monitora todos os riscos ergonômicos (físicos, cognitivos e organizacionais). Cada risco recebe automaticamente um nível de criticidade (1 a 5) com base em probabilidade × severidade.",
    acoes: [
      "Acesse a aba **GRO / Inventário** na barra de abas",
      "Clique em **Novo Risco** no cabeçalho para cadastrar riscos",
      "Preencha posto de trabalho, tipo de risco, probabilidade e severidade",
      "O sistema calculará automaticamente o nível de risco",
      "Acompanhe o painel consolidado com todos os riscos ativos",
    ],
    dica: "Riscos com nível ALTO ou CRÍTICO acionam automaticamente o Motor AET para recomendações técnicas.",
  },
  {
    id: "pdca",
    icon: RotateCcw,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    titulo: "Passo 2 — Ciclo PDCA",
    subtitulo: "Gestão por ciclo de melhoria contínua",
    descricao:
      "O Ciclo PDCA organiza os riscos em 4 fases: Identificar, Analisar, Controlar e Monitorar. Visualize o funil de riscos e acompanhe o Score de Maturidade GRO da organização.",
    acoes: [
      "Acesse a aba **Ciclo PDCA**",
      "Visualize o funil de fases com a distribuição dos riscos",
      "Acompanhe o **Score de Maturidade GRO** (0-100%)",
      "Use os cards para responder às perguntas obrigatórias de auditoria",
      "Monitore a evolução ao longo do tempo",
    ],
    dica: "O Score de Maturidade GRO responde automaticamente às perguntas obrigatórias de auditorias NR-01.",
  },
  {
    id: "motor_aet",
    icon: Zap,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    titulo: "Passo 3 — Motor AET",
    subtitulo: "Recomendações técnicas automatizadas",
    descricao:
      "O Motor AET analisa os riscos cadastrados e gera recomendações de análises técnicas: Obrigatórias, Recomendadas e Sugeridas. Integra dados psicossociais para indicar quando uma AEP é necessária.",
    acoes: [
      "Acesse a aba **Motor AET**",
      "Visualize as recomendações classificadas por prioridade",
      "Análises **Obrigatórias** devem ser priorizadas imediatamente",
      "Use o botão **Gerar AEP** para análises psicossociais indicadas",
      "Marque análises como concluídas para atualizar o score",
    ],
    dica: "Quando o IPS Psicossocial estiver abaixo de 65%, o Motor AET indicará automaticamente análise ergopsicossocial.",
  },
  {
    id: "analise_ia",
    icon: Brain,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    titulo: "Passo 4 — Análise por IA",
    subtitulo: "Diagnóstico ergonômico com inteligência artificial",
    descricao:
      "Envie fotos ou descrições de postos de trabalho e receba análises ergonômicas detalhadas geradas por IA, incluindo identificação de riscos, recomendações e adequações necessárias.",
    acoes: [
      "Acesse a aba **Análise por IA**",
      "Descreva o posto de trabalho ou envie imagem",
      "Aguarde a análise completa da IA",
      "Revise os riscos identificados automaticamente",
      "Salve a análise na Base Ergonômica para histórico",
    ],
    dica: "Cada análise por IA gera automaticamente um registro na Base Ergonômica para consultas futuras.",
  },
  {
    id: "aep",
    icon: FileText,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    titulo: "Passo 5 — Gerar AEP",
    subtitulo: "Análise Ergonômica Preliminar",
    descricao:
      "Gere documentos de AEP padronizados NR-17 para funções específicas ou múltiplos setores. A AEP inclui os 6 domínios obrigatórios NR-17/ISO 45003 com dados integrados das campanhas psicossociais.",
    acoes: [
      "Acesse a aba **Gerar AEP**",
      "Escolha entre **Função Única** ou **Multi-Setor**",
      "Selecione a função e preencha os dados do posto",
      "Os fatores psicossociais são preenchidos automaticamente com dados das campanhas",
      "Exporte o documento PDF assinado digitalmente",
    ],
    dica: "Use o modo Multi-Setor para gerar AEPs em lote para toda a organização de uma só vez.",
  },
  {
    id: "plano_acao",
    icon: ClipboardCheck,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    titulo: "Passo 6 — Plano de Ação",
    subtitulo: "Gestão de ações corretivas e preventivas",
    descricao:
      "Registre e acompanhe todas as ações de melhoria ergonômica. Defina responsáveis, prazos e prioridades. Acompanhe o status de cada ação até a conclusão.",
    acoes: [
      "Acesse a aba **Plano de Ação**",
      "Clique em **Nova Ação** para cadastrar uma ação",
      "Defina responsável, prazo e prioridade",
      "Acompanhe o progresso na listagem",
      "Atualize o status conforme as ações são executadas",
    ],
    dica: "Ações vinculadas a riscos críticos aparecem destacadas no painel GRO para facilitar o acompanhamento.",
  },
  {
    id: "documentos",
    icon: Database,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
    titulo: "Passo 7 — Documentos e Comunicação",
    subtitulo: "Metodologia e comunicação aos trabalhadores",
    descricao:
      "Gere o Documento de Metodologia (RQ-26) com a fundamentação técnica do programa ergonômico, e os materiais de Comunicação aos Trabalhadores (RQ-19/20) exigidos pela NR-17.",
    acoes: [
      "Acesse a aba **Hub de Serviços** para recursos adicionais",
      "Use **Base Ergonômica** para consultar o histórico de análises",
      "Visualize o **Mapa de Risco** geográfico dos postos avaliados",
      "Consulte **LER/DORT** para análise de doenças ocupacionais",
      "Acompanhe **Inventário de Riscos** consolidado por categoria",
    ],
    dica: "O Hub de Serviços centraliza integrações com laudos, PCMSOs e outros documentos do programa de saúde.",
  },
];

export function GuiaRapidoErgonomia({ open, onOpenChange }: GuiaRapidoErgonomiaProps) {
  const [passo, setPasso] = useState(0);

  const atual = PASSOS[passo];
  const IconeAtual = atual.icon;
  const progresso = ((passo + 1) / PASSOS.length) * 100;

  const irPara = (idx: number) => {
    if (idx >= 0 && idx < PASSOS.length) setPasso(idx);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh] h-[90vh]">
        {/* Header fixo */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b bg-background shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base text-foreground">Guia Rápido — Ergonomia</h2>
              <p className="text-xs text-muted-foreground">
                {passo + 1} de {PASSOS.length} — {atual.titulo}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Barra de progresso */}
        <div className="h-1 bg-muted">
          <motion.div
            className="h-full bg-primary"
            animate={{ width: `${progresso}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
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
                      ? "bg-primary/10 text-primary font-medium border-r-2 border-primary"
                      : concluido
                      ? "text-muted-foreground hover:bg-muted/60"
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
                        <Ic className="h-4 w-4 text-primary shrink-0" />
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
                          <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
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
                        i === passo ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                      )}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer de navegação */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-background shrink-0">
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
            <Button size="sm" onClick={() => irPara(passo + 1)} className="gap-2">
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
