import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";

export type HumorCategory = "positivo" | "neutro" | "negativo";

export interface HumorOption {
  id: string;
  label: string;
  emoji: string;
  color: string;
  category: HumorCategory;
}

// POSITIVOS: indicam bem-estar
// NEUTROS: requerem atenção leve
// NEGATIVOS: indicam risco de burnout/boreout e exigem atenção da gestão
export const HUMOR_OPTIONS: HumorOption[] = [
  // Positivos
  { id: "bem", label: "Bem", emoji: "😊", color: "bg-green-500", category: "positivo" },
  { id: "animado", label: "Animado", emoji: "😄", color: "bg-green-400", category: "positivo" },
  { id: "motivado", label: "Motivado", emoji: "💪", color: "bg-emerald-500", category: "positivo" },
  // Neutros
  { id: "neutro", label: "Neutro", emoji: "😐", color: "bg-yellow-400", category: "neutro" },
  { id: "cansado", label: "Cansado", emoji: "😴", color: "bg-orange-400", category: "neutro" },
  // Negativos (atenção - indicam risco)
  { id: "estressado", label: "Estressado", emoji: "😰", color: "bg-red-500", category: "negativo" },
  { id: "ansioso", label: "Ansioso", emoji: "😟", color: "bg-red-400", category: "negativo" },
  { id: "desanimado", label: "Desanimado", emoji: "😞", color: "bg-red-300", category: "negativo" },
];

// Micro-perguntas rotativas para análise ergonômica cognitiva
export interface MicroPergunta {
  id: string;
  pergunta: string;
  opcoes: { label: string; value: string }[];
}

export const MICRO_PERGUNTAS: MicroPergunta[] = [
  {
    id: "carga_trabalho",
    pergunta: "Hoje meu trabalho foi…",
    opcoes: [
      { label: "Leve", value: "leve" },
      { label: "Normal", value: "normal" },
      { label: "Pesado", value: "pesado" },
    ],
  },
  {
    id: "pausas",
    pergunta: "Consegui fazer pausas hoje?",
    opcoes: [
      { label: "Sim", value: "sim" },
      { label: "Parcial", value: "parcial" },
      { label: "Não", value: "nao" },
    ],
  },
  {
    id: "pressao",
    pergunta: "Senti pressão excessiva hoje?",
    opcoes: [
      { label: "Sim", value: "sim" },
      { label: "Não", value: "nao" },
    ],
  },
  {
    id: "apoio_equipe",
    pergunta: "Tive apoio da equipe hoje?",
    opcoes: [
      { label: "Sim", value: "sim" },
      { label: "Parcial", value: "parcial" },
      { label: "Não", value: "nao" },
    ],
  },
  {
    id: "clareza_tarefas",
    pergunta: "As tarefas de hoje foram claras?",
    opcoes: [
      { label: "Sim", value: "sim" },
      { label: "Parcial", value: "parcial" },
      { label: "Não", value: "nao" },
    ],
  },
];

// Função para obter uma micro-pergunta aleatória
export function getMicroPerguntaAleatoria(): MicroPergunta {
  const indice = Math.floor(Math.random() * MICRO_PERGUNTAS.length);
  return MICRO_PERGUNTAS[indice];
}

export interface HumorDiario {
  id: string;
  tenant_id: string;
  user_id: string;
  user_nome: string;
  data: string;
  humor: string;
  emoji: string;
  micropergunta_tipo?: string | null;
  micropergunta_resposta?: string | null;
  created_at: string;
  updated_at: string;
}

const humorDiarioTable = () => (supabase as any).from('humor_diario');
const humorHistoricoTable = () => (supabase as any).from('humor_historico');

const EMAILS_COM_POPUP_HUMOR_DESATIVADO = new Set([
  "renata_sophia_cortereal@cafefrossard.com",
]);

// Intervalo em horas para solicitar novo registro de humor (check-in recorrente)
const INTERVALO_HORAS = 5;

// Chaves de controle no localStorage para evitar múltiplas exibições
function getStorageKeys(userId: string, today: string) {
  return {
    morning: `humor_morning_${userId}_${today}`,   // primeiro login do dia
    lastShown: `humor_lastshown_${userId}`,        // timestamp do último popup exibido
  };
}

export function marcarHumorMorningVisto(userId: string) {
  const today = new Date().toISOString().split("T")[0];
  const keys = getStorageKeys(userId, today);
  localStorage.setItem(keys.morning, "1");
  localStorage.setItem(keys.lastShown, new Date().toISOString());
}

export function marcarHumorMiddayVisto(userId: string) {
  const keys = getStorageKeys(userId, new Date().toISOString().split("T")[0]);
  localStorage.setItem(keys.lastShown, new Date().toISOString());
}

// Verifica se passaram X horas desde o último registro
function passaramHorasDesdeRegistro(updatedAt: string, horas: number): boolean {
  const ultimaAtualizacao = new Date(updatedAt);
  const agora = new Date();
  const diferencaMs = agora.getTime() - ultimaAtualizacao.getTime();
  const diferencaHoras = diferencaMs / (1000 * 60 * 60);
  return diferencaHoras >= horas;
}

export function useHumorDiario() {
  const { user, profile, loading: authLoading } = useAuthContext();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split('T')[0];
  const popupHumorDesativado = EMAILS_COM_POPUP_HUMOR_DESATIVADO.has(
    user?.email?.toLowerCase() ?? ""
  );

  // Só buscar humor quando auth estiver pronto E profile carregado
  const isReady = !!user?.id && !!profile?.id && !authLoading;

  // Buscar humor do dia atual do usuário
  const { data: humorHoje, isLoading: queryLoading, refetch } = useQuery({
    queryKey: ["humor-diario", user?.id, today],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await humorDiarioTable()
        .select("*")
        .eq("user_id", user.id)
        .eq("data", today)
        .maybeSingle();

      if (error) throw error;
      return data as HumorDiario | null;
    },
    enabled: isReady,
  });

  // Loading inclui auth loading + query loading
  const isLoading = authLoading || !isReady || queryLoading;

  // Registrar humor do dia (primeira vez)
  const registrarHumor = useMutation({
    mutationFn: async ({ 
      humor, 
      emoji,
      micropergunta_tipo,
      micropergunta_resposta,
    }: { 
      humor: string; 
      emoji: string;
      micropergunta_tipo?: string;
      micropergunta_resposta?: string;
    }) => {
      if (!user?.id || !tenant?.id) {
        throw new Error("Sessão ainda carregando. Tente novamente em instantes.");
      }
      // Fallback: usuários sem registro em profiles (ou com perfil ainda
      // carregando) não devem ser impedidos de registrar o humor
      const nomeUsuario = profile?.nome_completo || user.email || "Colaborador";

      const { data, error } = await humorDiarioTable()
        .insert({
          tenant_id: tenant.id,
          user_id: user.id,
          user_nome: nomeUsuario,
          data: today,
          humor,
          emoji,
          micropergunta_tipo: micropergunta_tipo || null,
          micropergunta_resposta: micropergunta_resposta || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar no histórico como primeira entrada do dia
      await humorHistoricoTable().insert({
        tenant_id: tenant.id,
        user_id: user.id,
        user_nome: nomeUsuario,
        humor_diario_id: data.id,
        humor_anterior: null,
        humor_novo: humor,
        emoji_anterior: null,
        emoji_novo: emoji,
        motivo_mudanca: "Registro inicial do dia",
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["humor-diario"] });
    },
  });

  // Atualizar humor durante o dia
  const atualizarHumor = useMutation({
    mutationFn: async ({ 
      humor, 
      emoji, 
      motivo,
      micropergunta_tipo,
      micropergunta_resposta,
    }: { 
      humor: string; 
      emoji: string; 
      motivo?: string;
      micropergunta_tipo?: string;
      micropergunta_resposta?: string;
    }) => {
      if (!user?.id || !tenant?.id || !humorHoje) {
        throw new Error("Dados insuficientes para atualização");
      }
      const nomeUsuario = profile?.nome_completo || user.email || "Colaborador";

      const humorAnterior = humorHoje.humor;
      const emojiAnterior = humorHoje.emoji;

      // Atualizar o humor atual
      const { data, error } = await humorDiarioTable()
        .update({
          humor,
          emoji,
          micropergunta_tipo: micropergunta_tipo || null,
          micropergunta_resposta: micropergunta_resposta || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", humorHoje.id)
        .select()
        .single();

      if (error) throw error;

      // Registrar mudança no histórico
      await humorHistoricoTable().insert({
        tenant_id: tenant.id,
        user_id: user.id,
        user_nome: nomeUsuario,
        humor_diario_id: humorHoje.id,
        humor_anterior: humorAnterior,
        humor_novo: humor,
        emoji_anterior: emojiAnterior,
        emoji_novo: emoji,
        motivo_mudanca: motivo || "Mudança de humor durante o dia",
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["humor-diario"] });
    },
  });

  // Verificar se precisa mostrar o popup:
  // Ocasião 1 (morning): primeiro acesso do dia — não tem registro E não foi mostrado hoje
  // Ocasião 2 (recorrente): a cada 5h desde o último popup exibido
  const keys = isReady ? getStorageKeys(user!.id, today) : null;
  const morningJaMostrado = keys ? !!localStorage.getItem(keys.morning) : true;
  
  const lastShownStr = keys ? localStorage.getItem(keys.lastShown) : null;
  const passaram5hDesdeUltimoPopup = lastShownStr 
    ? passaramHorasDesdeRegistro(lastShownStr, INTERVALO_HORAS)
    : false;

  const precisaMorning = isReady && !queryLoading && !humorHoje && !morningJaMostrado;
  const precisaMidday = isReady && !queryLoading && !!humorHoje && passaram5hDesdeUltimoPopup;

  const precisaRegistrarHumor = !popupHumorDesativado && (precisaMorning || precisaMidday);

  // Flag para saber se é atualização (já tem registro) ou primeiro do dia
  const isAtualizacao = !!humorHoje;

  return {
    humorHoje,
    isLoading,
    precisaRegistrarHumor,
    isAtualizacao,
    marcarMorningVisto: () => user?.id && marcarHumorMorningVisto(user.id),
    marcarMiddayVisto: () => user?.id && marcarHumorMiddayVisto(user.id),
    registrarHumor,
    atualizarHumor,
    refetch,
  };
}
