/**
 * Utility to auto-archive generated documents to the Documentos module.
 * Resolves collaborator folders under "Gestão de Pessoas" and SST/company folders.
 * Creates audit log entries for traceability.
 */
import { supabase } from "@/integrations/supabase/client";

interface ArquivarDocumentoParams {
  tenantId: string;
  empresaId?: string | null;
  userId: string;
  userNome: string;
  // File
  file: Blob;
  fileName: string;
  mimeType?: string;
  // Metadata
  tipo: string;
  observacoes?: string;
  dataValidade?: string | null;
  // Collaborator (optional — if provided, archives in collaborator folder)
  colaboradorId?: string | null;
  colaboradorNome?: string | null;
  colaboradorCpf?: string | null;
  // Target folder category (used when no collaborator)
  pastaCategoria?: "SST" | "Ergonomia" | "Psicossocial" | "Ponto" | "Financeiro" | "Desligamento" | "Admissão" | null;
  // Subfolder inside collaborator folder
  subpastaColaborador?: "Admissão" | "Vida Funcional" | "Saúde Ocupacional" | "Desligamento" | null;
}

/**
 * Finds or creates the appropriate folder for a collaborator under "Gestão de Pessoas".
 * Returns the pasta_id or null.
 */
async function findOrCreateColaboradorPasta(
  tenantId: string,
  colaboradorId: string,
  colaboradorNome: string,
  colaboradorCpf?: string | null,
  subpasta?: string | null
): Promise<string | null> {
  // 1. Find existing collaborator folder
  const { data: existing } = await supabase
    .from("documento_pastas")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("colaborador_id", colaboradorId)
    .eq("tipo", "colaborador")
    .maybeSingle();

  let colabPastaId = existing?.id || null;

  // 2. If not found, create under "Gestão de Pessoas"
  if (!colabPastaId) {
    // Find "Gestão de Pessoas" root
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

    if (parentId) {
      // Create collaborator folder
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

      colabPastaId = colabPasta?.id || null;

      // Create standard subfolders
      if (colabPastaId) {
        const subfolders = ["Admissão", "Vida Funcional", "Saúde Ocupacional", "Desligamento"];
        for (let i = 0; i < subfolders.length; i++) {
          await supabase.from("documento_pastas").insert({
            tenant_id: tenantId,
            nome: subfolders[i],
            tipo: "categoria" as const,
            pasta_pai_id: colabPastaId,
            ordem: i,
          });
        }
      }
    }
  }

  // 3. If subpasta requested, find it inside the collaborator folder
  if (colabPastaId && subpasta) {
    const { data: sub } = await supabase
      .from("documento_pastas")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("pasta_pai_id", colabPastaId)
      .eq("nome", subpasta)
      .maybeSingle();

    if (sub?.id) return sub.id;
  }

  return colabPastaId;
}

/**
 * Finds the appropriate company-level folder for non-collaborator documents.
 */
async function findCategoriaPasta(
  tenantId: string,
  categoria: string
): Promise<string | null> {
  // Map categories to expected folder names
  const FOLDER_MAP: Record<string, string[]> = {
    SST: ["SST e Segurança do Trabalho", "SST da Empresa"],
    Ergonomia: ["Ergonomia", "AEP — Avaliação Ergonômica Preliminar"],
    Psicossocial: ["Riscos Psicossociais (NR-01)", "Diagnóstico Psicossocial"],
    Ponto: ["Gestão de Pessoas", "Processos Organizacionais"],
    Financeiro: ["Processos Organizacionais", "Gestão de Pessoas"],
    Desligamento: ["Gestão de Pessoas"],
    "Admissão": ["Gestão de Pessoas"],
  };

  const candidates = FOLDER_MAP[categoria] || [categoria];

  for (const nome of candidates) {
    const { data } = await supabase
      .from("documento_pastas")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("nome", nome)
      .limit(1)
      .maybeSingle();

    if (data?.id) return data.id;
  }

  return null;
}

/**
 * Archives a generated document to Supabase Storage + creates a record in the `documentos` table.
 * Automatically resolves the correct folder and creates audit trail.
 */
export async function arquivarDocumento(params: ArquivarDocumentoParams): Promise<{ id: string; storagePath: string } | null> {
  const {
    tenantId,
    empresaId,
    userId,
    userNome,
    file,
    fileName,
    mimeType = "application/pdf",
    tipo,
    observacoes,
    dataValidade,
    colaboradorId,
    colaboradorNome,
    colaboradorCpf,
    pastaCategoria,
    subpastaColaborador,
  } = params;

  try {
    // 1. Build storage path
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = colaboradorId
      ? `${tenantId}/colaboradores/${colaboradorId}/${timestamp}_${safeName}`
      : `${tenantId}/${timestamp}_${safeName}`;

    // 2. Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("documentos")
      .upload(storagePath, file, { contentType: mimeType, upsert: false });

    if (uploadError) throw uploadError;

    // 3. Resolve target folder
    let pastaId: string | null = null;

    if (colaboradorId && colaboradorNome) {
      pastaId = await findOrCreateColaboradorPasta(
        tenantId,
        colaboradorId,
        colaboradorNome,
        colaboradorCpf,
        subpastaColaborador
      );
    } else if (pastaCategoria) {
      pastaId = await findCategoriaPasta(tenantId, pastaCategoria);
    }

    // 4. Calculate status based on expiry date
    let status: "valido" | "vencendo" | "vencido" = "valido";
    if (dataValidade) {
      const validade = new Date(dataValidade);
      const hoje = new Date();
      const trintaDiasAntes = new Date(validade);
      trintaDiasAntes.setDate(trintaDiasAntes.getDate() - 30);

      if (validade < hoje) status = "vencido";
      else if (hoje > trintaDiasAntes) status = "vencendo";
    }

    // 5. Insert document record
    const { data: docData, error: docError } = await supabase
      .from("documentos" as never)
      .insert({
        tenant_id: tenantId,
        empresa_id: empresaId || null,
        colaborador_id: colaboradorId || null,
        colaborador_nome: colaboradorNome || "",
        colaborador_cpf: colaboradorCpf || null,
        nome_arquivo: storagePath,
        nome_original: fileName,
        tipo,
        tamanho: file.size,
        mime_type: mimeType,
        storage_path: storagePath,
        data_validade: dataValidade || null,
        status,
        observacoes: observacoes || null,
        criado_por: userId,
        criado_por_nome: userNome,
        pasta_id: pastaId,
        versao_atual: 1,
        total_versoes: 1,
      } as never)
      .select("id")
      .single();

    if (docError) {
      // Cleanup storage on failure
      await supabase.storage.from("documentos").remove([storagePath]);
      throw docError;
    }

    // 6. Create audit log
    try {
      await supabase.from("documento_audit_logs" as never).insert({
        tenant_id: tenantId,
        documento_id: (docData as any).id,
        documento_nome: fileName,
        acao: "upload",
        pasta_destino_id: pastaId,
        pasta_destino_nome: tipo,
        usuario_id: userId,
        usuario_nome: userNome,
      } as never);
    } catch { /* non-blocking */ }

    return { id: (docData as any).id, storagePath };
  } catch (error) {
    console.error("[arquivarDocumento] Erro:", error);
    return null;
  }
}
