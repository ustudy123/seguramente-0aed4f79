export type FeedbackCategoria = "reconhecimento" | "alinhamento" | "desenvolvimento";
export type OcorrenciaTipo = "positiva" | "neutra" | "negativa";
export type AdvertenciaStatus = "pendente" | "enviada" | "formalizada" | "arquivada";

export interface Feedback {
  id: string;
  tenant_id: string;
  colaborador_id: string;
  colaborador_nome: string;
  colaborador_cargo: string | null;
  colaborador_departamento: string | null;
  colaborador_filial: string | null;
  categoria: FeedbackCategoria;
  descricao: string;
  descricao_ia: string | null;
  ia_utilizada: boolean;
  registrado_por: string;
  registrado_por_nome: string;
  enviado_email: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ocorrencia {
  id: string;
  tenant_id: string;
  colaborador_id: string;
  colaborador_nome: string;
  colaborador_cargo: string | null;
  colaborador_departamento: string | null;
  colaborador_filial: string | null;
  tipo: OcorrenciaTipo;
  descricao: string;
  is_advertencia: boolean;
  registrado_por: string;
  registrado_por_nome: string;
  data_ocorrencia: string;
  bloqueado: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdvertenciaLink {
  id: string;
  tenant_id: string;
  ocorrencia_id: string;
  token: string;
  destinatario_email: string;
  destinatario_nome: string | null;
  status: AdvertenciaStatus;
  documento_url: string | null;
  documento_nome: string | null;
  enviado_em: string | null;
  formalizado_em: string | null;
  expira_em: string;
  created_at: string;
  updated_at: string;
}

export const CATEGORIA_LABELS: Record<FeedbackCategoria, string> = {
  reconhecimento: "Reconhecimento",
  alinhamento: "Alinhamento",
  desenvolvimento: "Desenvolvimento",
};

export const CATEGORIA_COLORS: Record<FeedbackCategoria, string> = {
  reconhecimento: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  alinhamento: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  desenvolvimento: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export const CATEGORIA_ICONS: Record<FeedbackCategoria, string> = {
  reconhecimento: "🏆",
  alinhamento: "🎯",
  desenvolvimento: "📈",
};

export const TIPO_LABELS: Record<OcorrenciaTipo, string> = {
  positiva: "Positiva",
  neutra: "Neutra",
  negativa: "Negativa",
};

export const TIPO_COLORS: Record<OcorrenciaTipo, string> = {
  positiva: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  neutra: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  negativa: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};
