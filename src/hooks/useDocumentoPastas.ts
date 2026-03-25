import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import type { 
  DocumentoPasta, 
  DocumentoPastaNode, 
  DocumentoAuditLog,
  DocumentoItem 
} from "@/types/documentoPasta";
import { useFiliais, type Filial } from "./useCadastros";
import { useColaboradores, type Colaborador } from "./useColaboradores";

interface DocumentoRow {
  id: string;
  nome_original: string;
  tipo: string;
  tamanho: number;
  status: string;
  data_validade: string | null;
  storage_path: string;
  created_at: string;
  pasta_id: string | null;
  colaborador_id: string | null;
  colaborador_nome: string;
}

export function useDocumentoPastas() {
  const { tenantId, user, profile } = useAuth();
  const { filiais } = useFiliais();
  const { colaboradores } = useColaboradores();
  const queryClient = useQueryClient();

  // Buscar pastas
  const { data: pastas = [], isLoading: loadingPastas, refetch: refetchPastas } = useQuery({
    queryKey: ["documento-pastas", tenantId],
    queryFn: async (): Promise<DocumentoPasta[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from("documento_pastas")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("ordem", { ascending: true });

      if (error) throw error;
      return (data || []) as DocumentoPasta[];
    },
    enabled: !!tenantId,
  });

  // Buscar documentos com pasta_id
  const { data: documentos = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["documentos-com-pasta", tenantId],
    queryFn: async (): Promise<(DocumentoItem & { pasta_id: string | null; colaborador_id: string | null; colaborador_nome: string })[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from("documentos")
        .select("id, nome_original, tipo, tamanho, status, data_validade, storage_path, created_at, pasta_id, colaborador_id, colaborador_nome")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((d: DocumentoRow) => ({
        id: d.id,
        nome_original: d.nome_original,
        tipo: d.tipo,
        tamanho: d.tamanho,
        status: d.status as 'valido' | 'vencendo' | 'vencido',
        data_validade: d.data_validade,
        storage_path: d.storage_path,
        created_at: d.created_at,
        pasta_id: d.pasta_id,
        colaborador_id: d.colaborador_id,
        colaborador_nome: d.colaborador_nome,
      }));
    },
    enabled: !!tenantId,
  });

  // Buscar auditoria
  const { data: auditLogs = [], isLoading: loadingAudit, refetch: refetchAudit } = useQuery({
    queryKey: ["documento-audit", tenantId],
    queryFn: async (): Promise<DocumentoAuditLog[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from("documento_audit_log")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as DocumentoAuditLog[];
    },
    enabled: !!tenantId,
  });

  // Sincronizar colaboradores que não possuem pasta
  const syncMissingColaboradores = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user || pastas.length === 0) return 0;

      // Encontrar pasta raiz de colaboradores
      const prontuariosRoot = pastas.find(p => p.tipo === "root" && (p.nome === "Documentos de Colaboradores" || p.nome === "Prontuários de Colaboradores"));
      if (!prontuariosRoot) return 0;

      // Encontrar pastas de unidade
      const unidadePastas = pastas.filter(p => p.tipo === "unidade" && p.pasta_pai_id === prontuariosRoot.id);

      // Colaboradores que já têm pasta
      const colabsComPasta = new Set(
        pastas.filter(p => p.tipo === "colaborador" && p.colaborador_id).map(p => p.colaborador_id)
      );

      // Colaboradores sem pasta
      const colabsSemPasta = colaboradores.filter((c: Colaborador) => !colabsComPasta.has(c.id));
      if (colabsSemPasta.length === 0) return 0;

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

      const pastasToCreate: PastaInsert[] = [];

      colabsSemPasta.forEach((colab: Colaborador) => {
        // Encontrar a unidade correta
        let unidadePasta = unidadePastas.find((u) => {
          const filial = filiais.find((f: Filial) => f.id === u.filial_id);
          return filial ? filial.nome === colab.filial : !u.filial_id;
        });

        // Se não encontrou, usar a primeira (geralmente "Matriz")
        if (!unidadePasta && unidadePastas.length > 0) {
          unidadePasta = unidadePastas[0];
        }

        if (!unidadePasta) return;

        const colabPastaId = crypto.randomUUID();
        const existingColabs = pastas.filter(p => p.tipo === "colaborador" && p.pasta_pai_id === unidadePasta!.id);

        pastasToCreate.push({
          id: colabPastaId,
          nome: colab.nome_completo,
          tipo: "colaborador",
          pasta_pai_id: unidadePasta.id,
          colaborador_id: colab.id,
          colaborador_cpf: colab.cpf,
          colaborador_nome: colab.nome_completo,
          ordem: existingColabs.length + pastasToCreate.filter(p => p.pasta_pai_id === unidadePasta!.id).length,
          icone: "User",
          filial_id: null,
          ano: null,
          tenant_id: tenantId,
          criado_por: user.id,
          criado_por_nome: profile?.nome_completo || null,
        });

        // Criar pasta do ano atual
        const ano = new Date().getFullYear();
        pastasToCreate.push({
          id: crypto.randomUUID(),
          nome: String(ano),
          tipo: "ano",
          pasta_pai_id: colabPastaId,
          ano: ano,
          ordem: 0,
          icone: null,
          filial_id: null,
          colaborador_id: null,
          colaborador_cpf: null,
          colaborador_nome: null,
          tenant_id: tenantId,
          criado_por: user.id,
          criado_por_nome: profile?.nome_completo || null,
        });
      });

      if (pastasToCreate.length === 0) return 0;

      const { error } = await supabase
        .from("documento_pastas")
        .insert(pastasToCreate);

      if (error) throw error;
      return colabsSemPasta.length;
    },
    onSuccess: (count) => {
      if (count && count > 0) {
        queryClient.invalidateQueries({ queryKey: ["documento-pastas"] });
        toast.success(`${count} colaborador(es) sincronizado(s) na estrutura de pastas!`);
      }
    },
    onError: (error: Error) => {
      console.error("Erro ao sincronizar colaboradores:", error);
    },
  });

  // Auto-sync: verificar colaboradores sem pasta quando dados carregam
  const needsSync = pastas.length > 0 && colaboradores.length > 0 && (() => {
    const colabsComPasta = new Set(
      pastas.filter(p => p.tipo === "colaborador" && p.colaborador_id).map(p => p.colaborador_id)
    );
    return colaboradores.some((c: Colaborador) => !colabsComPasta.has(c.id));
  })();

  // Construir árvore hierárquica
  const buildTree = (): DocumentoPastaNode[] => {
    const nodeMap = new Map<string, DocumentoPastaNode>();
    const roots: DocumentoPastaNode[] = [];

    // Criar nós para todas as pastas
    pastas.forEach(pasta => {
      const filial = filiais.find((f: Filial) => f.id === pasta.filial_id);
      nodeMap.set(pasta.id, {
        ...pasta,
        children: [],
        documentos: [],
        filial_nome: filial?.nome,
      });
    });

    // Adicionar documentos às pastas
    documentos.forEach((doc) => {
      const pastaId = doc.pasta_id;
      if (pastaId && nodeMap.has(pastaId)) {
        nodeMap.get(pastaId)!.documentos.push({
          id: doc.id,
          nome_original: doc.nome_original,
          tipo: doc.tipo,
          tamanho: doc.tamanho,
          status: doc.status,
          data_validade: doc.data_validade,
          storage_path: doc.storage_path,
          created_at: doc.created_at,
        });
      }
    });

    // Construir hierarquia
    pastas.forEach(pasta => {
      const node = nodeMap.get(pasta.id)!;
      if (pasta.pasta_pai_id && nodeMap.has(pasta.pasta_pai_id)) {
        nodeMap.get(pasta.pasta_pai_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Ordenar por ordem
    const sortNodes = (nodes: DocumentoPastaNode[]) => {
      nodes.sort((a, b) => a.ordem - b.ordem);
      nodes.forEach(node => sortNodes(node.children));
    };
    sortNodes(roots);

    return roots;
  };

  // Criar pasta
  const createPasta = useMutation({
    mutationFn: async (data: Partial<DocumentoPasta>) => {
      if (!tenantId || !user) throw new Error("Não autenticado");

      const { data: pasta, error } = await supabase
        .from("documento_pastas")
        .insert({
          nome: data.nome || "Nova Pasta",
          tipo: data.tipo || "custom",
          pasta_pai_id: data.pasta_pai_id || null,
          filial_id: data.filial_id || null,
          colaborador_id: data.colaborador_id || null,
          colaborador_cpf: data.colaborador_cpf || null,
          colaborador_nome: data.colaborador_nome || null,
          ano: data.ano || null,
          mes: data.mes || null,
          ordem: data.ordem || 0,
          icone: data.icone || null,
          cor: data.cor || null,
          tenant_id: tenantId,
          criado_por: user.id,
          criado_por_nome: profile?.nome_completo || null,
        })
        .select()
        .single();

      if (error) throw error;
      return pasta;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documento-pastas"] });
      toast.success("Pasta criada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar pasta: " + error.message);
    },
  });

  // Atualizar pasta
  const updatePasta = useMutation({
    mutationFn: async ({ id, ...data }: Partial<DocumentoPasta> & { id: string }) => {
      const { error } = await supabase
        .from("documento_pastas")
        .update({
          nome: data.nome,
          tipo: data.tipo,
          pasta_pai_id: data.pasta_pai_id,
          filial_id: data.filial_id,
          ordem: data.ordem,
          icone: data.icone,
          cor: data.cor,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documento-pastas"] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar pasta: " + error.message);
    },
  });

  // Deletar pasta
  const deletePasta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("documento_pastas")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documento-pastas"] });
      toast.success("Pasta excluída!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir pasta: " + error.message);
    },
  });

  // Mover documento para outra pasta
  const moveDocumento = useMutation({
    mutationFn: async ({
      documentoId,
      documentoNome,
      pastaOrigemId,
      pastaOrigemNome,
      pastaDestinoId,
      pastaDestinoNome,
    }: {
      documentoId: string;
      documentoNome: string;
      pastaOrigemId: string | null;
      pastaOrigemNome: string | null;
      pastaDestinoId: string | null;
      pastaDestinoNome: string | null;
    }) => {
      if (!tenantId || !user) throw new Error("Não autenticado");

      // Atualizar documento
      const { error: updateError } = await supabase
        .from("documentos")
        .update({ pasta_id: pastaDestinoId })
        .eq("id", documentoId);

      if (updateError) throw updateError;

      // Registrar auditoria
      const { error: auditError } = await supabase
        .from("documento_audit_log")
        .insert({
          tenant_id: tenantId,
          documento_id: documentoId,
          documento_nome: documentoNome,
          acao: "move",
          pasta_origem_id: pastaOrigemId,
          pasta_origem_nome: pastaOrigemNome,
          pasta_destino_id: pastaDestinoId,
          pasta_destino_nome: pastaDestinoNome,
          usuario_id: user.id,
          usuario_nome: profile?.nome_completo || null,
          user_agent: navigator.userAgent,
        });

      if (auditError) console.error("Erro ao registrar auditoria:", auditError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos-com-pasta"] });
      queryClient.invalidateQueries({ queryKey: ["documento-audit"] });
      toast.success("Documento movido!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao mover documento: " + error.message);
    },
  });

  // Inicializar estrutura padrão
  const initializeDefaultStructure = useMutation({
    mutationFn: async (params?: {
      porte?: string;
      cnae?: string;
      grauRisco?: number;
      numTrabalhadores?: number;
      riscos?: string[];
      atividadeEconomica?: string;
    }) => {
      if (!tenantId || !user) throw new Error("Não autenticado");

      const grauRisco = params?.grauRisco || 1;
      const riscos = params?.riscos || [];

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

      const mk = (id: string, nome: string, tipo: string, ordem: number, icone: string | null, pai: string | null): PastaInsert => ({
        id, nome, tipo, ordem, icone, pasta_pai_id: pai,
        filial_id: null, colaborador_id: null, colaborador_cpf: null,
        colaborador_nome: null, ano: null, tenant_id: tenantId,
        criado_por: user.id, criado_por_nome: profile?.nome_completo || null,
      });

      const pastasToCreate: PastaInsert[] = [];

      // ─── 1. GOVERNANÇA E ADMINISTRAÇÃO (ISO 9001 §4, §5) ─────────────────
      const govId = crypto.randomUUID();
      pastasToCreate.push(mk(govId, "Governança e Administração", "root", 0, "Scale", null));
      const govSubs: [string, string][] = [
        ["Contrato Social e Estatuto", "Building2"],
        ["Políticas e Diretrizes", "Target"],       // ISO 9001 §5.2 — Política da Qualidade, SST, Ambiental
        ["Licenças e Autorizações", "FileCheck"],   // Alvará, ANVISA, Bombeiros
        ["Certidões", "Award"],                     // CND Federal, Estadual, Municipal, FGTS, Trabalhista
        ["Registros em Conselhos", "Shield"],        // CREA, CRM, etc. (sem subpastas fixas)
      ];
      govSubs.forEach(([nome, icone], i) => {
        pastasToCreate.push(mk(crypto.randomUUID(), nome, "categoria", i, icone, govId));
      });

      // ─── 2. SISTEMA DE GESTÃO (ISO 9001 §6, §7) ──────────────────────────
      const sgId = crypto.randomUUID();
      pastasToCreate.push(mk(sgId, "Sistema de Gestão", "root", 1, "BookOpen", null));
      const sgSubs: [string, string][] = [
        ["Procedimentos e Instruções de Trabalho", "FileText"],   // ISO 9001 §7.5 — POPs, ITs
        ["Registros da Qualidade", "CheckSquare"],                 // ISO 9001 §9 — evidências
        ...(grauRisco >= 3 ? [["Gestão de Mudanças (MOC)", "RefreshCw"] as [string, string]] : []), // PSM §11
      ];
      sgSubs.forEach(([nome, icone], i) => {
        pastasToCreate.push(mk(crypto.randomUUID(), nome, "categoria", i, icone, sgId));
      });

      // ─── 3. GESTÃO DE RISCOS (PSM + ISO 9001 §6.1) ───────────────────────
      const riscosId = crypto.randomUUID();
      pastasToCreate.push(mk(riscosId, "Gestão de Riscos", "root", 2, "AlertTriangle", null));
      const riscoSubs: [string, string][] = [
        ["Inventário de Riscos", "List"],      // PSM §4 — Process Safety Information
        ["Análise de Riscos (APR / HAZOP)", "Search"], // PSM §5 — Process Hazard Analysis
        ["Planos de Emergência", "ShieldAlert"], // PSM §13 — Emergency Planning
        ...(grauRisco >= 3 ? [["Análise de Processos Críticos", "Cpu"] as [string, string]] : []),
      ];
      riscoSubs.forEach(([nome, icone], i) => {
        pastasToCreate.push(mk(crypto.randomUUID(), nome, "categoria", i, icone, riscosId));
      });

      // ─── 4. SST — Saúde e Segurança (NRs + PSM) ─────────────────────────
      const sstId = crypto.randomUUID();
      pastasToCreate.push(mk(sstId, "SST", "root", 3, "Shield", null));

      // 4a. Programas Legais
      const sstProgramasId = crypto.randomUUID();
      pastasToCreate.push(mk(sstProgramasId, "Programas Legais", "categoria", 0, "FileCheck", sstId));
      ["PGR", "PCMSO", "LTCAT"].forEach((n, i) => {
        pastasToCreate.push(mk(crypto.randomUUID(), n, "custom", i, null, sstProgramasId));
      });

      // 4b. Riscos especiais (somente se selecionados)
      let sstSubIdx = 1;
      if (riscos.includes("ergonomico")) {
        const ergoId = crypto.randomUUID();
        pastasToCreate.push(mk(ergoId, "Ergonomia", "categoria", sstSubIdx++, "Activity", sstId));
        ["AEP — Avaliação Ergonômica Preliminar", "AET — Análise Ergonômica do Trabalho"].forEach((n, i) => {
          pastasToCreate.push(mk(crypto.randomUUID(), n, "custom", i, null, ergoId));
        });
      }
      if (riscos.includes("psicossocial")) {
        const psId = crypto.randomUUID();
        pastasToCreate.push(mk(psId, "Riscos Psicossociais (NR-01)", "categoria", sstSubIdx++, "Brain", sstId));
        ["Diagnóstico Psicossocial", "Plano de Ação"].forEach((n, i) => {
          pastasToCreate.push(mk(crypto.randomUUID(), n, "custom", i, null, psId));
        });
      }

      // 4c. Treinamentos NR (pasta única com subpastas por NR obrigatória + contextuais)
      const treiId = crypto.randomUUID();
      pastasToCreate.push(mk(treiId, "Treinamentos", "categoria", sstSubIdx++, "GraduationCap", sstId));
      const nrsTreino = [
        "NR-01 — Disposições Gerais e Gerenciamento de Riscos",
        "NR-05 — CIPA",
        "NR-06 — EPIs",
        ...(riscos.includes("eletrico") ? ["NR-10 — Segurança em Eletricidade"] : []),
        ...(riscos.includes("maquinas") ? ["NR-12 — Segurança em Máquinas"] : []),
        ...((grauRisco >= 3 || riscos.includes("espaco_confinado")) ? ["NR-33 — Espaço Confinado"] : []),
        ...((grauRisco >= 3 || riscos.includes("altura")) ? ["NR-35 — Trabalho em Altura"] : []),
      ];
      nrsTreino.forEach((n, i) => {
        pastasToCreate.push(mk(crypto.randomUUID(), n, "custom", i, null, treiId));
      });

      // 4d. Registros SST (PSM §8 — Incident Investigation)
      const regSSTId = crypto.randomUUID();
      pastasToCreate.push(mk(regSSTId, "Registros e Evidências", "categoria", sstSubIdx++, "ClipboardList", sstId));
      ["CAT — Comunicação de Acidente", "Inspeções de Segurança", "Permissões de Trabalho"].forEach((n, i) => {
        pastasToCreate.push(mk(crypto.randomUUID(), n, "custom", i, null, regSSTId));
      });

      // ─── 5. AMBIENTAL (apenas se risco ambiental selecionado) ────────────
      if (riscos.includes("ambiental")) {
        const ambId = crypto.randomUUID();
        pastasToCreate.push(mk(ambId, "Gestão Ambiental", "root", 4, "Leaf", null));
        const ambSubs: [string, string][] = [
          ["Licenciamento Ambiental", "FileCheck"],        // LP, LI, LO
          ["Monitoramento e Controle", "Activity"],        // Emissões, efluentes, resíduos
          ["PGRS — Gerenciamento de Resíduos", "Trash2"],
        ];
        ambSubs.forEach(([nome, icone], i) => {
          pastasToCreate.push(mk(crypto.randomUUID(), nome, "categoria", i, icone, ambId));
        });
      }

      // ─── 6. GESTÃO DE PESSOAS ────────────────────────────────────────────
      const pessoasId = crypto.randomUUID();
      pastasToCreate.push(mk(pessoasId, "Gestão de Pessoas", "root", 5, "Users", null));

      const filiaisList = filiais.length > 0 ? filiais : [{ id: null, nome: "Matriz" }];
      filiaisList.forEach((filial: { id: string | null; nome: string }, idx: number) => {
        const unidadeId = crypto.randomUUID();
        pastasToCreate.push({
          ...mk(unidadeId, filial.nome, "unidade", idx, "Building", pessoasId),
          filial_id: filial.id,
        });

        const colabsUnidade = colaboradores.filter((c: Colaborador) =>
          filial.id ? c.filial === filial.nome : !c.filial
        );

        colabsUnidade.forEach((colab: Colaborador, colabIdx: number) => {
          const colabPastaId = crypto.randomUUID();
          pastasToCreate.push({
            ...mk(colabPastaId, colab.nome_completo, "colaborador", colabIdx, "User", unidadeId),
            colaborador_id: colab.id,
            colaborador_cpf: colab.cpf,
            colaborador_nome: colab.nome_completo,
          });
          // Subpastas do colaborador (enxutas)
          ["Admissão", "Vida Funcional", "Saúde Ocupacional", "Desligamento"].forEach((sub, subIdx) => {
            pastasToCreate.push(mk(crypto.randomUUID(), sub, "categoria", subIdx, null, colabPastaId));
          });
        });
      });

      // ─── 7. INVESTIGAÇÃO DE INCIDENTES (PSM §8, ISO 9001 §10.2) ─────────
      const incId = crypto.randomUUID();
      pastasToCreate.push(mk(incId, "Investigação de Incidentes", "root", 6, "SearchX", null));
      // Uma pasta por tipo — documentos vão diretamente dentro
      ["Acidentes de Trabalho", "Quase Acidentes", "Não Conformidades"].forEach((n, i) => {
        pastasToCreate.push(mk(crypto.randomUUID(), n, "categoria", i, null, incId));
      });

      // ─── 8. AUDITORIAS E MELHORIA CONTÍNUA (ISO 9001 §9, §10) ────────────
      const audId = crypto.randomUUID();
      pastasToCreate.push(mk(audId, "Auditorias e Melhoria Contínua", "root", 7, "CheckSquare", null));
      const audSubs: [string, string][] = [
        ["Auditorias Internas", "ClipboardCheck"],
        ["Auditorias Externas e Certificações", "Award"],
        ["Ações Corretivas e Preventivas", "RefreshCw"],  // ISO 9001 §10.2 — NC e AC
      ];
      audSubs.forEach(([nome, icone], i) => {
        pastasToCreate.push(mk(crypto.randomUUID(), nome, "categoria", i, icone, audId));
      });

      // ─── INSERT — apenas pastas faltantes ────────────────────────────────
      // Buscar todas as pastas raiz existentes para este tenant
      const { data: existentes } = await supabase
        .from("documento_pastas")
        .select("nome, pasta_pai_id")
        .eq("tenant_id", tenantId);

      const existingSet = new Set(
        (existentes || []).map((p: { nome: string; pasta_pai_id: string | null }) =>
          `${p.nome}||${p.pasta_pai_id ?? "null"}`
        )
      );

      // Filtrar apenas pastas que ainda não existem (por nome + pai)
      // Para pastas com IDs gerados localmente como pai, verificar se o pai também será criado
      const novas = pastasToCreate.filter((p) => {
        const key = `${p.nome}||${p.pasta_pai_id ?? "null"}`;
        return !existingSet.has(key);
      });

      if (novas.length === 0) {
        return 0;
      }

      // Insert em lotes de 100 para evitar limite do Supabase
      const chunkSize = 100;
      for (let i = 0; i < novas.length; i += chunkSize) {
        const chunk = novas.slice(i, i + chunkSize);
        const { error } = await supabase.from("documento_pastas").insert(chunk);
        if (error) throw error;
      }

      return novas.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["documento-pastas"] });
      if (count === 0) {
        toast.success("Estrutura já está completa! Nenhuma pasta nova foi necessária.");
      } else {
        toast.success(`${count} pasta(s) nova(s) adicionada(s) à estrutura existente.`);
      }
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar estrutura: " + error.message);
    },
  });

  // Criar pasta de mês automaticamente
  const createMonthFolder = async (parentPastaId: string, year: number, month: number) => {
    if (!tenantId || !user) throw new Error("Não autenticado");

    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const { data, error } = await supabase
      .from("documento_pastas")
      .insert({
        tenant_id: tenantId,
        nome: monthNames[month - 1],
        tipo: "mes",
        pasta_pai_id: parentPastaId,
        mes: month,
        ano: year,
        ordem: month,
        criado_por: user.id,
        criado_por_nome: profile?.nome_completo || null,
      })
      .select()
      .single();

    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["documento-pastas"] });
    return data;
  };

  return {
    pastas,
    documentos,
    auditLogs,
    loading: !tenantId || loadingPastas || loadingDocs,
    loadingAudit,
    tree: buildTree(),
    needsSync,
    syncColaboradores: syncMissingColaboradores.mutateAsync,
    syncing: syncMissingColaboradores.isPending,
    refetchPastas,
    refetchAudit,
    createPasta: createPasta.mutateAsync,
    updatePasta: updatePasta.mutateAsync,
    deletePasta: deletePasta.mutateAsync,
    moveDocumento: moveDocumento.mutateAsync,
    movingDoc: moveDocumento.isPending,
    initializeDefaultStructure: initializeDefaultStructure.mutateAsync,
    initializing: initializeDefaultStructure.isPending,
    createMonthFolder,
  };
}
