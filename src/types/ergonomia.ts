// Tipos para o Módulo de Ergonomia Inteligente

export type ErgonomiaStatus = 'atendido' | 'parcial' | 'nao_atendido' | 'nao_aplicavel';
export type ErgonomiaCategoria = 'organizacao_trabalho' | 'mobiliario' | 'equipamentos' | 'condicoes_ambientais' | 'levantamento_cargas' | 'aet';
export type ErgonomiaEixo = 'fisico' | 'cognitivo' | 'organizacional';
export type RiscoSeveridade = 'baixo' | 'medio' | 'alto' | 'critico';
export type AcaoPrioridade = 'baixa' | 'media' | 'alta' | 'urgente';
export type AcaoStatus = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';

export interface ItemNR17 {
  id: string;
  tenant_id: string;
  categoria: ErgonomiaCategoria;
  codigo: string;
  titulo: string;
  descricao?: string;
  status: ErgonomiaStatus;
  responsavel_id?: string;
  responsavel_nome?: string;
  data_avaliacao?: string;
  proxima_reavaliacao?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export interface ErgonomiaEvidencia {
  id: string;
  tenant_id: string;
  item_nr17_id: string;
  tipo: 'documento' | 'foto' | 'video' | 'audio' | 'relatorio';
  titulo: string;
  descricao?: string;
  arquivo_url?: string;
  arquivo_nome?: string;
  arquivo_tamanho?: number;
  enviado_por?: string;
  enviado_por_nome?: string;
  created_at: string;
}

export interface ErgonomiaRisco {
  id: string;
  tenant_id: string;
  item_nr17_id?: string;
  eixo: ErgonomiaEixo;
  titulo: string;
  descricao?: string;
  fonte?: string;
  impactos_potenciais?: string[];
  severidade: RiscoSeveridade;
  probabilidade: RiscoSeveridade;
  medidas_existentes?: string[];
  medidas_recomendadas?: string[];
  departamento?: string;
  setor?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ErgonomiaAcao {
  id: string;
  tenant_id: string;
  risco_id?: string;
  item_nr17_id?: string;
  titulo: string;
  descricao?: string;
  tipo: 'corretiva' | 'preventiva' | 'melhoria';
  prioridade: AcaoPrioridade;
  status: AcaoStatus;
  responsavel_id?: string;
  responsavel_nome?: string;
  prazo?: string;
  data_inicio?: string;
  data_conclusao?: string;
  evidencia_conclusao?: string;
  custo_estimado?: number;
  custo_real?: number;
  created_at: string;
  updated_at: string;
}

export interface ErgonomiaMaturidade {
  id: string;
  tenant_id: string;
  data_avaliacao: string;
  nivel: 'reativo' | 'corretivo' | 'preventivo' | 'estrategico' | 'cultura_saudavel';
  pontuacao: number;
  itens_atendidos: number;
  itens_parciais: number;
  itens_nao_atendidos: number;
  riscos_criticos: number;
  acoes_concluidas: number;
  acoes_pendentes: number;
  observacoes?: string;
  created_at: string;
}

// Labels e cores
export const STATUS_LABELS: Record<ErgonomiaStatus, string> = {
  atendido: 'Atendido',
  parcial: 'Parcial',
  nao_atendido: 'Não Atendido',
  nao_aplicavel: 'Não Aplicável',
};

export const STATUS_COLORS: Record<ErgonomiaStatus, string> = {
  atendido: 'bg-success/10 text-success border-success/30',
  parcial: 'bg-warning/10 text-warning border-warning/30',
  nao_atendido: 'bg-destructive/10 text-destructive border-destructive/30',
  nao_aplicavel: 'bg-muted text-muted-foreground border-muted',
};

export const CATEGORIA_LABELS: Record<ErgonomiaCategoria, string> = {
  organizacao_trabalho: 'Organização do Trabalho',
  mobiliario: 'Mobiliário',
  equipamentos: 'Equipamentos',
  condicoes_ambientais: 'Condições Ambientais',
  levantamento_cargas: 'Levantamento e Transporte de Cargas',
  aet: 'Análise Ergonômica do Trabalho',
};

export const CATEGORIA_ICONS: Record<ErgonomiaCategoria, string> = {
  organizacao_trabalho: 'Users',
  mobiliario: 'Armchair',
  equipamentos: 'Monitor',
  condicoes_ambientais: 'Thermometer',
  levantamento_cargas: 'Package',
  aet: 'FileSearch',
};

export const EIXO_LABELS: Record<ErgonomiaEixo, string> = {
  fisico: 'Físico',
  cognitivo: 'Cognitivo',
  organizacional: 'Organizacional',
};

export const EIXO_COLORS: Record<ErgonomiaEixo, string> = {
  fisico: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  cognitivo: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  organizacional: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
};

export const SEVERIDADE_LABELS: Record<RiscoSeveridade, string> = {
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
  critico: 'Crítico',
};

export const SEVERIDADE_COLORS: Record<RiscoSeveridade, string> = {
  baixo: 'bg-success/10 text-success',
  medio: 'bg-warning/10 text-warning',
  alto: 'bg-orange-500/10 text-orange-600',
  critico: 'bg-destructive/10 text-destructive',
};

export const PRIORIDADE_LABELS: Record<AcaoPrioridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

export const ACAO_STATUS_LABELS: Record<AcaoStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export const MATURIDADE_LABELS: Record<ErgonomiaMaturidade['nivel'], string> = {
  reativo: 'Reativo',
  corretivo: 'Corretivo',
  preventivo: 'Preventivo',
  estrategico: 'Estratégico',
  cultura_saudavel: 'Cultura Saudável',
};

export const MATURIDADE_COLORS: Record<ErgonomiaMaturidade['nivel'], string> = {
  reativo: 'bg-destructive/10 text-destructive',
  corretivo: 'bg-orange-500/10 text-orange-600',
  preventivo: 'bg-warning/10 text-warning',
  estrategico: 'bg-blue-500/10 text-blue-600',
  cultura_saudavel: 'bg-success/10 text-success',
};

// Itens padrão da NR-17 por categoria
export const ITENS_NR17_PADRAO: Omit<ItemNR17, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>[] = [
  // Organização do Trabalho
  { categoria: 'organizacao_trabalho', codigo: '17.1.1', titulo: 'Adaptação das condições de trabalho', descricao: 'As condições de trabalho incluem aspectos relacionados ao levantamento, transporte e descarga de materiais, ao mobiliário dos postos de trabalho, ao trabalho com máquinas, equipamentos e ferramentas manuais, às condições de conforto no ambiente de trabalho e à própria organização do trabalho.', status: 'nao_atendido' },
  { categoria: 'organizacao_trabalho', codigo: '17.6.1', titulo: 'Normas de produção e modo operatório', descricao: 'A organização do trabalho, para efeito desta NR, deve levar em consideração, no mínimo: as normas de produção, o modo operatório, a exigência de tempo, o ritmo de trabalho e o conteúdo das tarefas.', status: 'nao_atendido' },
  { categoria: 'organizacao_trabalho', codigo: '17.6.2', titulo: 'Pausas para descanso', descricao: 'Nas atividades que exijam sobrecarga muscular estática ou dinâmica do pescoço, ombros, dorso e membros superiores e inferiores, devem ser incluídas pausas para descanso.', status: 'nao_atendido' },
  { categoria: 'organizacao_trabalho', codigo: '17.6.3', titulo: 'Retorno ao trabalho após afastamento', descricao: 'Quando do retorno do trabalho, após qualquer tipo de afastamento igual ou superior a 15 dias, a exigência de produção deverá permitir um retorno gradativo aos níveis de produção vigentes na época anterior ao afastamento.', status: 'nao_atendido' },
  
  // Mobiliário
  { categoria: 'mobiliario', codigo: '17.3.1', titulo: 'Postura adequada no posto de trabalho', descricao: 'Sempre que o trabalho puder ser executado na posição sentada, o posto de trabalho deve ser planejado ou adaptado para esta posição.', status: 'nao_atendido' },
  { categoria: 'mobiliario', codigo: '17.3.2', titulo: 'Assentos nos postos de trabalho', descricao: 'Para trabalho manual sentado ou que tenha de ser feito em pé, as bancadas, mesas, escrivaninhas e os painéis devem proporcionar ao trabalhador condições de boa postura, visualização e operação.', status: 'nao_atendido' },
  { categoria: 'mobiliario', codigo: '17.3.3', titulo: 'Características do assento', descricao: 'Os assentos utilizados nos postos de trabalho devem atender aos requisitos mínimos de conforto: altura ajustável, pouca ou nenhuma conformação na base, borda frontal arredondada, encosto com suporte lombar.', status: 'nao_atendido' },
  { categoria: 'mobiliario', codigo: '17.3.4', titulo: 'Apoio para os pés', descricao: 'Para as atividades em que os trabalhos devam ser realizados sentados, a partir da análise ergonômica do trabalho, poderá ser exigido suporte para os pés.', status: 'nao_atendido' },
  
  // Equipamentos
  { categoria: 'equipamentos', codigo: '17.4.1', titulo: 'Equipamentos adequados às características', descricao: 'Todos os equipamentos que compõem um posto de trabalho devem estar adequados às características psicofisiológicas dos trabalhadores e à natureza do trabalho a ser executado.', status: 'nao_atendido' },
  { categoria: 'equipamentos', codigo: '17.4.2', titulo: 'Processamento eletrônico de dados', descricao: 'Nas atividades que envolvam leitura de documentos para digitação, datilografia ou mecanografia deve ser fornecido suporte adequado para documentos.', status: 'nao_atendido' },
  { categoria: 'equipamentos', codigo: '17.4.3', titulo: 'Requisitos de teclados', descricao: 'Os equipamentos utilizados no processamento eletrônico de dados com terminais de vídeo devem observar requisitos mínimos quanto a condições de mobilidade e superfície.', status: 'nao_atendido' },
  
  // Condições Ambientais
  { categoria: 'condicoes_ambientais', codigo: '17.5.1', titulo: 'Condições ambientais confortáveis', descricao: 'As condições ambientais de trabalho devem estar adequadas às características psicofisiológicas dos trabalhadores e à natureza do trabalho a ser executado.', status: 'nao_atendido' },
  { categoria: 'condicoes_ambientais', codigo: '17.5.2', titulo: 'Níveis de ruído', descricao: 'Nos locais de trabalho onde são executadas atividades que exijam solicitação intelectual e atenção constantes, são recomendadas condições de conforto acústico.', status: 'nao_atendido' },
  { categoria: 'condicoes_ambientais', codigo: '17.5.3', titulo: 'Iluminação adequada', descricao: 'Em todos os locais de trabalho deve haver iluminação adequada, natural ou artificial, geral ou suplementar, apropriada à natureza da atividade.', status: 'nao_atendido' },
  { categoria: 'condicoes_ambientais', codigo: '17.5.4', titulo: 'Temperatura efetiva', descricao: 'A temperatura efetiva deve estar entre 20ºC e 23ºC, a velocidade do ar não deve ser superior a 0,75m/s e a umidade relativa do ar não deve ser inferior a 40%.', status: 'nao_atendido' },
  
  // Levantamento e Transporte de Cargas
  { categoria: 'levantamento_cargas', codigo: '17.2.1', titulo: 'Limite de peso por trabalhador', descricao: 'Não deverá ser exigido nem admitido o transporte manual de cargas, por um trabalhador, cujo peso seja suscetível de comprometer sua saúde ou sua segurança.', status: 'nao_atendido' },
  { categoria: 'levantamento_cargas', codigo: '17.2.2', titulo: 'Transporte manual regular', descricao: 'Quando mulheres e trabalhadores jovens forem designados para o transporte manual de cargas, o peso máximo dessas cargas deverá ser nitidamente inferior àquele admitido para os homens.', status: 'nao_atendido' },
  { categoria: 'levantamento_cargas', codigo: '17.2.3', titulo: 'Impulsão ou tração de cargas', descricao: 'Todo trabalhador designado para o transporte manual regular de cargas, que não as leves, deve receber treinamento ou instruções satisfatórias.', status: 'nao_atendido' },
  { categoria: 'levantamento_cargas', codigo: '17.2.4', titulo: 'Equipamentos mecânicos', descricao: 'Respeitados os limites de peso estabelecidos, o trabalho de levantamento de material feito com equipamento mecânico de ação manual deverá ser executado de forma que o esforço físico seja compatível.', status: 'nao_atendido' },
  
  // AET
  { categoria: 'aet', codigo: '17.1.2', titulo: 'Análise Ergonômica do Trabalho', descricao: 'Para avaliar a adaptação das condições de trabalho às características psicofisiológicas dos trabalhadores, cabe ao empregador realizar a análise ergonômica do trabalho.', status: 'nao_atendido' },
  { categoria: 'aet', codigo: '17.1.2.1', titulo: 'Avaliação de demandas físicas', descricao: 'A análise ergonômica do trabalho deve contemplar as condições de trabalho conforme estabelecido nesta NR, incluindo, no mínimo, as demandas físicas do trabalho.', status: 'nao_atendido' },
  { categoria: 'aet', codigo: '17.1.2.2', titulo: 'Avaliação de demandas cognitivas', descricao: 'A análise ergonômica deve também contemplar demandas cognitivas e organizacionais que impactam na saúde do trabalhador.', status: 'nao_atendido' },
];
