import type { Trilha, TrilhaComProgresso, TrilhaModulo } from "@/types/trilha";
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

const baseModulo = {
  tenant_id: tenantDemo,
  conteudo_url: null,
  conteudo_texto: null,
  ordem_tipo: "sequencial" as const,
  evidencia_obrigatoria: false,
  competencia_relacionada: null,
  acao_pdi_id: null,
  ativo: true,
  created_at: now,
  updated_at: now,
};

export const DEMO_MODULOS: Record<string, TrilhaModulo[]> = {
  "demo-t1": [
    { ...baseModulo, id: "dm1-1", trilha_id: "demo-t1", titulo: "Introdução à NR-35", descricao: "Conceitos fundamentais sobre trabalho em altura e legislação aplicável.", objetivo: "Compreender o escopo da NR-35", tipo: "video", tempo_estimado_min: 15, pontuacao: 50, ordem: 1 },
    { ...baseModulo, id: "dm1-2", trilha_id: "demo-t1", titulo: "Análise de Risco em Altura", descricao: "Como identificar e avaliar riscos antes de iniciar atividades em altura.", objetivo: "Aplicar técnicas de análise de risco", tipo: "conteudo_interno", tempo_estimado_min: 20, pontuacao: 60, ordem: 2 },
    { ...baseModulo, id: "dm1-3", trilha_id: "demo-t1", titulo: "EPIs para Trabalho em Altura", descricao: "Equipamentos de proteção individual obrigatórios e seu uso correto.", objetivo: "Identificar e utilizar EPIs corretamente", tipo: "pdf", tempo_estimado_min: 15, pontuacao: 50, ordem: 3 },
    { ...baseModulo, id: "dm1-4", trilha_id: "demo-t1", titulo: "Quiz — Conceitos NR-35", descricao: "Avaliação dos conhecimentos adquiridos nos módulos anteriores.", objetivo: null, tipo: "quiz", tempo_estimado_min: 10, pontuacao: 80, ordem: 4 },
    { ...baseModulo, id: "dm1-5", trilha_id: "demo-t1", titulo: "Procedimentos de Resgate", descricao: "Técnicas e procedimentos para resgate em situações de emergência.", objetivo: "Executar procedimentos de resgate", tipo: "video", tempo_estimado_min: 25, pontuacao: 60, ordem: 5 },
    { ...baseModulo, id: "dm1-6", trilha_id: "demo-t1", titulo: "Atividade Prática — Plano de Resgate", descricao: "Elabore um plano de resgate para um cenário proposto.", objetivo: "Criar plano de resgate completo", tipo: "atividade_pratica", tempo_estimado_min: 30, pontuacao: 100, ordem: 6, evidencia_obrigatoria: true },
  ],
  "demo-t2": [
    { ...baseModulo, id: "dm2-1", trilha_id: "demo-t2", titulo: "O que é Segurança Psicológica?", descricao: "Conceito, origem e importância para equipes de alta performance.", objetivo: "Entender o conceito de segurança psicológica", tipo: "video", tempo_estimado_min: 12, pontuacao: 50, ordem: 1 },
    { ...baseModulo, id: "dm2-2", trilha_id: "demo-t2", titulo: "Os 4 Estágios da Segurança Psicológica", descricao: "Inclusão, aprendizado, contribuição e desafio.", objetivo: null, tipo: "conteudo_interno", tempo_estimado_min: 18, pontuacao: 60, ordem: 2 },
    { ...baseModulo, id: "dm2-3", trilha_id: "demo-t2", titulo: "Reflexão — Meu Ambiente de Trabalho", descricao: "Reflita sobre situações em que sentiu ou não segurança para se expressar.", objetivo: "Autoavaliação do ambiente atual", tipo: "reflexao", tempo_estimado_min: 15, pontuacao: 70, ordem: 3 },
    { ...baseModulo, id: "dm2-4", trilha_id: "demo-t2", titulo: "Estudo de Caso — Equipe Aristotle (Google)", descricao: "Análise do projeto Aristotle e como a segurança psicológica impactou resultados.", objetivo: null, tipo: "estudo_caso", tempo_estimado_min: 20, pontuacao: 80, ordem: 4 },
    { ...baseModulo, id: "dm2-5", trilha_id: "demo-t2", titulo: "Quiz Final — Segurança Psicológica", descricao: "Avaliação de aprendizado sobre todos os módulos.", objetivo: null, tipo: "quiz", tempo_estimado_min: 10, pontuacao: 100, ordem: 5 },
  ],
  "demo-t3": [
    { ...baseModulo, id: "dm3-1", trilha_id: "demo-t3", titulo: "Liderança: do Comando ao Cuidado", descricao: "Evolução dos modelos de liderança e o papel do líder humanizado.", objetivo: null, tipo: "video", tempo_estimado_min: 15, pontuacao: 50, ordem: 1 },
    { ...baseModulo, id: "dm3-2", trilha_id: "demo-t3", titulo: "Escuta Ativa e Empatia", descricao: "Técnicas de escuta ativa para gestores e líderes.", objetivo: "Praticar escuta ativa", tipo: "conteudo_interno", tempo_estimado_min: 20, pontuacao: 60, ordem: 2 },
    { ...baseModulo, id: "dm3-3", trilha_id: "demo-t3", titulo: "Feedback Construtivo", descricao: "Como dar e receber feedback de forma humanizada e efetiva.", objetivo: null, tipo: "video", tempo_estimado_min: 18, pontuacao: 60, ordem: 3 },
    { ...baseModulo, id: "dm3-4", trilha_id: "demo-t3", titulo: "Gestão de Conflitos", descricao: "Abordagens para mediação e resolução de conflitos na equipe.", objetivo: null, tipo: "conteudo_interno", tempo_estimado_min: 20, pontuacao: 60, ordem: 4 },
    { ...baseModulo, id: "dm3-5", trilha_id: "demo-t3", titulo: "Microdesafio — Conversa Difícil", descricao: "Conduza uma conversa difícil simulada com técnicas aprendidas.", objetivo: null, tipo: "microdesafio", tempo_estimado_min: 15, pontuacao: 70, ordem: 5 },
    { ...baseModulo, id: "dm3-6", trilha_id: "demo-t3", titulo: "Delegação e Autonomia", descricao: "Como delegar com clareza e promover autonomia responsável.", objetivo: null, tipo: "pdf", tempo_estimado_min: 15, pontuacao: 50, ordem: 6 },
    { ...baseModulo, id: "dm3-7", trilha_id: "demo-t3", titulo: "Estudo de Caso — Liderança em Crise", descricao: "Análise de liderança humanizada em cenários de pressão.", objetivo: null, tipo: "estudo_caso", tempo_estimado_min: 25, pontuacao: 80, ordem: 7 },
    { ...baseModulo, id: "dm3-8", trilha_id: "demo-t3", titulo: "Quiz — Liderança Humanizada", descricao: "Avaliação final dos conceitos de liderança.", objetivo: null, tipo: "quiz", tempo_estimado_min: 10, pontuacao: 100, ordem: 8 },
  ],
  "demo-t4": [
    { ...baseModulo, id: "dm4-1", trilha_id: "demo-t4", titulo: "Ergonomia Básica no Home Office", descricao: "Princípios de ergonomia para o ambiente de trabalho remoto.", objetivo: null, tipo: "video", tempo_estimado_min: 12, pontuacao: 50, ordem: 1 },
    { ...baseModulo, id: "dm4-2", trilha_id: "demo-t4", titulo: "Checklist — Organização do Espaço", descricao: "Verifique se seu espaço de trabalho atende aos requisitos ergonômicos.", objetivo: null, tipo: "checklist", tempo_estimado_min: 10, pontuacao: 60, ordem: 2 },
    { ...baseModulo, id: "dm4-3", trilha_id: "demo-t4", titulo: "Pausas Ativas e Alongamentos", descricao: "Exercícios e pausas recomendadas para prevenção de LER/DORT.", objetivo: null, tipo: "conteudo_interno", tempo_estimado_min: 15, pontuacao: 50, ordem: 3 },
    { ...baseModulo, id: "dm4-4", trilha_id: "demo-t4", titulo: "Quiz — Ergonomia no Home Office", descricao: "Avaliação rápida sobre boas práticas ergonômicas.", objetivo: null, tipo: "quiz", tempo_estimado_min: 8, pontuacao: 80, ordem: 4 },
  ],
  "demo-t5": [
    { ...baseModulo, id: "dm5-1", trilha_id: "demo-t5", titulo: "Bem-vindo à Empresa!", descricao: "Apresentação institucional: história, missão, visão e valores.", objetivo: null, tipo: "video", tempo_estimado_min: 10, pontuacao: 40, ordem: 1 },
    { ...baseModulo, id: "dm5-2", trilha_id: "demo-t5", titulo: "Nossa Cultura e Valores", descricao: "Como trabalhamos, o que valorizamos e o que esperamos.", objetivo: null, tipo: "conteudo_interno", tempo_estimado_min: 15, pontuacao: 60, ordem: 2 },
    { ...baseModulo, id: "dm5-3", trilha_id: "demo-t5", titulo: "Checklist de Integração", descricao: "Documentos, acessos e orientações iniciais que você precisa completar.", objetivo: null, tipo: "checklist", tempo_estimado_min: 20, pontuacao: 80, ordem: 3 },
    { ...baseModulo, id: "dm5-4", trilha_id: "demo-t5", titulo: "Conheça sua Equipe", descricao: "Apresentação dos colegas e da estrutura organizacional.", objetivo: null, tipo: "conteudo_interno", tempo_estimado_min: 10, pontuacao: 50, ordem: 4 },
    { ...baseModulo, id: "dm5-5", trilha_id: "demo-t5", titulo: "Quiz — Integração Cultural", descricao: "Verifique se absorveu os pontos principais da integração.", objetivo: null, tipo: "quiz", tempo_estimado_min: 8, pontuacao: 70, ordem: 5 },
  ],
  "demo-t6": [
    { ...baseModulo, id: "dm6-1", trilha_id: "demo-t6", titulo: "O que é um POP?", descricao: "Introdução aos Procedimentos Operacionais Padrão.", objetivo: null, tipo: "conteudo_interno", tempo_estimado_min: 12, pontuacao: 50, ordem: 1 },
    { ...baseModulo, id: "dm6-2", trilha_id: "demo-t6", titulo: "Como Documentar Processos", descricao: "Técnicas e ferramentas para documentação padronizada.", objetivo: null, tipo: "pdf", tempo_estimado_min: 18, pontuacao: 60, ordem: 2 },
    { ...baseModulo, id: "dm6-3", trilha_id: "demo-t6", titulo: "Atividade — Crie seu POP", descricao: "Elabore um POP para um processo do seu setor.", objetivo: null, tipo: "atividade_pratica", tempo_estimado_min: 30, pontuacao: 100, ordem: 3, evidencia_obrigatoria: true },
  ],
};
