/**
 * Auditoria de ajustes de ponto: motivo declarado × evidência × recorrência.
 *
 * Do chamado da Jaqueline Dalmolin (08/06/2026): "Falha no equipamento /
 * aplicativo" é motivo legítimo, mas também o mais fácil de usar para
 * encobrir marcação inexistente. O relatório existe para mostrar com que
 * frequência cada colaborador o declara e se veio prova junto.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AuditoriaAjusteMotivo {
  colaborador_cpf: string;
  colaborador_nome: string;
  motivo: string;
  justificativa_nome: string | null;
  requer_anexo: boolean;
  qtd_ajustes: number;
  qtd_com_anexo: number;
  qtd_sem_anexo: number;
  qtd_sem_anexo_exigido: number;
  qtd_aprovados: number;
  qtd_pendentes: number;
  dias_distintos: number;
  meses_distintos: number;
  primeira_data: string;
  ultima_data: string;
  media_por_mes: number;
}

export interface AuditoriaMotivoResumo {
  motivo: string;
  qtd_ajustes: number;
  qtd_colaboradores: number;
  qtd_com_anexo: number;
  qtd_sem_anexo: number;
  qtd_sem_anexo_exigido: number;
  pct_sem_anexo: number;
}

const num = (v: unknown) => Number(v) || 0;

export function usePontoAuditoriaAjustes(
  empresaId: string | null | undefined,
  ini: string,
  fim: string
) {
  const { tenantId } = useAuth();
  const enabled = !!tenantId && !!ini && !!fim;

  const detalhe = useQuery({
    queryKey: ["ponto-auditoria-ajustes", tenantId, empresaId, ini, fim],
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("ponto_auditoria_ajustes_motivo", {
        p_tenant_id: tenantId,
        p_empresa_id: empresaId || null,
        p_ini: ini,
        p_fim: fim,
      });
      if (error) throw error;
      return ((data || []) as any[]).map<AuditoriaAjusteMotivo>((r) => ({
        colaborador_cpf: String(r.colaborador_cpf || ""),
        colaborador_nome: String(r.colaborador_nome || ""),
        motivo: String(r.motivo || ""),
        justificativa_nome: r.justificativa_nome ? String(r.justificativa_nome) : null,
        requer_anexo: Boolean(r.requer_anexo),
        qtd_ajustes: num(r.qtd_ajustes),
        qtd_com_anexo: num(r.qtd_com_anexo),
        qtd_sem_anexo: num(r.qtd_sem_anexo),
        qtd_sem_anexo_exigido: num(r.qtd_sem_anexo_exigido),
        qtd_aprovados: num(r.qtd_aprovados),
        qtd_pendentes: num(r.qtd_pendentes),
        dias_distintos: num(r.dias_distintos),
        meses_distintos: num(r.meses_distintos),
        primeira_data: String(r.primeira_data || ""),
        ultima_data: String(r.ultima_data || ""),
        media_por_mes: num(r.media_por_mes),
      }));
    },
  });

  const resumo = useQuery({
    queryKey: ["ponto-auditoria-motivos", tenantId, empresaId, ini, fim],
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("ponto_auditoria_motivos_resumo", {
        p_tenant_id: tenantId,
        p_empresa_id: empresaId || null,
        p_ini: ini,
        p_fim: fim,
      });
      if (error) throw error;
      return ((data || []) as any[]).map<AuditoriaMotivoResumo>((r) => ({
        motivo: String(r.motivo || ""),
        qtd_ajustes: num(r.qtd_ajustes),
        qtd_colaboradores: num(r.qtd_colaboradores),
        qtd_com_anexo: num(r.qtd_com_anexo),
        qtd_sem_anexo: num(r.qtd_sem_anexo),
        qtd_sem_anexo_exigido: num(r.qtd_sem_anexo_exigido),
        pct_sem_anexo: num(r.pct_sem_anexo),
      }));
    },
  });

  return {
    linhas: detalhe.data || [],
    resumo: resumo.data || [],
    carregando: detalhe.isLoading || resumo.isLoading,
    erro: detalhe.error || resumo.error,
  };
}

/**
 * Um par colaborador×motivo merece olhar quando se repete e a prova não
 * acompanha. Não é acusação — é fila de conferência para o RH.
 */
export function precisaConferencia(l: AuditoriaAjusteMotivo): boolean {
  if (l.qtd_sem_anexo_exigido > 0) return true;
  return l.qtd_ajustes >= 3 && l.qtd_sem_anexo > l.qtd_com_anexo;
}
