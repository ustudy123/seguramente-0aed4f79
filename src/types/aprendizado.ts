export type FrequenciaAtividade = "diaria" | "semanal" | "mensal" | "eventual";
export type ComplexidadeAtividade = "baixa" | "media" | "alta";
export type ClassificacaoAtividade = "rotineira" | "critica" | "excepcional";
export type TipoConteudoFuncao = "manual" | "pop" | "instrucao" | "video" | "apresentacao" | "documento" | "link";
export type TipoFerramenta = "sistema" | "software" | "planilha" | "equipamento";
export type TipoCompetencia = "tecnica" | "comportamental" | "cognitiva";
export type ObrigatoriedadeEpi = "obrigatorio" | "recomendado" | "condicional";

export interface FuncaoAtividade {
  id: string;
  tenant_id: string;
  cargo_id: string;
  nome: string;
  descricao: string | null;
  frequencia: FrequenciaAtividade;
  complexidade: ComplexidadeAtividade;
  classificacao: ClassificacaoAtividade;
  created_at: string;
  updated_at: string;
}

export interface FuncaoResponsabilidade {
  id: string;
  tenant_id: string;
  atividade_id: string;
  responsavel_direto: string | null;
  interfaces: string | null;
  consequencia_erro: string | null;
  created_at: string;
  updated_at: string;
}

export interface FuncaoConteudo {
  id: string;
  tenant_id: string;
  atividade_id: string;
  tipo: TipoConteudoFuncao;
  titulo: string;
  url: string;
  descricao: string | null;
  created_at: string;
}

export interface FuncaoFerramenta {
  id: string;
  tenant_id: string;
  atividade_id: string;
  nome: string;
  tipo: TipoFerramenta;
  url_manual: string | null;
  descricao: string | null;
  created_at: string;
}

export interface FuncaoCompetencia {
  id: string;
  tenant_id: string;
  cargo_id: string;
  nome: string;
  tipo: TipoCompetencia;
  descricao: string | null;
  created_at: string;
  updated_at: string;
}

export interface FuncaoCompetenciaRecurso {
  id: string;
  tenant_id: string;
  competencia_id: string;
  tipo: TipoConteudoFuncao;
  titulo: string;
  url: string;
  descricao: string | null;
  created_at: string;
}

export interface FuncaoEpiVinculacao {
  id: string;
  tenant_id: string;
  cargo_id: string;
  epi_tipo_id: string;
  obrigatoriedade: ObrigatoriedadeEpi;
  created_at: string;
  epi_tipo_nome?: string;
  epi_tipo_categoria?: string;
}

export interface FuncaoEpiConteudo {
  id: string;
  tenant_id: string;
  vinculacao_id: string;
  tipo: TipoConteudoFuncao;
  titulo: string;
  url: string;
  descricao: string | null;
  created_at: string;
}

export interface FuncaoEpiQuestionario {
  id: string;
  tenant_id: string;
  vinculacao_id: string;
  pergunta: string;
  opcoes: string[];
  resposta_correta: number;
  ordem: number;
  created_at: string;
}

export interface FuncaoTreinamentoEvidencia {
  id: string;
  tenant_id: string;
  colaborador_id: string | null;
  colaborador_nome: string;
  colaborador_cpf: string | null;
  cargo_id: string;
  vinculacao_id: string | null;
  tipo_treinamento: string;
  data_acesso: string;
  data_conclusao: string | null;
  nota: number | null;
  nota_minima: number | null;
  aprovado: boolean;
  aceite_eletronico: boolean;
  tentativa: number;
  detalhes: Record<string, unknown> | null;
  created_at: string;
}

export interface FuncaoConfig {
  id: string;
  tenant_id: string;
  treinamento_epi_obrigatorio: boolean;
  nota_minima_padrao: number;
  reaplicacao_meses: number;
  ativar_onboarding: boolean;
  ativar_mudanca_funcao: boolean;
  created_at: string;
  updated_at: string;
}
