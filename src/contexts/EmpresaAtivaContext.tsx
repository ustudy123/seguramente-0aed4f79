import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useUsuarioVinculos } from "@/hooks/useUsuarioVinculos";
import type { EmpresaCadastro } from "@/types/empresa";

interface EmpresaAtivaContextType {
  empresaAtiva: EmpresaCadastro | null;
  empresaAtivaId: string | null;
  setEmpresaAtiva: (empresa: EmpresaCadastro | null) => void;
  empresas: EmpresaCadastro[];
  isLoading: boolean;
  /** true quando o contexto já tentou restaurar a empresa do storage ou auto-selecionar */
  initialized: boolean;
  /** true quando o usuário é profissional e tem restrição por vínculo */
  isProfissional: boolean;
  /** true quando profissional não tem nenhum vínculo ativo */
  semVinculos: boolean;
}

const EmpresaAtivaContext = createContext<EmpresaAtivaContextType | undefined>(undefined);

export const EmpresaAtivaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenantId } = useTenant();
  const [empresaAtiva, setEmpresaAtivaState] = useState<EmpresaCadastro | null>(null);
  const [initialized, setInitialized] = useState(false);

  const { isProfissional, empresaIdsPermitidas, isLoading: loadingVinculos } = useUsuarioVinculos();

  const { data: todasEmpresas = [], isLoading: loadingEmpresas } = useQuery({
    queryKey: ["empresa_cadastro_list_ativa", tenantId],
    queryFn: async () => {
      // Paginação manual para contornar o limite max-rows=1000 do PostgREST
      const PAGE = 1000;
      let from = 0;
      const acc: any[] = [];
      for (let i = 0; i < 50; i++) {
        const { data, error } = await supabase
          .from("empresa_cadastro")
          .select("*")
          .eq("tenant_id", tenantId!)
          .eq("ativo", true)
          .order("razao_social")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const chunk = data || [];
        acc.push(...chunk);
        if (chunk.length < PAGE) break;
        from += PAGE;
      }
      return acc as unknown as EmpresaCadastro[];
    },

    enabled: !!tenantId,
  });

  // Filtra empresas para profissionais com vínculos
  const empresas = useMemo(() => {
    let lista: EmpresaCadastro[];
    if (!isProfissional) {
      lista = todasEmpresas;
    } else if (empresaIdsPermitidas.length === 0) {
      // Profissional sem vínculos: lista vazia
      lista = [];
    } else {
      lista = todasEmpresas.filter((e) => empresaIdsPermitidas.includes(e.id));
    }
    // Defesa contra duplicatas (mesmo id aparecendo mais de uma vez por race
    // condition de fetch/cache). Garante 1 entrada por empresa no seletor.
    const seen = new Set<string>();
    return lista.filter((e) => {
      if (!e?.id || seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [todasEmpresas, isProfissional, empresaIdsPermitidas]);

  const isLoading = loadingEmpresas || loadingVinculos;

  const semVinculos = isProfissional && !loadingVinculos && empresaIdsPermitidas.length === 0;

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

  // Restore from localStorage or auto-select single company
  useEffect(() => {
    if (!tenantId || isLoading) return;
    
    // Se já temos uma empresa ativa válida para o tenant atual, não precisamos auto-selecionar
    if (empresaAtiva && empresas.some(e => e.id === empresaAtiva.id)) {
      setInitialized(true);
      return;
    }

    if (empresas.length === 0) {
      setEmpresaAtivaState(null);
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
  }, [tenantId, empresas, isLoading, empresaAtiva]);

  // Se a empresa ativa não está mais na lista filtrada e já terminou de carregar, resetar para a primeira
  useEffect(() => {
    if (isLoading || empresas.length === 0) return;
    
    if (empresaAtiva && !empresas.find((e) => e.id === empresaAtiva.id)) {
      setEmpresaAtiva(empresas[0]);
    }
  }, [empresas, empresaAtiva, isLoading, setEmpresaAtiva]);

  return (
    <EmpresaAtivaContext.Provider
      value={{
        empresaAtiva,
        empresaAtivaId: empresaAtiva?.id ?? null,
        setEmpresaAtiva,
        empresas,
        isLoading,
        initialized,
        isProfissional,
        semVinculos,
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
