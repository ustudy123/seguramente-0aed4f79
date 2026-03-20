export type EventoSSTTipo = "incidente" | "acidente";
export type EventoSSTStatus = "em_aberto" | "em_analise" | "acoes_andamento" | "concluido";
export type AcidenteGravidadeLesao = "sem_lesao" | "leve" | "moderada" | "grave";
export type AcidenteAfastamento = "sem_afastamento" | "ate_15_dias" | "mais_15_dias";
export type AcidenteAtendimento = "nao_necessario" | "ambulatorial" | "hospitalar";
export type CATTipo = "inicial" | "reabertura" | "comunicacao_obito";
export type TipoAcidenteLegal = "tipico" | "trajeto" | "doenca_ocupacional" | "ntep";
export type NexoCausal = "confirmado" | "suspeito" | "descartado";

export interface EventoSST {
  id: string;
  tenant_id: string;
  codigo: string | null;
  tipo: EventoSSTTipo;
  status: EventoSSTStatus;
  data_evento: string;
  hora_evento: string | null;
  unidade: string | null;
  setor: string | null;
  local_especifico: string | null;
  turno: string | null;
  colaborador_id: string | null;
  colaborador_nome: string | null;
  colaborador_funcao: string | null;
  colaborador_tempo_empresa: string | null;
  outros_envolvidos: string | null;
  categoria_principal: string | null;
  origem_predominante: string | null;
  descricao: string | null;
  percepcao_causa: string | null;
  gravidade_potencial: string | null;
  gravidade_lesao: AcidenteGravidadeLesao | null;
  afastamento: AcidenteAfastamento | null;
  obito: boolean;
  atendimento: AcidenteAtendimento | null;
  cat_emitida: boolean;
  cat_numero: string | null;
  cat_data_emissao: string | null;
  cat_tipo: CATTipo | null;
  cat_arquivo_url: string | null;
  cat_arquivo_nome: string | null;
  cat_observacoes: string | null;
  fatores_ergonomicos: string[];
  // Campos legais (NR, eSocial, NTEP)
  tipo_acidente_legal: TipoAcidenteLegal | null;
  cid10: string | null;
  nexo_causal: NexoCausal | null;
  agente_causador_esocial: string | null;
  dias_afastamento_total: number | null;
  horas_perdidas: number | null;
  criado_por: string | null;
  criado_por_nome: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventoSSTAnexo {
  id: string;
  tenant_id: string;
  evento_id: string;
  arquivo_url: string;
  arquivo_nome: string;
  arquivo_tamanho: number | null;
  tipo: string | null;
  criado_por: string | null;
  criado_por_nome: string | null;
  created_at: string;
}

export const CATEGORIAS_PRINCIPAIS = [
  "Quase queda",
  "Queda em mesmo nível",
  "Queda de altura",
  "Choque contra objeto",
  "Corte / laceração",
  "Esmagamento",
  "Exposição a agente químico",
  "Exposição a agente biológico",
  "Exposição a ruído",
  "Exposição a calor",
  "Ato inseguro",
  "Condição insegura",
  "Falha de EPI",
  "Falha de máquina / equipamento",
];

export const ORIGENS_PREDOMINANTES = [
  "Comportamental",
  "Organizacional (pressão, falta de recurso, falta de pessoal)",
  "Técnica (máquina, ferramenta, EPI, layout)",
  "Ambiental (iluminação, temperatura, ruído, piso)",
];

export const FATORES_ERGONOMICOS = [
  "Ritmo de trabalho acelerado / pressa",
  "Pressão excessiva por meta / produção",
  "Jornada longa / plantão prolongado",
  "Falta de pausas adequadas",
  "Falta de treinamento ou treinamento insuficiente",
  "Falha ou ausência de procedimento (POP, instruções)",
  "Layout inadequado do posto",
  "Iluminação inadequada",
  "Ruído intenso",
  "Exposição a calor / frio",
  "Sinais aparentes de estresse / exaustão emocional",
  "Turno noturno / 3º turno",
];

export const TURNOS = ["1º Turno", "2º Turno", "3º Turno", "Outro"];
