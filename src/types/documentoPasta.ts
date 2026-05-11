export interface DocumentoPasta {
  id: string;
  tenant_id: string;
  nome: string;
  tipo: 'root' | 'unidade' | 'colaborador' | 'ano' | 'mes' | 'categoria' | 'custom';
  pasta_pai_id: string | null;
  filial_id: string | null;
  colaborador_id: string | null;
  colaborador_cpf: string | null;
  colaborador_nome: string | null;
  ano: number | null;
  mes: number | null;
  ordem: number;
  icone: string | null;
  cor: string | null;
  criado_por: string | null;
  criado_por_nome: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentoPastaNode extends DocumentoPasta {
  children: DocumentoPastaNode[];
  documentos: DocumentoItem[];
  filial_nome?: string;
  isVirtual?: boolean;
  virtualLabel?: string;
  totalDescendantes?: number;
}

export interface DocumentoItem {
  id: string;
  nome_original: string;
  tipo: string;
  tamanho: number;
  status: 'valido' | 'vencendo' | 'vencido';
  data_validade: string | null;
  storage_path: string;
  created_at: string;
}

export interface DocumentoAuditLog {
  id: string;
  tenant_id: string;
  documento_id: string;
  documento_nome: string;
  acao: 'upload' | 'move' | 'rename' | 'delete' | 'restore';
  pasta_origem_id: string | null;
  pasta_origem_nome: string | null;
  pasta_destino_id: string | null;
  pasta_destino_nome: string | null;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  usuario_id: string | null;
  usuario_nome: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface CategoriaPadrao {
  id: string;
  tenant_id: string;
  grupo: 'juridico' | 'licencas' | 'registros' | 'sst_empresa' | 'colaborador';
  nome: string;
  descricao: string | null;
  icone: string | null;
  obrigatorio: boolean;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// Estrutura padrão de categorias para documentos da empresa
export const CATEGORIAS_EMPRESA_PADRAO = {
  juridico: {
    nome: 'Jurídico',
    icone: 'Scale',
    tipos: [
      { nome: 'Contrato Social', obrigatorio: true },
      { nome: 'Ata de Reunião', obrigatorio: false },
      { nome: 'Procuração', obrigatorio: false },
      { nome: 'Estatuto', obrigatorio: false },
    ],
  },
  licencas: {
    nome: 'Licenças e Alvarás',
    icone: 'FileCheck',
    tipos: [
      { nome: 'Alvará de Funcionamento', obrigatorio: true },
      { nome: 'Licença Vigilância Sanitária', obrigatorio: false },
      { nome: 'Licença Bombeiros (AVCB)', obrigatorio: false },
      { nome: 'Licença Ambiental', obrigatorio: false },
    ],
  },
  registros: {
    nome: 'Registros em Conselhos',
    icone: 'Award',
    tipos: [
      { nome: 'Registro CRM', obrigatorio: false },
      { nome: 'Registro CREA', obrigatorio: false },
      { nome: 'Registro CRQ', obrigatorio: false },
      { nome: 'Registro CRO', obrigatorio: false },
      { nome: 'Outros Registros', obrigatorio: false },
    ],
  },
  sst_empresa: {
    nome: 'SST da Empresa',
    icone: 'Shield',
    tipos: [
      { nome: 'PCMSO', obrigatorio: true },
      { nome: 'PGR', obrigatorio: true },
      { nome: 'LTCAT', obrigatorio: false },
      { nome: 'PPP', obrigatorio: false },
      { nome: 'Laudo Ergonômico (AET)', obrigatorio: false },
      { nome: 'PPRA', obrigatorio: false },
    ],
  },
};

// Meses para organização por data
export const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];
