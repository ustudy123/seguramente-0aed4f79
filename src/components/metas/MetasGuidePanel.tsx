import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Flag,
  GitBranch,
  Lock,
  MessageSquare,
  Shield,
  Target,
  Users,
} from "lucide-react";

const pilares = [
  {
    titulo: "Desdobramento estratégico",
    descricao: "Permite sair da meta corporativa e chegar até metas de unidade, setor e individuais mantendo alinhamento organizacional.",
    icon: GitBranch,
  },
  {
    titulo: "Gestão contínua",
    descricao: "Acompanhamento por progresso, status, check-ins, evidências, responsáveis e participantes colaborativos.",
    icon: ClipboardCheck,
  },
  {
    titulo: "IA First",
    descricao: "A IA apoia sugestões SMART, desdobramentos, validação de consistência, análise de risco e resumo executivo.",
    icon: Bot,
  },
  {
    titulo: "Governança e auditoria",
    descricao: "Fluxos, aprovações, rastreabilidade e consolidação reforçam controle corporativo e tomada de decisão.",
    icon: Shield,
  },
];

const fluxoOperacional = [
  "1. Defina o nível da meta: estratégica, unidade, setor ou individual.",
  "2. Preencha título, descrição, período, ano, peso e objetivo estratégico.",
  "3. Configure o indicador principal, meta-alvo e direção de medição.",
  "4. Vincule responsável, participantes e relacionamentos hierárquicos quando aplicável.",
  "5. Salve em rascunho ou siga o fluxo de aprovação definido na governança.",
  "6. Faça check-ins periódicos com avanço real, bloqueios e previsão de atingimento.",
  "7. Anexe evidências para sustentar resultados e auditorias.",
  "8. Use IA para validar consistência, gerar resumo e apoiar a análise do ciclo.",
  "9. Consolide o resultado final com base em progresso e peso ponderado.",
];

const secoes = [
  {
    id: "visao-geral",
    titulo: "1. Visão geral do módulo",
    descricao:
      "O módulo de Metas organiza a estratégia em uma estrutura operacional clara. Ele conecta planejamento, execução, acompanhamento e avaliação em um mesmo fluxo, permitindo que a liderança acompanhe metas corporativas e também o desdobramento até áreas e pessoas.",
    itens: [
      "Centraliza metas em múltiplos níveis hierárquicos.",
      "Ajuda a alinhar objetivos estratégicos e execução operacional.",
      "Permite gestão por indicadores, peso, progresso e ciclo.",
      "Aumenta rastreabilidade e transparência para gestores e auditorias.",
    ],
  },
  {
    id: "niveis",
    titulo: "2. Níveis hierárquicos das metas",
    descricao:
      "As metas podem existir em quatro níveis. Cada nível possui papel específico dentro da governança e do desdobramento corporativo.",
    itens: [
      "Estratégica: metas corporativas que expressam prioridades da organização.",
      "Unidade: traduz a estratégia para uma empresa, filial ou unidade de negócio.",
      "Setor: distribui o objetivo para áreas ou departamentos específicos.",
      "Individual: transforma a meta em responsabilidade direta de um colaborador.",
    ],
  },
  {
    id: "criacao",
    titulo: "3. Como criar uma nova meta",
    descricao:
      "Ao clicar em 'Nova Meta', o sistema abre o formulário principal. O ideal é preencher a meta de forma objetiva, mensurável e com lógica de acompanhamento desde o início.",
    itens: [
      "Escolha o nível correto da meta antes de salvar.",
      "Defina título claro e descrição sem ambiguidades.",
      "Selecione período e ano do ciclo avaliativo.",
      "Informe peso da meta para consolidação final.",
      "Associe objetivo estratégico, responsável e estrutura organizacional quando necessário.",
    ],
  },
  {
    id: "indicadores",
    titulo: "4. Indicadores e mensuração",
    descricao:
      "Toda meta deve, preferencialmente, possuir indicador. Isso garante comparabilidade, avaliação justa e leitura executiva consistente.",
    itens: [
      "Tipos suportados: quantitativo, qualitativo, percentual, financeiro, marco e híbrido.",
      "Direções suportadas: maior é melhor, menor é melhor, igual ao alvo e faixa.",
      "Campos comuns: baseline, valor atual, valor alvo, limites e fórmula de medição.",
      "A aba de indicadores reutilizáveis ajuda a padronizar métricas entre áreas.",
    ],
  },
  {
    id: "desdobramento",
    titulo: "5. Desdobramento de metas",
    descricao:
      "O desdobramento permite transformar uma meta de nível superior em submetas coerentes em níveis abaixo. Isso é essencial para tirar a estratégia do nível conceitual e levá-la para execução real.",
    itens: [
      "Uma meta estratégica pode gerar metas de unidade.",
      "Uma meta de unidade pode gerar metas de setor.",
      "Uma meta de setor pode gerar metas individuais.",
      "A IA pode sugerir desdobramentos com justificativa e responsáveis sugeridos.",
    ],
  },
  {
    id: "workflow",
    titulo: "6. Workflow e governança",
    descricao:
      "O módulo suporta estados de workflow para controlar maturidade, aprovação e revisão das metas ao longo do ciclo.",
    itens: [
      "Rascunho: meta ainda em elaboração.",
      "Em aprovação: aguardando validação da liderança definida.",
      "Ativa: meta aprovada e em execução.",
      "Em revisão: meta reavaliada por mudança de contexto.",
      "Suspensa, encerrada ou cancelada: estados finais conforme governança.",
    ],
  },
  {
    id: "checkins",
    titulo: "7. Check-ins e acompanhamento",
    descricao:
      "Check-ins registram a evolução real da meta. Eles permitem histórico de avanço, bloqueios, previsões e aprendizado do ciclo.",
    itens: [
      "Registre valor anterior, valor novo e progresso atualizado.",
      "Explique observações e bloqueios encontrados.",
      "Informe previsão de atingimento para apoiar gestão de risco.",
      "Use check-ins frequentes para evitar surpresas no fechamento do ciclo.",
    ],
  },
  {
    id: "evidencias",
    titulo: "8. Evidências e comprovação",
    descricao:
      "Evidências sustentam a confiabilidade da meta. Elas podem ser anexos, links, registros de período ou descrições de comprovação.",
    itens: [
      "Servem para auditoria, revisão gerencial e defesa de resultado.",
      "Podem incluir arquivo, link externo e descrição contextual.",
      "Devem estar ligadas ao período de referência correto.",
      "Quanto mais objetiva a evidência, maior a confiança na avaliação.",
    ],
  },
  {
    id: "participantes",
    titulo: "9. Participantes colaborativos",
    descricao:
      "Metas compartilhadas podem ter co-responsáveis, apoiadores ou consultados. Isso reduz dependência de uma única pessoa e reflete melhor a execução transversal.",
    itens: [
      "Co-responsável: divide a entrega da meta.",
      "Apoio: contribui com execução parcial ou suporte técnico.",
      "Consultado: participa com orientação, análise ou validação.",
      "O peso entre participantes ajuda a refletir co-responsabilidade.",
    ],
  },
  {
    id: "ia",
    titulo: "10. Inteligência artificial no módulo",
    descricao:
      "A IA é parte central do módulo. Ela apoia construção, análise e leitura das metas, mas não substitui governança humana.",
    itens: [
      "Sugestão de metas em formato SMART.",
      "Desdobramento automático entre níveis.",
      "Validação de consistência para detectar conflitos e duplicidades.",
      "Resumo executivo e leitura gerencial do ciclo.",
      "Assistente conversacional para dúvidas e orientação operacional.",
    ],
  },
  {
    id: "consolidacao",
    titulo: "11. Consolidação de avaliação",
    descricao:
      "A consolidação calcula o atingimento do ciclo considerando progresso e peso. Isso permite leitura mais justa que uma média simples.",
    itens: [
      "Atingimento ponderado = soma de progresso × peso ÷ soma dos pesos.",
      "A tela mostra visão geral e visão por nível hierárquico.",
      "O resumo executivo por IA ajuda a diretoria a interpretar o ciclo.",
      "Use a memória de cálculo para explicar o resultado final com transparência.",
    ],
  },
  {
    id: "privacidade",
    titulo: "12. Privacidade, LGPD e cuidados operacionais",
    descricao:
      "Metas, principalmente individuais, podem envolver dados sensíveis de desempenho. O uso correto exige critério de visibilidade, necessidade de acesso e linguagem profissional.",
    itens: [
      "Evite expor dados individuais para quem não participa do processo.",
      "Use descrições objetivas, sem conteúdo discriminatório ou desnecessário.",
      "Anexe apenas evidências pertinentes ao resultado e ao contexto do ciclo.",
      "Toda saída de IA deve ser validada por gestor ou responsável humano.",
    ],
  },
  {
    id: "boas-praticas",
    titulo: "13. Boas práticas para usar o módulo sem dúvidas",
    descricao:
      "A qualidade da gestão de metas depende menos da quantidade de metas e mais da clareza, disciplina de acompanhamento e consistência dos indicadores.",
    itens: [
      "Prefira metas claras, com dono, prazo e indicador definidos.",
      "Evite metas duplicadas em áreas diferentes sem desdobramento explícito.",
      "Não concentre toda a revisão apenas no fechamento do ciclo.",
      "Use o painel de consistência antes de reuniões executivas.",
      "Revise pesos para refletir prioridade real do negócio.",
    ],
  },
];

const perguntas = [
  {
    pergunta: "Quando devo usar meta compartilhada?",
    resposta:
      "Quando a entrega depende de mais de uma pessoa ou área. Nesses casos, cadastre participantes colaborativos para registrar co-responsabilidade e apoio operacional.",
  },
  {
    pergunta: "Posso criar meta sem indicador?",
    resposta:
      "Depende das configurações do módulo. Mesmo quando permitido, o recomendado é sempre associar um indicador para melhorar acompanhamento e avaliação.",
  },
  {
    pergunta: "A IA decide o resultado final da meta?",
    resposta:
      "Não. A IA apoia análise e sugestões, mas a decisão final deve ser humana, seguindo governança, regras internas e validação do responsável.",
  },
  {
    pergunta: "Qual rotina ideal de acompanhamento?",
    resposta:
      "Check-ins regulares, revisão de bloqueios, atualização de evidências e leitura periódica da consolidação. O ideal é não deixar tudo para o fim do ciclo.",
  },
];

export function MetasGuidePanel() {
  return (
    <ScrollArea className="h-[calc(100vh-16rem)] min-h-[640px] rounded-lg border bg-card">
      <div className="space-y-6 p-6">
        <section className="space-y-3">
          <Badge variant="outline" className="gap-1.5">
            <BookOpenGuideIcon />
            Guia completo do módulo
          </Badge>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Manual completo de Metas</h2>
            <p className="max-w-4xl text-sm leading-relaxed text-muted-foreground">
              Este guia explica, em linguagem simples e sem lacunas, como funciona o módulo de Metas do Seguramente:
              criação, desdobramento, acompanhamento, evidências, IA, consolidação, governança e cuidados de uso.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pilares.map((pilar) => {
            const Icon = pilar.icon;
            return (
              <Card key={pilar.titulo} className="border-border/70">
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{pilar.titulo}</CardTitle>
                    <CardDescription className="mt-1 text-sm leading-relaxed">
                      {pilar.descricao}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-primary" />
                Fluxo operacional recomendado
              </CardTitle>
              <CardDescription>
                Sequência prática para usar o módulo corretamente do início ao fechamento do ciclo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {fluxoOperacional.map((item) => (
                <div key={item} className="flex gap-3 rounded-lg border bg-background p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-sm leading-relaxed text-foreground/90">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Flag className="h-5 w-5 text-primary" />
                O que existe hoje na tela
              </CardTitle>
              <CardDescription>
                Resumo das áreas principais do módulo para facilitar navegação e adoção.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <MiniBox icon={Target} titulo="Dashboard" texto="Visão geral, progresso médio, distribuição e leitura rápida do cenário." />
              <MiniBox icon={GitBranch} titulo="Níveis" texto="Listas separadas por metas estratégicas, de unidade, setor e individuais." />
              <MiniBox icon={Calculator} titulo="Consolidação" texto="Cálculo ponderado do atingimento do ciclo e leitura executiva." />
              <MiniBox icon={MessageSquare} titulo="Assistente IA" texto="Espaço conversacional para orientação, análise e apoio operacional." />
              <MiniBox icon={FileText} titulo="Indicadores" texto="Padronização de métricas reutilizáveis para metas recorrentes." />
              <MiniBox icon={Lock} titulo="Configurações" texto="Parâmetros de obrigatoriedade, aprovação, frequências e modelo de avaliação." />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Passo a passo detalhado</CardTitle>
              <CardDescription>
                Abra cada seção para entender em profundidade como cada funcionalidade funciona e quando usar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {secoes.map((secao) => (
                  <AccordionItem key={secao.id} value={secao.id}>
                    <AccordionTrigger className="text-left text-base hover:no-underline">
                      {secao.titulo}
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <p className="text-sm leading-relaxed text-muted-foreground">{secao.descricao}</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        {secao.itens.map((item) => (
                          <div key={item} className="rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed text-foreground/90">
                            {item}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                Perguntas frequentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {perguntas.map((item) => (
                <div key={item.pergunta} className="rounded-lg border bg-background p-4">
                  <h3 className="text-sm font-semibold text-foreground">{item.pergunta}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.resposta}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                Diretrizes finais para operação segura
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                Use o módulo como instrumento de gestão, não apenas como repositório. A meta deve nascer clara, ser acompanhada
                com frequência, possuir evidência compatível e terminar com uma avaliação defensável.
              </p>
              <p>
                Em metas individuais, redobre o cuidado com visibilidade e privacidade. O acesso deve seguir necessidade real,
                governança interna e princípios de LGPD.
              </p>
              <p>
                Sempre revise criticamente qualquer texto gerado por IA antes de aprovar, compartilhar ou usar em avaliação formal.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <PolicyBox
                  icon={Bot}
                  titulo="IA com supervisão"
                  texto="Sugestões, resumos e análises devem passar por validação humana antes de decisão final."
                />
                <PolicyBox
                  icon={Lock}
                  titulo="Privacidade"
                  texto="Metas individuais e evidências devem respeitar confidencialidade e acesso mínimo necessário."
                />
                <PolicyBox
                  icon={Calculator}
                  titulo="Transparência"
                  texto="Use pesos, memória de cálculo e evidências para sustentar o resultado consolidado."
                />
                <PolicyBox
                  icon={FileText}
                  titulo="Rastreabilidade"
                  texto="Registre check-ins, alterações e justificativas para manter histórico completo do ciclo."
                />
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </ScrollArea>
  );
}

function MiniBox({
  icon: Icon,
  titulo,
  texto,
}: {
  icon: typeof Target;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{texto}</p>
    </div>
  );
}

function PolicyBox({
  icon: Icon,
  titulo,
  texto,
}: {
  icon: typeof Target;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{texto}</p>
    </div>
  );
}

function BookOpenGuideIcon() {
  return <FileText className="h-3.5 w-3.5" />;
}