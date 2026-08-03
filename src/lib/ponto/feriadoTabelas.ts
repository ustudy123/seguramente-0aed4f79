/** RN20-22 — tabelas nomeadas/numeradas de feriados reaproveitáveis por filiais. */

export type FeriadoItemTipo = "feriado" | "facultativo";

export interface FeriadoTabela {
  id: string;
  tenant_id: string;
  numero: number | null;
  nome: string;
  uf: string | null;
  municipio: string | null;
  codigo_ibge: string | null;
  ano: number | null;
  descricao: string | null;
  ativo: boolean;
}

export interface FeriadoTabelaItem {
  id: string;
  tabela_id: string;
  nome: string;
  data: string | null;
  recorrente: boolean;
  dia: number | null;
  mes: number | null;
  tipo: FeriadoItemTipo;
  ativo: boolean;
}

export interface FeriadoTabelaVinculo {
  id: string;
  tabela_id: string;
  empresa_id: string;
}

export interface FeriadoTabelaForm {
  nome: string;
  uf: string;
  municipio: string;
  codigo_ibge: string;
  ano: string;
  descricao: string;
  ativo: boolean;
}

export interface FeriadoItemForm {
  nome: string;
  data: string;
  recorrente: boolean;
  dia: string;
  mes: string;
  tipo: FeriadoItemTipo;
  ativo: boolean;
}

export const formVazioTabela = (): FeriadoTabelaForm => ({
  nome: "",
  uf: "",
  municipio: "",
  codigo_ibge: "",
  ano: "",
  descricao: "",
  ativo: true,
});

export const formVazioItem = (): FeriadoItemForm => ({
  nome: "",
  data: "",
  recorrente: false,
  dia: "",
  mes: "",
  tipo: "feriado",
  ativo: true,
});

/** Rótulo "Tabela 1 — Pato Branco/PR (2026)". */
export function rotuloTabela(t: FeriadoTabela): string {
  const base = `Tabela ${t.numero ?? "—"} — ${t.nome}`;
  const local = t.municipio ? ` · ${t.municipio}${t.uf ? `/${t.uf}` : ""}` : t.uf ? ` · ${t.uf}` : "";
  const ano = t.ano ? ` (${t.ano})` : " (permanente)";
  return `${base}${local}${ano}`;
}

export function validarTabela(form: FeriadoTabelaForm): string | null {
  if (!form.nome.trim()) return "Informe o nome da tabela.";
  if (form.ano && !/^\d{4}$/.test(form.ano.trim())) return "Ano de vigência inválido.";
  return null;
}

export function validarItem(form: FeriadoItemForm): string | null {
  if (!form.nome.trim()) return "Informe o nome do feriado.";
  if (form.recorrente) {
    const dia = Number(form.dia);
    const mes = Number(form.mes);
    if (!dia || !mes) return "Feriado recorrente exige dia e mês.";
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return "Dia ou mês inválido.";
  } else if (!form.data) {
    return "Informe a data.";
  }
  return null;
}

export function payloadTabela(form: FeriadoTabelaForm, tenantId: string) {
  return {
    tenant_id: tenantId,
    nome: form.nome.trim(),
    uf: form.uf ? form.uf.toUpperCase() : null,
    municipio: form.municipio.trim() || null,
    codigo_ibge: form.codigo_ibge.trim() || null,
    ano: form.ano ? Number(form.ano) : null,
    descricao: form.descricao.trim() || null,
    ativo: form.ativo,
  };
}

export function payloadItem(form: FeriadoItemForm, tabelaId: string, tenantId: string) {
  const recorrente = form.recorrente;
  return {
    tenant_id: tenantId,
    tabela_id: tabelaId,
    nome: form.nome.trim(),
    data: recorrente ? null : form.data,
    recorrente,
    dia: recorrente ? Number(form.dia) : null,
    mes: recorrente ? Number(form.mes) : null,
    tipo: form.tipo,
    ativo: form.ativo,
  };
}

/** Data exibida do item no ano de referência. */
export function dataItem(item: FeriadoTabelaItem, ano: number): string {
  if (item.recorrente) {
    if (!item.dia || !item.mes) return "—";
    return `${String(item.dia).padStart(2, "0")}/${String(item.mes).padStart(2, "0")}/${ano}`;
  }
  if (!item.data) return "—";
  const [y, m, d] = item.data.split("-");
  return `${d}/${m}/${y}`;
}
