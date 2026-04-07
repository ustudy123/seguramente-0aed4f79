/**
 * Creates a folder for a collaborator under "Gestão de Pessoas" in the Documentos module.
 * Idempotent: if the folder already exists, returns its ID.
 * Also creates standard subfolders (Admissão, Vida Funcional, Saúde Ocupacional, Desligamento).
 */
import { supabase } from "@/integrations/supabase/client";

interface CriarPastaColaboradorParams {
  tenantId: string;
  colaboradorId: string;
  colaboradorNome: string;
  colaboradorCpf?: string | null;
}

const SUBPASTAS_PADRAO = ["Admissão", "Vida Funcional", "Saúde Ocupacional", "Desligamento"];

export async function criarPastaColaborador(params: CriarPastaColaboradorParams): Promise<string | null> {
  const { tenantId, colaboradorId, colaboradorNome, colaboradorCpf } = params;

  try {
    // 1. Check if collaborator folder already exists
    const { data: existing } = await supabase
      .from("documento_pastas")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("colaborador_id", colaboradorId)
      .eq("tipo", "colaborador")
      .maybeSingle();

    if (existing?.id) {
      // Ensure subfolders exist
      await ensureSubfolders(tenantId, existing.id);
      return existing.id;
    }

    // 2. Find "Gestão de Pessoas" root folder
    const { data: gestaoPessoas } = await supabase
      .from("documento_pastas")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("nome", "Gestão de Pessoas")
      .is("pasta_pai_id", null)
      .maybeSingle();

    let parentId = gestaoPessoas?.id || null;

    // If root doesn't exist, create it
    if (!parentId) {
      const { data: created } = await supabase
        .from("documento_pastas")
        .insert({
          tenant_id: tenantId,
          nome: "Gestão de Pessoas",
          tipo: "root" as const,
          ordem: 5,
          icone: "Users",
        })
        .select("id")
        .single();
      parentId = created?.id || null;
    }

    if (!parentId) return null;

    // 3. Create collaborator folder
    const { data: colabPasta } = await supabase
      .from("documento_pastas")
      .insert({
        tenant_id: tenantId,
        nome: colaboradorNome,
        tipo: "colaborador" as const,
        pasta_pai_id: parentId,
        colaborador_id: colaboradorId,
        colaborador_cpf: colaboradorCpf || null,
        colaborador_nome: colaboradorNome,
        ordem: 0,
        icone: "User",
      })
      .select("id")
      .single();

    const colabPastaId = colabPasta?.id || null;

    // 4. Create standard subfolders
    if (colabPastaId) {
      await ensureSubfolders(tenantId, colabPastaId);
    }

    return colabPastaId;
  } catch (error) {
    console.error("[criarPastaColaborador] Erro:", error);
    return null;
  }
}

async function ensureSubfolders(tenantId: string, pastaColaboradorId: string) {
  const { data: existingSubs } = await supabase
    .from("documento_pastas")
    .select("nome")
    .eq("tenant_id", tenantId)
    .eq("pasta_pai_id", pastaColaboradorId);

  const existingNames = new Set((existingSubs || []).map(s => s.nome));

  for (let i = 0; i < SUBPASTAS_PADRAO.length; i++) {
    if (!existingNames.has(SUBPASTAS_PADRAO[i])) {
      await supabase.from("documento_pastas").insert({
        tenant_id: tenantId,
        nome: SUBPASTAS_PADRAO[i],
        tipo: "categoria" as const,
        pasta_pai_id: pastaColaboradorId,
        ordem: i,
      });
    }
  }
}

/**
 * Batch-create folders for multiple collaborators.
 * Used after import or to backfill existing collaborators.
 */
export async function criarPastasColaboradoresEmLote(
  tenantId: string,
  colaboradores: Array<{ id: string; nome: string; cpf?: string | null }>
): Promise<number> {
  let criadas = 0;
  for (const colab of colaboradores) {
    const result = await criarPastaColaborador({
      tenantId,
      colaboradorId: colab.id,
      colaboradorNome: colab.nome,
      colaboradorCpf: colab.cpf,
    });
    if (result) criadas++;
  }
  return criadas;
}
