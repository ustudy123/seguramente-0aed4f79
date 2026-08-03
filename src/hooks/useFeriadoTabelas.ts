import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type {
  FeriadoTabela, FeriadoTabelaItem, FeriadoTabelaVinculo,
} from "@/lib/ponto/feriadoTabelas";
import { payloadItem, payloadTabela } from "@/lib/ponto/feriadoTabelas";

type TabelaPayload = ReturnType<typeof payloadTabela>;
type ItemPayload = ReturnType<typeof payloadItem>;

/** CRUD das tabelas nomeadas de feriados, itens e vínculos com filiais. */
export function useFeriadoTabelas() {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["feriado-tabelas"] });
    qc.invalidateQueries({ queryKey: ["feriado-tabela-itens"] });
    qc.invalidateQueries({ queryKey: ["feriado-tabela-vinculos"] });
  };

  const erro = (title: string) => (e: Error) =>
    toast({ title, description: e.message, variant: "destructive" });

  const tabelasQuery = useQuery({
    queryKey: ["feriado-tabelas", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feriado_tabelas")
        .select("*")
        .order("numero", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as FeriadoTabela[];
    },
  });

  const itensQuery = useQuery({
    queryKey: ["feriado-tabela-itens", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feriado_tabela_itens")
        .select("*")
        .order("mes", { ascending: true })
        .order("dia", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as FeriadoTabelaItem[];
    },
  });

  const vinculosQuery = useQuery({
    queryKey: ["feriado-tabela-vinculos", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feriado_tabela_empresas")
        .select("id, tabela_id, empresa_id");
      if (error) throw error;
      return (data || []) as unknown as FeriadoTabelaVinculo[];
    },
  });

  const itensPorTabela = useMemo(() => {
    const map = new Map<string, FeriadoTabelaItem[]>();
    for (const item of itensQuery.data || []) {
      map.set(item.tabela_id, [...(map.get(item.tabela_id) || []), item]);
    }
    return map;
  }, [itensQuery.data]);

  const empresasPorTabela = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const v of vinculosQuery.data || []) {
      map.set(v.tabela_id, [...(map.get(v.tabela_id) || []), v.empresa_id]);
    }
    return map;
  }, [vinculosQuery.data]);

  const salvarTabela = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: TabelaPayload }) => {
      if (id) {
        const { error } = await supabase.from("feriado_tabelas").update(payload).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("feriado_tabelas").insert(payload).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => { invalidate(); toast({ title: "Tabela salva" }); },
    onError: erro("Erro ao salvar tabela"),
  });

  const excluirTabela = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feriado_tabelas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Tabela excluída" }); },
    onError: erro("Erro ao excluir tabela"),
  });

  const duplicarTabela = useMutation({
    mutationFn: async ({ id, ano }: { id: string; ano: number }) => {
      const { error } = await supabase.rpc("feriado_tabela_duplicar", {
        p_tabela_id: id, p_ano: ano, p_nome: undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Tabela duplicada para o novo ano" }); },
    onError: erro("Erro ao duplicar tabela"),
  });

  const salvarItem = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: ItemPayload }) => {
      if (id) {
        const { error } = await supabase.from("feriado_tabela_itens").update(payload).eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("feriado_tabela_itens").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Feriado salvo na tabela" }); },
    onError: erro("Erro ao salvar feriado"),
  });

  const excluirItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feriado_tabela_itens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Feriado removido" }); },
    onError: erro("Erro ao remover feriado"),
  });

  const definirVinculos = useMutation({
    mutationFn: async ({ tabelaId, empresaIds }: { tabelaId: string; empresaIds: string[] }) => {
      if (!tenantId) throw new Error("Tenant não identificado.");
      const { error: delErr } = await supabase
        .from("feriado_tabela_empresas").delete().eq("tabela_id", tabelaId);
      if (delErr) throw delErr;
      if (empresaIds.length === 0) return;
      const { error } = await supabase.from("feriado_tabela_empresas").insert(
        empresaIds.map((empresa_id) => ({ tenant_id: tenantId, tabela_id: tabelaId, empresa_id })),
      );
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Filiais vinculadas" }); },
    onError: erro("Erro ao vincular filiais"),
  });

  /** RN22 — define (ou remove) a tabela de feriados vinculada a uma única filial/empresa. */
  const vincularEmpresa = useMutation({
    mutationFn: async ({ empresaId, tabelaId }: { empresaId: string; tabelaId: string | null }) => {
      if (!tenantId) throw new Error("Tenant não identificado.");
      const { error: delErr } = await supabase
        .from("feriado_tabela_empresas").delete().eq("empresa_id", empresaId);
      if (delErr) throw delErr;
      if (!tabelaId) return;
      const { error } = await supabase
        .from("feriado_tabela_empresas")
        .insert({ tenant_id: tenantId, tabela_id: tabelaId, empresa_id: empresaId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["ponto-diario"] });
      toast({ title: "Tabela de feriados atualizada" });
    },
    onError: erro("Erro ao vincular tabela de feriados"),
  });


  return {
    tabelas: tabelasQuery.data || [],
    isLoading: tabelasQuery.isLoading,
    itensPorTabela,
    empresasPorTabela,
    salvarTabela,
    excluirTabela,
    duplicarTabela,
    salvarItem,
    excluirItem,
    definirVinculos,
    vincularEmpresa,

  };
}
