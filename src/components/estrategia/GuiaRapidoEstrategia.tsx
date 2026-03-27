import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Compass, Target, Waves, Heart, Users, Settings2,
  ChevronRight, ChevronLeft, X, CheckCircle2, Circle, Lightbulb,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ManualEstrategia } from "./ManualEstrategia";

interface GuiaRapidoEstrategiaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PASSOS = [
  {
    id: "overview",
    icon: Compass,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    titulo: "O que e esse modulo?",
    subtitulo: "Visao geral — planejamento e governanca",
    descricao:
      "O modulo de Estrategia & Governanca do Seguramente fornece ferramentas para diagnostico estrategico (SWOT), inovacao (Oceano Azul), gestao de cultura organizacional e estrutura hierarquica (Organograma). Tudo com escopo configuravel por empresa ou grupo economico.",
    destaques: [
      { icon: Target, label: "Analise SWOT com acoes vinculadas" },
      { icon: Waves, label: "Estrategia Oceano Azul" },
      { icon: Heart, label: "Cultura organizacional mapeada" },
      { icon: Users, label: "Organograma automatico" },
    ],
    dica: "Este modulo transforma planejamento em acao. Cada analise estrategica pode gerar acoes concretas com responsavel, prazo e acompanhamento.",
  },
  {
    id: "swot",
    icon: Target,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    titulo: "Passo 1 — Analise SWOT",
    subtitulo: "Diagnostico estrategico",
    descricao:
      "A analise SWOT mapeia Forcas, Fraquezas, Oportunidades e Ameacas. Cadastre itens em cada quadrante com prioridade e descricao para construir o diagnostico estrategico da empresa.",
    acoes: [
      "Acesse a aba **SWOT** no modulo",
      "Clique em **+ Novo Item** no quadrante desejado",
      "Preencha **titulo, descricao e prioridade**",
      "Vincule **acoes estrategicas** a cada item",
      "Revise e atualize a SWOT **trimestralmente**",
    ],
    dica: "A SWOT pode ser aplicada por empresa ou grupo economico. Use o seletor de escopo para alternar entre visoes.",
  },
  {
    id: "oceano",
    icon: Waves,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
    titulo: "Passo 2 — Oceano Azul",
    subtitulo: "Inovacao e diferenciacao",
    descricao:
      "O Oceano Azul organiza a estrategia em 4 acoes: Eliminar, Reduzir, Elevar e Criar. Cada item pode ter acoes vinculadas com responsavel e prazo para execucao.",
    acoes: [
      "Acesse a aba **Oceano Azul**",
      "Cadastre itens nos quadrantes: **Eliminar, Reduzir, Elevar, Criar**",
      "Para cada item, clique em **+ Acao** para vincular iniciativas",
      "Defina **responsavel, prazo e status** da acao",
      "Acompanhe o **progresso** de cada iniciativa",
    ],
    dica: "Foque em itens que os concorrentes consideram obvios. A inovacao real surge ao eliminar custos desnecessarios e criar valor unico.",
  },
  {
    id: "cultura",
    icon: Heart,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    titulo: "Passo 3 — Cultura Organizacional",
    subtitulo: "Valores e comportamentos",
    descricao:
      "Mapeie os pilares da cultura organizacional: missao, visao, valores, comportamentos esperados e rituais. Identifique gaps entre a cultura desejada e a praticada.",
    acoes: [
      "Acesse a aba **Cultura**",
      "Defina **missao, visao e valores** da organizacao",
      "Cadastre **comportamentos esperados** por valor",
      "Identifique **gaps culturais** e crie iniciativas",
      "Vincule acoes a **prazos e responsaveis**",
    ],
    dica: "A cultura organizacional impacta diretamente a seguranca do trabalho. Empresas com cultura forte de prevencao apresentam menos acidentes.",
  },
  {
    id: "organograma",
    icon: Users,
    color: "text-green-600",
    bgColor: "bg-green-50",
    titulo: "Passo 4 — Organograma",
    subtitulo: "Estrutura hierarquica e funcional",
    descricao:
      "Visualize e gerencie a estrutura da empresa. O sistema gera automaticamente a hierarquia baseada no 'Gestor Imediato' dos colaboradores. A opcao 'Limpar e Gerar' reconstroi vinculos orfaos.",
    acoes: [
      "Acesse a aba **Organograma**",
      "Clique em **Gerar Automaticamente** para criar a hierarquia",
      "O sistema usa o campo **Gestor Imediato** dos colaboradores",
      "Use **Limpar e Gerar** para corrigir vinculos orfaos",
      "A selecao de funcoes lista **todos os cargos do tenant**",
    ],
    dica: "Mantenha o organograma atualizado. Ele alimenta avaliacoes de desempenho, fluxos de aprovacao e identificacao de gestores em diversos modulos.",
  },
  {
    id: "escopo",
    icon: Settings2,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    titulo: "Passo 5 — Seletor de Escopo",
    subtitulo: "Empresa ou grupo economico",
    descricao:
      "O seletor de escopo permite alternar entre a visao de uma empresa individual e a visao consolidada do grupo economico. Todas as ferramentas respeitam o escopo selecionado.",
    acoes: [
      "Localize o **seletor de escopo** no topo da pagina",
      "Selecione **Empresa** para visao individual",
      "Selecione **Grupo** para visao consolidada",
      "Ao trocar empresa ativa, o escopo **reseta automaticamente**",
      "Use o escopo de grupo para **reunioes de diretoria**",
    ],
    dica: "O escopo se sincroniza reativamente com a empresa ativa. Se o grupo selecionado nao for valido para a nova empresa, ele reseta para 'Empresa'.",
  },
  {
    id: "recursos",
    icon: FileText,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    titulo: "Documentos e Recursos",
    subtitulo: "Material de referencia offline",
    descricao:
      "O Seguramente registra todas as analises estrategicas com historico e rastreabilidade. Baixe o Manual Completo em PDF para ter um guia de referencia offline.",
    acoes: [
      "**Analise SWOT** — diagnostico com acoes vinculadas",
      "**Oceano Azul** — inovacao com acompanhamento de iniciativas",
      "**Cultura** — mapeamento de valores e comportamentos",
      "**Organograma** — estrutura hierarquica exportavel",
      "**Manual do modulo** — baixe abaixo em PDF para referencia offline",
    ],
    dica: "Documente decisoes estrategicas e justificativas. Em auditorias e due diligences, a rastreabilidade demonstra maturidade de governanca.",
  },
];

export function GuiaRapidoEstrategia({ open, onOpenChange }: GuiaRapidoEstrategiaProps) {
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
              <h2 className="font-bold text-base text-foreground">Guia do Modulo Estrategia & Governanca</h2>
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
                    <ManualEstrategia />
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

        {/* Footer */}
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
