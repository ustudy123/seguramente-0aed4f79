import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Building2, Plus, Users, FileText, Shield, Clock,
  ClipboardCheck, BarChart3, ChevronRight, ChevronLeft, X,
  CheckCircle2, Circle, Lightbulb, AlertTriangle, GraduationCap,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ManualTerceiros } from "./ManualTerceiros";

interface GuiaRapidoTerceirosProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PASSOS = [
  {
    id: "overview",
    icon: Building2,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    titulo: "O que e esse modulo?",
    subtitulo: "Visao geral — para quem e e o que resolve",
    descricao:
      "O modulo de Terceiros & SST do YourEyes permite controlar todo o ciclo de compliance de prestadores de servico: cadastro, documentacao, treinamentos, permissoes de trabalho e monitoramento de vencimentos. Tudo em conformidade com as NRs aplicaveis.",
    destaques: [
      { icon: Shield, label: "Compliance NR-01 / NR-06 / NR-35" },
      { icon: Users, label: "Para: RH, SST e Gestores" },
      { icon: FileText, label: "Controle documental completo" },
      { icon: ClipboardCheck, label: "Permissoes de Trabalho digitais" },
    ],
    dica: "A empresa contratante e corresponsavel pela seguranca dos terceirizados (CLT Art. 455). Este modulo garante que toda a documentacao esteja em dia para comprovar diligencia.",
  },
  {
    id: "cadastro",
    icon: Plus,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    titulo: "Passo 1 — Cadastre o Terceiro",
    subtitulo: "Auto-preenchimento via CNPJ",
    descricao:
      "Clique em '+ Novo Terceiro' e informe o CNPJ. O sistema consulta automaticamente a BrasilAPI e preenche razao social, nome fantasia, CNAE e atividade principal. Complete os dados de contato, tipos de servico e tipo de acesso.",
    acoes: [
      "Clique em **+ Novo Terceiro** no topo da pagina",
      "Informe o **CNPJ** — os dados sao preenchidos automaticamente",
      "Selecione os **tipos de servico** prestados",
      "Defina o **tipo de acesso**: eventual, recorrente ou continuo",
      "Informe **unidades e setores** onde o terceiro atuara",
    ],
    dica: "O CNAE preenchido automaticamente ajuda a validar se o servico contratado e compativel com o objeto social da empresa terceirizada.",
  },
  {
    id: "trabalhadores",
    icon: Users,
    color: "text-green-600",
    bgColor: "bg-green-50",
    titulo: "Passo 2 — Cadastre os Trabalhadores",
    subtitulo: "Controle individual de cada prestador",
    descricao:
      "Dentro da ficha do terceiro, acesse a aba 'Trabalhadores' e cadastre cada profissional que atuara na sua empresa. Informe funcao, atividades, unidade/setor e atividades de risco.",
    acoes: [
      "Acesse a ficha do terceiro e clique na aba **Trabalhadores**",
      "Clique em **+ Trabalhador** para adicionar",
      "Informe **nome, CPF, funcao e atividades**",
      "Marque as **atividades de risco** (altura, confinado, eletricidade)",
      "O status e **recalculado automaticamente** conforme documentacao",
    ],
    dica: "Se qualquer documento ou treinamento obrigatorio do trabalhador estiver vencido, o status muda automaticamente para 'bloqueado'.",
  },
  {
    id: "documentos",
    icon: Upload,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    titulo: "Passo 3 — Gerencie Documentos",
    subtitulo: "Compliance documental completo",
    descricao:
      "Envie documentos da empresa (PGR, PCMSO, LTCAT, contrato, seguros) e documentos dos trabalhadores (ASO, certificados de NRs, fichas de EPI). O sistema monitora validades automaticamente.",
    acoes: [
      "Na ficha do terceiro, acesse a aba **Documentos**",
      "Envie **PGR, PCMSO, LTCAT, contrato e seguros** da empresa",
      "Para cada trabalhador, envie **ASO e certificados de NRs**",
      "Informe **data de emissao e validade** para controle automatico",
      "Documentos vencidos **bloqueiam o trabalhador** automaticamente",
    ],
    dica: "O painel de Vencimentos consolida todos os documentos proximos do vencimento em uma unica tela, facilitando a gestao proativa.",
  },
  {
    id: "treinamentos",
    icon: GraduationCap,
    color: "text-green-600",
    bgColor: "bg-green-50",
    titulo: "Passo 4 — Registre Treinamentos",
    subtitulo: "Capacitacao e habilitacao tecnica",
    descricao:
      "Registre treinamentos como NR-10, NR-12, NR-33, NR-35, Integracao SST e NR-06. Faca upload do certificado e informe a validade. Treinamentos vencidos impactam diretamente o status do trabalhador.",
    acoes: [
      "Acesse a aba **Treinamentos** do trabalhador",
      "Clique em **+ Treinamento** e selecione o tipo",
      "Informe **data, carga horaria e validade**",
      "Faca **upload do certificado** como comprovacao",
      "O sistema alerta quando o treinamento estiver **proximo de vencer**",
    ],
    dica: "Um eletricista com NR-10 vencida sera automaticamente bloqueado ate a regularizacao. Exija certificados com carga horaria minima exigida pela norma.",
  },
  {
    id: "permissoes",
    icon: ClipboardCheck,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    titulo: "Passo 5 — Emita Permissoes de Trabalho",
    subtitulo: "Autorizacao formal para atividades de risco",
    descricao:
      "Crie Permissoes de Trabalho (PT) digitais para cada atividade de risco. A PT contem terceiro, trabalhador, tipo de atividade, medidas de seguranca, EPIs e periodo de validade.",
    acoes: [
      "Acesse a aba **Permissoes de Trabalho** no modulo",
      "Clique em **+ Nova PT** para criar uma permissao",
      "Selecione o **terceiro e trabalhador** responsavel",
      "Defina **atividade, medidas de seguranca e EPIs**",
      "A PT deve ser **aprovada** antes do inicio do trabalho",
    ],
    dica: "A PT e obrigatoria para trabalho em altura (NR-35), espaco confinado (NR-33) e trabalho a quente. Nao permita inicio de atividade sem PT aprovada.",
  },
  {
    id: "vencimentos",
    icon: Clock,
    color: "text-red-600",
    bgColor: "bg-red-50",
    titulo: "Passo 6 — Monitore Vencimentos",
    subtitulo: "Visao consolidada de prazos criticos",
    descricao:
      "A aba 'Vencimentos' consolida todos os documentos e treinamentos com datas de validade proximas ou vencidas. Documentos vencidos em vermelho, proximos do vencimento em amarelo, validos em verde.",
    acoes: [
      "Acesse a aba **Vencimentos** no modulo",
      "Filtre por **status**: vencido, a vencer ou valido",
      "Cada item mostra o **terceiro, trabalhador e dias restantes**",
      "Aja proativamente nos itens **a vencer** antes do bloqueio",
      "Estabeleca uma **rotina semanal** de verificacao",
    ],
    dica: "Configure o monitoramento para alertar 30 dias antes do vencimento. Isso garante tempo habil para solicitar renovacoes ao terceiro.",
  },
  {
    id: "dashboard",
    icon: BarChart3,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    titulo: "Passo 7 — Dashboard de Compliance",
    subtitulo: "Indicadores gerenciais em tempo real",
    descricao:
      "O Dashboard apresenta indicadores consolidados: total de terceiros, trabalhadores por status, documentos por situacao e alertas pendentes. Use para reunioes de compliance e auditorias.",
    acoes: [
      "Acesse a aba **Dashboard** do modulo",
      "Visualize **terceiros ativos e trabalhadores por status**",
      "Identifique terceiros com **maior risco documental**",
      "Acompanhe a **taxa de conformidade** ao longo do tempo",
      "Use os dados para **reunioes e auditorias externas**",
    ],
    dica: "Mantenha uma meta de conformidade acima de 95%. Terceiros com conformidade abaixo de 80% devem ser notificados formalmente.",
  },
  {
    id: "recursos",
    icon: FileText,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    titulo: "Documentos e Recursos",
    subtitulo: "Tudo que o sistema gera para voce",
    descricao:
      "O YourEyes gera registros completos para compliance com terceiros. Baixe o Manual Completo em PDF para ter um guia de referencia offline.",
    acoes: [
      "**Ficha cadastral** — dados completos do terceiro e trabalhadores",
      "**Historico documental** — timeline de todos os envios e validades",
      "**Permissoes de Trabalho** — documento digital com aprovacao",
      "**Relatorio de conformidade** — indicadores de compliance",
      "**Manual do modulo** — baixe abaixo em PDF para referencia offline",
    ],
    dica: "Em caso de acidente com terceirizado, a documentacao completa (PT, ASO, treinamentos, EPI) e a principal prova de diligencia da empresa contratante.",
  },
];

export function GuiaRapidoTerceiros({ open, onOpenChange }: GuiaRapidoTerceirosProps) {
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
              <h2 className="font-bold text-base text-foreground">Guia do Modulo Terceiros & SST</h2>
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
                    <ManualTerceiros />
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
