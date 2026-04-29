import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "./useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";

export interface OrdemServico {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  colaborador_id: string;
  cargo_id: string | null;
  cargo_nome: string | null;
  setor_nome: string | null;
  numero_sequencial: number;
  ano: number;
  numero_formatado: string;
  pgr_id: string | null;
  conteudo_html: string | null;
  conteudo_json: any;
  data_emissao: string;
  data_vigencia: string | null;
  status: "rascunho" | "aguardando_assinatura" | "assinada" | "vencida" | "desatualizada" | "cancelada";
  assinada_em: string | null;
  assinatura_selfie_url: string | null;
  responsavel_emissao_nome: string | null;
  responsavel_tecnico_nome: string | null;
  responsavel_tecnico_registro: string | null;
  motivo_reemissao: string | null;
  versao: number;
  os_anterior_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useOrdensServico() {
  const { tenantId, user } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const qc = useQueryClient();

  const { data: ordens = [], isLoading } = useQuery({
    queryKey: ["ordens-servico", tenantId, empresaAtivaId],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = fromTable("ordens_servico")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (empresaAtivaId) q = q.eq("empresa_id", empresaAtivaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as OrdemServico[];
    },
    enabled: !!tenantId,
  });

  const gerar = useMutation({
    mutationFn: async (params: {
      colaborador_id: string;
      pgr_id?: string;
      responsavel_emissao_nome?: string;
      responsavel_tecnico_nome?: string;
      responsavel_tecnico_registro?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("gerar-ordem-servico", {
        body: params,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
  });

  const salvar = useMutation({
    mutationFn: async (params: {
      colaborador_id: string;
      empresa_id: string | null;
      cargo_id: string | null;
      cargo_nome: string;
      setor_nome: string;
      pgr_id: string;
      conteudo_html: string;
      conteudo_json: any;
      data_vigencia: string;
      ano: number;
      responsavel_emissao_nome?: string;
      responsavel_tecnico_nome?: string;
      responsavel_tecnico_registro?: string;
      status?: "rascunho" | "aguardando_assinatura";
    }) => {
      if (!tenantId || !user) throw new Error("não autenticado");
      const { data, error } = await fromTable("ordens_servico").insert({
        tenant_id: tenantId,
        empresa_id: params.empresa_id,
        colaborador_id: params.colaborador_id,
        cargo_id: params.cargo_id,
        cargo_nome: params.cargo_nome,
        setor_nome: params.setor_nome,
        pgr_id: params.pgr_id,
        conteudo_html: params.conteudo_html,
        conteudo_json: params.conteudo_json,
        data_vigencia: params.data_vigencia,
        ano: params.ano,
        status: params.status || "rascunho",
        responsavel_emissao_id: user.id,
        responsavel_emissao_nome: params.responsavel_emissao_nome,
        responsavel_tecnico_nome: params.responsavel_tecnico_nome,
        responsavel_tecnico_registro: params.responsavel_tecnico_registro,
        criado_por: user.id,
      } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens-servico"] });
      toast.success("Ordem de Serviço criada!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const enviarParaAssinatura = useMutation({
    mutationFn: async (osId: string) => {
      if (!tenantId) throw new Error("não autenticado");
      const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      const { data: link, error: linkErr } = await fromTable("ordem_servico_links").insert({
        ordem_servico_id: osId,
        tenant_id: tenantId,
        token,
      } as any).select().single();
      if (linkErr) throw linkErr;
      await fromTable("ordens_servico").update({ status: "aguardando_assinatura" } as any).eq("id", osId);
      return link;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens-servico"] });
      toast.success("OS enviada para assinatura!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const excluir = useMutation({
    mutationFn: async (osId: string) => {
      const { error } = await fromTable("ordens_servico").delete().eq("id", osId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens-servico"] });
      toast.success("OS excluída!");
    },
  });

  return { ordens, isLoading, gerar, salvar, enviarParaAssinatura, excluir };
}
