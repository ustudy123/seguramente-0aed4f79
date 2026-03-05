import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";

// Types
export interface Departamento {
  id: string;
  tenant_id: string;
  nome: string;
  descricao: string | null;
  responsavel_id: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Cargo {
  id: string;
  tenant_id: string;
  nome: string;
  descricao: string | null;
  departamento_id: string | null;
  nivel: string | null;
  faixa_salarial_min: number | null;
  faixa_salarial_max: number | null;
  periodicidade_exame_meses: number | null;
  exames_obrigatorios: string[] | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  departamento?: Departamento | { id: string; nome: string } | null;
}

export interface Filial {
  id: string;
  tenant_id: string;
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  responsavel_id: string | null;
  empresa_id: string | null;
  tipo: string;
  cno: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// Departamentos Hook
export function useDepartamentos() {
  const { tenantId } = useTenant();
  const { empresaAtivaId } = useEmpresaAtiva();
  const queryClient = useQueryClient();

  const { data: departamentos = [], isLoading, error } = useQuery({
    queryKey: ["departamentos", tenantId, empresaAtivaId],
    queryFn: async () => {
      let query = supabase
        .from("departamentos")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("nome");

      if (empresaAtivaId) query = query.eq("empresa_id", empresaAtivaId);

      const { data, error } = await query;
      if (error) throw error;
      return data as Departamento[];
    },
    enabled: !!tenantId,
  });

  const createDepartamento = useMutation({
    mutationFn: async (departamento: Omit<Departamento, "id" | "tenant_id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("departamentos")
        .insert({ ...departamento, tenant_id: tenantId!, empresa_id: empresaAtivaId || null })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departamentos"] });
      toast.success("Departamento criado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar departamento: " + error.message);
    },
  });

  const updateDepartamento = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Departamento> & { id: string }) => {
      const { data, error } = await supabase
        .from("departamentos")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departamentos"] });
      toast.success("Departamento atualizado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar departamento: " + error.message);
    },
  });

  const deleteDepartamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("departamentos")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departamentos"] });
      toast.success("Departamento excluído com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir departamento: " + error.message);
    },
  });

  return {
    departamentos,
    isLoading,
    error,
    createDepartamento,
    updateDepartamento,
    deleteDepartamento,
  };
}

// Cargos Hook
export function useCargos() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const { data: cargos = [], isLoading, error } = useQuery({
    queryKey: ["cargos", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargos")
        .select(`
          *,
          departamento:departamentos(id, nome)
        `)
        .order("nome");

      if (error) throw error;
      return data as (Cargo & { departamento: { id: string; nome: string } | null })[];
    },
    enabled: !!tenantId,
  });

  const createCargo = useMutation({
    mutationFn: async (cargo: Omit<Cargo, "id" | "tenant_id" | "created_at" | "updated_at" | "departamento">) => {
      const { data, error } = await supabase
        .from("cargos")
        .insert({ ...cargo, tenant_id: tenantId! })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cargos"] });
      toast.success("Função criada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar função: " + error.message);
    },
  });

  const updateCargo = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Cargo> & { id: string }) => {
      const { departamento, ...rest } = updates;
      const { data, error } = await supabase
        .from("cargos")
        .update(rest)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cargos"] });
      toast.success("Função atualizada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar função: " + error.message);
    },
  });

  const deleteCargo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cargos")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cargos"] });
      toast.success("Função excluída com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir função: " + error.message);
    },
  });

  return {
    cargos,
    isLoading,
    error,
    createCargo,
    updateCargo,
    deleteCargo,
  };
}

// Filiais Hook
export function useFiliais() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const { data: filiais = [], isLoading, error } = useQuery({
    queryKey: ["filiais", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("filiais")
        .select("*")
        .order("nome");

      if (error) throw error;
      return data as Filial[];
    },
    enabled: !!tenantId,
  });

  const createFilial = useMutation({
    mutationFn: async (filial: Omit<Filial, "id" | "tenant_id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("filiais")
        .insert({ ...filial, tenant_id: tenantId! })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["filiais"] });
      toast.success("Registro criado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar registro: " + error.message);
    },
  });

  const updateFilial = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Filial> & { id: string }) => {
      const { data, error } = await supabase
        .from("filiais")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["filiais"] });
      toast.success("Registro atualizado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar registro: " + error.message);
    },
  });

  const deleteFilial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("filiais")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["filiais"] });
      toast.success("Registro excluído com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir registro: " + error.message);
    },
  });

  return {
    filiais,
    isLoading,
    error,
    createFilial,
    updateFilial,
    deleteFilial,
  };
}
