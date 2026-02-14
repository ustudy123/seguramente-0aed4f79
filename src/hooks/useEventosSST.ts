import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import type { EventoSST, EventoSSTAnexo } from "@/types/eventoSST";

export const useEventosSST = () => {
  const { user, profile } = useAuth();
  const { tenant } = useTenant();
  const qc = useQueryClient();
  const tid = tenant?.id;

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["eventos-sst", tid],
    queryFn: async () => {
      if (!tid) return [];
      const { data, error } = await supabase
        .from("eventos_sst")
        .select("*")
        .eq("tenant_id", tid)
        .order("data_evento", { ascending: false });
      if (error) throw error;
      return data as unknown as EventoSST[];
    },
    enabled: !!tid,
  });

  const createEvento = useMutation({
    mutationFn: async (evt: Partial<EventoSST>) => {
      const { data, error } = await supabase
        .from("eventos_sst")
        .insert({
          ...evt,
          tenant_id: tid!,
          criado_por: user?.id,
          criado_por_nome: profile?.nome_completo || user?.email,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventos-sst"] });
      toast.success("Evento registrado com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateEvento = useMutation({
    mutationFn: async ({ id, ...rest }: Partial<EventoSST> & { id: string }) => {
      const { error } = await supabase
        .from("eventos_sst")
        .update(rest as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventos-sst"] });
      toast.success("Evento atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteEvento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("eventos_sst").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventos-sst"] });
      toast.success("Evento removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Anexos
  const uploadAnexo = async (eventoId: string, file: File, tipo: string) => {
    const path = `${tid}/${eventoId}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage
      .from("eventos-sst")
      .upload(path, file);
    if (uploadErr) throw uploadErr;

    const { data: urlData } = supabase.storage
      .from("eventos-sst")
      .getPublicUrl(path);

    const { error } = await supabase.from("evento_sst_anexos").insert({
      tenant_id: tid!,
      evento_id: eventoId,
      arquivo_url: path,
      arquivo_nome: file.name,
      arquivo_tamanho: file.size,
      tipo,
      criado_por: user?.id,
      criado_por_nome: profile?.nome_completo || user?.email,
    } as any);
    if (error) throw error;
    toast.success("Anexo enviado");
  };

  const getAnexos = async (eventoId: string): Promise<EventoSSTAnexo[]> => {
    const { data, error } = await supabase
      .from("evento_sst_anexos")
      .select("*")
      .eq("evento_id", eventoId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as unknown as EventoSSTAnexo[];
  };

  // Upload CAT file
  const uploadCAT = async (eventoId: string, file: File) => {
    const path = `${tid}/${eventoId}/cat_${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage
      .from("eventos-sst")
      .upload(path, file);
    if (uploadErr) throw uploadErr;

    await supabase
      .from("eventos_sst")
      .update({
        cat_arquivo_url: path,
        cat_arquivo_nome: file.name,
      } as any)
      .eq("id", eventoId);

    qc.invalidateQueries({ queryKey: ["eventos-sst"] });
    toast.success("CAT anexada com sucesso");
  };

  // Create linked action
  const criarAcaoVinculada = async (eventoId: string, evento: EventoSST) => {
    const { data: acao, error } = await supabase
      .from("plano_acoes")
      .insert({
        tenant_id: tid!,
        titulo: `Ação ${evento.tipo === "acidente" ? "corretiva" : "preventiva"} - ${evento.codigo}`,
        descricao: evento.descricao || "",
        origem_modulo: "sst",
        origem_descricao: `SST → ${evento.tipo === "acidente" ? "Acidente" : "Incidente"} ${evento.codigo}`,
        tipo: evento.tipo === "acidente" ? "corretiva" : "preventiva",
        responsavel_id: user?.id,
        responsavel_nome: profile?.nome_completo || user?.email,
        prazo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "pendente",
        criado_por: user?.id,
        criado_por_nome: profile?.nome_completo || user?.email,
      } as any)
      .select()
      .single();
    if (error) throw error;

    // Link action to event
    await supabase.from("evento_sst_acoes").insert({
      tenant_id: tid!,
      evento_id: eventoId,
      acao_id: acao.id,
    } as any);

    // Update event status
    await supabase
      .from("eventos_sst")
      .update({ status: "acoes_andamento" } as any)
      .eq("id", eventoId);

    qc.invalidateQueries({ queryKey: ["eventos-sst"] });
    qc.invalidateQueries({ queryKey: ["plano-acoes"] });
    toast.success("Ação criada e vinculada ao evento");
    return acao;
  };

  // Stats
  const stats = {
    total: eventos.length,
    incidentes: eventos.filter((e) => e.tipo === "incidente").length,
    acidentes: eventos.filter((e) => e.tipo === "acidente").length,
    emAberto: eventos.filter((e) => e.status === "em_aberto").length,
    comAcoes: eventos.filter((e) => e.status === "acoes_andamento").length,
    concluidos: eventos.filter((e) => e.status === "concluido").length,
    acidentesComAfastamento: eventos.filter(
      (e) =>
        e.tipo === "acidente" &&
        e.afastamento &&
        e.afastamento !== "sem_afastamento"
    ).length,
    catPendentes: eventos.filter(
      (e) => e.tipo === "acidente" && !e.cat_emitida
    ).length,
  };

  return {
    eventos,
    isLoading,
    stats,
    createEvento,
    updateEvento,
    deleteEvento,
    uploadAnexo,
    getAnexos,
    uploadCAT,
    criarAcaoVinculada,
  };
};
