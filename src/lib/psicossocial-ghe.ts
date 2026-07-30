export const MIN_ELEGIVEIS_GHE = 5;

interface ValidarElegibilidadeGHEParams {
  isEdicao: boolean;
  vinculos: number;
  elegiveis: number;
  baseRespondentes: number;
  ausenciasJustificadas: number;
}

/**
 * Valida a composição de um GHE para uso em pesquisas.
 * Um GHE existente pode ficar temporariamente sem composição para permitir
 * sua desvinculação e posterior exclusão.
 */
export function validarElegibilidadeGHE({
  isEdicao,
  vinculos,
  elegiveis,
  baseRespondentes,
  ausenciasJustificadas,
}: ValidarElegibilidadeGHEParams): string | null {
  if (isEdicao && vinculos === 0) return null;

  if (elegiveis < MIN_ELEGIVEIS_GHE) {
    return `Este GHE possui apenas ${elegiveis} colaborador(es) elegível(is). O mínimo permitido é ${MIN_ELEGIVEIS_GHE} para garantir o anonimato (ISO 45003).`;
  }

  if (baseRespondentes < MIN_ELEGIVEIS_GHE) {
    return `Após descontar ${ausenciasJustificadas} ausência(s) justificada(s), restam apenas ${baseRespondentes} elegível(is). Mínimo: ${MIN_ELEGIVEIS_GHE}.`;
  }

  return null;
}