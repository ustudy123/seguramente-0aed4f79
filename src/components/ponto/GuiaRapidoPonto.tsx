import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Clock,
  Settings,
  LogIn,
  FileText,
  Wallet,
  Lock,
  Bell,
  Link2,
  HardDrive,
  Scale,
  FileSpreadsheet,
  FileDown,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  Circle,
  Lightbulb,
  ShieldCheck,
  MapPin,
  Camera,
  Users,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GuiaRapidoPontoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PASSOS = [
  {
    id: "overview",
    icon: Clock,
    color: "text-primary",
    bgColor: "bg-primary/10",
    titulo: "O que é esse módulo?",
    subtitulo: "Visão geral — para quem é e o que resolve",
    descricao:
      "O Controle de Ponto do Seguramente registra, audita e fecha a jornada dos colaboradores em conformidade com a Portaria 671/2021 (REP-C/REP-P). Tudo é rastreável, com geolocalização, selfie e validações automáticas para garantir segurança jurídica ao empregador.",
    destaques: [
      { icon: Users, label: "Para: RH, Gestores e DP" },
      { icon: ShieldCheck, label: "Conformidade Portaria 671/2021" },
      { icon: MapPin, label: "Geolocalização ≤ 50m" },
      { icon: Sparkles, label: "Cálculo automático de jornada" },
    ],
    dica: "Antes de começar a registrar, configure as escalas e atribua cada colaborador a uma escala — sem isso o sistema não consegue calcular atrasos, faltas e horas extras.",
  },
  {
    id: "config",
    icon: Settings,
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    titulo: "Passo 1 — Configure o Módulo",
    subtitulo: "Parâmetros gerais antes de operar",
    descricao:
      "Na aba Configuração defina tolerâncias de atraso, regras de hora extra, adicional noturno, raio de geolocalização e exigência de selfie. Esses parâmetros valem para todo o tenant e devem refletir as práticas e CCT da empresa.",
    acoes: [
      "Acesse a aba **Configuração**",
      "Defina **tolerância de atraso** (ex.: 5 ou 10 minutos)",
      "Configure **percentuais de hora extra** (50% / 100%) e adicional noturno",
      "Ative **selfie obrigatória** e **raio de geolocalização** (recomendado: 50m)",
      "Salve — as regras passam a valer para todas as marcações novas",
    ],
    dica: "As regras seguem a CLT por padrão, mas devem ser revisadas conforme a CCT (Convenção Coletiva) da categoria. Use a aba CCT para anexar o documento vigente.",
  },
  {
    id: "escalas",
    icon: Settings,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    titulo: "Passo 2 — Cadastre as Escalas",
    subtitulo: "Base para todo cálculo de jornada",
    descricao:
      "A escala define o horário esperado de cada colaborador: blocos diários, intervalos, sábado/domingo úteis e recorrências mensais (ex.: 1º sábado do mês). Sem escala atribuída, o sistema não consegue identificar atrasos, faltas ou horas extras.",
    acoes: [
      "Vá em **Escalas → Nova Escala**",
      "Preencha **nome, tipo (5x2, 6x1, 12x36, personalizada)** e jornada semanal",
      "Adicione os **blocos diários** (ex.: 07:54–12:00 e 13:30–18:00)",
      "Configure **recorrências mensais** se houver (ex.: 1 sábado/mês 08:00–12:00)",
      "Atribua a escala aos **colaboradores** com data de início",
    ],
    dica: "Você pode editar, inativar ou excluir uma escala — exclusão só é permitida se ela nunca tiver sido atribuída. Caso contrário, inative para preservar o histórico.",
  },
  {
    id: "registrar",
    icon: LogIn,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    titulo: "Passo 3 — Registre o Ponto",
    subtitulo: "Marcação interna (REP-C) com selfie e GPS",
    descricao:
      "O REP-C é o registro feito pelo navegador, com captura automática de geolocalização e, opcionalmente, selfie. Cada marcação gera um comprovante digital (NSR) que pode ser exportado pelo colaborador a qualquer momento.",
    acoes: [
      "Clique em **Registrar Ponto** no topo da página",
      "Selecione o **colaborador** — o sistema sugere o próximo tipo (entrada → almoço → retorno → saída)",
      "Permita a **localização** quando o navegador solicitar",
      "Capture a **selfie** (se exigida pela configuração)",
      "Confirme — o registro é gravado com **timestamp, GPS e hash** auditáveis",
    ],
    dica: "Para registro fora do escritório, use a aba Links e gere um link REP-P (web) que o colaborador acessa pelo próprio celular com verificação por OTP via WhatsApp.",
  },
  {
    id: "ajustes",
    icon: FileText,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    titulo: "Passo 4 — Solicite e Aprove Ajustes",
    subtitulo: "Correções com trilha de auditoria",
    descricao:
      "Quando há esquecimento, erro de marcação ou justificativa de falta, o colaborador (ou o RH) abre uma solicitação de ajuste. O gestor aprova ou rejeita pela aba Ajustes, e tudo fica registrado para auditoria.",
    acoes: [
      "Clique em **Solicitar Ajuste** no topo da página",
      "Escolha o **tipo: Inclusão, Correção ou Justificativa**",
      "Informe **data, marcação, hora solicitada e motivo**",
      "Na aba **Ajustes**, o gestor visualiza pendentes e aprova/rejeita",
      "Após aprovado, o ajuste é aplicado e **recalcula automaticamente** o dia",
    ],
    dica: "Toda alteração mantém o registro original — o sistema nunca apaga, apenas adiciona o ajuste com responsável, data e motivo, garantindo rastreabilidade total.",
  },
  {
    id: "banco",
    icon: Wallet,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    titulo: "Passo 5 — Banco de Horas",
    subtitulo: "Crédito, débito e compensação",
    descricao:
      "O sistema calcula automaticamente o saldo do banco de horas a cada marcação encerrada, comparando o realizado com o esperado da escala. Você acompanha o saldo individual e coletivo na aba Banco Horas.",
    acoes: [
      "Acesse a aba **Banco Horas**",
      "Visualize o **saldo atual** por colaborador",
      "Filtre por **período, departamento ou status** (positivo/negativo)",
      "Lance **compensações manuais** quando houver folga acordada",
      "Exporte o **extrato individual** para o colaborador",
    ],
    dica: "O saldo respeita o limite legal (até 6 meses para acordo individual, 1 ano para acordo coletivo). O sistema alerta quando o saldo se aproxima do vencimento.",
  },
  {
    id: "fechamento",
    icon: Lock,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    titulo: "Passo 6 — Fechamento Mensal",
    subtitulo: "Travar o mês para integrar à folha",
    descricao:
      "Ao final do período, o gestor revisa pendências (ajustes, faltas sem justificativa, marcações inconsistentes) e fecha o mês. Após o fechamento, nenhuma alteração pode ser feita sem reabertura formal — garantindo a integridade dos dados que vão para a folha.",
    acoes: [
      "Acesse a aba **Fechamento**",
      "Resolva todas as **pendências sinalizadas** (ajustes, faltas)",
      "Confira o **resumo de horas, extras e adicional noturno**",
      "Clique em **Fechar período** — o sistema bloqueia edições",
      "Os dados ficam disponíveis na aba **Folha** para integração",
    ],
    dica: "Faça o fechamento sempre na mesma data do mês (ex.: dia 25 → 25). Isso facilita auditoria e mantém o ritmo da folha de pagamento.",
  },
  {
    id: "alertas",
    icon: Bell,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    titulo: "Passo 7 — Acompanhe os Alertas",
    subtitulo: "Sinais antes que virem problema",
    descricao:
      "A aba Alertas concentra notificações automáticas: atrasos recorrentes, faltas não justificadas, horas extras acima do limite, intervalos não cumpridos e marcações fora do raio. Cada alerta pode virar um Plano de Ação 5W2H.",
    acoes: [
      "Acesse a aba **Alertas**",
      "Filtre por **tipo, prioridade ou colaborador**",
      "Clique em **Criar Ação** para gerar um plano 5W2H vinculado",
      "Marque como **lido ou resolvido** após tratativa",
      "Acompanhe o histórico para identificar **padrões** (ex.: setor com atrasos recorrentes)",
    ],
    dica: "Alertas não tratados impactam o Escore de Maturidade do dashboard. Resolva sempre os de prioridade Alta primeiro — eles geralmente têm impacto legal direto.",
  },
  {
    id: "links",
    icon: Link2,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
    titulo: "Passo 8 — Links Externos (REP-P)",
    subtitulo: "Marcação remota via WhatsApp/web",
    descricao:
      "Para colaboradores em campo, home office ou sem acesso ao sistema interno, gere um link REP-P. O colaborador acessa pelo celular, valida a identidade por OTP via WhatsApp e registra o ponto com selfie e GPS.",
    acoes: [
      "Acesse a aba **Links**",
      "Gere um **link individual** ou por equipe",
      "Compartilhe via **WhatsApp, e-mail ou QR Code**",
      "O colaborador valida com **código OTP enviado por WhatsApp**",
      "A marcação é registrada com **mesmo nível de auditoria** do REP-C",
    ],
    dica: "O link tem validade configurável e fica vinculado ao colaborador. Se houver tentativa de uso fora do raio permitido, o sistema bloqueia e gera alerta automático.",
  },
  {
    id: "repc",
    icon: HardDrive,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    titulo: "Passo 9 — REP-C, CCT e Folha",
    subtitulo: "Conformidade e integração",
    descricao:
      "As abas REP-C, CCT, Folha e Relatórios fecham o ciclo: garantem conformidade técnica (Portaria 671), aplicam regras da Convenção Coletiva, exportam dados para a folha de pagamento e geram relatórios auditáveis (AFD/AEJ).",
    acoes: [
      "**REP-C**: armazena os arquivos AFD/AEJ exigidos pela Portaria 671",
      "**CCT**: anexe a Convenção Coletiva vigente para aplicar regras específicas",
      "**Folha**: exporte os dados consolidados para o módulo Financeiro",
      "**Relatórios**: gere espelhos de ponto, extratos e relatórios fiscais",
      "Tudo é **rastreável e auditável** — pronto para fiscalização",
    ],
    dica: "Mantenha o arquivo AFD sempre exportado e arquivado mensalmente. Em caso de fiscalização do MTE, ele é o documento oficial — exigido pela Portaria 671/2021.",
  },
];

export function GuiaRapidoPonto({ open, onOpenChange }: GuiaRapidoPontoProps) {
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
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b bg-background">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base text-foreground">Guia do Controle de Ponto</h2>
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
        <div className="h-1 bg-muted">
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
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
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

        {/* Footer */}
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
            <Button
              size="sm"
              onClick={() => irPara(passo + 1)}
              className="gap-2"
            >
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleClose}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4" />
              Concluir
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
