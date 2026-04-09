import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Target, GitBranch, ClipboardCheck, Bot, Shield,
  ChevronRight, ChevronLeft, X, CheckCircle2, Circle, Lightbulb,
  Calculator, FileText, Users, Lock, BarChart3, Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GuiaRapidoMetasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PASSOS = [
  {
    id: "overview",
    icon: Target,
    color: "text-primary",
    bgColor: "bg-primary/10",
    titulo: "O que é este módulo?",
    subtitulo: "Visão geral — para quem é e o que resolve",
    descricao:
      "O módulo de Metas organiza a estratégia em uma estrutura operacional clara. Ele conecta planejamento, execução, acompanhamento e avaliação em um mesmo fluxo, permitindo que a liderança acompanhe metas corporativas e também o desdobramento até áreas e pessoas.",
    destaques: [
      { icon: GitBranch, label: "Desdobramento estratégico multinível" },
      { icon: Users, label: "Para: Diretoria, Gestores e Colaboradores" },
      { icon: Bot, label: "IA First: sugestões SMART e análise" },
      { icon: Shield, label: "Governança, auditoria e LGPD" },
    ],
    dica: "A qualidade da gestão de metas depende menos da quantidade de metas e mais da clareza, disciplina de acompanhamento e consistência dos indicadores.",
  },
  {
    id: "niveis",
    icon: GitBranch,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    titulo: "Passo 1 — Níveis Hierárquicos",
    subtitulo: "Estruture a estratégia em 4 camadas",
    descricao:
      "As metas podem existir em quatro níveis. Cada nível possui papel específico dentro da governança e do desdobramento corporativo.",
    acoes: [
      "**Estratégica**: metas corporativas que expressam prioridades da organização",
      "**Unidade**: traduz a estratégia para uma empresa, filial ou unidade de negócio",
      "**Setor**: distribui o objetivo para áreas ou departamentos específicos",
      "**Individual**: transforma a meta em responsabilidade direta de um colaborador",
    ],
    dica: "O desdobramento permite transformar uma meta de nível superior em submetas coerentes em níveis abaixo, garantindo alinhamento organizacional.",
  },
  {
    id: "criacao",
    icon: Flag,
    color: "text-green-600",
    bgColor: "bg-green-50",
    titulo: "Passo 2 — Crie uma Nova Meta",
    subtitulo: "Formulário com apoio de IA",
    descricao:
      "Ao clicar em 'Nova Meta', o sistema abre o formulário principal. O ideal é preencher a meta de forma objetiva, mensurável e com lógica de acompanhamento desde o início.",
    acoes: [
      "Clique em **Nova Meta** no topo da página",
      "Escolha o **nível correto** da meta (estratégica, unidade, setor ou individual)",
      "Defina **título claro** e descrição sem ambiguidades",
      "Selecione **período e ano** do ciclo avaliativo",
      "Informe **peso** da meta para consolidação final",
      "Associe **objetivo estratégico**, responsável e estrutura organizacional",
    ],
    dica: "Prefira metas claras, com dono, prazo e indicador definidos. Evite metas duplicadas em áreas diferentes sem desdobramento explícito.",
  },
  {
    id: "indicadores",
    icon: BarChart3,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    titulo: "Passo 3 — Configure Indicadores",
    subtitulo: "Mensuração e comparabilidade",
    descricao:
      "Toda meta deve, preferencialmente, possuir indicador. Isso garante comparabilidade, avaliação justa e leitura executiva consistente.",
    acoes: [
      "Tipos suportados: **quantitativo, qualitativo, percentual, financeiro, marco e híbrido**",
      "Direções: **maior é melhor, menor é melhor, igual ao alvo e faixa**",
      "Campos comuns: **baseline, valor atual, valor alvo, limites e fórmula**",
      "Use a aba **Indicadores** para padronizar métricas reutilizáveis entre áreas",
    ],
    dica: "Mesmo quando permitido criar meta sem indicador, o recomendado é sempre associar um para melhorar acompanhamento e avaliação.",
  },
  {
    id: "workflow",
    icon: Shield,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    titulo: "Passo 4 — Workflow e Governança",
    subtitulo: "Controle de maturidade e aprovação",
    descricao:
      "O módulo suporta estados de workflow para controlar maturidade, aprovação e revisão das metas ao longo do ciclo.",
    acoes: [
      "**Rascunho**: meta ainda em elaboração",
      "**Em aprovação**: aguardando validação da liderança definida",
      "**Ativa**: meta aprovada e em execução",
      "**Em revisão**: meta reavaliada por mudança de contexto",
      "**Suspensa, encerrada ou cancelada**: estados finais conforme governança",
    ],
    dica: "Configure as aprovações por nível na aba Configurações para definir quais metas exigem validação.",
  },
  {
    id: "checkins",
    icon: ClipboardCheck,
    color: "text-green-600",
    bgColor: "bg-green-50",
    titulo: "Passo 5 — Check-ins e Evidências",
    subtitulo: "Acompanhamento contínuo do ciclo",
    descricao:
      "Check-ins registram a evolução real da meta. Evidências sustentam a confiabilidade do resultado para auditoria e revisão gerencial.",
    acoes: [
      "Registre **valor anterior, valor novo e progresso** atualizado",
      "Explique **observações e bloqueios** encontrados",
      "Informe **previsão de atingimento** para gestão de risco",
      "Anexe **evidências**: arquivos, links ou descrições de comprovação",
      "Use check-ins frequentes para **evitar surpresas** no fechamento do ciclo",
    ],
    dica: "Quanto mais objetiva a evidência, maior a confiança na avaliação. Registre check-ins periódicos conforme a frequência configurada.",
  },
  {
    id: "ia",
    icon: Bot,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    titulo: "Passo 6 — Inteligência Artificial",
    subtitulo: "Apoio operacional e analítico",
    descricao:
      "A IA é parte central do módulo. Ela apoia construção, análise e leitura das metas, mas não substitui governança humana.",
    acoes: [
      "**Sugestão SMART** de metas com título e descrição otimizados",
      "**Desdobramento automático** entre níveis hierárquicos",
      "**Validação de consistência** para detectar conflitos e duplicidades",
      "**Resumo executivo** e leitura gerencial do ciclo",
      "**Assistente conversacional** para dúvidas e orientação operacional",
    ],
    dica: "Sempre revise criticamente qualquer texto gerado por IA antes de aprovar, compartilhar ou usar em avaliação formal.",
  },
  {
    id: "consolidacao",
    icon: Calculator,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    titulo: "Passo 7 — Consolidação e Resultados",
    subtitulo: "Atingimento ponderado do ciclo",
    descricao:
      "A consolidação calcula o atingimento do ciclo considerando progresso e peso. Isso permite leitura mais justa que uma média simples.",
    acoes: [
      "**Atingimento ponderado** = soma de progresso × peso ÷ soma dos pesos",
      "Visão **geral e por nível** hierárquico",
      "**Resumo executivo** por IA para interpretar o ciclo",
      "Use a **memória de cálculo** para explicar o resultado final com transparência",
    ],
    dica: "Não concentre toda a revisão apenas no fechamento do ciclo. Use o painel de consistência antes de reuniões executivas.",
  },
  {
    id: "recursos",
    icon: FileText,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    titulo: "Recursos e Boas Práticas",
    subtitulo: "Diretrizes finais para operação segura",
    descricao:
      "Use o módulo como instrumento de gestão, não apenas como repositório. A meta deve nascer clara, ser acompanhada com frequência, possuir evidência compatível e terminar com uma avaliação defensável.",
    acoes: [
      "**Participantes colaborativos**: co-responsáveis, apoio e consultados com pesos",
      "**Privacidade**: em metas individuais, cuide da visibilidade e LGPD",
      "**Transparência**: use pesos, memória de cálculo e evidências",
      "**Rastreabilidade**: registre check-ins, alterações e justificativas",
      "Revise **pesos** para refletir prioridade real do negócio",
    ],
    dica: "Em caso de auditoria, a documentação completa (check-ins, evidências, workflow) é a principal prova de diligência da gestão de metas.",
  },
];

export function GuiaRapidoMetas({ open, onOpenChange }: GuiaRapidoMetasProps) {
  const [passo, setPasso] = useState(0);

  const atual = PASSOS[passo];
  const IconeAtual = atual.icon;
  const progresso = ((passo + 1) / PASSOS.length) * 100;

  const irPara = (idx: number) => {
    if (idx >= 0 && idx < PASSOS.length) setPasso(idx);
  };

  const handleClose = () => {
    setPasso(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(true); }}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh] h-[90vh] [&>button.absolute]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b bg-background flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base text-foreground">Guia do Módulo de Metas</h2>
              <p className="text-xs text-muted-foreground">
                {passo + 1} de {PASSOS.length} — {atual.titulo}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Barra de progresso */}
        <div className="h-1 bg-muted flex-shrink-0">
          <motion.div
            className="h-full bg-primary"
            animate={{ width: `${progresso}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Sidebar */}
          <div className="w-52 shrink-0 border-r bg-muted/30 py-4 hidden sm:block overflow-y-auto">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 mb-2">
              Passo a Passo
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
                      : "text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  {concluido ? (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  ) : ativo ? (
                    <Icone className={cn("h-4 w-4 shrink-0", p.color)} />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  )}
                  <span className="text-xs leading-tight">
                    {p.titulo.replace(/^Passo \d+ — /, "")}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Conteúdo */}
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
                {/* Cabeçalho */}
                <div className="flex items-start gap-4">
                  <div className={cn("p-3 rounded-xl shrink-0", atual.bgColor)}>
                    <IconeAtual className={cn("h-6 w-6", atual.color)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg text-foreground">{atual.titulo}</h3>
                      <Badge variant="outline" className="text-xs">
                        {atual.subtitulo}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Descrição */}
                <p className="text-sm text-foreground/80 leading-relaxed">{atual.descricao}</p>

                {/* Destaques (overview) */}
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

                {/* Ações */}
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

                {/* Indicadores mobile */}
                <div className="flex justify-center gap-1.5 sm:hidden pt-2">
                  {PASSOS.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => irPara(idx)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all",
                        idx === passo
                          ? "bg-primary w-4"
                          : idx < passo
                          ? "bg-primary/50"
                          : "bg-muted-foreground/30"
                      )}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer de navegação */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-background flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => irPara(passo - 1)}
            disabled={passo === 0}
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>

          <span className="text-xs text-muted-foreground">
            {passo + 1} / {PASSOS.length}
          </span>

          {passo < PASSOS.length - 1 ? (
            <Button size="sm" onClick={() => irPara(passo + 1)} className="gap-1.5">
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleClose} className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Concluir
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
