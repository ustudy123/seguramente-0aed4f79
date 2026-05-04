import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Shield, Sparkles, FileText, BarChart3, AlertTriangle,
  Target, FileCheck, ChevronRight, ChevronLeft, X,
  CheckCircle2, Circle, Lightbulb, Search, Brain, Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ManualComplianceSST } from "./ManualComplianceSST";

interface GuiaRapidoComplianceSSTProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PASSOS = [
  {
    id: "overview",
    icon: Shield,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    titulo: "O que e esse modulo?",
    subtitulo: "Visao geral — governanca e inteligencia SST",
    descricao:
      "O modulo de Compliance SST do YourEyes permite importar, analisar e monitorar documentos legais de Saude e Seguranca do Trabalho (PGR, PCMSO, LTCAT) com inteligencia artificial. O sistema audita a coerencia normativa, gera alertas e planos de acao automaticamente.",
    destaques: [
      { icon: Brain, label: "Extracao inteligente com IA (GPT-4o)" },
      { icon: Shield, label: "Auditoria normativa NR-01 / NR-07" },
      { icon: AlertTriangle, label: "Alertas e vencimentos automaticos" },
      { icon: FileCheck, label: "Confronto eSocial (S-2210/S-2220/S-2240)" },
    ],
    dica: "Este modulo nao substitui profissionais habilitados nem elabora documentos obrigatorios. Atua como orquestrador, auditor de coerencia e gerador de inteligencia preventiva.",
  },
  {
    id: "importacao",
    icon: Sparkles,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    titulo: "Passo 1 — Importe com IA",
    subtitulo: "Upload e extracao inteligente",
    descricao:
      "Faca upload do documento SST (PDF) e classifique o tipo: PGR, PCMSO, LTCAT ou outro. A IA extrai automaticamente riscos, exames, agentes nocivos e planos de acao 5W2H conforme o tipo do documento.",
    acoes: [
      "Acesse a aba **Importacao IA**",
      "Faca **upload do PDF** do documento SST",
      "Selecione o **tipo**: PGR, PCMSO, LTCAT ou outro",
      "Aguarde a **extracao automatica** pela IA",
      "**Revise os dados** extraidos antes de consolidar",
    ],
    dica: "A classificacao correta do tipo de documento e fundamental. Ela guia a IA para extrair os campos certos: riscos para PGR, exames para PCMSO, agentes nocivos para LTCAT.",
  },
  {
    id: "revisao",
    icon: Search,
    color: "text-green-600",
    bgColor: "bg-green-50",
    titulo: "Passo 2 — Revise e Consolide",
    subtitulo: "Validacao humana dos dados",
    descricao:
      "Apos a extracao, revise os dados identificados pela IA. Voce pode editar, adicionar ou remover itens. A consolidacao salva os dados no sistema e gera alertas e acoes automaticamente.",
    acoes: [
      "Verifique os **riscos e agentes** identificados",
      "Revise a **matriz de exames** (PCMSO) ou **plano 5W2H** (PGR)",
      "Ajuste dados como **profissional responsavel e datas**",
      "Clique em **Consolidar** para salvar no sistema",
      "Acoes 5W2H podem ser **exportadas ao Plano de Acao Global**",
    ],
    dica: "A revisao humana e obrigatoria. A IA e uma ferramenta de apoio, mas a validacao tecnica e responsabilidade do profissional habilitado.",
  },
  {
    id: "documentos",
    icon: FileText,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    titulo: "Passo 3 — Gerencie Documentos",
    subtitulo: "Controle de vigencia e rastreabilidade",
    descricao:
      "A aba 'Documentos' lista todos os documentos importados com status de vigencia. Cada documento mantem historico completo e permite revisao dos dados extraidos a qualquer momento.",
    acoes: [
      "Acesse a aba **Documentos** para ver todos os importados",
      "Verifique o **status de vigencia** (vigente, vencido)",
      "Clique em um documento para **revisar dados extraidos**",
      "Use o botao de **analise** para ver detalhes da extracao IA",
      "Documentos vencidos geram **alertas automaticos**",
    ],
    dica: "PGR, PCMSO e LTCAT possuem validades distintas. Mantenha uma rotina mensal de verificacao para evitar lacunas de conformidade.",
  },
  {
    id: "painel",
    icon: BarChart3,
    color: "text-green-600",
    bgColor: "bg-green-50",
    titulo: "Passo 4 — Monitore o Painel",
    subtitulo: "Indicadores e calendario de vencimentos",
    descricao:
      "O Painel apresenta indicadores consolidados e o Calendario de Vencimentos, que ordena documentos por data de validade com indicadores visuais de urgencia.",
    acoes: [
      "Acesse a aba **Painel** para visao gerencial",
      "Acompanhe **documentos vigentes vs. vencidos**",
      "Verifique o **Calendario de Vencimentos** regularmente",
      "Documentos com menos de **60 dias** recebem destaque",
      "Use os dados para **reunioes de compliance e auditorias**",
    ],
    dica: "O Calendario de Vencimentos e sua ferramenta mais importante para gestao proativa. Verifique-o semanalmente.",
  },
  {
    id: "alertas",
    icon: AlertTriangle,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    titulo: "Passo 5 — Acompanhe Alertas",
    subtitulo: "Pendencias e inconsistencias normativas",
    descricao:
      "A aba 'Alertas' consolida pendencias: documentos vencidos, lacunas normativas e inconsistencias entre PGR, PCMSO e LTCAT. Alertas criticos exigem acao imediata.",
    acoes: [
      "Acesse a aba **Alertas** para ver todas as pendencias",
      "Filtre por **prioridade**: critica, alta, media, baixa",
      "Trate **alertas criticos** imediatamente",
      "Inconsistencias PGR x PCMSO geram alertas de **lacuna normativa**",
      "Crie **acoes corretivas** diretamente a partir dos alertas",
    ],
    dica: "Lacunas entre PGR, PCMSO e LTCAT podem configurar passivo trabalhista e previdenciario. Trate inconsistencias como prioridade.",
  },
  {
    id: "acoes",
    icon: Target,
    color: "text-red-600",
    bgColor: "bg-red-50",
    titulo: "Passo 6 — Gerencie Acoes",
    subtitulo: "Plano de acao 5W2H integrado",
    descricao:
      "A aba 'Acoes' lista todas as acoes corretivas e preventivas. Cada acao segue o modelo 5W2H e e vinculada ao documento de origem para rastreabilidade completa.",
    acoes: [
      "Acesse a aba **Acoes** para ver o plano de acao",
      "Acoes podem ser **geradas automaticamente** pela IA ou manualmente",
      "Acompanhe o **status**: pendente, em andamento, concluida",
      "Acoes concluidas devem ter **evidencias** anexadas",
      "O status das acoes impacta os **indicadores do Painel**",
    ],
    dica: "Em caso de fiscalizacao, a rastreabilidade completa das acoes (origem, responsavel, prazo, evidencia) e a principal prova de diligencia.",
  },
  {
    id: "recursos",
    icon: FileText,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    titulo: "Documentos e Recursos",
    subtitulo: "Material de referencia offline",
    descricao:
      "O YourEyes gera registros completos para compliance SST. Baixe o Manual Completo em PDF para ter um guia de referencia offline com todos os passos e orientacoes normativas.",
    acoes: [
      "**Documentos importados** — historico completo com rastreabilidade",
      "**Alertas e pendencias** — notificacoes automaticas de risco",
      "**Plano de acao** — acoes 5W2H vinculadas aos documentos",
      "**Indicadores** — metricas de maturidade de compliance",
      "**Manual do modulo** — baixe abaixo em PDF para referencia offline",
    ],
    dica: "A documentacao completa de compliance SST (PGR, PCMSO, LTCAT atualizados, acoes evidenciadas) e fundamental para defesa em processos trabalhistas e previdenciarios.",
  },
];

export function GuiaRapidoComplianceSST({ open, onOpenChange }: GuiaRapidoComplianceSSTProps) {
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
            <div className="p-2 rounded-lg bg-blue-100">
              <BookOpen className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <h2 className="font-bold text-base text-foreground">Guia do Modulo Compliance SST</h2>
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
            className="h-full bg-blue-700"
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
                      ? "bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-700"
                      : "text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  {concluido ? (
                    <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
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

          {/* Conteudo */}
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
                {/* Cabecalho */}
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

                {/* Descricao */}
                <p className="text-sm text-foreground/80 leading-relaxed">{atual.descricao}</p>

                {/* Destaques (overview) */}
                {atual.destaques && (
                  <div className="grid grid-cols-2 gap-3">
                    {atual.destaques.map(({ icon: Ic, label }) => (
                      <div
                        key={label}
                        className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/50 border border-border/50"
                      >
                        <Ic className="h-4 w-4 text-blue-700 shrink-0" />
                        <span className="text-xs font-medium text-foreground">{label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Acoes */}
                {atual.acoes && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Como fazer
                    </p>
                    <ol className="space-y-2">
                      {atual.acoes.map((acao, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
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

                {/* CTA Manual PDF — ultima etapa */}
                {passo === PASSOS.length - 1 && (
                  <div className="flex flex-col items-center gap-3 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground text-center">
                      Quer um guia de referencia para consultar offline?
                    </p>
                    <ManualComplianceSST />
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
                          ? "bg-blue-700 w-4"
                          : idx < passo
                          ? "bg-blue-300"
                          : "bg-muted-foreground/30"
                      )}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer de navegacao */}
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
            <Button size="sm" onClick={() => irPara(passo + 1)} className="gap-1.5 bg-blue-700 hover:bg-blue-800">
              Proximo <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleClose} className="gap-1.5 bg-blue-700 hover:bg-blue-800">
              <CheckCircle2 className="h-4 w-4" /> Concluir
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
