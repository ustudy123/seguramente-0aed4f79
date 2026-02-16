import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import type { CulturaData, CulturaAcao, CulturaRitual, CulturaConfig, CulturaMarco, CulturaPreferencia } from "@/types/cultura";

export function useCultura() {
  const { tenantId } = useAuth();
  const qc = useQueryClient();

  // --- Datas configuráveis ---
  const { data: datas = [], isLoading: isLoadingDatas } = useQuery({
    queryKey: ["cultura-datas", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("cultura_datas")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("mes", { ascending: true });
      if (error) throw error;
      return data as CulturaData[];
    },
    enabled: !!tenantId,
  });

  const createData = async (payload: Partial<CulturaData>) => {
    if (!tenantId) return;
    const { error } = await supabase.from("cultura_datas").insert({ ...payload, tenant_id: tenantId } as any);
    if (error) { toast.error("Erro ao criar data"); throw error; }
    toast.success("Data criada!");
    qc.invalidateQueries({ queryKey: ["cultura-datas"] });
  };

  const deleteData = async (id: string) => {
    const { error } = await supabase.from("cultura_datas").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); throw error; }
    toast.success("Data removida");
    qc.invalidateQueries({ queryKey: ["cultura-datas"] });
  };

  // --- Ações ---
  const { data: acoes = [], isLoading: isLoadingAcoes } = useQuery({
    queryKey: ["cultura-acoes", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("cultura_acoes")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("data_referencia", { ascending: true });
      if (error) throw error;
      return data as CulturaAcao[];
    },
    enabled: !!tenantId,
  });

  const createAcao = async (payload: Partial<CulturaAcao>) => {
    if (!tenantId) return;
    const { error } = await supabase.from("cultura_acoes").insert({ ...payload, tenant_id: tenantId } as any);
    if (error) { toast.error("Erro ao criar ação"); throw error; }
    toast.success("Ação criada!");
    qc.invalidateQueries({ queryKey: ["cultura-acoes"] });
  };

  const updateAcaoStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("cultura_acoes").update({ status }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar"); throw error; }
    toast.success("Status atualizado");
    qc.invalidateQueries({ queryKey: ["cultura-acoes"] });
  };

  const deleteAcao = async (id: string) => {
    const { error } = await supabase.from("cultura_acoes").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); throw error; }
    toast.success("Ação removida");
    qc.invalidateQueries({ queryKey: ["cultura-acoes"] });
  };

  // --- Rituais ---
  const { data: rituais = [], isLoading: isLoadingRituais } = useQuery({
    queryKey: ["cultura-rituais", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("cultura_rituais")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("nome");
      if (error) throw error;
      return data as CulturaRitual[];
    },
    enabled: !!tenantId,
  });

  const createRitual = async (payload: Partial<CulturaRitual>) => {
    if (!tenantId) return;
    const { error } = await supabase.from("cultura_rituais").insert({ ...payload, tenant_id: tenantId } as any);
    if (error) { toast.error("Erro ao criar ritual"); throw error; }
    toast.success("Ritual criado!");
    qc.invalidateQueries({ queryKey: ["cultura-rituais"] });
  };

  const toggleRitual = async (id: string, ativo: boolean) => {
    const { error } = await supabase.from("cultura_rituais").update({ ativo }).eq("id", id);
    if (error) { toast.error("Erro"); throw error; }
    qc.invalidateQueries({ queryKey: ["cultura-rituais"] });
  };

  const deleteRitual = async (id: string) => {
    const { error } = await supabase.from("cultura_rituais").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); throw error; }
    toast.success("Ritual removido");
    qc.invalidateQueries({ queryKey: ["cultura-rituais"] });
  };

  // --- Config ---
  const { data: config } = useQuery({
    queryKey: ["cultura-config", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("cultura_config")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data as CulturaConfig | null;
    },
    enabled: !!tenantId,
  });

  const saveConfig = async (payload: Partial<CulturaConfig>) => {
    if (!tenantId) return;
    if (config?.id) {
      const { error } = await supabase.from("cultura_config").update(payload as any).eq("id", config.id);
      if (error) { toast.error("Erro"); throw error; }
    } else {
      const { error } = await supabase.from("cultura_config").insert({ ...payload, tenant_id: tenantId } as any);
      if (error) { toast.error("Erro"); throw error; }
    }
    toast.success("Configuração salva!");
    qc.invalidateQueries({ queryKey: ["cultura-config"] });
  };

  // --- Marcos ---
  const { data: marcos = [] } = useQuery({
    queryKey: ["cultura-marcos", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("cultura_marcos")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("anos");
      if (error) throw error;
      return data as CulturaMarco[];
    },
    enabled: !!tenantId,
  });

  const createMarco = async (payload: Partial<CulturaMarco>) => {
    if (!tenantId) return;
    const { error } = await supabase.from("cultura_marcos").insert({ ...payload, tenant_id: tenantId } as any);
    if (error) { toast.error("Erro ao criar marco"); throw error; }
    toast.success("Marco criado!");
    qc.invalidateQueries({ queryKey: ["cultura-marcos"] });
  };

  // --- Preferências ---
  const { data: preferencias = [] } = useQuery({
    queryKey: ["cultura-preferencias", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("cultura_preferencias")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("colaborador_nome");
      if (error) throw error;
      return data as CulturaPreferencia[];
    },
    enabled: !!tenantId,
  });

  const createPreferencia = async (payload: Partial<CulturaPreferencia>) => {
    if (!tenantId) return;
    const { error } = await supabase.from("cultura_preferencias").insert({ ...payload, tenant_id: tenantId } as any);
    if (error) { toast.error("Erro ao salvar preferência"); throw error; }
    toast.success("Preferência salva!");
    qc.invalidateQueries({ queryKey: ["cultura-preferencias"] });
  };

  const deletePreferencia = async (id: string) => {
    const { error } = await supabase.from("cultura_preferencias").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); throw error; }
    toast.success("Preferência removida");
    qc.invalidateQueries({ queryKey: ["cultura-preferencias"] });
  };

  // Stats
  const acoesPendentes = acoes.filter(a => a.status === "pendente").length;
  const acoesConcluidas = acoes.filter(a => a.status === "concluida").length;
  const rituaisAtivos = rituais.filter(r => r.ativo).length;
  const datasAtivas = datas.filter(d => d.ativo).length;

  return {
    datas, isLoadingDatas, createData, deleteData,
    acoes, isLoadingAcoes, createAcao, updateAcaoStatus, deleteAcao,
    rituais, isLoadingRituais, createRitual, toggleRitual, deleteRitual,
    config, saveConfig,
    marcos, createMarco,
    preferencias, createPreferencia, deletePreferencia,
    acoesPendentes, acoesConcluidas, rituaisAtivos, datasAtivas,
  };
}
