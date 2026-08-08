export const MIN_ELEGIVEIS_GHE = 5;

interface ValidarElegibilidadeGHEParams {
  isEdicao: boolean;
  vinculos: number;
  elegiveis: number;
  baseRespondentes: number;
  ausenciasJustificadas: number;
  /**
   * Total de colaboradores elegíveis do CNPJ. Micro empresas (< MIN_ELEGIVEIS_GHE)
   * não conseguem, por definição, formar um GHE com o mínimo de anonimato — nesse
   * caso a criação é liberada e o anonimato passa a ser tratado na liberação dos
   * resultados, não no cadastro.
   */
  totalElegiveisEmpresa?: number;
}

/** Empresa pequena demais para atingir o mínimo de anonimato em qualquer GHE. */
export function empresaAbaixoDoMinimo(totalElegiveisEmpresa?: number): boolean {
  return typeof totalElegiveisEmpresa === "number" && totalElegiveisEmpresa < MIN_ELEGIVEIS_GHE;
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
  totalElegiveisEmpresa,
}: ValidarElegibilidadeGHEParams): string | null {
  if (vinculos === 0) return null;

  // Empresas com menos de 5 colaboradores no total: criação liberada.
  if (empresaAbaixoDoMinimo(totalElegiveisEmpresa)) return null;

  if (elegiveis < MIN_ELEGIVEIS_GHE) {
    return `Este GHE possui apenas ${elegiveis} colaborador(es) elegível(is). O mínimo permitido é ${MIN_ELEGIVEIS_GHE} para garantir o anonimato (ISO 45003).`;
  }

  if (baseRespondentes < MIN_ELEGIVEIS_GHE) {
    return `Após descontar ${ausenciasJustificadas} ausência(s) justificada(s), restam apenas ${baseRespondentes} elegível(is). Mínimo: ${MIN_ELEGIVEIS_GHE}.`;
  }

  return null;
}
