import type { Trilha, TrilhaComProgresso } from "@/types/trilha";
import type { Medalha, MedalhaConquistada, Certificado, RankingEntry } from "@/hooks/useGamificacao";

const now = new Date().toISOString();
const tenantDemo = "demo-tenant";

const baseTrilha = {
  objetivo: null,
  visibilidade: "publica" as const,
  pontuacao_minima: 70,
  imagem_url: null,
  conexao_pdi: false,
  conexao_indicadores: null,
};

export const DEMO_TRILHAS: Trilha[] = [
  { ...baseTrilha, id: "demo-t1", tenant_id: tenantDemo, nome: "NR-35 — Trabalho em Altura", descricao: "Capacitação obrigatória para atividades acima de 2 metros com risco de queda. Inclui análise de risco, EPIs e procedimentos de resgate.", tipo: "tecnica", prioridade: "obrigatoria", status: "ativa", prazo_dias: 30, total_modulos: 6, criado_por: null, criado_por_nome: "Admin Demo", created_at: "2026-01-15T10:00:00Z", updated_at: now },
  { ...baseTrilha, id: "demo-t2", tenant_id: tenantDemo, nome: "Cultura de Segurança Psicológica", descricao: "Trilha sobre criação de ambientes seguros para expressão, feedback e vulnerabilidade no trabalho.", tipo: "comportamental", prioridade: "recomendada", status: "ativa", prazo_dias: 45, total_modulos: 5, criado_por: null, criado_por_nome: "Admin Demo", created_at: "2026-01-20T10:00:00Z", updated_at: now },
  { ...baseTrilha, id: "demo-t3", tenant_id: tenantDemo, nome: "Liderança Humanizada", descricao: "Desenvolvimento de competências de liderança com foco em pessoas, empatia e gestão participativa.", tipo: "lideranca", prioridade: "recomendada", status: "ativa", prazo_dias: 60, total_modulos: 8, criado_por: null, criado_por_nome: "Admin Demo", created_at: "2026-02-01T10:00:00Z", updated_at: now },
  { ...baseTrilha, id: "demo-t4", tenant_id: tenantDemo, nome: "Ergonomia no Home Office", descricao: "Orientações práticas para organização do espaço de trabalho remoto, prevenção de LER/DORT e pausas ativas.", tipo: "ergonomia_saude", prioridade: "opcional", status: "ativa", prazo_dias: null, total_modulos: 4, criado_por: null, criado_por_nome: "Admin Demo", created_at: "2026-02-05T10:00:00Z", updated_at: now },
  { ...baseTrilha, id: "demo-t5", tenant_id: tenantDemo, nome: "Onboarding — Integração Cultural", descricao: "Trilha de acolhimento para novos colaboradores com apresentação da empresa, valores e processos internos.", tipo: "cultura", prioridade: "obrigatoria", status: "ativa", prazo_dias: 15, total_modulos: 5, criado_por: null, criado_por_nome: "Admin Demo", created_at: "2026-02-10T10:00:00Z", updated_at: now },
  { ...baseTrilha, id: "demo-t6", tenant_id: tenantDemo, nome: "Gestão de Processos (POP)", descricao: "Como documentar, padronizar e melhorar processos operacionais através de Procedimentos Operacionais Padrão.", tipo: "processos", prioridade: "recomendada", status: "rascunho", prazo_dias: 30, total_modulos: 3, criado_por: null, criado_por_nome: "Admin Demo", created_at: "2026-02-12T10:00:00Z", updated_at: now },
];

export const DEMO_MINHAS_TRILHAS: TrilhaComProgresso[] = [
  { ...DEMO_TRILHAS[0], progressoModulos: [], totalConcluidos: 4, pontosObtidos: 340, percentual: 67 },
  { ...DEMO_TRILHAS[1], progressoModulos: [], totalConcluidos: 5, pontosObtidos: 480, percentual: 100 },
  { ...DEMO_TRILHAS[2], progressoModulos: [], totalConcluidos: 2, pontosObtidos: 150, percentual: 25 },
  { ...DEMO_TRILHAS[3], progressoModulos: [], totalConcluidos: 0, pontosObtidos: 0, percentual: 0 },
  { ...DEMO_TRILHAS[4], progressoModulos: [], totalConcluidos: 5, pontosObtidos: 400, percentual: 100 },
];

export const DEMO_MEDALHAS_CONFIG: Medalha[] = [
  { id: "dm1", tenant_id: tenantDemo, nome: "Primeiro Passo", descricao: "Concluiu o primeiro módulo", icone: "star", cor: "#3b82f6", tipo: "primeiro_modulo", criterio: {}, pontos_bonus: 50, ativo: true, created_at: now },
  { id: "dm2", tenant_id: tenantDemo, nome: "Explorador", descricao: "Concluiu 3 trilhas diferentes", icone: "target", cor: "#8b5cf6", tipo: "conclusao_trilha", criterio: { quantidade: 3 }, pontos_bonus: 150, ativo: true, created_at: now },
  { id: "dm3", tenant_id: tenantDemo, nome: "Segurança em Primeiro", descricao: "Concluiu uma trilha de NR", icone: "flame", cor: "#ef4444", tipo: "conclusao_trilha", criterio: {}, pontos_bonus: 100, ativo: true, created_at: now },
  { id: "dm4", tenant_id: tenantDemo, nome: "Líder em Formação", descricao: "Concluiu trilha de liderança", icone: "crown", cor: "#f59e0b", tipo: "conclusao_trilha", criterio: {}, pontos_bonus: 200, ativo: true, created_at: now },
  { id: "dm5", tenant_id: tenantDemo, nome: "Dedicação Total", descricao: "Obteve nota máxima em um quiz", icone: "trophy", cor: "#10b981", tipo: "nota_maxima", criterio: {}, pontos_bonus: 75, ativo: true, created_at: now },
  { id: "dm6", tenant_id: tenantDemo, nome: "Bem-estar", descricao: "Concluiu trilha de ergonomia", icone: "heart", cor: "#ec4899", tipo: "conclusao_trilha", criterio: {}, pontos_bonus: 100, ativo: true, created_at: now },
];

export const DEMO_MINHAS_MEDALHAS: MedalhaConquistada[] = [
  { id: "dmc1", tenant_id: tenantDemo, medalha_id: "dm1", colaborador_id: "demo-user", colaborador_nome: "Você", trilha_id: "demo-t1", data_conquista: "2026-01-20T10:00:00Z", created_at: now, medalha: DEMO_MEDALHAS_CONFIG[0] },
  { id: "dmc2", tenant_id: tenantDemo, medalha_id: "dm3", colaborador_id: "demo-user", colaborador_nome: "Você", trilha_id: "demo-t1", data_conquista: "2026-02-01T10:00:00Z", created_at: now, medalha: DEMO_MEDALHAS_CONFIG[2] },
  { id: "dmc3", tenant_id: tenantDemo, medalha_id: "dm5", colaborador_id: "demo-user", colaborador_nome: "Você", trilha_id: "demo-t2", data_conquista: "2026-02-10T10:00:00Z", created_at: now, medalha: DEMO_MEDALHAS_CONFIG[4] },
];

export const DEMO_CERTIFICADOS: Certificado[] = [
  { id: "dc1", tenant_id: tenantDemo, trilha_id: "demo-t2", colaborador_id: "demo-user", colaborador_nome: "Usuário Demo", data_conclusao: "2026-02-08T10:00:00Z", pontos_obtidos: 480, codigo: "CERT-A3F8B2C1", created_at: now, trilha_nome: "Cultura de Segurança Psicológica" },
  { id: "dc2", tenant_id: tenantDemo, trilha_id: "demo-t5", colaborador_id: "demo-user", colaborador_nome: "Usuário Demo", data_conclusao: "2026-02-14T10:00:00Z", pontos_obtidos: 400, codigo: "CERT-D7E9F4A2", created_at: now, trilha_nome: "Onboarding — Integração Cultural" },
];

export const DEMO_RANKING: RankingEntry[] = [
  { colaborador_id: "r1", colaborador_nome: "Ana Beatriz Silva", total_pontos: 1850, trilhas_concluidas: 4, medalhas_count: 6 },
  { colaborador_id: "r2", colaborador_nome: "Carlos Eduardo Oliveira", total_pontos: 1620, trilhas_concluidas: 3, medalhas_count: 5 },
  { colaborador_id: "demo-user", colaborador_nome: "Você (Demo)", total_pontos: 1370, trilhas_concluidas: 2, medalhas_count: 3 },
  { colaborador_id: "r3", colaborador_nome: "Mariana Costa Santos", total_pontos: 1190, trilhas_concluidas: 2, medalhas_count: 4 },
  { colaborador_id: "r4", colaborador_nome: "Rafael Mendes Almeida", total_pontos: 980, trilhas_concluidas: 2, medalhas_count: 2 },
  { colaborador_id: "r5", colaborador_nome: "Juliana Ferreira Lima", total_pontos: 750, trilhas_concluidas: 1, medalhas_count: 2 },
  { colaborador_id: "r6", colaborador_nome: "Pedro Augusto Ribeiro", total_pontos: 520, trilhas_concluidas: 1, medalhas_count: 1 },
  { colaborador_id: "r7", colaborador_nome: "Fernanda Rocha Dias", total_pontos: 340, trilhas_concluidas: 0, medalhas_count: 1 },
];
