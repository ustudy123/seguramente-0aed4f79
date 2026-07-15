export type QaCasoTipo = "feliz" | "alternativo" | "negativo" | "excecao";
export type QaCasoStatus = "rascunho" | "aprovado" | "obsoleto";
export type QaPrioridade = "critica" | "alta" | "media" | "baixa";
export type QaNivel = "api" | "e2e";
export type QaStatusDoc = "nao_iniciado" | "bloqueado" | "em_andamento" | "documentado" | "dispensado";

export const QA_STATUS_DOC_LABELS: Record<QaStatusDoc, string> = {
  nao_iniciado: "Na fila",
  bloqueado: "Bloqueado",
  em_andamento: "Em andamento",
  documentado: "Documentado",
  dispensado: "Dispensado",
};

export interface QaModulo {
  id: string;
  parent_id: string | null;
  label: string;
  path: string;
  icone: string | null;
  ordem: number;
  prioridade_doc: number;
  status_doc: QaStatusDoc;
  motivo_bloqueio: string | null;
  created_at: string;
}

/** Módulo com os filhos aninhados (montado no cliente). */
export interface QaModuloNode extends QaModulo {
  filhos: QaModuloNode[];
}

export interface QaPasso {
  ordem: number;
  acao: string;
  resultado_esperado: string;
}

export interface QaCasoTeste {
  id: string;
  modulo_id: string;
  codigo: string | null;
  titulo: string;
  tipo: QaCasoTipo;
  prioridade: QaPrioridade;
  status: QaCasoStatus;
  objetivo: string | null;
  pre_condicoes: string | null;
  passos: QaPasso[];
  resultado_esperado: string | null;
  observacoes: string | null;
  nivel: QaNivel;
  versao: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const QA_TIPO_LABELS: Record<QaCasoTipo, string> = {
  feliz: "Caminho feliz",
  alternativo: "Caminho alternativo",
  negativo: "Caminho negativo",
  excecao: "Exceção",
};

/** Descrição do que cada tipo cobre — usada como ajuda no editor. */
export const QA_TIPO_DESCRICAO: Record<QaCasoTipo, string> = {
  feliz: "O fluxo principal, tudo como esperado.",
  alternativo: "Um caminho válido, porém diferente do principal.",
  negativo: "O usuário faz algo inválido — o sistema deve barrar.",
  excecao: "Condição fora do fluxo (dado retroativo, concorrência, falha externa).",
};

export const QA_STATUS_LABELS: Record<QaCasoStatus, string> = {
  rascunho: "Rascunho",
  aprovado: "Aprovado",
  obsoleto: "Obsoleto",
};

export const QA_PRIORIDADE_LABELS: Record<QaPrioridade, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const QA_NIVEL_LABELS: Record<QaNivel, string> = {
  api: "API / dados",
  e2e: "E2E / tela",
};

/** Monta a árvore a partir da lista plana vinda do banco. */
export function montarArvore(modulos: QaModulo[]): QaModuloNode[] {
  const mapa = new Map<string, QaModuloNode>();
  modulos.forEach((m) => mapa.set(m.id, { ...m, filhos: [] }));

  const raizes: QaModuloNode[] = [];
  mapa.forEach((node) => {
    if (node.parent_id && mapa.has(node.parent_id)) {
      mapa.get(node.parent_id)!.filhos.push(node);
    } else {
      raizes.push(node);
    }
  });

  const ordenar = (nodes: QaModuloNode[]) => {
    nodes.sort(
      (a, b) =>
        (a.prioridade_doc ?? 99) - (b.prioridade_doc ?? 99) ||
        a.ordem - b.ordem ||
        a.label.localeCompare(b.label)
    );
    nodes.forEach((n) => ordenar(n.filhos));
  };
  ordenar(raizes);
  return raizes;
}
