import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import type {
  PlanoAcao,
  PlanoTarefa,
  PlanoHistorico,
  PlanoComentario,
  PlanoEvidencia,
  PlanoParticipante,
  PlanoAcaoStats,
  PlanoAcaoFilters,
  CreatePlanoAcaoDTO,
  UpdatePlanoAcaoDTO,
  CreatePlanoTarefaDTO,
  UpdatePlanoTarefaDTO,
  AcaoStatus,
  TarefaStatus,
} from "@/types/planoAcao";

// Dados mock para demonstração
const MOCK_ACOES: PlanoAcao[] = [
  {
    id: "mock-1",
    tenant_id: "demo",
    codigo: "ACO-00001",
    titulo: "Implementar ajustes ergonômicos nas estações de trabalho",
    descricao: "Avaliar e ajustar altura de mesas, cadeiras e monitores para prevenir LER/DORT",
    porque: "Reduzir afastamentos por problemas ergonômicos e melhorar produtividade",
    onde: "Setor Administrativo - Matriz",
    prazo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    responsavel_id: "user-1",
    responsavel_nome: "Carlos Silva",
    como: "Contratar empresa especializada para avaliação e ajustes",
    custo_estimado: 15000,
    origem_modulo: "ergonomia",
    origem_descricao: "Avaliação NR-17",
    gravidade: 4,
    urgencia: 4,
    tendencia: 3,
    pontuacao_gut: 48,
    prioridade: "urgente",
    status: "em_andamento",
    progresso: 35,
    tipo: "corretiva",
    exige_evidencia: true,
    tempo_estimado_minutos: 480,
    tempo_gasto_minutos: 120,
    criado_por_nome: "Admin Sistema",
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mock-2",
    tenant_id: "demo",
    codigo: "ACO-00002",
    titulo: "Substituir EPIs vencidos do setor de produção",
    descricao: "Realizar levantamento e substituição de todos os EPIs com CA vencido",
    porque: "Garantir conformidade legal e segurança dos colaboradores",
    onde: "Linha de Produção - Unidade 2",
    prazo: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    responsavel_id: "user-2",
    responsavel_nome: "Maria Santos",
    como: "Inventário + Compra emergencial + Troca programada",
    custo_estimado: 8500,
    origem_modulo: "epi",
    origem_descricao: "Alerta de vencimento automático",
    gravidade: 5,
    urgencia: 5,
    tendencia: 5,
    pontuacao_gut: 125,
    prioridade: "imediato",
    status: "pendente",
    progresso: 0,
    tipo: "corretiva",
    exige_evidencia: true,
    tempo_estimado_minutos: 240,
    tempo_gasto_minutos: 0,
    criado_por_nome: "Sistema EPI",
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mock-3",
    tenant_id: "demo",
    codigo: "ACO-00003",
    titulo: "Treinamento de Segurança do Trabalho - Novos colaboradores",
    descricao: "Realizar integração e treinamento de segurança para 15 novos funcionários",
    porque: "Atender NR-1 e prevenir acidentes de trabalho",
    onde: "Sala de Treinamento - RH",
    prazo: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    responsavel_id: "user-1",
    responsavel_nome: "Carlos Silva",
    como: "Agendar sessões de treinamento com material atualizado",
    custo_estimado: 2000,
    origem_modulo: "manual",
    gravidade: 3,
    urgencia: 3,
    tendencia: 2,
    pontuacao_gut: 18,
    prioridade: "medio",
    status: "pendente",
    progresso: 0,
    tipo: "preventiva",
    exige_evidencia: true,
    tempo_estimado_minutos: 480,
    tempo_gasto_minutos: 0,
    criado_por_nome: "Gestor RH",
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mock-4",
    tenant_id: "demo",
    codigo: "ACO-00004",
    titulo: "Investigar denúncia anônima sobre assédio moral",
    descricao: "Apurar relato recebido via ouvidoria sobre comportamento inadequado",
    porque: "Garantir ambiente de trabalho saudável e conformidade com políticas",
    onde: "Departamento Comercial",
    prazo: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    responsavel_id: "user-3",
    responsavel_nome: "Ana Oliveira",
    como: "Entrevistas sigilosas + Análise de histórico + Relatório conclusivo",
    origem_modulo: "ouvidoria",
    origem_descricao: "Denúncia #2024-089",
    gravidade: 5,
    urgencia: 4,
    tendencia: 4,
    pontuacao_gut: 80,
    prioridade: "urgente",
    status: "em_andamento",
    progresso: 60,
    tipo: "corretiva",
    exige_evidencia: true,
    tempo_estimado_minutos: 960,
    tempo_gasto_minutos: 480,
    criado_por_nome: "Comitê de Ética",
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mock-5",
    tenant_id: "demo",
    codigo: "ACO-00005",
    titulo: "Campanha de bem-estar: Ginástica laboral",
    descricao: "Implementar programa de ginástica laboral 3x por semana",
    porque: "Melhorar índices de humor diário e reduzir estresse ocupacional",
    onde: "Todas as unidades",
    prazo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    responsavel_id: "user-2",
    responsavel_nome: "Maria Santos",
    como: "Contratar instrutor + Definir horários + Comunicação interna",
    custo_estimado: 5000,
    origem_modulo: "humor",
    origem_descricao: "Análise de tendências de humor",
    gravidade: 2,
    urgencia: 2,
    tendencia: 3,
    pontuacao_gut: 12,
    prioridade: "baixo",
    status: "pendente",
    progresso: 0,
    tipo: "melhoria",
    exige_evidencia: false,
    tempo_estimado_minutos: 240,
    tempo_gasto_minutos: 0,
    criado_por_nome: "RH",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mock-6",
    tenant_id: "demo",
    codigo: "ACO-00006",
    titulo: "Correção de ponto irregular - Colaborador ID 1842",
    descricao: "Ajustar registros de ponto com mais de 10 ocorrências no mês",
    porque: "Regularizar folha de pagamento e evitar passivos trabalhistas",
    onde: "Sistema de Ponto",
    prazo: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    responsavel_id: "user-1",
    responsavel_nome: "Carlos Silva",
    como: "Reunião com gestor + Ajustes manuais + Orientação ao colaborador",
    origem_modulo: "ponto",
    origem_descricao: "Alerta automático de inconsistências",
    gravidade: 3,
    urgencia: 4,
    tendencia: 3,
    pontuacao_gut: 36,
    prioridade: "urgente",
    status: "concluida",
    progresso: 100,
    data_conclusao: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    tipo: "corretiva",
    exige_evidencia: true,
    tempo_estimado_minutos: 60,
    tempo_gasto_minutos: 45,
    criado_por_nome: "Sistema Ponto",
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function usePlanoAcao(filters?: PlanoAcaoFilters) {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { tenantId } = useTenant();

  // ===================== QUERIES =====================

  // Lista de ações
  const {
    data: acoes = [],
    isLoading: isLoadingAcoes,
    refetch: refetchAcoes,
  } = useQuery({
    queryKey: ["plano-acoes", tenantId, filters],
    queryFn: async () => {
      if (!tenantId) return MOCK_ACOES; // Retorna mock se não há tenant

      let query = supabase
        .from("plano_acoes")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("pontuacao_gut", { ascending: false })
        .order("prazo", { ascending: true, nullsFirst: false });

      // Aplicar filtros
      if (filters?.status?.length) {
        query = query.in("status", filters.status as any);
      }
      if (filters?.prioridade?.length) {
        query = query.in("prioridade", filters.prioridade as any);
      }
      if (filters?.origem_modulo?.length) {
        query = query.in("origem_modulo", filters.origem_modulo);
      }
      if (filters?.responsavel_id) {
        query = query.eq("responsavel_id", filters.responsavel_id);
      }
      if (filters?.prazo_inicio) {
        query = query.gte("prazo", filters.prazo_inicio);
      }
      if (filters?.prazo_fim) {
        query = query.lte("prazo", filters.prazo_fim);
      }
      if (filters?.busca) {
        query = query.or(
          `titulo.ilike.%${filters.busca}%,codigo.ilike.%${filters.busca}%,descricao.ilike.%${filters.busca}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Se não há dados reais, retorna mock para demonstração
      if (!data || data.length === 0) {
        return MOCK_ACOES;
      }
      
      return data as PlanoAcao[];
    },
    enabled: true, // Sempre habilitado para mostrar mock
  });

  // Ação individual com relacionamentos
  const useAcao = (acaoId: string | undefined) =>
    useQuery({
      queryKey: ["plano-acao", acaoId],
      queryFn: async () => {
        if (!acaoId) return null;

        // Retornar mock se o ID for de demonstração
        if (acaoId.startsWith("mock-")) {
          const mockAcao = MOCK_ACOES.find(a => a.id === acaoId);
          return mockAcao || null;
        }

        const { data, error } = await supabase
          .from("plano_acoes")
          .select("*")
          .eq("id", acaoId)
          .single();

        if (error) throw error;
        return data as PlanoAcao;
      },
      enabled: !!acaoId,
    });

  // Tarefas mock para demonstração
  const MOCK_TAREFAS: PlanoTarefa[] = [
    {
      id: "tarefa-1",
      tenant_id: "demo",
      acao_id: "mock-1",
      titulo: "Realizar levantamento das estações de trabalho",
      descricao: "Mapear todas as estações e identificar necessidades de ajuste",
      ordem: 1,
      status: "concluida",
      prioridade: "urgente",
      prazo: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      data_conclusao: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      responsavel_nome: "Carlos Silva",
      tempo_estimado_minutos: 120,
      tempo_gasto_minutos: 90,
      concluida_por_nome: "Carlos Silva",
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "tarefa-2",
      tenant_id: "demo",
      acao_id: "mock-1",
      titulo: "Solicitar orçamentos de fornecedores",
      descricao: "Contatar ao menos 3 fornecedores especializados",
      ordem: 2,
      status: "em_andamento",
      prioridade: "medio",
      prazo: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      responsavel_nome: "Maria Santos",
      tempo_estimado_minutos: 240,
      tempo_gasto_minutos: 60,
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "tarefa-3",
      tenant_id: "demo",
      acao_id: "mock-1",
      titulo: "Executar ajustes nas estações prioritárias",
      descricao: "Iniciar pelos setores com maior incidência de queixas",
      ordem: 3,
      status: "nao_iniciada",
      prioridade: "urgente",
      prazo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      responsavel_nome: "Carlos Silva",
      tempo_estimado_minutos: 480,
      tempo_gasto_minutos: 0,
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // Tarefas de uma ação
  const useTarefas = (acaoId: string | undefined) =>
    useQuery({
      queryKey: ["plano-tarefas", acaoId],
      queryFn: async () => {
        if (!acaoId) return [];

        // Retornar mock se o ID for de demonstração
        if (acaoId.startsWith("mock-")) {
          return MOCK_TAREFAS.filter(t => t.acao_id === acaoId);
        }

        const { data, error } = await supabase
          .from("plano_tarefas")
          .select("*")
          .eq("acao_id", acaoId)
          .order("ordem", { ascending: true });

        if (error) throw error;
        return data as PlanoTarefa[];
      },
      enabled: !!acaoId,
    });

  // Histórico mock para demonstração
  const MOCK_HISTORICO: PlanoHistorico[] = [
    {
      id: "hist-1",
      tenant_id: "demo",
      acao_id: "mock-1",
      tipo_evento: "criacao",
      descricao: "Ação criada a partir da análise ergonômica NR-17",
      usuario_nome: "Admin Sistema",
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "hist-2",
      tenant_id: "demo",
      acao_id: "mock-1",
      tipo_evento: "status_alterado",
      descricao: "Status alterado de Pendente para Em Andamento",
      usuario_nome: "Carlos Silva",
      created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "hist-3",
      tenant_id: "demo",
      acao_id: "mock-1",
      tipo_evento: "tarefa_concluida",
      descricao: "Tarefa 'Realizar levantamento das estações de trabalho' concluída",
      usuario_nome: "Carlos Silva",
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "hist-4",
      tenant_id: "demo",
      acao_id: "mock-1",
      tipo_evento: "comentario",
      descricao: "Novo comentário adicionado",
      usuario_nome: "Maria Santos",
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  // Histórico de uma ação
  const useHistorico = (acaoId: string | undefined) =>
    useQuery({
      queryKey: ["plano-historico", acaoId],
      queryFn: async () => {
        if (!acaoId) return [];

        // Retornar mock se o ID for de demonstração
        if (acaoId.startsWith("mock-")) {
          return MOCK_HISTORICO.filter(h => h.acao_id === acaoId);
        }

        const { data, error } = await supabase
          .from("plano_historico")
          .select("*")
          .eq("acao_id", acaoId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return data as PlanoHistorico[];
      },
      enabled: !!acaoId,
    });

  // Comentários mock para demonstração
  const MOCK_COMENTARIOS: PlanoComentario[] = [
    {
      id: "com-1",
      tenant_id: "demo",
      acao_id: "mock-1",
      conteudo: "Já iniciamos o levantamento. Identificamos 12 estações que precisam de ajustes urgentes.",
      autor_id: "user-1",
      autor_nome: "Carlos Silva",
      mencoes: [],
      created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "com-2",
      tenant_id: "demo",
      acao_id: "mock-1",
      conteudo: "Ótimo trabalho! Podemos priorizar o setor administrativo que tem mais queixas.",
      autor_id: "user-2",
      autor_nome: "Maria Santos",
      mencoes: [],
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "com-3",
      tenant_id: "demo",
      acao_id: "mock-1",
      conteudo: "Recebi 2 orçamentos dos fornecedores. Aguardando o terceiro para comparativo.",
      autor_id: "user-2",
      autor_nome: "Maria Santos",
      mencoes: [],
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  // Comentários de uma ação
  const useComentarios = (acaoId: string | undefined) =>
    useQuery({
      queryKey: ["plano-comentarios", acaoId],
      queryFn: async () => {
        if (!acaoId) return [];

        // Retornar mock se o ID for de demonstração
        if (acaoId.startsWith("mock-")) {
          return MOCK_COMENTARIOS.filter(c => c.acao_id === acaoId);
        }

        const { data, error } = await supabase
          .from("plano_comentarios")
          .select("*")
          .eq("acao_id", acaoId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        return data as PlanoComentario[];
      },
      enabled: !!acaoId,
    });

  // Evidências de uma ação
  const useEvidencias = (acaoId: string | undefined) =>
    useQuery({
      queryKey: ["plano-evidencias", acaoId],
      queryFn: async () => {
        if (!acaoId) return [];

        const { data, error } = await supabase
          .from("plano_evidencias")
          .select("*")
          .eq("acao_id", acaoId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return data as PlanoEvidencia[];
      },
      enabled: !!acaoId,
    });

  // Participantes de uma ação
  const useParticipantes = (acaoId: string | undefined) =>
    useQuery({
      queryKey: ["plano-participantes", acaoId],
      queryFn: async () => {
        if (!acaoId) return [];

        const { data, error } = await supabase
          .from("plano_participantes")
          .select("*")
          .eq("acao_id", acaoId);

        if (error) throw error;
        return data as PlanoParticipante[];
      },
      enabled: !!acaoId,
    });

  // Estatísticas
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["plano-acoes-stats", tenantId],
    queryFn: async (): Promise<PlanoAcaoStats> => {
      // Calcular stats baseado nos dados mock ou reais
      const dataToUse = acoes.length > 0 ? acoes : MOCK_ACOES;
      
      if (!tenantId) {
        // Stats mock
        return {
          total: MOCK_ACOES.length,
          pendentes: MOCK_ACOES.filter((a) => a.status === "pendente").length,
          em_andamento: MOCK_ACOES.filter((a) => a.status === "em_andamento").length,
          atrasadas: MOCK_ACOES.filter((a) => a.prazo && new Date(a.prazo) < new Date() && a.status !== "concluida").length,
          concluidas: MOCK_ACOES.filter((a) => a.status === "concluida").length,
          por_origem: { 
            manual: MOCK_ACOES.filter(a => a.origem_modulo === 'manual').length,
            ergonomia: MOCK_ACOES.filter(a => a.origem_modulo === 'ergonomia').length,
            ouvidoria: MOCK_ACOES.filter(a => a.origem_modulo === 'ouvidoria').length,
            epi: MOCK_ACOES.filter(a => a.origem_modulo === 'epi').length,
            ponto: MOCK_ACOES.filter(a => a.origem_modulo === 'ponto').length,
            humor: MOCK_ACOES.filter(a => a.origem_modulo === 'humor').length,
          },
          por_prioridade: { 
            baixo: MOCK_ACOES.filter(a => a.prioridade === 'baixo').length,
            medio: MOCK_ACOES.filter(a => a.prioridade === 'medio').length,
            urgente: MOCK_ACOES.filter(a => a.prioridade === 'urgente').length,
            imediato: MOCK_ACOES.filter(a => a.prioridade === 'imediato').length,
          },
        };
      }

      const { data, error } = await supabase
        .from("plano_acoes")
        .select("status, origem_modulo, prioridade, prazo")
        .eq("tenant_id", tenantId);

      if (error) throw error;
      
      // Se não há dados reais, usa mock
      const finalData = (!data || data.length === 0) ? MOCK_ACOES : data;

      const result: PlanoAcaoStats = {
        total: finalData.length,
        pendentes: finalData.filter((a) => a.status === "pendente").length,
        em_andamento: finalData.filter((a) => a.status === "em_andamento").length,
        atrasadas: finalData.filter((a) => a.prazo && new Date(a.prazo) < new Date() && a.status !== "concluida").length,
        concluidas: finalData.filter((a) => a.status === "concluida").length,
        por_origem: { manual: 0, ergonomia: 0, ouvidoria: 0, epi: 0, ponto: 0, humor: 0 },
        por_prioridade: { baixo: 0, medio: 0, urgente: 0, imediato: 0 },
      };

      finalData.forEach((a) => {
        if (a.origem_modulo && result.por_origem[a.origem_modulo as keyof typeof result.por_origem] !== undefined) {
          result.por_origem[a.origem_modulo as keyof typeof result.por_origem]++;
        }
        if (a.prioridade && result.por_prioridade[a.prioridade as keyof typeof result.por_prioridade] !== undefined) {
          result.por_prioridade[a.prioridade as keyof typeof result.por_prioridade]++;
        }
      });

      return result;
    },
    enabled: true,
  });

  // Minhas ações (inbox) - mock com algumas ações atribuídas ao usuário
  const { data: minhasAcoes = [], isLoading: isLoadingMinhasAcoes } = useQuery({
    queryKey: ["plano-minhas-acoes", tenantId, user?.id],
    queryFn: async () => {
      if (!tenantId || !user?.id) {
        // Retorna algumas ações mock como "minhas"
        return MOCK_ACOES.filter(a => 
          a.responsavel_nome === "Carlos Silva" && a.status !== "concluida"
        );
      }

      // Ações onde sou responsável
      const { data: responsavel, error: errResp } = await supabase
        .from("plano_acoes")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("responsavel_id", user.id)
        .neq("status", "concluida")
        .order("pontuacao_gut", { ascending: false });

      if (errResp) throw errResp;

      // Ações onde sou participante
      const { data: participante, error: errPart } = await supabase
        .from("plano_participantes")
        .select("acao_id")
        .eq("tenant_id", tenantId)
        .eq("usuario_id", user.id);

      if (errPart) throw errPart;

      const participanteIds = participante?.map((p) => p.acao_id) || [];

      if (participanteIds.length > 0) {
        const { data: acoesParticipante, error: errAcoes } = await supabase
          .from("plano_acoes")
          .select("*")
          .in("id", participanteIds)
          .neq("status", "concluida");

        if (errAcoes) throw errAcoes;

        // Merge sem duplicatas
        const merged = [...(responsavel || [])];
        acoesParticipante?.forEach((a) => {
          if (!merged.find((m) => m.id === a.id)) {
            merged.push(a);
          }
        });
        
        if (merged.length === 0) {
          return MOCK_ACOES.filter(a => 
            a.responsavel_nome === "Carlos Silva" && a.status !== "concluida"
          );
        }
        
        return merged as PlanoAcao[];
      }

      if (!responsavel || responsavel.length === 0) {
        return MOCK_ACOES.filter(a => 
          a.responsavel_nome === "Carlos Silva" && a.status !== "concluida"
        );
      }

      return responsavel as PlanoAcao[];
    },
    enabled: true,
  });

  // ===================== MUTATIONS =====================

  // Criar ação
  const createAcaoMutation = useMutation({
    mutationFn: async (data: CreatePlanoAcaoDTO) => {
      if (!tenantId) throw new Error("Tenant não encontrado");

      const userName = profile?.nome_completo || user?.email || "Usuário";

      const { data: created, error } = await supabase
        .from("plano_acoes")
        .insert({
          ...data,
          tenant_id: tenantId,
          codigo: "", // Será gerado pelo trigger
          criado_por: user?.id,
          criado_por_nome: userName,
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar histórico
      await supabase.from("plano_historico").insert({
        tenant_id: tenantId,
        acao_id: created.id,
        tipo_evento: "criacao",
        descricao: `Ação "${created.titulo}" criada`,
        usuario_id: user?.id,
        usuario_nome: userName,
      });

      return created as PlanoAcao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-acoes"] });
      queryClient.invalidateQueries({ queryKey: ["plano-acoes-stats"] });
      queryClient.invalidateQueries({ queryKey: ["plano-minhas-acoes"] });
      toast.success("Ação criada com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao criar ação:", error);
      toast.error("Erro ao criar ação");
    },
  });

  // Atualizar ação
  const updateAcaoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdatePlanoAcaoDTO }) => {
      const userName = profile?.nome_completo || user?.email || "Usuário";
      
      const { data: updated, error } = await supabase
        .from("plano_acoes")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Registrar histórico
      await (supabase.from("plano_historico") as any).insert({
        tenant_id: tenantId,
        acao_id: id,
        tipo_evento: "edicao",
        descricao: `Ação atualizada`,
        dados_novos: data as Record<string, unknown>,
        usuario_id: user?.id,
        usuario_nome: userName,
      });

      return updated as PlanoAcao;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["plano-acoes"] });
      queryClient.invalidateQueries({ queryKey: ["plano-acao", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["plano-acoes-stats"] });
      toast.success("Ação atualizada!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar ação:", error);
      toast.error("Erro ao atualizar ação");
    },
  });

  // Deletar ação
  const deleteAcaoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plano_acoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-acoes"] });
      queryClient.invalidateQueries({ queryKey: ["plano-acoes-stats"] });
      toast.success("Ação excluída!");
    },
    onError: (error) => {
      console.error("Erro ao excluir ação:", error);
      toast.error("Erro ao excluir ação");
    },
  });

  // Criar tarefa
  const createTarefaMutation = useMutation({
    mutationFn: async (data: CreatePlanoTarefaDTO) => {
      if (!tenantId) throw new Error("Tenant não encontrado");

      const userName = profile?.nome_completo || user?.email || "Usuário";

      const { data: created, error } = await supabase
        .from("plano_tarefas")
        .insert({
          ...data,
          tenant_id: tenantId,
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar histórico
      await supabase.from("plano_historico").insert({
        tenant_id: tenantId,
        acao_id: data.acao_id,
        tarefa_id: created.id,
        tipo_evento: "criacao",
        descricao: `Tarefa "${created.titulo}" adicionada`,
        usuario_id: user?.id,
        usuario_nome: userName,
      });

      return created as PlanoTarefa;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["plano-tarefas", variables.acao_id] });
      queryClient.invalidateQueries({ queryKey: ["plano-acao", variables.acao_id] });
      queryClient.invalidateQueries({ queryKey: ["plano-historico", variables.acao_id] });
      toast.success("Tarefa adicionada!");
    },
    onError: (error) => {
      console.error("Erro ao criar tarefa:", error);
      toast.error("Erro ao criar tarefa");
    },
  });

  // Atualizar tarefa
  const updateTarefaMutation = useMutation({
    mutationFn: async ({ id, acaoId, data }: { id: string; acaoId: string; data: UpdatePlanoTarefaDTO }) => {
      const userName = profile?.nome_completo || user?.email || "Usuário";
      
      // Se é uma tarefa mock, simular atualização localmente
      if (id.startsWith("tarefa-") || acaoId.startsWith("mock-")) {
        const mockTarefa = MOCK_TAREFAS.find(t => t.id === id);
        if (mockTarefa) {
          const updated = { 
            ...mockTarefa, 
            ...data,
            data_conclusao: data.status === "concluida" ? new Date().toISOString() : mockTarefa.data_conclusao,
          };
          // Atualizar no array mock para refletir mudança
          const index = MOCK_TAREFAS.findIndex(t => t.id === id);
          if (index !== -1) {
            MOCK_TAREFAS[index] = updated as PlanoTarefa;
          }
          return updated as PlanoTarefa;
        }
        throw new Error("Tarefa não encontrada");
      }
      
      const updateData: Record<string, unknown> = { ...data };
      
      // Se está sendo concluída, registrar quem concluiu
      if (data.status === "concluida") {
        updateData.data_conclusao = new Date().toISOString();
        updateData.concluida_por = user?.id;
        updateData.concluida_por_nome = userName;
      }

      const { data: updated, error } = await supabase
        .from("plano_tarefas")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Registrar histórico se status mudou
      if (data.status) {
        await supabase.from("plano_historico").insert({
          tenant_id: tenantId,
          acao_id: acaoId,
          tarefa_id: id,
          tipo_evento: data.status === "concluida" ? "tarefa_concluida" : "status_alterado",
          descricao: data.status === "concluida" 
            ? `Tarefa "${updated.titulo}" concluída` 
            : `Status da tarefa "${updated.titulo}" alterado para ${data.status}`,
          usuario_id: user?.id,
          usuario_nome: userName,
        });
      }

      return updated as PlanoTarefa;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["plano-tarefas", variables.acaoId] });
      queryClient.invalidateQueries({ queryKey: ["plano-acao", variables.acaoId] });
      queryClient.invalidateQueries({ queryKey: ["plano-acoes"] });
      queryClient.invalidateQueries({ queryKey: ["plano-historico", variables.acaoId] });
      toast.success("Tarefa atualizada!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar tarefa:", error);
      toast.error("Erro ao atualizar tarefa");
    },
  });

  // Deletar tarefa
  const deleteTarefaMutation = useMutation({
    mutationFn: async ({ id, acaoId }: { id: string; acaoId: string }) => {
      // Se é uma tarefa mock, simular deleção localmente
      if (id.startsWith("tarefa-") || acaoId.startsWith("mock-")) {
        const index = MOCK_TAREFAS.findIndex(t => t.id === id);
        if (index !== -1) {
          MOCK_TAREFAS.splice(index, 1);
        }
        return { acaoId };
      }
      
      const { error } = await supabase.from("plano_tarefas").delete().eq("id", id);
      if (error) throw error;
      return { acaoId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["plano-tarefas", data.acaoId] });
      queryClient.invalidateQueries({ queryKey: ["plano-acao", data.acaoId] });
      toast.success("Tarefa removida!");
    },
    onError: (error) => {
      console.error("Erro ao excluir tarefa:", error);
      toast.error("Erro ao excluir tarefa");
    },
  });

  // Adicionar comentário
  const createComentarioMutation = useMutation({
    mutationFn: async ({ acaoId, conteudo, tarefaId }: { acaoId: string; conteudo: string; tarefaId?: string }) => {
      if (!tenantId || !user?.id) throw new Error("Usuário não autenticado");

      const userName = profile?.nome_completo || user.email || "Usuário";

      const { data: created, error } = await supabase
        .from("plano_comentarios")
        .insert({
          tenant_id: tenantId,
          acao_id: acaoId,
          tarefa_id: tarefaId,
          conteudo,
          autor_id: user.id,
          autor_nome: userName,
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar histórico
      await supabase.from("plano_historico").insert({
        tenant_id: tenantId,
        acao_id: acaoId,
        tarefa_id: tarefaId,
        tipo_evento: "comentario",
        descricao: `Comentário adicionado`,
        usuario_id: user.id,
        usuario_nome: userName,
      });

      return created as PlanoComentario;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["plano-comentarios", variables.acaoId] });
      queryClient.invalidateQueries({ queryKey: ["plano-historico", variables.acaoId] });
      toast.success("Comentário adicionado!");
    },
    onError: (error) => {
      console.error("Erro ao adicionar comentário:", error);
      toast.error("Erro ao adicionar comentário");
    },
  });

  return {
    // Queries
    acoes,
    isLoadingAcoes,
    refetchAcoes,
    stats,
    isLoadingStats,
    minhasAcoes,
    isLoadingMinhasAcoes,
    
    // Hooks para uso individual
    useAcao,
    useTarefas,
    useHistorico,
    useComentarios,
    useEvidencias,
    useParticipantes,
    
    // Mutations
    createAcao: createAcaoMutation.mutateAsync,
    isCreatingAcao: createAcaoMutation.isPending,
    updateAcao: updateAcaoMutation.mutateAsync,
    isUpdatingAcao: updateAcaoMutation.isPending,
    deleteAcao: deleteAcaoMutation.mutateAsync,
    isDeletingAcao: deleteAcaoMutation.isPending,
    
    createTarefa: createTarefaMutation.mutateAsync,
    isCreatingTarefa: createTarefaMutation.isPending,
    updateTarefa: updateTarefaMutation.mutateAsync,
    isUpdatingTarefa: updateTarefaMutation.isPending,
    deleteTarefa: deleteTarefaMutation.mutateAsync,
    isDeletingTarefa: deleteTarefaMutation.isPending,
    
    createComentario: createComentarioMutation.mutateAsync,
    isCreatingComentario: createComentarioMutation.isPending,
  };
}
