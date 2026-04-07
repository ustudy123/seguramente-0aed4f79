import { supabase } from "@/integrations/supabase/client";

type PastaInsert = {
  id: string;
  nome: string;
  tipo: string;
  ordem: number;
  icone: string | null;
  pasta_pai_id: string | null;
  filial_id: string | null;
  colaborador_id: string | null;
  colaborador_cpf: string | null;
  colaborador_nome: string | null;
  ano: number | null;
  tenant_id: string;
  criado_por: string;
  criado_por_nome: string | null;
};

const mk = (
  id: string, nome: string, tipo: string, ordem: number, icone: string | null,
  pai: string | null, tenantId: string, userId: string, userName: string | null
): PastaInsert => ({
  id, nome, tipo, ordem, icone, pasta_pai_id: pai,
  filial_id: null, colaborador_id: null, colaborador_cpf: null,
  colaborador_nome: null, ano: null, tenant_id: tenantId,
  criado_por: userId, criado_por_nome: userName,
});

export async function autoGenerateFolderStructure(
  tenantId: string,
  userId: string,
  userName: string | null
) {
  const pastasToCreate: PastaInsert[] = [];
  const m = (id: string, nome: string, tipo: string, ordem: number, icone: string | null, pai: string | null) =>
    mk(id, nome, tipo, ordem, icone, pai, tenantId, userId, userName);

  // 1. GOVERNANÇA E ADMINISTRAÇÃO
  const govId = crypto.randomUUID();
  pastasToCreate.push(m(govId, "Governança e Administração", "root", 0, "Scale", null));
  [
    ["Contrato Social e Estatuto", "Building2"],
    ["Políticas e Diretrizes", "Target"],
    ["Licenças e Autorizações", "FileCheck"],
    ["Certidões", "Award"],
    ["Registros em Conselhos", "Shield"],
  ].forEach(([nome, icone], i) => {
    pastasToCreate.push(m(crypto.randomUUID(), nome, "categoria", i, icone, govId));
  });

  // 2. SISTEMA DE GESTÃO
  const sgId = crypto.randomUUID();
  pastasToCreate.push(m(sgId, "Sistema de Gestão", "root", 1, "BookOpen", null));
  [
    ["Procedimentos e Instruções de Trabalho", "FileText"],
    ["Registros da Qualidade", "CheckSquare"],
  ].forEach(([nome, icone], i) => {
    pastasToCreate.push(m(crypto.randomUUID(), nome, "categoria", i, icone, sgId));
  });

  // 3. GESTÃO DE RISCOS
  const riscosId = crypto.randomUUID();
  pastasToCreate.push(m(riscosId, "Gestão de Riscos", "root", 2, "AlertTriangle", null));
  [
    ["Inventário de Riscos", "List"],
    ["Análise de Riscos (APR / HAZOP)", "Search"],
    ["Planos de Emergência", "ShieldAlert"],
  ].forEach(([nome, icone], i) => {
    pastasToCreate.push(m(crypto.randomUUID(), nome, "categoria", i, icone, riscosId));
  });

  // 4. SST
  const sstId = crypto.randomUUID();
  pastasToCreate.push(m(sstId, "SST", "root", 3, "Shield", null));
  const sstProgramasId = crypto.randomUUID();
  pastasToCreate.push(m(sstProgramasId, "Programas Legais", "categoria", 0, "FileCheck", sstId));
  ["PGR", "PCMSO", "LTCAT"].forEach((n, i) => {
    pastasToCreate.push(m(crypto.randomUUID(), n, "custom", i, null, sstProgramasId));
  });
  const treiId = crypto.randomUUID();
  pastasToCreate.push(m(treiId, "Treinamentos", "categoria", 1, "GraduationCap", sstId));
  [
    "NR-01 — Disposições Gerais e Gerenciamento de Riscos",
    "NR-05 — CIPA",
    "NR-06 — EPIs",
  ].forEach((n, i) => {
    pastasToCreate.push(m(crypto.randomUUID(), n, "custom", i, null, treiId));
  });
  const regSSTId = crypto.randomUUID();
  pastasToCreate.push(m(regSSTId, "Registros e Evidências", "categoria", 2, "ClipboardList", sstId));
  ["CAT — Comunicação de Acidente", "Inspeções de Segurança", "Permissões de Trabalho"].forEach((n, i) => {
    pastasToCreate.push(m(crypto.randomUUID(), n, "custom", i, null, regSSTId));
  });

  // 5. GESTÃO DE PESSOAS
  const pessoasId = crypto.randomUUID();
  pastasToCreate.push(m(pessoasId, "Gestão de Pessoas", "root", 5, "Users", null));

  // 6. INVESTIGAÇÃO DE INCIDENTES
  const incId = crypto.randomUUID();
  pastasToCreate.push(m(incId, "Investigação de Incidentes", "root", 6, "SearchX", null));
  ["Acidentes de Trabalho", "Quase Acidentes", "Não Conformidades"].forEach((n, i) => {
    pastasToCreate.push(m(crypto.randomUUID(), n, "categoria", i, null, incId));
  });

  // 7. AUDITORIAS E MELHORIA CONTÍNUA
  const audId = crypto.randomUUID();
  pastasToCreate.push(m(audId, "Auditorias e Melhoria Contínua", "root", 7, "CheckSquare", null));
  [
    ["Auditorias Internas", "ClipboardCheck"],
    ["Auditorias Externas e Certificações", "Award"],
    ["Ações Corretivas e Preventivas", "RefreshCw"],
  ].forEach(([nome, icone], i) => {
    pastasToCreate.push(m(crypto.randomUUID(), nome, "categoria", i, icone, audId));
  });

  // Verificar pastas existentes e criar apenas as faltantes
  const { data: existentes } = await supabase
    .from("documento_pastas")
    .select("nome, pasta_pai_id")
    .eq("tenant_id", tenantId);

  const existingSet = new Set(
    (existentes || []).map((p: { nome: string; pasta_pai_id: string | null }) =>
      `${p.nome}||${p.pasta_pai_id ?? "null"}`
    )
  );

  const novas = pastasToCreate.filter((p) => {
    const key = `${p.nome}||${p.pasta_pai_id ?? "null"}`;
    return !existingSet.has(key);
  });

  if (novas.length === 0) return 0;

  const chunkSize = 100;
  for (let i = 0; i < novas.length; i += chunkSize) {
    const chunk = novas.slice(i, i + chunkSize);
    const { error } = await supabase.from("documento_pastas").insert(chunk);
    if (error) throw error;
  }

  return novas.length;
}
