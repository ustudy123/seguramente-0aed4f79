import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";

export interface PermissaoTrabalho {
  id: string;
  tenant_id: string;
  terceiro_id: string;
  codigo: string;
  data_inicio: string;
  data_fim: string;
  local: string;
  atividade: string;
  descricao: string | null;
  atividades_risco: string[];
  status: "rascunho" | "liberada" | "bloqueada" | "encerrada" | "cancelada";
  motivo_bloqueio: string | null;
  criado_por: string | null;
  criado_por_nome: string | null;
  liberado_por: string | null;
  liberado_por_nome: string | null;
  liberado_em: string | null;
  encerrado_por: string | null;
  encerrado_por_nome: string | null;
  encerrado_em: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PermissaoTrabalhador {
  id: string;
  permissao_id: string;
  trabalhador_id: string;
  tenant_id: string;
  docs_ok: boolean;
  treins_ok: boolean;
  aso_ok: boolean;
  apto: boolean;
  motivo_bloqueio: string | null;
  created_at: string;
  // joined
  trabalhador_nome?: string;
  trabalhador_funcao?: string;
  trabalhador_status?: string;
}

export function usePermissaoTrabalho(terceiroId?: string) {
  const { tenantId, user, profile } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const qc = useQueryClient();

  const permissoes = useQuery({
    queryKey: ["permissoes-trabalho", tenantId, terceiroId],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = fromTable("permissoes_trabalho")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (terceiroId) q = q.eq("terceiro_id", terceiroId);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as PermissaoTrabalho[];
    },
    enabled: !!tenantId,
  });

  const useTrabalhadoresPT = (permissaoId?: string) =>
    useQuery({
      queryKey: ["permissao-trabalhadores", permissaoId],
      queryFn: async () => {
        if (!permissaoId || !tenantId) return [];
        const { data, error } = await fromTable("permissao_trabalhadores")
          .select("*")
          .eq("permissao_id", permissaoId)
          .eq("tenant_id", tenantId);
        if (error) throw error;

        // Enrich with worker names
        const trabIds = (data as any[]).map((d: any) => d.trabalhador_id);
        if (trabIds.length === 0) return [];

        const { data: trabs } = await fromTable("terceiro_trabalhadores")
          .select("id, nome, funcao, status")
          .in("id", trabIds);

        const trabMap = new Map((trabs as any[] || []).map((t: any) => [t.id, t]));
        return (data as any[]).map((d: any) => ({
          ...d,
          trabalhador_nome: trabMap.get(d.trabalhador_id)?.nome || "—",
          trabalhador_funcao: trabMap.get(d.trabalhador_id)?.funcao || "",
          trabalhador_status: trabMap.get(d.trabalhador_id)?.status || "liberado",
        })) as PermissaoTrabalhador[];
      },
      enabled: !!permissaoId && !!tenantId,
    });

  const createPermissao = useMutation({
    mutationFn: async (payload: {
      terceiro_id: string;
      data_inicio: string;
      data_fim: string;
      local: string;
      atividade: string;
      descricao?: string;
      atividades_risco?: string[];
      observacoes?: string;
      trabalhador_ids: string[];
    }) => {
      if (!tenantId || !user) throw new Error("Não autenticado");

      // 1. Create PT
      const { data: pt, error: ptErr } = await fromTable("permissoes_trabalho")
        .insert({
          tenant_id: tenantId,
          empresa_id: empresaAtivaId || null,
          terceiro_id: payload.terceiro_id,
          codigo: "PT-TEMP", // trigger will replace
          data_inicio: payload.data_inicio,
          data_fim: payload.data_fim,
          local: payload.local,
          atividade: payload.atividade,
          descricao: payload.descricao || null,
          atividades_risco: payload.atividades_risco || [],
          observacoes: payload.observacoes || null,
          criado_por: user.id,
          criado_por_nome: profile?.nome_completo || user.email,
        } as any)
        .select()
        .single();
      if (ptErr) throw ptErr;

      const ptId = (pt as any).id;

      // 2. Validate each worker and add
      if (payload.trabalhador_ids.length > 0) {
        const validations = await Promise.all(
          payload.trabalhador_ids.map(async (trabId) => {
            // Check docs
            const { data: docs } = await fromTable("terceiro_documentos")
              .select("id, status")
              .eq("trabalhador_id", trabId)
              .eq("tenant_id", tenantId);
            const docsOk = (docs as any[] || []).length > 0 &&
              !(docs as any[]).some((d: any) => d.status === "vencido");

            // Check trainings
            const { data: treins } = await fromTable("terceiro_treinamentos")
              .select("id, status")
              .eq("trabalhador_id", trabId)
              .eq("tenant_id", tenantId);
            const treinsOk = (treins as any[] || []).length > 0 &&
              !(treins as any[]).some((t: any) => t.status === "vencido");

            // Check ASO
            const { data: asos } = await fromTable("terceiro_documentos")
              .select("id, status")
              .eq("trabalhador_id", trabId)
              .eq("tenant_id", tenantId)
              .eq("tipo", "ASO");
            const asoOk = (asos as any[] || []).length > 0 &&
              !(asos as any[]).some((a: any) => a.status === "vencido");

            const apto = docsOk && treinsOk && asoOk;

            return {
              permissao_id: ptId,
              trabalhador_id: trabId,
              tenant_id: tenantId,
              docs_ok: docsOk,
              treins_ok: treinsOk,
              aso_ok: asoOk,
              apto,
              motivo_bloqueio: apto
                ? null
                : [
                    !docsOk && "Documentos pendentes/vencidos",
                    !treinsOk && "Treinamentos pendentes/vencidos",
                    !asoOk && "ASO ausente/vencido",
                  ]
                    .filter(Boolean)
                    .join("; "),
            };
          })
        );

        const { error: insertErr } = await fromTable("permissao_trabalhadores")
          .insert(validations as any);
        if (insertErr) throw insertErr;

        // 3. Auto-determine PT status
        const allApto = validations.every((v) => v.apto);
        const newStatus = allApto ? "liberada" : "bloqueada";
        const motivo = allApto
          ? null
          : "Trabalhador(es) com pendência documental";

        await fromTable("permissoes_trabalho")
          .update({
            status: newStatus,
            motivo_bloqueio: motivo,
            ...(allApto
              ? { liberado_em: new Date().toISOString(), liberado_por: user.id, liberado_por_nome: profile?.nome_completo || user.email }
              : {}),
          } as any)
          .eq("id", ptId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permissoes-trabalho"] });
      toast.success("Permissão de Trabalho criada!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const encerrarPermissao = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await fromTable("permissoes_trabalho")
        .update({
          status: "encerrada",
          encerrado_por: user.id,
          encerrado_por_nome: profile?.nome_completo || user.email,
          encerrado_em: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permissoes-trabalho"] });
      toast.success("PT encerrada!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const cancelarPermissao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("permissoes_trabalho")
        .update({ status: "cancelada" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permissoes-trabalho"] });
      toast.success("PT cancelada!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  return {
    permissoes,
    useTrabalhadoresPT,
    createPermissao,
    encerrarPermissao,
    cancelarPermissao,
  };
}
