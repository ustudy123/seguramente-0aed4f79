import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type TicketTipo = "bug" | "falha" | "reclamacao" | "sugestao" | "duvida";
export type TicketStatus = "aberto" | "em_analise" | "em_andamento" | "resolvido" | "fechado" | "cancelado";
export type TicketPrioridade = "baixa" | "media" | "alta" | "critica";

export interface SuporteTicket {
  id: string;
  tenant_id: string;
  titulo: string;
  descricao: string;
  tipo: TicketTipo;
  status: TicketStatus;
  prioridade: TicketPrioridade;
  modulo: string | null;
  screenshot_url: string | null;
  criado_por: string | null;
  criado_por_nome: string | null;
  atribuido_a_nome: string | null;
  atribuido_a_id: string | null;
  resolucao: string | null;
  resolvido_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketComentario {
  id: string;
  ticket_id: string;
  autor_id: string | null;
  autor_nome: string | null;
  conteudo: string;
  created_at: string;
}

export const TIPO_LABELS: Record<TicketTipo, string> = {
  bug: "Bug",
  falha: "Falha",
  reclamacao: "Reclamação",
  sugestao: "Sugestão",
  duvida: "Dúvida",
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  aberto: "Aberto",
  em_analise: "Em Análise",
  em_andamento: "Em Andamento",
  resolvido: "Resolvido",
  fechado: "Fechado",
  cancelado: "Cancelado",
};

export const PRIORIDADE_LABELS: Record<TicketPrioridade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export function useSuporteTickets() {
  const { tenantId, user, profile, isSuperAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["suporte-tickets", tenantId, isSuperAdmin],
    queryFn: async (): Promise<SuporteTicket[]> => {
      if (!isSuperAdmin && !tenantId) return [];
      let query = (supabase as any)
        .from("suporte_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      // Superadmins veem todos os tickets; usuários normais só do seu tenant
      if (!isSuperAdmin) {
        query = query.eq("tenant_id", tenantId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin || !!tenantId,
  });

  const createTicket = useMutation({
    mutationFn: async (payload: Partial<SuporteTicket>) => {
      if (!tenantId) throw new Error("Sem tenant");
      const { data, error } = await (supabase as any)
        .from("suporte_tickets")
        .insert({
          ...payload,
          tenant_id: tenantId,
          criado_por: user?.id,
          criado_por_nome: profile?.nome_completo || user?.email,
        })
        .select()
        .single();
      if (error) throw error;
      return data as SuporteTicket;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suporte-tickets"] });
      toast.success("Ticket criado com sucesso!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const updateTicket = useMutation({
    mutationFn: async ({ id, ...payload }: Partial<SuporteTicket> & { id: string }) => {
      const updateData: any = { ...payload };
      if (payload.status === "resolvido" && !payload.resolvido_em) {
        updateData.resolvido_em = new Date().toISOString();
      }
      const { error } = await (supabase as any)
        .from("suporte_tickets")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suporte-tickets"] });
      toast.success("Ticket atualizado!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  // Comments
  const fetchComentarios = async (ticketId: string): Promise<TicketComentario[]> => {
    const { data, error } = await (supabase as any)
      .from("suporte_ticket_comentarios")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at");
    if (error) throw error;
    return data || [];
  };

  const addComentario = useMutation({
    mutationFn: async ({ ticketId, conteudo }: { ticketId: string; conteudo: string }) => {
      if (!tenantId) throw new Error("Sem tenant");
      const { error } = await (supabase as any)
        .from("suporte_ticket_comentarios")
        .insert({
          tenant_id: tenantId,
          ticket_id: ticketId,
          autor_id: user?.id,
          autor_nome: profile?.nome_completo || user?.email,
          conteudo,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comentário adicionado!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  return {
    tickets,
    isLoading,
    isSuperAdmin,
    createTicket,
    updateTicket,
    fetchComentarios,
    addComentario,
  };
}
