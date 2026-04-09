export interface Cliente {
  id: string;
  nome_empresa: string;
  cnpj: string | null;
  poc_nome: string | null;
  poc_email: string | null;
  poc_telefone: string | null;
  fase: string;
  segmento: string | null;
  quantidade_colaboradores: number | null;
  tipo_cliente: string;
  onboarding_token: string | null;
}

export interface Contrato {
  id: string;
  token: string;
  status: 'pendente' | 'enviado' | 'assinado' | 'recusado';
  assinado_em: string | null;
  html_assinado: string | null;
}

export interface DocumentoLink {
  id: string;
  tipo: string;
  token: string;
  status: 'pendente' | 'visualizado' | 'aceito' | 'recusado';
  aceito_em: string | null;
  html_assinado: string | null;
  html_documento: string | null;
}

export interface OnboardingState {
  empresa_cadastrada: boolean;
  estrutura_cadastrada: boolean;
  colaboradores_cadastrados: boolean;
  diagnostico_iniciado: boolean;
  contrato_assinado: boolean;
  ata_aceita: boolean;
}

export interface BlocoRespostas { [perguntaId: string]: boolean }
