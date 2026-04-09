export const FASES = [
  { key: 'prospeccao', label: 'Prospecção' },
  { key: 'qualificacao', label: 'Qualificação' },
  { key: 'kickoff', label: 'Kickoff' },
  { key: 'configuracao', label: 'Configuração' },
  { key: 'ativo', label: 'Ativo' },
];

export const BLOCOS_DIAGNOSTICO = [
  {
    id: 'estrutura',
    titulo: 'Estrutura Organizacional',
    descricao: 'Nível de organização estrutural da empresa',
    icon: '🏢',
    perguntas: [
      { id: 'e1', texto: 'A empresa possui departamentos definidos?' },
      { id: 'e2', texto: 'Existe responsável por cada setor?' },
      { id: 'e3', texto: 'Existem descrições de função formalizadas?' },
      { id: 'e4', texto: 'A empresa possui organograma definido?' },
    ],
    classificar: (positivas: number) =>
      positivas <= 1 ? 'Estrutura inicial' : positivas <= 3 ? 'Estrutura intermediária' : 'Estrutura organizada',
  },
  {
    id: 'gestao',
    titulo: 'Gestão de Pessoas',
    descricao: 'Maturidade na gestão de colaboradores',
    icon: '👥',
    perguntas: [
      { id: 'g1', texto: 'A empresa realiza avaliações periódicas de colaboradores?' },
      { id: 'g2', texto: 'Existe acompanhamento de clima organizacional?' },
      { id: 'g3', texto: 'Há políticas internas formalizadas?' },
      { id: 'g4', texto: 'Existem indicadores de gestão de pessoas?' },
    ],
    classificar: (positivas: number) =>
      positivas <= 1 ? 'Baixa maturidade' : positivas <= 3 ? 'Média maturidade' : 'Alta maturidade',
  },
  {
    id: 'sst',
    titulo: 'Saúde e Segurança do Trabalho',
    descricao: 'Nível de gestão em SST',
    icon: '🛡️',
    perguntas: [
      { id: 's1', texto: 'A empresa possui PGR ativo?' },
      { id: 's2', texto: 'Possui PCMSO vigente?' },
      { id: 's3', texto: 'Realiza treinamentos obrigatórios?' },
      { id: 's4', texto: 'Controla exames ocupacionais?' },
    ],
    classificar: (positivas: number) =>
      positivas <= 1 ? 'Básico' : positivas <= 3 ? 'Intermediário' : 'Estruturado',
  },
  {
    id: 'psicossocial',
    titulo: 'Riscos Psicossociais',
    descricao: 'Fatores que impactam saúde mental',
    icon: '🧠',
    perguntas: [
      { id: 'p1', texto: 'A empresa já realizou avaliação psicossocial?' },
      { id: 'p2', texto: 'Existem indicadores de absenteísmo?' },
      { id: 'p3', texto: 'Há registro de afastamentos por saúde mental?' },
      { id: 'p4', texto: 'Existe canal de escuta ou feedback organizacional?' },
    ],
    classificar: (positivas: number) =>
      positivas <= 1 ? 'Inicial' : positivas <= 3 ? 'Intermediário' : 'Avançado',
  },
];
