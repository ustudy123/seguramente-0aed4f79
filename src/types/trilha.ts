export type TrilhaTipo = "tecnica" | "comportamental" | "lideranca" | "cultura" | "ergonomia_saude" | "processos" | "onboarding";
export type TrilhaPrioridade = "obrigatoria" | "recomendada" | "opcional";
export type TrilhaVisibilidade = "publica" | "restrita";
export type TrilhaStatus = "rascunho" | "ativa" | "arquivada";
export type TrilhaModuloTipo = "video" | "pdf" | "link" | "apresentacao" | "conteudo_interno" | "quiz" | "atividade_pratica" | "checklist" | "reflexao" | "estudo_caso" | "microdesafio";
export type TrilhaOrdemTipo = "sequencial" | "livre";
export type TrilhaProgressoStatus = "nao_iniciado" | "em_andamento" | "concluido";

// Conteúdo adicional dentro de um módulo (o módulo pode ter vários)
export type TrilhaConteudoTipo = "video" | "pdf" | "apresentacao" | "link" | "texto";
export interface TrilhaModuloConteudo {
  id: string;
  tipo: TrilhaConteudoTipo;
  titulo?: string;
  url?: string;
  texto?: string;
}

export interface Trilha {
  id: string;
  tenant_id: string;
  nome: string;
  descricao: string | null;
  objetivo: string | null;
  tipo: TrilhaTipo;
  prioridade: TrilhaPrioridade;
  visibilidade: TrilhaVisibilidade;
  status: TrilhaStatus;
  pontuacao_minima: number;
  prazo_dias: number | null;
  imagem_url: string | null;
  conexao_pdi: boolean;
  conexao_indicadores: string[] | null;
  criado_por: string | null;
  criado_por_nome: string | null;
  total_modulos: number;
  created_at: string;
  updated_at: string;
}

export interface TrilhaModulo {
  id: string;
  tenant_id: string;
  trilha_id: string;
  titulo: string;
  descricao: string | null;
  objetivo: string | null;
  tipo: TrilhaModuloTipo;
  conteudo_url: string | null;
  conteudo_texto: string | null;
  conteudos?: TrilhaModuloConteudo[] | null;
  tempo_estimado_min: number;
  pontuacao: number;
  ordem: number;
  ordem_tipo: TrilhaOrdemTipo;
  evidencia_obrigatoria: boolean;
  competencia_relacionada: string | null;
  acao_pdi_id: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrilhaQuizPergunta {
  id: string;
  tenant_id: string;
  modulo_id: string;
  pergunta: string;
  opcoes: string[];
  resposta_correta: number;
  ordem: number;
  created_at: string;
}

export interface TrilhaProgresso {
  id: string;
  tenant_id: string;
  trilha_id: string;
  modulo_id: string;
  colaborador_id: string;
  colaborador_nome: string;
  status: TrilhaProgressoStatus;
  data_inicio: string | null;
  data_conclusao: string | null;
  evidencia_texto: string | null;
  evidencia_url: string | null;
  nota: number | null;
  pontos_obtidos: number | null;
  conteudos_concluidos?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface TrilhaComProgresso extends Trilha {
  progressoModulos: TrilhaProgresso[];
  totalConcluidos: number;
  pontosObtidos: number;
  percentual: number;
}

export const TRILHA_TIPO_LABELS: Record<TrilhaTipo, string> = {
  tecnica: "Técnica",
  comportamental: "Comportamental",
  lideranca: "Liderança",
  cultura: "Cultura",
  ergonomia_saude: "Ergonomia & Saúde",
  processos: "Processos",
  onboarding: "Onboarding",
};

export const TRILHA_PRIORIDADE_LABELS: Record<TrilhaPrioridade, string> = {
  obrigatoria: "Obrigatória",
  recomendada: "Recomendada",
  opcional: "Opcional",
};

export const TRILHA_STATUS_LABELS: Record<TrilhaStatus, string> = {
  rascunho: "Rascunho",
  ativa: "Ativa",
  arquivada: "Arquivada",
};

export const MODULO_TIPO_LABELS: Record<TrilhaModuloTipo, string> = {
  video: "Vídeo",
  pdf: "PDF",
  link: "Link Externo",
  apresentacao: "Apresentação",
  conteudo_interno: "Conteúdo Interno",
  quiz: "Quiz",
  atividade_pratica: "Atividade Prática",
  checklist: "Checklist",
  reflexao: "Reflexão Guiada",
  estudo_caso: "Estudo de Caso",
  microdesafio: "Microdesafio",
};
