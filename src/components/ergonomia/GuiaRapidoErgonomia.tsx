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
  FileText,
  AlertTriangle,
  ClipboardCheck,
  Database,
  Brain,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  Circle,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ManualErgonomia } from "@/components/ergonomia/ManualErgonomia";

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
    subtitulo: "GRO em 5 etapas — do risco ao documento",
    descricao:
      "Este módulo segue o fluxo normativo do GRO (Gerenciamento de Riscos Ocupacionais) em 5 etapas sequenciais. Você não precisa ser especialista: o sistema guia cada passo, calcula os níveis de risco automaticamente e gera os documentos exigidos pela NR-17 e NR-01.",
    destaques: [
      { icon: FileText, label: "Etapa 1 — Avaliar Riscos (AEP)" },
      { icon: ShieldCheck, label: "Etapa 2 — Inventário GRO" },
      { icon: AlertTriangle, label: "Etapa 3 — Riscos Prioritários" },
      { icon: ClipboardCheck, label: "Etapa 4 — Plano de Ação" },
      { icon: TrendingUp, label: "Etapa 5 — Monitoramento" },
      { icon: Brain, label: "Extra — Análise por IA" },
    ],
  },
  {
    id: "aep",
    icon: FileText,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    titulo: "Etapa 1 — Avaliar Riscos (AEP)",
    subtitulo: "Análise focada em Função/Posto — foco real da NR-17",
    descricao:
      "A AEP documenta as condições reais de trabalho por Situação de Trabalho (par Setor + Função). Cada combinação representa uma realidade distinta — como um faturista é diferente de um recepcionista, mesmo dentro do mesmo departamento. O sistema impede análises genéricas e alimenta automaticamente o Inventário GRO.",
    acoes: [
      "Clique na aba **1. Avaliar Riscos (AEP)** e em **Nova AEP**",
      "Adicione cada combinação **Setor + Função** que representa uma realidade de trabalho distinta (NR-17)",
      "Use **Duplicar** para funções similares no mesmo setor — isso representa o GHE (Grupo de Exposição Homogênea da NR-1)",
      "O sistema preenche automaticamente CNPJ e razão social da empresa ativa",
      "Descreva o **trabalho real** (não apenas o prescrito) — auditores verificam o descompasso entre os dois",
      "Preencha as **Condições Ambientais** (§17.5): ruído ≤ 65 dB(A), temperatura 20–23°C, umidade ≥ 40%",
      "Preencha a **Organização do Trabalho** (§17.6): cotas, pausas, jornada, modo operatório",
      "Na Síntese, marque o **Checklist NR-17** — 12 itens que auditores fiscais verificam obrigatoriamente. O sistema calcula o % de conformidade automaticamente",
    ],
    dica: "Hierarquia NR-17: a AEP é focada na Função/Posto. O departamento ajuda a agrupar riscos ambientais comuns (ruído, temperatura). A empresa é o nível de gestão e inventário (PGR). Não faça uma AEP genérica 'da empresa' — faça por função e use o documento mestre para consolidar.",
  },
  {
    id: "inventario",
    icon: ShieldCheck,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    titulo: "Etapa 2 — Inventário GRO",
    subtitulo: "Cadastre e gerencie todos os riscos ergonômicos",
    descricao:
      "O Inventário GRO é onde ficam registrados todos os riscos da empresa. Cada risco tem seu nível calculado automaticamente (Baixo, Médio, Alto ou Crítico). Daqui partem as ações corretivas e os documentos de conformidade.",
    acoes: [
      "Clique na aba **2. Inventário GRO**",
      "Veja todos os riscos já cadastrados pela AEP ou adicione manualmente com **Novo Risco**",
      "Para cada risco, defina: posto de trabalho, tipo (físico, cognitivo ou organizacional), probabilidade e severidade",
      "O sistema calcula automaticamente o nível de risco (1 a 25) — quanto maior, mais urgente",
      "Riscos **Altos** e **Críticos** exigem Plano de Ação vinculado — o sistema bloqueia encerramento sem ele",
    ],
    dica: "Não sabe por onde começar no inventário? Gere as AEPs na Etapa 1 — elas preenchem o inventário automaticamente.",
  },
  {
    id: "prioritarios",
    icon: AlertTriangle,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    titulo: "Etapa 3 — Riscos Prioritários",
    subtitulo: "Veja o que exige atenção imediata",
    descricao:
      "Esta aba filtra automaticamente todos os riscos classificados como Alto ou Crítico. São os riscos que precisam de ação agora — o sistema os destaca para que você saiba exatamente onde concentrar esforços.",
    acoes: [
      "Clique na aba **3. Riscos Prioritários**",
      "Veja a lista de riscos que exigem intervenção urgente (Alto e Crítico)",
      "Para cada risco crítico, clique em **Criar Ação** para vincular um Plano de Ação",
      "Riscos sem ação vinculada ficam destacados em vermelho como pendência",
      "Ao vincular uma ação, o risco avança no ciclo de gestão automaticamente",
    ],
    dica: "Riscos Críticos têm prazo sugerido de 30 dias; Altos, de 60 dias. O sistema gera alertas de vencimento automaticamente.",
  },
  {
    id: "plano_acao",
    icon: ClipboardCheck,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    titulo: "Etapa 4 — Plano de Ação",
    subtitulo: "Registre e acompanhe as ações de melhoria",
    descricao:
      "O Plano de Ação transforma os riscos em tarefas concretas. Para cada risco identificado, você cria uma ação com responsável, prazo e descrição de como será executada. O sistema monitora o andamento de todas as ações.",
    acoes: [
      "Clique na aba **4. Plano de Ação**",
      "Clique em **Nova Ação** para criar uma ação corretiva",
      "Defina: o que será feito, quem é responsável, qual o prazo e como será executado (modelo 5W2H)",
      "Atualize o progresso (0% a 100%) conforme a ação avança",
      "Ações concluídas devem ter evidências registradas (fotos, laudos, notas fiscais)",
      "O sistema envia alertas para ações próximas do vencimento ou atrasadas",
    ],
    dica: "Mantenha as ações atualizadas — ações atrasadas reduzem o score de maturidade do programa e podem indicar não conformidade em auditorias.",
  },
  {
    id: "monitoramento",
    icon: TrendingUp,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
    titulo: "Etapa 5 — Monitoramento",
    subtitulo: "Mapa de riscos e documentos de conformidade",
    descricao:
      "A etapa de monitoramento reúne o mapa geográfico dos riscos por setor e os dois documentos técnicos exigidos pela NR-01: o Documento de Metodologia e o Relatório de Comunicação aos Trabalhadores. Gere e arquive com um clique.",
    acoes: [
      "Clique na aba **5. Monitoramento**",
      "Visualize o **Mapa de Risco** — distribuição visual dos riscos por setor/posto",
      "Clique em **Gerar PDF** no card **Documento de Metodologia** (RQ-26) para exportar a documentação técnica do programa",
      "Clique em **Gerar PDF** no card **Comunicação aos Trabalhadores** (RQ-19/20) para gerar o comunicado formal de riscos",
      "Guarde os documentos gerados — comprovam conformidade em auditorias e ações trabalhistas",
    ],
    dica: "Gere os documentos de Metodologia e Comunicação sempre que houver atualização relevante no inventário de riscos. Recomenda-se revisão anual no mínimo.",
  },
  {
    id: "analise_ia",
    icon: Brain,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    titulo: "Extra — Análise por IA",
    subtitulo: "Diagnóstico rápido por descrição ou foto do posto",
    descricao:
      "A Análise por IA é uma ferramenta de suporte: você descreve o posto de trabalho em linguagem simples ou envia uma foto, e a IA gera um diagnóstico ergonômico em segundos. Ideal para avaliações rápidas ou para fundamentar laudos técnicos com mais agilidade.",
    acoes: [
      "Clique na aba **Análise por IA**",
      "Descreva o posto em linguagem livre (ex: 'operador de caixa, 8h em pé, balcão alto demais') ou envie uma foto",
      "Clique em **Analisar** e aguarde o resultado",
      "A IA identifica riscos, classifica por tipo e sugere adequações",
      "A análise é salva automaticamente na **Base Ergonômica** para consultas futuras",
    ],
    dica: "A Análise por IA não substitui a AEP formal, mas é um excelente ponto de partida para identificar rapidamente onde concentrar esforços de avaliação.",
  },
  {
    id: "base",
    icon: Database,
    color: "text-slate-600",
    bgColor: "bg-slate-100",
    titulo: "Extra — Base Ergonômica",
    subtitulo: "Histórico de todas as análises realizadas",
    descricao:
      "A Base Ergonômica é o arquivo histórico do módulo. Todas as análises geradas pela IA ficam armazenadas aqui, organizadas por data e setor. Consulte para acompanhar a evolução ao longo do tempo ou para embasar documentos técnicos.",
    acoes: [
      "Clique na aba **Base Ergonômica**",
      "Visualize todas as análises registradas, com data, setor e resultado",
      "Use os filtros para buscar análises por setor ou função específica",
      "Análises podem ser arquivadas quando não forem mais relevantes",
      "Use o histórico para demonstrar evolução do programa em auditorias",
    ],
    dica: "Mantenha a base organizada arquivando análises antigas. Isso facilita a navegação e demonstra maturidade do programa ergonômico ao longo do tempo.",
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
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh] h-[90vh] [&>button.absolute]:hidden">
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
          <div className="w-52 shrink-0 border-r bg-muted/30 py-4 hidden sm:block overflow-y-auto">
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

                {/* CTA Manual PDF — última etapa */}
                {passo === PASSOS.length - 1 && (
                  <div className="flex flex-col items-center gap-3 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground text-center">
                      Quer um guia de referência completo para consultar offline?
                    </p>
                    <ManualErgonomia />
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
