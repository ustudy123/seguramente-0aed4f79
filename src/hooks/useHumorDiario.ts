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

export interface HumorDiario {
  id: string;
  tenant_id: string;
  user_id: string;
  user_nome: string;
  data: string;
  humor: string;
  emoji: string;
  created_at: string;
  updated_at: string;
}

const humorDiarioTable = () => (supabase as any).from('humor_diario');
const humorHistoricoTable = () => (supabase as any).from('humor_historico');

export function useHumorDiario() {
  const { user, profile } = useAuthContext();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split('T')[0];

  // Buscar humor do dia atual do usuário
  const { data: humorHoje, isLoading, refetch } = useQuery({
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
    enabled: !!user?.id,
  });

  // Registrar humor do dia (primeira vez)
  const registrarHumor = useMutation({
    mutationFn: async ({ humor, emoji }: { humor: string; emoji: string }) => {
      if (!user?.id || !tenant?.id || !profile?.nome_completo) {
        throw new Error("Usuário não autenticado");
      }

      const { data, error } = await humorDiarioTable()
        .insert({
          tenant_id: tenant.id,
          user_id: user.id,
          user_nome: profile.nome_completo,
          data: today,
          humor,
          emoji,
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar no histórico como primeira entrada do dia
      await humorHistoricoTable().insert({
        tenant_id: tenant.id,
        user_id: user.id,
        user_nome: profile.nome_completo,
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
      motivo 
    }: { 
      humor: string; 
      emoji: string; 
      motivo?: string;
    }) => {
      if (!user?.id || !tenant?.id || !profile?.nome_completo || !humorHoje) {
        throw new Error("Dados insuficientes para atualização");
      }

      const humorAnterior = humorHoje.humor;
      const emojiAnterior = humorHoje.emoji;

      // Atualizar o humor atual
      const { data, error } = await humorDiarioTable()
        .update({
          humor,
          emoji,
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
        user_nome: profile.nome_completo,
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

  // Verificar se precisa mostrar o popup (não registrou humor hoje)
  const precisaRegistrarHumor = !isLoading && !humorHoje && !!user?.id;

  return {
    humorHoje,
    isLoading,
    precisaRegistrarHumor,
    registrarHumor,
    atualizarHumor,
    refetch,
  };
}
