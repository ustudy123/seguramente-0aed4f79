import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface Feriado {
  id: string;
  tenant_id: string | null; // null = feriado global (nacional padrão)
  abrangencia: "nacional" | "estadual" | "municipal";
  tipo: "feriado" | "facultativo";
  ativo: boolean;
  uf: string | null;
  municipio: string | null;
  data: string; // YYYY-MM-DD
  nome: string;
}

export interface NovoFeriado {
  data: string;
  nome: string;
  abrangencia: "nacional" | "estadual" | "municipal";
  tipo?: "feriado" | "facultativo";
  uf?: string | null;
  municipio?: string | null;
}

/** Feriados visíveis ao tenant (globais + próprios), com CRUD dos próprios. */
export function useFeriados() {
  const { tenantId } = useAuth();
  const qc = useQueryClient();

  const { data: feriados = [], isLoading } = useQuery({
    queryKey: ["feriados", tenantId],
    queryFn: async (): Promise<Feriado[]> => {
      if (!tenantId) return [];
      const { data, error } = await fromTable("feriados")
        .select("*")
        .eq("ativo", true)
        .order("data") as { data: Feriado[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const criar = useMutation({
    mutationFn: async (f: NovoFeriado) => {
      if (!tenantId) throw new Error("Tenant não identificado");
      const { error } = await fromTable("feriados").insert({
        tenant_id: tenantId,
        abrangencia: f.abrangencia,
        tipo: f.tipo || "feriado",
        uf: f.abrangencia !== "nacional" ? (f.uf || null) : null,
        municipio: f.abrangencia === "municipal" ? (f.municipio || null) : null,
        data: f.data,
        nome: f.nome.trim(),
      } as any) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feriados"] });
      qc.invalidateQueries({ queryKey: ["ponto-equalizacao"] });
      toast.success("Feriado cadastrado");
    },
    onError: (e: Error) => toast.error(`Erro ao cadastrar feriado: ${e.message}`),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("feriados")
        .delete()
        .eq("id", id) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feriados"] });
      qc.invalidateQueries({ queryKey: ["ponto-equalizacao"] });
      toast.success("Feriado removido");
    },
    onError: (e: Error) => toast.error(`Erro ao remover feriado: ${e.message}`),
  });

  return { feriados, isLoading, criar, excluir };
}
