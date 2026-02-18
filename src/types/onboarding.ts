export type OnboardingEtapaTipo =
  | "apresentacao_institucional"
  | "cultura_valores"
  | "mural_boas_vindas"
  | "checklist_integracao"
  | "conteudo_livre"
  | "quiz"
  | "reflexao";

export type OnboardingProcessoStatus = "pendente" | "em_andamento" | "concluido" | "cancelado";

export interface OnboardingTemplate {
  id: string;
  tenant_id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  funcoes: string[] | null;
  unidades: string[] | null;
  departamentos: string[] | null;
  tipos_vinculo: string[] | null;
  prazo_dias: number;
  pontuacao_total: number;
  emitir_certificado: boolean;
  conexao_pdi: boolean;
  criado_por: string | null;
  criado_por_nome: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingEtapa {
  id: string;
  tenant_id: string;
  template_id: string;
  titulo: string;
  descricao: string | null;
  tipo: OnboardingEtapaTipo;
  conteudo_texto: string | null;
  conteudo_url: string | null;
  formato: string;
  ordem: number;
  pontuacao: number;
  obrigatoria: boolean;
  tempo_estimado_min: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface OnboardingChecklistItem {
  id: string;
  tenant_id: string;
  etapa_id: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  obrigatorio: boolean;
  created_at: string;
}

export interface OnboardingMensagem {
  id: string;
  tenant_id: string;
  etapa_id: string;
  autor_nome: string;
  autor_cargo: string | null;
  mensagem: string;
  tipo: string;
  ordem: number;
  created_at: string;
}

export interface OnboardingProcesso {
  id: string;
  tenant_id: string;
  admissao_id: string;
  template_id: string | null;
  trilha_id: string | null;
  colaborador_nome: string;
  colaborador_cpf: string;
  status: OnboardingProcessoStatus;
  data_inicio: string | null;
  data_conclusao: string | null;
  progresso: number;
  pontos_obtidos: number;
  certificado_emitido: boolean;
  pdi_alimentado: boolean;
  created_at: string;
  updated_at: string;
}

export const ETAPA_TIPO_LABELS: Record<OnboardingEtapaTipo, string> = {
  apresentacao_institucional: "Apresentação Institucional",
  cultura_valores: "Cultura & Valores",
  mural_boas_vindas: "Mural de Boas-vindas",
  checklist_integracao: "Checklist de Integração",
  conteudo_livre: "Conteúdo Livre",
  quiz: "Quiz",
  reflexao: "Reflexão",
};

export const ETAPA_TIPO_ICONS: Record<OnboardingEtapaTipo, string> = {
  apresentacao_institucional: "Building2",
  cultura_valores: "Heart",
  mural_boas_vindas: "MessageCircle",
  checklist_integracao: "CheckSquare",
  conteudo_livre: "FileText",
  quiz: "HelpCircle",
  reflexao: "Lightbulb",
};

export const PROCESSO_STATUS_LABELS: Record<OnboardingProcessoStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em Andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};
