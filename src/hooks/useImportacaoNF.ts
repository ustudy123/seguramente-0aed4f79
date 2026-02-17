import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface NFItemData {
  epi_id: string;
  local_estoque_id: string;
  descricao_nf?: string;
  quantidade: number;
  valor_unitario?: number;
  valor_total?: number;
}

export interface NFData {
  numero_nf: string;
  serie?: string;
  chave_acesso?: string;
  fornecedor_cnpj?: string;
  fornecedor_nome?: string;
  data_emissao?: string;
  valor_total?: number;
  observacoes?: string;
  origem: "xml" | "manual";
  itens: NFItemData[];
}

export interface NFXmlParsed {
  numero_nf: string;
  serie: string;
  chave_acesso: string;
  fornecedor_cnpj: string;
  fornecedor_nome: string;
  data_emissao: string;
  valor_total: number;
  itens: { descricao: string; quantidade: number; valor_unitario: number; valor_total: number }[];
}

/** Parse NF-e XML string and extract header + items */
export function parseNFeXml(xmlString: string): NFXmlParsed {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("XML inválido. Verifique o arquivo.");

  // NF-e namespace-agnostic helpers
  const tag = (parent: Document | Element, name: string): Element | null => {
    return parent.getElementsByTagName(name)[0] || null;
  };
  const tagText = (parent: Document | Element, name: string): string => {
    return tag(parent, name)?.textContent?.trim() || "";
  };

  const infNFe = tag(doc, "infNFe");
  if (!infNFe) throw new Error("Elemento infNFe não encontrado. Este XML é uma NF-e válida?");

  const chaveAcesso = infNFe.getAttribute("Id")?.replace("NFe", "") || "";

  // ide
  const nNF = tagText(infNFe, "nNF");
  const serie = tagText(infNFe, "serie");
  const dhEmi = tagText(infNFe, "dhEmi") || tagText(infNFe, "dEmi");

  // emit (fornecedor)
  const emit = tag(infNFe, "emit");
  const fornecedorCnpj = emit ? tagText(emit, "CNPJ") : "";
  const fornecedorNome = emit ? (tagText(emit, "xFant") || tagText(emit, "xNome")) : "";

  // total
  const icmsTot = tag(infNFe, "ICMSTot");
  const vNF = icmsTot ? parseFloat(tagText(icmsTot, "vNF")) || 0 : 0;

  // det items
  const dets = infNFe.getElementsByTagName("det");
  const itens: NFXmlParsed["itens"] = [];

  for (let i = 0; i < dets.length; i++) {
    const det = dets[i];
    const prod = tag(det, "prod");
    if (!prod) continue;
    itens.push({
      descricao: tagText(prod, "xProd"),
      quantidade: parseFloat(tagText(prod, "qCom")) || 1,
      valor_unitario: parseFloat(tagText(prod, "vUnCom")) || 0,
      valor_total: parseFloat(tagText(prod, "vProd")) || 0,
    });
  }

  if (itens.length === 0) throw new Error("Nenhum item encontrado na NF-e.");

  return {
    numero_nf: nNF,
    serie,
    chave_acesso: chaveAcesso,
    fornecedor_cnpj: fornecedorCnpj,
    fornecedor_nome: fornecedorNome,
    data_emissao: dhEmi ? dhEmi.substring(0, 10) : "",
    valor_total: vNF,
    itens,
  };
}

export function useImportacaoNF() {
  const { tenantId, user, profile } = useAuth();
  const queryClient = useQueryClient();

  const importarNFMutation = useMutation({
    mutationFn: async (dados: NFData) => {
      if (!tenantId) throw new Error("Tenant não identificado");
      if (dados.itens.length === 0) throw new Error("Nenhum item para importar");

      // 1. Create NF record
      const { data: nf, error: nfError } = await supabase
        .from("epi_notas_fiscais")
        .insert({
          tenant_id: tenantId,
          numero_nf: dados.numero_nf,
          serie: dados.serie || null,
          chave_acesso: dados.chave_acesso || null,
          fornecedor_cnpj: dados.fornecedor_cnpj || null,
          fornecedor_nome: dados.fornecedor_nome || null,
          data_emissao: dados.data_emissao || null,
          valor_total: dados.valor_total || null,
          observacoes: dados.observacoes || null,
          origem: dados.origem,
          criado_por: user?.id,
          criado_por_nome: profile?.nome_completo,
        })
        .select("id")
        .single();
      if (nfError) throw nfError;

      // 2. Process each item: stock entry + nf_item record
      for (const item of dados.itens) {
        let epiId = item.epi_id;

        // Check if epi_id exists in epis table
        let epiRecord = await supabase
          .from("epis")
          .select("id, quantidade_estoque")
          .eq("id", epiId)
          .maybeSingle()
          .then(r => r.data);

        // If not found by id, check if it's a tipo_id and find existing epis record
        if (!epiRecord) {
          epiRecord = await supabase
            .from("epis")
            .select("id, quantidade_estoque")
            .eq("tipo_id", epiId)
            .eq("tenant_id", tenantId)
            .maybeSingle()
            .then(r => r.data);
        }

        let qtdAnterior = 0;

        if (epiRecord) {
          epiId = epiRecord.id;
          qtdAnterior = epiRecord.quantidade_estoque || 0;
        } else {
          // No epis record exists — auto-create one
          const { data: novoEpi, error: novoEpiError } = await supabase
            .from("epis")
            .insert({
              tenant_id: tenantId,
              tipo_id: epiId,
              quantidade_estoque: 0,
              status: "disponivel",
            })
            .select("id")
            .single();
          if (novoEpiError) throw novoEpiError;
          epiId = novoEpi.id;
        }

        const qtdNova = qtdAnterior + item.quantidade;

        // Update global stock
        const { error: updErr } = await supabase
          .from("epis")
          .update({ quantidade_estoque: qtdNova })
          .eq("id", epiId);
        if (updErr) throw updErr;

        // Upsert local stock
        const { data: estoqueLocal } = await supabase
          .from("epi_estoque_local")
          .select("id, quantidade")
          .eq("epi_id", epiId)
          .eq("local_estoque_id", item.local_estoque_id)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (estoqueLocal) {
          await supabase
            .from("epi_estoque_local")
            .update({ quantidade: estoqueLocal.quantidade + item.quantidade })
            .eq("id", estoqueLocal.id);
        } else {
          await supabase
            .from("epi_estoque_local")
            .insert({
              tenant_id: tenantId,
              epi_id: epiId,
              local_estoque_id: item.local_estoque_id,
              quantidade: item.quantidade,
            });
        }

        // Create movement record
        const { data: mov } = await supabase
          .from("epi_movimentacoes")
          .insert({
            tenant_id: tenantId,
            epi_id: epiId,
            tipo: "entrada",
            subtipo: "compra_nf",
            local_estoque_id: item.local_estoque_id,
            quantidade: item.quantidade,
            quantidade_anterior: qtdAnterior,
            quantidade_atual: qtdNova,
            motivo: `NF ${dados.numero_nf} - ${item.descricao_nf || "Compra"}`,
            realizado_por: user?.id,
            realizado_por_nome: profile?.nome_completo,
          })
          .select("id")
          .single();

        // Create NF item linked to movement
        await supabase.from("epi_nf_itens").insert({
          tenant_id: tenantId,
          nota_fiscal_id: nf.id,
          epi_id: epiId,
          local_estoque_id: item.local_estoque_id,
          descricao_nf: item.descricao_nf || null,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario || null,
          valor_total: item.valor_total || null,
          movimentacao_id: mov?.id || null,
        });
      }

      return nf;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epis"] });
      queryClient.invalidateQueries({ queryKey: ["epi-movimentacoes"] });
      queryClient.invalidateQueries({ queryKey: ["epi-estoque-local"] });
      queryClient.invalidateQueries({ queryKey: ["epi-notas-fiscais"] });
      toast.success("Nota fiscal importada e estoque atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao importar NF: " + error.message);
    },
  });

  const notasFiscaisQuery = useQuery({
    queryKey: ["epi-notas-fiscais", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("epi_notas_fiscais")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  return {
    importarNF: importarNFMutation.mutateAsync,
    importando: importarNFMutation.isPending,
    notasFiscais: notasFiscaisQuery.data || [],
    notasFiscaisLoading: notasFiscaisQuery.isLoading,
    parseNFeXml,
  };
}
