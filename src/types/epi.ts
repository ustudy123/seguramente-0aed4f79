import type { Database } from "@/integrations/supabase/types";

// Enums
export type EpiStatus = Database["public"]["Enums"]["epi_status"];
export type EntregaStatus = Database["public"]["Enums"]["entrega_status"];

// Tipos de tabela
export type EpiTipo = Database["public"]["Tables"]["epi_tipos"]["Row"] & {
  // Campos adicionados pela migração
  categoria?: string | null;
  ca_numero?: string | null;
  marca?: string | null;
  fabricante?: string | null;
  estoque_minimo?: number | null;
  quantidade_estoque?: number | null;
  is_active?: boolean | null;
};
export type EpiTipoInsert = Database["public"]["Tables"]["epi_tipos"]["Insert"];

export type Epi = Database["public"]["Tables"]["epis"]["Row"];
export type EpiInsert = Database["public"]["Tables"]["epis"]["Insert"];
export type EpiUpdate = Database["public"]["Tables"]["epis"]["Update"];

export type EpiEntrega = Database["public"]["Tables"]["epi_entregas"]["Row"] & {
  // Campos adicionados pela migração
  assinatura_url?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  signed_at?: string | null;
  liveness_detected?: boolean | null;
  liveness_data?: { actions: string[]; timestamps: string[] } | null;
  data_validade?: string | null;
  employee_id?: string | null;
};
export type EpiEntregaInsert = Database["public"]["Tables"]["epi_entregas"]["Insert"];
export type EpiEntregaUpdate = Database["public"]["Tables"]["epi_entregas"]["Update"];

export type EpiMovimentacao = Database["public"]["Tables"]["epi_movimentacoes"]["Row"];

// Tipos estendidos
export interface EpiCompleto extends Epi {
  tipo: EpiTipo;
  entregas?: EpiEntrega[];
}

export interface EpiEntregaCompleta extends EpiEntrega {
  epi: EpiCompleto;
}

// Labels e cores
export const EPI_STATUS_LABELS: Record<EpiStatus, string> = {
  disponivel: "Disponível",
  em_uso: "Em Uso",
  danificado: "Danificado",
  vencido: "Vencido",
  descartado: "Descartado",
};

export const EPI_STATUS_COLORS: Record<EpiStatus, string> = {
  disponivel: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  em_uso: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  danificado: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  vencido: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  descartado: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

export const ENTREGA_STATUS_LABELS: Record<EntregaStatus, string> = {
  ativa: "Ativa",
  devolvido: "Devolvido",
  extraviado: "Extraviado",
  vencido: "Vencido",
};

export const ENTREGA_STATUS_COLORS: Record<EntregaStatus, string> = {
  ativa: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  devolvido: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  extraviado: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  vencido: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
};

// Tipos de EPI padrão (para seed inicial)
export const TIPOS_EPI_PADRAO = [
  { nome: "Capacete de Segurança", descricao: "Proteção para a cabeça", validade_meses: 60 },
  { nome: "Óculos de Proteção", descricao: "Proteção ocular", validade_meses: 24 },
  { nome: "Protetor Auricular", descricao: "Proteção auditiva", validade_meses: 12 },
  { nome: "Luvas de Segurança", descricao: "Proteção para as mãos", validade_meses: 6 },
  { nome: "Botina de Segurança", descricao: "Proteção para os pés", validade_meses: 12 },
  { nome: "Cinto de Segurança", descricao: "Proteção contra quedas", validade_meses: 24 },
  { nome: "Máscara Respiratória", descricao: "Proteção respiratória", validade_meses: 6 },
  { nome: "Avental de Segurança", descricao: "Proteção do tronco", validade_meses: 12 },
  { nome: "Protetor Facial", descricao: "Proteção facial completa", validade_meses: 24 },
  { nome: "Colete Refletivo", descricao: "Sinalização de alta visibilidade", validade_meses: 24 },
];

// Motivos de entrega padrão
export const MOTIVOS_ENTREGA = [
  "Admissão",
  "Substituição por Desgaste",
  "Substituição por Dano",
  "Substituição por Perda",
  "Vencimento do EPI anterior",
  "Mudança de Função",
  "Treinamento",
  "Outro",
];
