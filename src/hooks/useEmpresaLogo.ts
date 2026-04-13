import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";

/**
 * Hook para obter a URL da logo da empresa ativa.
 * Use em documentos gerados (PDF, HTML, laudos) para personalização.
 */
export function useEmpresaLogo() {
  const { empresaAtiva } = useEmpresaAtiva();
  const logoUrl = (empresaAtiva as any)?.logo_url as string | null;

  return {
    logoUrl,
    hasLogo: !!logoUrl,
    empresaNome: empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social || "",
  };
}
