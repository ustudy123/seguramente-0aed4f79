// ─── Types ───────────────────────────────────────────────────────────────────

export type Fase =
  | 'prospeccao'
  | 'qualificacao'
  | 'kickoff'
  | 'ativo'
  | 'suspenso'
  | 'encerrado';

export type TipoDoc =
  | 'contrato_programa_validador'
  | 'ata_kickoff';

export interface Cliente {
  id: string;
  nome_empresa: string;
  cnpj: string | null;
  poc_nome: string | null;
  poc_email: string | null;
  poc_telefone: string | null;
  poc_cargo: string | null;
  fase: Fase;
  data_inicio_piloto: string | null;
  data_fim_piloto: string | null;
  segmento: string | null;
  tamanho_empresa: string | null;
  quantidade_colaboradores: number | null;
  aceita_beta: boolean;
  observacoes: string | null;
  responsavel_YourEyes: string | null;
  endereco: string | null;
  representante: string | null;
  cidade_foro: string | null;
  tipo_cliente: 'tester' | 'pagante';
  valor_mensal: number | null;
  dia_vencimento: number | null;
  plano: string | null;
  modulos_contratados: string[] | null;
  data_contrato: string | null;
  data_vigencia_fim: string | null;
  created_at: string;
}

export interface Contrato {
  id: string;
  cliente_id: string;
  token: string;
  status: 'pendente' | 'enviado' | 'assinado' | 'recusado';
  html_contrato: string;
  html_assinado: string | null;
  assinatura_img: string | null;
  assinado_em: string | null;
  assinado_por: string | null;
  expira_em: string;
  created_at: string;
}

export interface Documento {
  id: string;
  cliente_id: string;
  tipo: TipoDoc;
  status: 'pendente' | 'enviado' | 'aceito' | 'recusado';
  enviado_em: string | null;
  aceito_em: string | null;
  versao: string | null;
  observacao: string | null;
}

export interface Historico {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  autor: string | null;
  created_at: string;
}

export interface DocumentoLink {
  id: string;
  cliente_id: string;
  documento_id: string | null;
  tipo: TipoDoc;
  token: string;
  status: 'pendente' | 'visualizado' | 'aceito' | 'recusado';
  aceito_em: string | null;
  aceito_por: string | null;
  created_at: string;
}
