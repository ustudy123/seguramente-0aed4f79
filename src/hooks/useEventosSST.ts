import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";
import { handleMutationError } from "@/lib/toastError";
import type { EventoSST, EventoSSTAnexo } from "@/types/eventoSST";
import { formatDateBR } from "@/lib/dataLocal";

export const useEventosSST = () => {
  const { user, profile } = useAuth();
  const { tenant } = useTenant();
  const { empresaAtivaId } = useEmpresaAtiva();
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

  // Helper: criar pasta de investigação automaticamente para acidentes graves
  const criarPastaInvestigacao = async (evento: any) => {
    try {
      // Buscar pasta raiz "Investigação de Incidentes" ou "Incidentes"
      const { data: pastasRaiz } = await supabase
        .from("documento_pastas")
        .select("id, nome")
        .eq("tenant_id", tid!)
        .ilike("nome", "%Investi%");

      let pastaRaizId: string | null = null;
      if (pastasRaiz && pastasRaiz.length > 0) {
        pastaRaizId = pastasRaiz[0].id;
      } else {
        // Tentar pasta "Incidentes"
        const { data: pastasInc } = await supabase
          .from("documento_pastas")
          .select("id, nome")
          .eq("tenant_id", tid!)
          .ilike("nome", "%Incidente%")
          .limit(1);
        if (pastasInc && pastasInc.length > 0) pastaRaizId = pastasInc[0].id;
      }

      if (!pastaRaizId) return; // Sem estrutura de pastas, não cria

      const codigo = evento.codigo || `EVT-${Date.now()}`;
      const label = evento.tipo === "acidente" ? "Acidente" : "Incidente";
      const dataStr = formatDateBR(evento.data_evento);

      // Criar pasta principal do evento
      const { data: novaPasta, error: errPasta } = await supabase
        .from("documento_pastas")
        .insert({
          tenant_id: tid!,
          nome: `${label} ${codigo} — ${dataStr}`,
          tipo: "custom",
          pasta_pai_id: pastaRaizId,
          ordem: 999,
          criado_por: user?.id,
          criado_por_nome: profile?.nome_completo || user?.email,
        })
        .select()
        .single();

      if (errPasta || !novaPasta) return;

      // Criar subpastas padrão
      const subpastas = ["Relato do Ocorrido", "Análise de Causa Raiz", "Plano de Ação", "Evidências e Fotos", "CAT"];
      for (let i = 0; i < subpastas.length; i++) {
        await supabase.from("documento_pastas").insert({
          tenant_id: tid!,
          nome: subpastas[i],
          tipo: "custom",
          pasta_pai_id: novaPasta.id,
          ordem: i,
          criado_por: user?.id,
          criado_por_nome: profile?.nome_completo || user?.email,
        });
      }

      qc.invalidateQueries({ queryKey: ["documento-pastas"] });
    } catch (err) {
      // Silencioso — não bloquear o registro do evento
      console.warn("Não foi possível criar pasta de investigação:", err);
    }
  };

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
    onSuccess: async (data: any) => {
      qc.invalidateQueries({ queryKey: ["eventos-sst"] });
      toast.success("Evento registrado com sucesso");

      // Auto-criar pasta de investigação para acidentes ou incidentes graves
      const isGrave =
        data.tipo === "acidente" ||
        (data.gravidade_lesao && data.gravidade_lesao !== "sem_lesao") ||
        data.obito;

      if (isGrave) {
        await criarPastaInvestigacao(data);
        toast.info("📁 Pasta de investigação criada automaticamente em Documentos");
      }
    },
    onError: handleMutationError,
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
    onError: handleMutationError,
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
    onError: handleMutationError,
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
