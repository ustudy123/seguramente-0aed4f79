import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, HardHat, Plus, Package, Users, AlertTriangle, Shield,
  BarChart3, RefreshCw, FileText, ChevronRight, ChevronLeft, X,
  CheckCircle2, Circle, Lightbulb, ShieldCheck, Warehouse, ArrowDownCircle,
  Wrench, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ManualEpi } from "./ManualEpi";

interface GuiaRapidoEpiProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PASSOS = [
  {
    id: "overview",
    icon: HardHat,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    titulo: "O que é esse módulo?",
    subtitulo: "Visão geral — para quem é e o que resolve",
    descricao:
      "O módulo de Gestão de EPIs do Seguramente permite controlar todo o ciclo de vida dos Equipamentos de Proteção Individual: cadastro, estoque, entrega com assinatura digital, devolução, alertas automáticos e auditoria com IA. Tudo em conformidade com a NR-06.",
    destaques: [
      { icon: ShieldCheck, label: "Conformidade NR-06" },
      { icon: Users, label: "Para: RH, SST e Gestores" },
      { icon: FileText, label: "Ficha de EPI digital" },
      { icon: AlertTriangle, label: "Alertas de CA e vencimento" },
    ],
    dica: "Você não precisa controlar planilhas manualmente. O sistema rastreia cada EPI do recebimento até o descarte, com histórico auditável e alertas automáticos.",
  },
  {
    id: "cadastro",
    icon: Plus,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    titulo: "Passo 1 — Cadastre os Tipos de EPI",
    subtitulo: "A base de tudo",
    descricao:
      "Antes de movimentar estoque ou registrar entregas, cadastre os tipos de EPI da sua empresa. Cada tipo contém: nome, categoria, número do CA (Certificado de Aprovação), marca, fabricante, validade e periodicidade de troca.",
    acoes: [
      "Clique em **+ Categoria** para criar categorias personalizadas ou use as padrão",
      "Clique em **+ Novo EPI** para cadastrar um tipo de equipamento",
      "Informe o **Número e validade do CA** — obrigatório pela NR-06",
      "Configure o **Estoque Mínimo** para alertas de reposição automáticos",
      "Defina a **Periodicidade de Troca (dias)** para alertas preventivos",
    ],
    dica: "O CA (Certificado de Aprovação) é emitido pelo Ministério do Trabalho e valida o EPI para uso legal no Brasil. Um EPI com CA vencido não pode ser entregue ao colaborador.",
  },
  {
    id: "estoque",
    icon: ArrowDownCircle,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    titulo: "Passo 2 — Registre Entradas no Estoque",
    subtitulo: "Controle de recebimento",
    descricao:
      "Na aba 'Movimentar', registre cada lote de EPI recebido. O sistema credita o saldo no local especificado (empresa/almoxarifado) e mantém o histórico rastreável com nota fiscal e fornecedor.",
    acoes: [
      "Acesse a aba **Movimentar** no menu do módulo",
      "Selecione o tipo de EPI e informe a **quantidade recebida**",
      "Escolha o **local de destino** (empresa/obra + almoxarifado)",
      "Informe a **nota fiscal** e o fornecedor para rastreabilidade",
      "O saldo é creditado automaticamente no local selecionado",
    ],
    dica: "O sistema suporta múltiplos locais de estoque. Você pode ter saldos separados por estabelecimento e almoxarifado — útil para empresas com obras ou filiais.",
  },
  {
    id: "entrega",
    icon: Users,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    titulo: "Passo 3 — Registre a Entrega ao Colaborador",
    subtitulo: "O evento central do módulo",
    descricao:
      "Clique em 'Registrar Entrega' para iniciar o assistente. Em poucos passos: selecione o colaborador, o EPI, a quantidade e o motivo. O colaborador assina digitalmente na tela. O saldo é debitado automaticamente.",
    acoes: [
      "Clique no botão **Registrar Entrega** no topo da página",
      "Selecione o **colaborador** que receberá o EPI",
      "Escolha o **tipo de EPI** e a quantidade",
      "Informe o **motivo** (admissão, substituição, treinamento etc.)",
      "O colaborador **assina digitalmente** — registro tem validade legal",
    ],
    dica: "A assinatura digital substitui a Ficha de EPI em papel, com validade legal. O sistema gera comprovante imprimível a qualquer momento com todos os dados da entrega.",
  },
  {
    id: "devolucao",
    icon: RefreshCw,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    titulo: "Passo 4 — Gerencie Devoluções",
    subtitulo: "Destino correto para cada EPI",
    descricao:
      "Na aba Entregas, localize a entrega ativa e registre a devolução. Informe o destino: Estoque (EPI em bom estado), Manutenção ou Descarte. Cada destino tem impacto diferente no saldo e status do EPI.",
    acoes: [
      "Acesse a aba **Entregas** e localize a entrega ativa",
      "Clique em **Registrar Devolução**",
      "Escolha o destino: **Estoque** (credita saldo), **Manutenção** ou **Descarte**",
      "Registre uma **observação** — especialmente em casos de dano ou perda",
      "O status do EPI é atualizado automaticamente",
    ],
    dica: "EPIs devolvidos para Descarte ou Manutenção não retornam ao estoque automaticamente. Para baixar definitivamente um EPI danificado, use a opção Descarte com o motivo correto.",
  },
  {
    id: "alertas",
    icon: AlertTriangle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    titulo: "Passo 5 — Monitore os Alertas",
    subtitulo: "Prevenção e conformidade contínua",
    descricao:
      "A aba Alertas consolida automaticamente todas as situações que exigem atenção: EPIs com CA vencido, estoque abaixo do mínimo, EPIs próximos do vencimento e colaboradores com EPIs em atraso de troca.",
    acoes: [
      "Acesse a aba **Alertas** para ver todas as pendências",
      "**CA Vencido** — ação urgente: EPI não pode ser entregue legalmente",
      "**Estoque Mínimo** — solicite reposição antes que acabe",
      "**Vencimento próximo** — programe substituição preventiva",
      "Clique em cada alerta para ver os detalhes e tomar a ação",
    ],
    dica: "Configure o estoque mínimo de cada tipo de EPI para receber alertas com antecedência. Isso evita desabastecimento e notificações de autuação por falta de EPI.",
  },
  {
    id: "saldo-local",
    icon: Warehouse,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    titulo: "Passo 6 — Visualize o Saldo por Local",
    subtitulo: "Distribuição do estoque em tempo real",
    descricao:
      "A aba 'Por Local' exibe um dashboard com o saldo atual de cada tipo de EPI por empresa/obra e almoxarifado. Identifique rapidamente locais com estoque crítico e planeje transferências.",
    acoes: [
      "Acesse a aba **Por Local** para ver o dashboard de saldos",
      "Locais com estoque **abaixo do mínimo** aparecem em destaque",
      "Use o filtro por **tipo de EPI** ou por **local** para análises específicas",
      "Planeje **transferências** entre locais conforme necessidade",
      "O saldo é atualizado em **tempo real** a cada movimentação",
    ],
    dica: "Mantenha um nível de segurança acima do mínimo em cada local de trabalho. Isso garante que os colaboradores em campo sempre tenham acesso aos EPIs necessários.",
  },
  {
    id: "matriz",
    icon: Shield,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    titulo: "Passo 7 — Configure a Matriz de Proteção",
    subtitulo: "EPIs obrigatórios por função",
    descricao:
      "A Matriz define quais EPIs são obrigatórios para cada cargo/função da empresa, conforme exige a NR-06. O sistema cruza essa configuração com as entregas ativas para identificar colaboradores sem os EPIs necessários.",
    acoes: [
      "Acesse a aba **Matriz** para configurar os EPIs por função",
      "Adicione linhas: **Função × EPI × Quantidade mínima**",
      "O sistema identifica automaticamente **lacunas de conformidade**",
      "O assistente de entrega usa a matriz para **sugerir EPIs** corretos",
      "Exporte o relatório de conformidade da matriz",
    ],
    dica: "A Matriz de Proteção é exigida pela NR-06 e pelo PPRA/PGR. Configure-a para todas as funções que operam com riscos que exigem EPI — isso é a base do controle legal.",
  },
  {
    id: "auditoria",
    icon: BarChart3,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    titulo: "Passo 8 — Auditoria e Histórico",
    subtitulo: "Rastreabilidade total e IA",
    descricao:
      "A aba Auditoria usa inteligência artificial para analisar os dados e identificar inconsistências e oportunidades de melhoria. O Histórico de Movimentações registra cada operação com data, usuário e detalhes completos.",
    acoes: [
      "Acesse a aba **Auditoria** para o relatório IA de conformidade",
      "Use o **Histórico** para exportar todas as movimentações",
      "O histórico inclui: entradas, saídas, entregas e devoluções",
      "Filtre por período, tipo de EPI ou colaborador",
      "**Exporte** os dados para auditorias externas e fiscalizações",
    ],
    dica: "Realize uma auditoria mensal para identificar EPIs com CA vencido ou colaboradores sem equipamentos antes de uma fiscalização. O relatório IA faz essa análise automaticamente.",
  },
  {
    id: "recursos",
    icon: FileText,
    color: "text-teal-600",
    bgColor: "bg-teal-50",
    titulo: "Documentos e Recursos",
    subtitulo: "Tudo que o sistema gera para você",
    descricao:
      "O Seguramente gera automaticamente todos os registros necessários para conformidade com a NR-06. Baixe o Manual Completo em PDF para ter um guia de referência offline.",
    acoes: [
      "**Ficha de EPI digital** — assinada eletronicamente, substituição legal ao papel",
      "**Comprovante de entrega** — imprimível com dados completos da entrega",
      "**Histórico de movimentações** — relatório exportável para auditorias",
      "**Relatório de conformidade** — gerado pela IA de Auditoria",
      "**Manual do módulo** — baixe abaixo em PDF para referência offline",
    ],
    dica: "Todos os registros têm timestamp, usuário responsável e hash de integridade. Isso garante validade jurídica e rastreabilidade em eventuais processos trabalhistas.",
  },
];

export function GuiaRapidoEpi({ open, onOpenChange }: GuiaRapidoEpiProps) {
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
            <div className="p-2 rounded-lg bg-emerald-100">
              <BookOpen className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-bold text-base text-foreground">Guia do Módulo de EPIs</h2>
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
            className="h-full bg-emerald-600"
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
                      ? "bg-emerald-50 text-emerald-700 font-medium border-r-2 border-emerald-600"
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
                        <Ic className="h-4 w-4 text-emerald-600 shrink-0" />
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
                          <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center mt-0.5">
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
                      Quer um guia de referência para consultar offline?
                    </p>
                    <ManualEpi />
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
                          ? "bg-emerald-600 w-4"
                          : idx < passo
                          ? "bg-emerald-300"
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
            <Button size="sm" onClick={() => irPara(passo + 1)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleClose} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Concluir
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
