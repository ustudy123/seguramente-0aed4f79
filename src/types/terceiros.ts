export type TerceiroStatus = "liberado" | "restrito" | "bloqueado";
export type TerceiroAcesso = "eventual" | "recorrente" | "continuo";
export type TerceiroDocStatus = "valido" | "a_vencer" | "vencido" | "pendente";

export interface Terceiro {
  id: string;
  tenant_id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  atividade_principal: string | null;
  cnae: string | null;
  responsavel_nome: string | null;
  responsavel_cargo: string | null;
  email: string | null;
  telefone: string | null;
  tipo_servico: string[] | null;
  unidades: string[] | null;
  setores: string[] | null;
  tipo_acesso: TerceiroAcesso;
  contrato_inicio: string | null;
  contrato_fim: string | null;
  atividade_risco: boolean;
  status: TerceiroStatus;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TerceiroTrabalhador {
  id: string;
  tenant_id: string;
  terceiro_id: string;
  nome: string;
  cpf: string | null;
  funcao: string | null;
  atividades: string[] | null;
  unidade: string | null;
  setor: string | null;
  atividades_risco: string[] | null;
  status: TerceiroStatus;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface TerceiroDocumento {
  id: string;
  tenant_id: string;
  terceiro_id: string;
  trabalhador_id: string | null;
  tipo: string;
  nome: string;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  arquivo_tamanho: number | null;
  data_emissao: string | null;
  data_validade: string | null;
  status: TerceiroDocStatus;
  observacoes: string | null;
  criado_por: string | null;
  criado_por_nome: string | null;
  created_at: string;
  updated_at: string;
}

export interface TerceiroTreinamento {
  id: string;
  tenant_id: string;
  terceiro_id: string;
  trabalhador_id: string;
  tipo: string;
  descricao: string | null;
  data_realizacao: string | null;
  carga_horaria: number | null;
  data_validade: string | null;
  certificado_url: string | null;
  certificado_nome: string | null;
  status: TerceiroDocStatus;
  criado_por: string | null;
  criado_por_nome: string | null;
  created_at: string;
  updated_at: string;
}

export const TIPOS_SERVICO = [
  "Manutenção",
  "Pintura",
  "Elétrica",
  "Mecânica",
  "Limpeza técnica",
  "Obras",
  "Segurança",
  "TI",
  "Outros",
];

export const ATIVIDADES_RISCO = [
  "Trabalho em Altura",
  "Espaço Confinado",
  "Eletricidade",
  "Máquinas e Equipamentos",
  "Pintura Industrial",
  "Manutenção Mecânica",
  "Soldagem",
  "Trabalho a Quente",
];

export const TIPOS_DOCUMENTO_EMPRESA = [
  "PGR",
  "PCMSO",
  "LTCAT",
  "Contrato",
  "Certificado/Registro Legal",
  "Seguro",
  "Outros",
];

export const TIPOS_DOCUMENTO_TRABALHADOR = [
  "ASO",
  "Certificado NR-10",
  "Certificado NR-12",
  "Certificado NR-18",
  "Certificado NR-33",
  "Certificado NR-35",
  "Ficha de EPI",
  "Outros",
];

export const TIPOS_TREINAMENTO = [
  "NR-10",
  "NR-12",
  "NR-18",
  "NR-33",
  "NR-35",
  "NR-06 (EPI)",
  "Integração SST",
  "Outros",
];
