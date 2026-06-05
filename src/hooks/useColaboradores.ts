import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";

export interface Colaborador {
  id: string;
  nome_completo: string;
  cpf: string;
  cargo: string;
  departamento: string | null;
  email: string | null;
  celular: string | null;
  filial: string | null;
  data_admissao: string | null;
  empresa_id?: string | null;
  gestor_imediato?: string | null;
  foto_url?: string | null;
  bate_ponto?: boolean | null;
}

interface UseColaboradoresOptions {
  /** Exclui contratos PJ/Pró-labore/Terceiros (usado em módulos exclusivos CLT como Ponto e Férias). */
  excluirPJ?: boolean;
  /** Mantém apenas colaboradores marcados como "bate ponto" (usado no módulo Ponto). */
  apenasBatePonto?: boolean;
}

export function useColaboradores(options: UseColaboradoresOptions = {}) {
  const { excluirPJ = false, apenasBatePonto = false } = options;
  const { tenantId } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();

  const { data: colaboradores = [], isLoading, error, refetch } = useQuery({
    queryKey: ["colaboradores", tenantId, empresaAtivaId, excluirPJ, apenasBatePonto],
    queryFn: async (): Promise<Colaborador[]> => {
      if (!tenantId) return [];

      let query = supabase
        .from("admissoes")
        .select("id, nome_completo, cpf, cargo, departamento, email, celular, filial, data_admissao, empresa_id, gestor_imediato, foto_url, tipo_contrato, bate_ponto")
        .eq("tenant_id", tenantId)
        .eq("status", "concluido");

      if (empresaAtivaId) {
        query = query.eq("empresa_id", empresaAtivaId);
      }

      const { data, error } = await query.order("data_admissao", { ascending: false });

      if (error) throw error;

      let rows = data || [];
      if (excluirPJ) {
        // Mantém apenas vínculos CLT (exclui PJ, pró-labore e terceiros).
        const naoCLT = new Set(["pj", "prolabore", "pro_labore", "terceiro", "terceirizado", "autonomo"]);
        rows = rows.filter((r: any) => {
          const tc = (r.tipo_contrato || "").toString().trim().toLowerCase();
          return !naoCLT.has(tc);
        });
      }

      // Deduplica por CPF (normalizado em apenas dígitos), mantendo a admissão mais recente.
      // Fallback para nome+empresa quando o CPF estiver vazio.
      const seen = new Set<string>();
      const deduped: any[] = [];
      for (const r of rows) {
        const cpfDigits = (r.cpf || "").toString().replace(/\D/g, "");
        const key = cpfDigits
          ? `cpf:${cpfDigits}`
          : `nome:${(r.nome_completo || "").trim().toLowerCase()}|emp:${r.empresa_id || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(r);
      }

      // Ordena alfabeticamente pelo nome após a deduplicação.
      deduped.sort((a, b) =>
        (a.nome_completo || "").localeCompare(b.nome_completo || "", "pt-BR", { sensitivity: "base" })
      );

      // Remove campo auxiliar para manter o tipo público estável.
      return deduped.map(({ tipo_contrato, ...rest }: any) => rest);
    },
    enabled: !!tenantId,
  });

  return {
    colaboradores,
    isLoading,
    error: error?.message || null,
    refetch,
  };
}
