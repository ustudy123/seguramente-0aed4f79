import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Shield,
  FileText,
  AlertTriangle,
  ClipboardCheck,
  BarChart3,
  Search,
  Folder,
  Link2,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  Circle,
  Lightbulb,
  Zap,
  DollarSign,
  BrainCircuit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ManualIncidentes } from "@/components/incidentes/ManualIncidentes";

interface GuiaRapidoIncidentesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PASSOS = [
  {
    id: "overview",
    icon: Shield,
    color: "text-primary",
    bgColor: "bg-primary/10",
    titulo: "Bem-vindo ao Módulo de Incidentes & Acidentes",
    subtitulo: "Registro, investigação e aprendizado organizacional",
    descricao:
      "Este módulo centraliza todos os eventos de segurança da empresa — de Cartões de Desvio (base preventiva) a acidentes fatais. A hierarquia técnica do sistema segue a Pirâmide de Bird ampliada: Desvio → Incidente → Acidente. Cada desvio registrado é uma oportunidade de evitar o próximo acidente. O sistema guia o registro, aciona obrigações legais (CAT, e-Social), simula impacto no FAP/RAT e integra dados com Ergonomia, Documentos e Plano de Ação.",
    destaques: [
      { icon: Zap,           label: "Cartões de Desvio (Novo)" },
      { icon: FileText,      label: "Registrar Incidente/Acidente" },
      { icon: AlertTriangle, label: "Investigar a Causa" },
      { icon: ClipboardCheck,label: "Emitir CAT (quando aplicável)" },
      { icon: DollarSign,    label: "Simulador FAP/RAT" },
      { icon: BrainCircuit,  label: "Análise Preditiva" },
      { icon: TrendingUp,    label: "Pirâmide de Bird" },
    ],
  },
  {
    id: "desvios",
    icon: Zap,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    titulo: "Cartões de Desvio — A Base Preventiva",
    subtitulo: "Registre antes do acidente acontecer",
    descricao:
      "Cartões de Desvio são micro-registros proativos de condições inseguras, atos inseguros ou desvios de processo — captados ANTES de um incidente ou acidente ocorrer. Na hierarquia do sistema: Desvio → Incidente → Acidente. Cada desvio registrado alimenta a base da Pirâmide de Bird e impacta diretamente a redução do FAP.",
    acoes: [
      "Acesse a aba **Desvios** na tela de Incidentes & Acidentes",
      "Clique em **Registrar Desvio** e escolha o tipo: **Condição Insegura**, **Ato Inseguro** ou **Desvio de Processo**",
      "Informe o **local/setor**, a **data** e o **potencial de risco** (Baixo, Médio, Alto ou Crítico)",
      "Descreva o desvio com detalhes — adicione **foto ou evidência** se disponível",
      "Selecione a **categoria técnica**: Ergonomia, EPI, Máquina, Organização do Trabalho ou Outro",
      "Desvios com risco **Alto ou Crítico** são automaticamente escalados e podem virar um Incidente",
      "Desvios resolvidos reduzem o **score de risco preditivo** do setor",
    ],
    dica: "Impacto no FAP: cada acidente gerado a partir de um desvio não tratado contribui para o FAP (Fator Acidentário de Prevenção). Registrar e tratar desvios é a ação mais eficaz para reduzir sinistralidade e, consequentemente, o FAP e o custo do RAT da empresa.",
  },
  {
    id: "registro",
    icon: FileText,
    color: "text-red-600",
    bgColor: "bg-red-50",
    titulo: "Registrar Incidente ou Acidente",
    subtitulo: "Incidente vs Acidente — como classificar corretamente",
    descricao:
      "O primeiro passo é classificar o evento corretamente. Incidente: evento sem lesão (quase-acidente, near miss). Acidente: evento com lesão, doença ou morte. Essa distinção define quais campos adicionais aparecem e quais obrigações legais são ativadas.",
    acoes: [
      "Clique em **Registrar Evento** no cabeçalho da tela",
      "Selecione o **Tipo**: Incidente (sem lesão) ou Acidente (com lesão/afastamento)",
      "Preencha **data, hora, estabelecimento/obra, setor, local** e **turno** do evento",
      "Informe o **colaborador envolvido** (nome e função) e outros envolvidos, se houver",
      "Selecione a **Categoria Principal** (ex: queda, corte, exposição química) e a **Origem Predominante** (comportamental, organizacional, técnica ou ambiental)",
      "Descreva detalhadamente o ocorrido e a percepção inicial de causa — seja específico",
      "O sistema gera automaticamente um **código único** (INC-AAAA-001 ou ACD-AAAA-001) para rastreabilidade",
    ],
    dica: "Quanto mais detalhada a descrição inicial, mais fácil a investigação de causa raiz. Inclua: o que estava fazendo, onde exatamente, quais equipamentos estavam envolvidos e se havia alguma condição especial (piso molhado, correria, turno noturno).",
  },
  {
    id: "acidente",
    icon: AlertTriangle,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    titulo: "Campos de Acidente e CAT",
    subtitulo: "Obrigações legais — Lei 8.213/91 e e-Social",
    descricao:
      "Quando o tipo for Acidente, campos adicionais são exibidos para caracterização legal. A CAT (Comunicação de Acidente do Trabalho) deve ser emitida no 1º dia útil após o acidente — o não cumprimento sujeita a empresa a multa. O sistema alerta quando há acidentes sem CAT no painel de estatísticas.",
    acoes: [
      "Preencha a **Gravidade da Lesão**: sem lesão, leve, moderada ou grave",
      "Informe o **Afastamento**: sem afastamento, até 15 dias ou mais de 15 dias",
      "Selecione o **Tipo de Atendimento**: não necessário, ambulatorial ou hospitalar",
      "Para acidentes fatais, marque **Óbito** — isso ativa obrigações legais imediatas",
      "Nos campos de **CAT**: informe se foi emitida, o número, a data de emissão e o tipo (inicial, reabertura ou comunicação de óbito)",
      "Você pode **anexar o PDF da CAT** diretamente no registro para centralizar a documentação",
      "Os dados preenchidos aqui são os mesmos exigidos pelo **e-Social S-2210** — facilita a transmissão ao governo",
    ],
    dica: "Prazo legal da CAT: Art. 22 da Lei 8.213/91 — o empregador tem até o 1º dia útil após o acidente para emitir a CAT. Em caso de óbito, a comunicação é imediata. O painel de estatísticas exibe o card 'CAT Pendentes' para monitorar acidentes sem CAT emitida.",
  },
  {
    id: "fatores",
    icon: Link2,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    titulo: "Fatores Ergonômicos e Psicossociais",
    subtitulo: "Como o evento alimenta o GRO e o módulo de Ergonomia",
    descricao:
      "O campo Fatores Ergonômicos é um diferencial do sistema: ao marcar os fatores que contribuíram para o evento, os dados são cruzados automaticamente com o Inventário GRO e as AEPs. Quando um fator aparece com frequência, o sistema recomenda a revisão ergonômica do posto.",
    acoes: [
      "No formulário de registro, expanda a seção **Fatores Ergonômicos**",
      "Selecione um ou mais fatores que podem ter contribuído (ex: pressão por meta, jornada longa, falta de pausa, layout inadequado)",
      "Os fatores selecionados são enviados automaticamente ao **Inventário GRO** do módulo de Ergonomia",
      "Indicadores de **estresse/exaustão emocional** são cruzados com dados psicossociais para identificar grupos de risco",
      "Quando o mesmo fator aparece em 3 ou mais eventos, o sistema gera um **alerta de padrão recorrente**",
      "Use esses dados para **justificar intervenções ergonômicas** com evidências concretas: 'X eventos com fator Y neste posto'",
    ],
    dica: "Esta integração permite que o gestor de SST use incidentes como evidência para justificar melhorias ergonômicas. Em vez de 'achamos que há risco', você tem dados: '4 incidentes nos últimos 6 meses com fator pressão por meta — isso justifica a revisão da organização do trabalho (NR-17 §17.6)'.",
  },
  {
    id: "investigacao",
    icon: Folder,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    titulo: "Investigação e Pasta Automática",
    subtitulo: "Documentação centralizada para acidentes graves",
    descricao:
      "Para acidentes graves (com lesão, afastamento ou óbito), o sistema cria automaticamente uma pasta de investigação no módulo de Documentos. A pasta é nomeada com o código do evento e a data, e contém 5 subpastas padrão para organizar toda a documentação.",
    acoes: [
      "Ao registrar um **acidente grave**, o sistema cria automaticamente a pasta em **Documentos → Investigação de Incidentes**",
      "A pasta contém 5 subpastas: **Relato do Ocorrido**, **Análise de Causa Raiz**, **Plano de Ação**, **Evidências e Fotos** e **CAT**",
      "Use a **aba de Anexos** na tela de detalhe do evento para anexar arquivos diretamente ao registro",
      "Acesse o detalhe do evento clicando nele na lista — lá você encontra todas as informações, anexos e ações vinculadas",
      "O **Relato do Ocorrido** deve ser feito pelo supervisor direto nas primeiras 24 horas",
      "A **Análise de Causa Raiz** deve envolver o trabalhador, o supervisor e o técnico de SST (Árvore de Causas, 5 Porquês ou Ishikawa)",
    ],
    dica: "Boa prática: os 3 documentos essenciais para qualquer defesa trabalhista são (1) Relato do Ocorrido feito nas primeiras 24h, (2) Análise de Causa Raiz com participação do trabalhador e (3) Plano de Ação com evidências de conclusão. O sistema cria as subpastas para você — preencha-as.",
  },
  {
    id: "acao",
    icon: ClipboardCheck,
    color: "text-green-600",
    bgColor: "bg-green-50",
    titulo: "Ação Vinculada e Ciclo de Status",
    subtitulo: "Fechar o ciclo do evento com ações concretas",
    descricao:
      "Cada evento deve ter uma ação corretiva (acidente) ou preventiva (incidente) vinculada. O sistema cria a ação automaticamente com responsável e prazo. O status do evento avança conforme o ciclo de gestão.",
    acoes: [
      "No detalhe do evento, clique em **Criar Ação Vinculada**",
      "O sistema preenche automaticamente: título, descrição, tipo (corretiva/preventiva), responsável e prazo de 30 dias",
      "A ação aparece no **Plano de Ação Global** e fica vinculada ao evento",
      "O status do evento avança automaticamente para **Ações em Andamento**",
      "Atualize o **status do evento** conforme o ciclo: **Em Aberto → Em Análise → Ações em Andamento → Concluído**",
      "Eventos ficam **Concluídos** quando todas as ações vinculadas estão concluídas e há evidências anexadas",
    ],
    dica: "Gestão pelo status: filtre os eventos por 'Em Aberto' regularmente. O objetivo é que todos os eventos estejam em 'Ações em Andamento' em até 5 dias úteis após o registro. Eventos 'Em Aberto' por mais de 15 dias indicam falha no processo de investigação.",
  },
  {
    id: "fap",
    icon: DollarSign,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    titulo: "Simulador FAP / RAT",
    subtitulo: "Projete o impacto financeiro dos acidentes",
    descricao:
      "O FAP (Fator Acidentário de Prevenção) é calculado pelo INSS e pode aumentar ou diminuir em até 100% a alíquota do RAT da empresa — impactando diretamente a folha de pagamento. O simulador do sistema permite projetar o impacto antes que aconteça.",
    acoes: [
      "Acesse a aba **Análise** → seção **Simulador FAP/RAT**",
      "O sistema exibe o **RAT atual** (1%, 2% ou 3%) e o **score de risco estimado**",
      "Veja a projeção de **B91 e NTEP**: se os acidentes registrados têm nexo técnico com o FAP",
      "Use a ferramenta para simular: 'se eu reduzir X acidentes, qual seria meu FAP estimado?'",
      "Exporte o relatório de impacto para apresentar ao **RH, Financeiro ou Diretoria**",
      "A redução de desvios e incidentes é a estratégia mais efetiva para **melhorar o FAP**",
    ],
    dica: "Cada acidente com afastamento > 15 dias pode contribuir para a classificação B91 no INSS (benefício acidentário), impactando o FAP por até 3 anos. Desvios tratados antes de virarem acidentes são a economia mais inteligente em SST.",
  },
  {
    id: "preditivo",
    icon: BrainCircuit,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    titulo: "Análise Preditiva e Score de Risco",
    subtitulo: "Antecipe riscos antes que se tornem acidentes",
    descricao:
      "O sistema analisa padrões em desvios, incidentes e fatores ergonômicos para calcular um score de risco por setor/turno. Quando o padrão histórico indica alto potencial de acidente, alertas proativos são gerados.",
    acoes: [
      "Acesse a aba **Análise** → seção **Score de Risco por Setor**",
      "Setores com **score alto** (laranja/vermelho) requerem ação preventiva imediata",
      "Verifique os **alertas de padrão**: 'Alto volume de desvios de EPI no turno 3 — risco de acidente iminente'",
      "Cruze os dados com as campanhas **Psicossociais** para identificar grupos sob estresse elevado",
      "O sistema exibe a **taxa de conversão**: % de desvios que evoluíram para incidentes ou acidentes",
      "Use as **recomendações automáticas** para embasar ações no PGR e nas reuniões de CIPA",
    ],
    dica: "Diferencial competitivo: empresas que capturam desvios de forma estruturada e cruzam com dados psicossociais e ergonômicos reduzem em média 40-60% os acidentes com afastamento em 12 meses. O sistema transforma dados operacionais em inteligência de prevenção.",
  },
  {
    id: "dashboard",
    icon: BarChart3,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    titulo: "Dashboard e KPIs de Segurança",
    subtitulo: "Indicadores em tempo real para gestão proativa",
    descricao:
      "A aba Análise exibe gráficos e indicadores calculados automaticamente. Use-os para identificar padrões, priorizar intervenções, justificar investimentos e demonstrar a evolução do programa de segurança.",
    acoes: [
      "Acesse a aba **Análise** para ver os gráficos do módulo",
      "Visualize a **distribuição por tipo** (desvios, incidentes e acidentes) e por **status**",
      "Analise a **evolução temporal** (eventos por mês) para identificar tendências e sazonalidades",
      "Verifique a **distribuição por turno** — concentração no 3º turno pode indicar relação com fadiga",
      "Acompanhe os **novos KPIs**: % desvios tratados, tempo médio de resposta ao desvio, taxa de conversão Desvio→Acidente",
      "Use os indicadores do **painel de estatísticas** (topo da tela) em reuniões de CIPA e relatórios de SST",
    ],
    dica: "KPIs para relatório mensal: (a) total de desvios, incidentes e acidentes; (b) Taxa de Frequência com Afastamento (TFA = nº acidentes × 1.000.000 ÷ horas trabalhadas); (c) % de desvios tratados no prazo; (d) score de risco por setor. O sistema fornece todos os dados automaticamente.",
  },
  {
    id: "piramide",
    icon: TrendingUp,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    titulo: "Pirâmide de Bird — Hierarquia Completa",
    subtitulo: "Desvio → Incidente → Acidente: a pirâmide ampliada",
    descricao:
      "A pirâmide do sistema agora inclui o nível base de Desvios, completando a hierarquia preventiva. Uma base larga de desvios registrados e tratados, com topo mínimo de acidentes graves, indica maturidade máxima de segurança organizacional.",
    acoes: [
      "Acesse a aba **Pirâmide** para visualizar a distribuição completa em 5 níveis",
      "Nível base (azul): **Desvios** — condições inseguras capturadas antes do evento",
      "Nível 2 (verde): **Quase-Acidentes / Near Miss** — eventos sem consequência",
      "Nível 3 (amarelo): **Incidentes** — eventos com dano material ou interrupção",
      "Nível 4 (laranja): **Acidentes Leves** — com lesão sem afastamento",
      "Topo (vermelho): **Acidentes Graves / Fatais** — com afastamento ou óbito",
    ],
    dica: "Cultura de reporte: o maior obstáculo ao registro de desvios não é a falta de sistema — é o medo de punição. Líderes que respondem ao reporte com 'boa observação, vamos resolver' criam culturas de segurança muito mais efetivas. O sistema registra; a liderança cria o ambiente seguro.",
  },
  {
    id: "filtros",
    icon: Search,
    color: "text-slate-600",
    bgColor: "bg-slate-100",
    titulo: "Filtros, Busca e Boas Práticas",
    subtitulo: "Como encontrar eventos e preparar relatórios",
    descricao:
      "A aba Ocorrências inclui filtros avançados para localizar eventos rapidamente. Combine filtros para preparar relatórios específicos para CIPA, SESMT, auditorias externas ou o PGR.",
    acoes: [
      "Use a **busca textual** para localizar por código, nome do colaborador ou setor",
      "Combine **Tipo + Status + Turno + Estabelecimento/Obra + Período** para relatórios específicos",
      "Para o **relatório anual da CIPA**: filtre Tipo=Acidente + Período=01/01 a 31/12 do ano",
      "Para o **PGR/GRO**: inclua os desvios como evidência do programa de identificação contínua de riscos (NR-01)",
      "Para **auditorias ISO 45001**: filtre por status 'Concluído' e verifique se todos têm ações com evidências",
      "Para o **e-Social**: filtre Tipo=Acidente e verifique se todos têm o campo CAT preenchido",
    ],
    dica: "Quer um guia completo para consultar offline? Clique em 'Baixar Manual PDF' abaixo — o manual cobre todos os campos, prazos legais, integrações, Cartões de Desvio, FAP/RAT e boas práticas em um documento técnico profissional.",
  },
];

export function GuiaRapidoIncidentes({ open, onOpenChange }: GuiaRapidoIncidentesProps) {
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
            <div className="p-2 rounded-lg bg-destructive/10">
              <BookOpen className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h2 className="font-bold text-base text-foreground">Guia Rápido — Incidentes & Acidentes</h2>
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
            className="h-full bg-destructive"
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
                      ? "bg-destructive/10 text-destructive font-medium border-r-2 border-destructive"
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
                        <Ic className="h-4 w-4 text-destructive shrink-0" />
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
                          <span className="shrink-0 w-5 h-5 rounded-full bg-destructive/10 text-destructive text-xs font-bold flex items-center justify-center mt-0.5">
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
                    <ManualIncidentes />
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
                        i === passo ? "w-6 bg-destructive" : "w-1.5 bg-muted-foreground/30"
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
            <Button size="sm" onClick={() => onOpenChange(false)} className="gap-2 bg-destructive hover:bg-destructive/90">
              <CheckCircle2 className="h-4 w-4" />
              Concluir
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
