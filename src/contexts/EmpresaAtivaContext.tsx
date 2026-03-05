import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import type { EmpresaCadastro } from "@/types/empresa";

interface EmpresaAtivaContextType {
  empresaAtiva: EmpresaCadastro | null;
  empresaAtivaId: string | null;
  setEmpresaAtiva: (empresa: EmpresaCadastro | null) => void;
  empresas: EmpresaCadastro[];
  isLoading: boolean;
}

const EmpresaAtivaContext = createContext<EmpresaAtivaContextType | undefined>(undefined);

export const EmpresaAtivaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenantId } = useTenant();
  const [empresaAtiva, setEmpresaAtivaState] = useState<EmpresaCadastro | null>(null);
  const [initialized, setInitialized] = useState(false);

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["empresa_cadastro_list_ativa", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresa_cadastro")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("ativo", true)
        .order("razao_social");
      if (error) throw error;
      return (data || []) as unknown as EmpresaCadastro[];
    },
    enabled: !!tenantId,
  });

  // Restore from localStorage or auto-select single company
  useEffect(() => {
    if (!tenantId || isLoading || initialized) return;
    if (empresas.length === 0) {
      setInitialized(true);
      return;
    }
    const storageKey = `empresa_ativa_${tenantId}`;
    const savedId = localStorage.getItem(storageKey);
    if (savedId) {
      const found = empresas.find((e) => e.id === savedId);
      if (found) {
        setEmpresaAtivaState(found);
        setInitialized(true);
        return;
      }
    }
    // Auto-select first company when nothing saved (or saved ID not found)
    setEmpresaAtivaState(empresas[0]);
    localStorage.setItem(storageKey, empresas[0].id);
    setInitialized(true);
  }, [tenantId, empresas, isLoading, initialized]);

  const setEmpresaAtiva = useCallback(
    (empresa: EmpresaCadastro | null) => {
      setEmpresaAtivaState(empresa);
      if (tenantId) {
        const storageKey = `empresa_ativa_${tenantId}`;
        if (empresa) {
          localStorage.setItem(storageKey, empresa.id);
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    },
    [tenantId]
  );

  return (
    <EmpresaAtivaContext.Provider
      value={{
        empresaAtiva,
        empresaAtivaId: empresaAtiva?.id ?? null,
        setEmpresaAtiva,
        empresas,
        isLoading,
      }}
    >
      {children}
    </EmpresaAtivaContext.Provider>
  );
};

export const useEmpresaAtiva = () => {
  const ctx = useContext(EmpresaAtivaContext);
  if (!ctx) throw new Error("useEmpresaAtiva must be used within EmpresaAtivaProvider");
  return ctx;
};
