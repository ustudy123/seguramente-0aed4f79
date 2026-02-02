import { 
  TrendingDown, 
  Clock, 
  AlertTriangle, 
  MessageSquareWarning, 
  Heart,
  Minus,
  RefreshCw,
  Target,
  Smile,
  Users,
  Zap,
  Sparkles,
  Activity,
} from "lucide-react";

export interface SugestaoAcao {
  titulo: string;
  porque: string;
}

export const BURNOUT_NIVEL_CONFIG = {
  baixo: {
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
    label: 'Baixo Risco',
    icon: '✓',
    chartColor: 'hsl(142, 76%, 36%)',
  },
  moderado: {
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/30',
    label: 'Atenção',
    icon: '⚠',
    chartColor: 'hsl(38, 92%, 50%)',
  },
  alto: {
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    label: 'Alto Risco',
    icon: '🔥',
    chartColor: 'hsl(24, 95%, 53%)',
  },
  critico: {
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
    label: 'Crítico',
    icon: '🚨',
    chartColor: 'hsl(0, 84%, 60%)',
  },
};

export const ENERGIA_NIVEL_CONFIG = {
  baixo: {
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
    label: 'Crítico',
    icon: '⚠',
    chartColor: 'hsl(0, 84%, 60%)',
  },
  moderado: {
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/30',
    label: 'Regular',
    icon: '⚡',
    chartColor: 'hsl(38, 92%, 50%)',
  },
  alto: {
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
    label: 'Bom',
    icon: '✓',
    chartColor: 'hsl(142, 76%, 36%)',
  },
  excelente: {
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/30',
    label: 'Excelente',
    icon: '⚡',
    chartColor: 'hsl(252, 59%, 48%)',
  },
};

export const BURNOUT_FATORES = [
  { 
    key: 'sobrecargaCognitiva', 
    label: 'Sobrecarga Cognitiva', 
    icon: TrendingDown, 
    description: 'Excesso de demandas mentais e complexidade das tarefas',
    detailedAnalysis: 'Analisamos a quantidade e complexidade dos riscos cognitivos identificados no ambiente de trabalho, incluindo demandas de atenção, memória e processamento de informações.',
    dataSource: ['Inventário de Riscos Cognitivos', 'Análise de Carga Mental'],
    sugestoes: [
      { 
        titulo: 'Implementar rodízio de tarefas complexas',
        porque: 'Reduzir a sobrecarga mental causada pela exposição prolongada a tarefas de alta complexidade cognitiva'
      },
      { 
        titulo: 'Criar pausas programadas para recuperação mental',
        porque: 'Permitir recuperação cognitiva adequada e prevenir fadiga mental acumulada'
      },
      { 
        titulo: 'Simplificar processos e procedimentos',
        porque: 'Diminuir a carga cognitiva exigida para execução das atividades rotineiras'
      },
      { 
        titulo: 'Implementar ferramentas de apoio cognitivo',
        porque: 'Oferecer suporte tecnológico que reduza a demanda de memória e processamento mental'
      },
    ],
  },
  { 
    key: 'ritmoTrabalho', 
    label: 'Ritmo de Trabalho', 
    icon: Clock, 
    description: 'Velocidade e intensidade das atividades exigidas',
    detailedAnalysis: 'Avaliamos os riscos organizacionais relacionados ao ritmo, pressão por prazos e metas, intensidade das demandas e controle sobre o próprio trabalho.',
    dataSource: ['Riscos Organizacionais', 'Análise de Jornada'],
    sugestoes: [
      { 
        titulo: 'Revisar metas e prazos irrealistas',
        porque: 'Adequar as expectativas de entrega à capacidade real da equipe, evitando sobrecarga'
      },
      { 
        titulo: 'Balancear carga de trabalho entre equipes',
        porque: 'Distribuir demandas de forma equitativa para evitar sobrecarga em indivíduos específicos'
      },
      { 
        titulo: 'Implementar gestão de prioridades',
        porque: 'Permitir foco nas atividades mais importantes e reduzir sensação de urgência constante'
      },
      { 
        titulo: 'Avaliar necessidade de contratações',
        porque: 'Dimensionar adequadamente a equipe para atender às demandas sem sobrecarga'
      },
    ],
  },
  { 
    key: 'faltaPausas', 
    label: 'Falta de Pausas', 
    icon: AlertTriangle, 
    description: 'Ausência de intervalos adequados para recuperação',
    detailedAnalysis: 'Consideramos as ações pendentes relacionadas a pausas e recuperação, assim como a existência de políticas e práticas de descanso durante a jornada.',
    dataSource: ['Ações Pendentes', 'Política de Pausas'],
    sugestoes: [
      { 
        titulo: 'Implementar pausas ativas obrigatórias',
        porque: 'Garantir momentos de recuperação física e mental durante a jornada de trabalho'
      },
      { 
        titulo: 'Criar espaços de descanso adequados',
        porque: 'Oferecer ambientes propícios para recuperação e descompressão dos colaboradores'
      },
      { 
        titulo: 'Estabelecer política formal de pausas',
        porque: 'Institucionalizar a cultura de pausas e garantir que todos tenham direito ao descanso'
      },
      { 
        titulo: 'Monitorar intervalos por sistema',
        porque: 'Acompanhar o cumprimento das pausas e identificar colaboradores em risco de fadiga'
      },
    ],
  },
  { 
    key: 'humorNegativo', 
    label: 'Humor Negativo', 
    icon: TrendingDown, 
    description: 'Presença de estados emocionais negativos relatados',
    detailedAnalysis: 'Monitoramos os registros de humor diário dos colaboradores, identificando padrões de estresse, cansaço, ansiedade e desânimo nos últimos 7 dias.',
    dataSource: ['Humor Diário', 'Registros dos últimos 7 dias'],
    sugestoes: [
      { 
        titulo: 'Realizar escuta ativa com gestores',
        porque: 'Identificar causas específicas do humor negativo através de conversas individuais'
      },
      { 
        titulo: 'Oferecer apoio psicológico',
        porque: 'Disponibilizar suporte profissional para colaboradores em sofrimento emocional'
      },
      { 
        titulo: 'Investigar causas de insatisfação',
        porque: 'Compreender os fatores organizacionais que contribuem para o humor negativo'
      },
      { 
        titulo: 'Promover ações de bem-estar',
        porque: 'Criar iniciativas que melhorem o clima organizacional e a satisfação no trabalho'
      },
    ],
  },
  { 
    key: 'denuncias', 
    label: 'Denúncias/Ocorrências', 
    icon: MessageSquareWarning, 
    description: 'Registros na ouvidoria relacionados ao ambiente',
    detailedAnalysis: 'Analisamos as manifestações recebidas pela ouvidoria, incluindo denúncias, reclamações e sugestões relacionadas ao ambiente de trabalho e relações interpessoais.',
    dataSource: ['Ouvidoria', 'Ocorrências em aberto'],
    sugestoes: [
      { 
        titulo: 'Investigar denúncias pendentes',
        porque: 'Resolver situações reportadas que podem estar causando sofrimento aos colaboradores'
      },
      { 
        titulo: 'Implementar ações corretivas',
        porque: 'Tratar as causas raiz das denúncias e prevenir novas ocorrências similares'
      },
      { 
        titulo: 'Reforçar canais de comunicação',
        porque: 'Garantir que colaboradores tenham meios seguros para reportar problemas'
      },
      { 
        titulo: 'Capacitar lideranças',
        porque: 'Preparar gestores para lidar adequadamente com conflitos e situações sensíveis'
      },
    ],
  },
  { 
    key: 'exigenciasEmocionais', 
    label: 'Exigências Emocionais', 
    icon: Heart, 
    description: 'Demandas de controle emocional no trabalho',
    detailedAnalysis: 'Combinamos indicadores de humor negativo com riscos cognitivos para avaliar a carga emocional exigida nas atividades laborais.',
    dataSource: ['Humor Diário', 'Riscos Cognitivos'],
    sugestoes: [
      { 
        titulo: 'Oferecer treinamento de inteligência emocional',
        porque: 'Desenvolver habilidades para lidar com demandas emocionais do trabalho'
      },
      { 
        titulo: 'Criar grupos de apoio entre pares',
        porque: 'Estabelecer rede de suporte entre colegas para compartilhar experiências e estratégias'
      },
      { 
        titulo: 'Revisar atribuições de funções de alto contato',
        porque: 'Adequar a exposição emocional às características e limites de cada colaborador'
      },
      { 
        titulo: 'Implementar supervisão técnica',
        porque: 'Oferecer acompanhamento profissional para funções com alta demanda emocional'
      },
    ],
  },
] as const;

export const BOREOUT_FATORES = [
  { 
    key: 'baixoDesafio', 
    label: 'Baixo Desafio', 
    icon: Target, 
    description: 'Tarefas abaixo da capacidade do colaborador',
    detailedAnalysis: 'Avaliamos se há subutilização das competências dos colaboradores, analisando a relação entre capacidades identificadas e complexidade das tarefas atribuídas.',
    dataSource: ['Inventário de Riscos', 'Ações Cadastradas'],
    sugestoes: [
      { 
        titulo: 'Mapear competências e realocá-las',
        porque: 'Aproveitar melhor o potencial dos colaboradores e reduzir a subutilização de habilidades'
      },
      { 
        titulo: 'Criar projetos especiais desafiadores',
        porque: 'Estimular o engajamento através de desafios que correspondam às capacidades do colaborador'
      },
      { 
        titulo: 'Implementar job enrichment',
        porque: 'Enriquecer as funções com responsabilidades que aumentem o senso de realização'
      },
      { 
        titulo: 'Oferecer oportunidades de desenvolvimento',
        porque: 'Proporcionar crescimento profissional e novos desafios de aprendizagem'
      },
    ],
  },
  { 
    key: 'repetitividade', 
    label: 'Repetitividade', 
    icon: RefreshCw, 
    description: 'Monotonia e falta de variabilidade nas atividades',
    detailedAnalysis: 'Analisamos riscos cognitivos relacionados à monotonia, avaliando a diversidade de tarefas e estímulos no ambiente de trabalho.',
    dataSource: ['Riscos Cognitivos', 'Análise de Tarefas'],
    sugestoes: [
      { 
        titulo: 'Implementar rodízio de atividades',
        porque: 'Quebrar a monotonia através da alternância entre diferentes tipos de tarefas'
      },
      { 
        titulo: 'Automatizar tarefas repetitivas',
        porque: 'Liberar colaboradores para atividades mais estimulantes e de maior valor agregado'
      },
      { 
        titulo: 'Criar variação nas rotinas',
        porque: 'Introduzir elementos de novidade que mantenham o interesse e a atenção'
      },
      { 
        titulo: 'Enriquecer postos de trabalho',
        porque: 'Adicionar responsabilidades e atividades diversificadas às funções existentes'
      },
    ],
  },
  { 
    key: 'faltaSentido', 
    label: 'Falta de Sentido', 
    icon: Minus, 
    description: 'Dificuldade em perceber propósito no trabalho',
    detailedAnalysis: 'Correlacionamos indicadores de humor com a percepção de propósito, avaliando se os colaboradores compreendem a importância de suas contribuições.',
    dataSource: ['Humor Diário', 'Clima Organizacional'],
    sugestoes: [
      { 
        titulo: 'Comunicar propósito e impacto do trabalho',
        porque: 'Conectar as atividades diárias aos resultados e benefícios gerados pela empresa'
      },
      { 
        titulo: 'Conectar tarefas aos objetivos maiores',
        porque: 'Demonstrar como cada função contribui para o sucesso organizacional'
      },
      { 
        titulo: 'Promover reconhecimento',
        porque: 'Valorizar contribuições individuais e reforçar a importância de cada colaborador'
      },
      { 
        titulo: 'Envolver em decisões',
        porque: 'Aumentar o senso de pertencimento e responsabilidade sobre os resultados'
      },
    ],
  },
  { 
    key: 'apatia', 
    label: 'Apatia Emocional', 
    icon: Smile, 
    description: 'Indiferença e desinteresse pelas atividades',
    detailedAnalysis: 'Monitoramos a frequência de registros de humor neutro ou indiferente, que podem indicar desconexão emocional com o trabalho.',
    dataSource: ['Humor Diário', 'Taxa de Neutralidade'],
    sugestoes: [
      { 
        titulo: 'Realizar conversas individuais',
        porque: 'Identificar causas pessoais ou profissionais da apatia através de escuta ativa'
      },
      { 
        titulo: 'Investigar causas da apatia',
        porque: 'Compreender fatores organizacionais que levam ao desinteresse e desengajamento'
      },
      { 
        titulo: 'Criar momentos de celebração',
        porque: 'Estimular emoções positivas e reconexão com aspectos prazerosos do trabalho'
      },
      { 
        titulo: 'Promover conexões interpessoais',
        porque: 'Fortalecer vínculos sociais que aumentam o engajamento e a satisfação'
      },
    ],
  },
  { 
    key: 'desconexao', 
    label: 'Desconexão com Equipe', 
    icon: Users, 
    description: 'Isolamento e falta de pertencimento',
    detailedAnalysis: 'Avaliamos indicadores de integração social, analisando a participação em atividades coletivas e a percepção de pertencimento ao grupo.',
    dataSource: ['Humor Positivo', 'Engajamento Social'],
    sugestoes: [
      { 
        titulo: 'Promover team building',
        porque: 'Fortalecer vínculos entre membros da equipe através de atividades conjuntas'
      },
      { 
        titulo: 'Criar rituais de integração',
        porque: 'Estabelecer momentos regulares de conexão e fortalecimento do grupo'
      },
      { 
        titulo: 'Facilitar colaboração entre áreas',
        porque: 'Ampliar a rede de relacionamentos e reduzir o isolamento departamental'
      },
      { 
        titulo: 'Estabelecer mentoria entre pares',
        porque: 'Criar conexões significativas através do compartilhamento de conhecimento'
      },
    ],
  },
] as const;

export const ENERGIA_FATORES = [
  { 
    key: 'vitalidade', 
    label: 'Vitalidade da Equipe', 
    icon: Heart, 
    description: 'Energia física e mental para executar tarefas',
    detailedAnalysis: 'Medimos a vitalidade através dos registros de humor positivo, avaliando a disposição e energia demonstrada pelos colaboradores.',
    dataSource: ['Humor Diário', 'Registros Positivos'],
    sugestoes: [
      { 
        titulo: 'Promover atividades físicas',
        porque: 'Aumentar os níveis de energia física e mental através do exercício regular'
      },
      { 
        titulo: 'Melhorar qualidade do ambiente',
        porque: 'Criar condições ambientais que favoreçam o bem-estar e a disposição'
      },
      { 
        titulo: 'Incentivar hábitos saudáveis',
        porque: 'Promover escolhas que contribuam para a saúde e vitalidade dos colaboradores'
      },
      { 
        titulo: 'Criar programa de qualidade de vida',
        porque: 'Institucionalizar iniciativas de promoção da saúde e bem-estar integral'
      },
    ],
  },
  { 
    key: 'engajamento', 
    label: 'Engajamento', 
    icon: Activity, 
    description: 'Envolvimento ativo e comprometimento',
    detailedAnalysis: 'Calculamos o engajamento combinando taxa de conclusão de ações com indicadores positivos de humor, refletindo o comprometimento ativo.',
    dataSource: ['Ações Concluídas', 'Humor Positivo'],
    sugestoes: [
      { 
        titulo: 'Reconhecer realizações publicamente',
        porque: 'Valorizar contribuições e reforçar comportamentos desejados através do reconhecimento'
      },
      { 
        titulo: 'Dar autonomia e responsabilidade',
        porque: 'Aumentar o senso de propriedade e controle sobre o próprio trabalho'
      },
      { 
        titulo: 'Alinhar objetivos pessoais e organizacionais',
        porque: 'Criar conexão entre as aspirações individuais e as metas da empresa'
      },
      { 
        titulo: 'Promover participação em decisões',
        porque: 'Envolver colaboradores nos processos decisórios que afetam seu trabalho'
      },
    ],
  },
  { 
    key: 'presencaPsicologica', 
    label: 'Presença Psicológica', 
    icon: Sparkles, 
    description: 'Atenção plena e foco nas atividades',
    detailedAnalysis: 'Avaliamos a presença psicológica considerando a ausência de fatores negativos como humor ruim e denúncias abertas que indicam desconexão.',
    dataSource: ['Humor Negativo', 'Denúncias Abertas'],
    sugestoes: [
      { 
        titulo: 'Implementar práticas de mindfulness',
        porque: 'Desenvolver a capacidade de atenção plena e redução do estresse'
      },
      { 
        titulo: 'Reduzir distrações no ambiente',
        porque: 'Criar condições que favoreçam a concentração e o foco nas atividades'
      },
      { 
        titulo: 'Criar ambientes de foco',
        porque: 'Disponibilizar espaços adequados para trabalho que exige concentração'
      },
      { 
        titulo: 'Promover gestão do tempo',
        porque: 'Capacitar colaboradores para organizar suas atividades de forma mais eficiente'
      },
    ],
  },
  { 
    key: 'sustentabilidade', 
    label: 'Sustentabilidade', 
    icon: Zap, 
    description: 'Capacidade de manter o desempenho ao longo do tempo',
    detailedAnalysis: 'Avaliamos a sustentabilidade da energia considerando o nível de burnout - quanto menor o risco de burnout, maior a sustentabilidade.',
    dataSource: ['Índice de Burnout', 'Tendência Histórica'],
    sugestoes: [
      { 
        titulo: 'Equilibrar demandas e recursos',
        porque: 'Garantir que a carga de trabalho seja compatível com os recursos disponíveis'
      },
      { 
        titulo: 'Promover recuperação adequada',
        porque: 'Assegurar tempo e condições para restauração da energia física e mental'
      },
      { 
        titulo: 'Monitorar sinais de esgotamento',
        porque: 'Identificar precocemente colaboradores em risco de burnout para intervenção'
      },
      { 
        titulo: 'Criar cultura de cuidado',
        porque: 'Estabelecer ambiente onde o bem-estar é valorizado e protegido'
      },
    ],
  },
] as const;
