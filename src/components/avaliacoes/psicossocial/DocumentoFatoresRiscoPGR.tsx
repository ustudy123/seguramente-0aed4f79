import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSignature, Loader2, FileDown, Info, ClipboardList, Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import type { CampanhaPsicossocial } from "@/types/psicossocial";
import type { GRORisco } from "@/types/gro";
import {
  gerarDocumentoFatoresRiscoPsicossocial,
  type AcaoDocumento,
} from "@/utils/gerarDocumentoFatoresRiscoPsicossocial";

interface DocumentoFatoresRiscoPGRProps {
  campanhas: CampanhaPsicossocial[];
}

export function DocumentoFatoresRiscoPGR({ campanhas }: DocumentoFatoresRiscoPGRProps) {
  const { tenantId } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const queryClient = useQueryClient();

  const [campanhaId, setCampanhaId] = useState<string>("");
  const [nome, setNome] = useState("");
  const [ocupacao, setOcupacao] = useState("");
  const [registro, setRegistro] = useState("");
  const [gerando, setGerando] = useState(false);

  const campanhasOrdenadas = useMemo(
    () =>
      [...campanhas].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      ),
    [campanhas]
  );

  // Responsável técnico salvo (reutilizado nas próximas emissões)
  const { data: respSalvo } = useQuery({
    queryKey: ["psico-resp-tecnico", tenantId, empresaAtivaId],
    queryFn: async () => {
      let query = fromTable("psicossocial_responsavel_tecnico")
        .select("*")
        .eq("tenant_id", tenantId);
      query = empresaAtivaId
        ? query.eq("empresa_id", empresaAtivaId)
        : query.is("empresa_id", null);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as { id: string; nome: string; ocupacao: string | null; registro_profissional: string | null } | null;
    },
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (respSalvo) {
      setNome(respSalvo.nome || "");
      setOcupacao(respSalvo.ocupacao || "");
      setRegistro(respSalvo.registro_profissional || "");
    }
  }, [respSalvo]);

  // Prévia do que a campanha selecionada tem de inventário + plano de ação
  const { data: previa } = useQuery({
    queryKey: ["psico-doc-previa", campanhaId],
    queryFn: async () => {
      const { data: riscos, error } = await fromTable("gro_riscos")
        .select("id, acao_id, nivel_risco")
        .eq("campanha_id", campanhaId)
        .eq("ativo", true);
      if (error) throw error;
      const acaoIds = [...new Set((riscos || []).map((r: any) => r.acao_id).filter(Boolean))];
      return { totalRiscos: (riscos || []).length, totalAcoesVinculadas: acaoIds.length };
    },
    enabled: !!campanhaId,
  });

  const salvarResponsavel = async () => {
    const payload = {
      tenant_id: tenantId,
      empresa_id: empresaAtivaId || null,
      nome: nome.trim(),
      ocupacao: ocupacao.trim() || null,
      registro_profissional: registro.trim() || null,
    };
    if (respSalvo?.id) {
      await fromTable("psicossocial_responsavel_tecnico").update(payload).eq("id", respSalvo.id);
    } else {
      await fromTable("psicossocial_responsavel_tecnico").insert(payload);
    }
    queryClient.invalidateQueries({ queryKey: ["psico-resp-tecnico", tenantId, empresaAtivaId] });
  };

  const handleGerar = async () => {
    if (!campanhaId) {
      toast.error("Selecione a campanha do documento");
      return;
    }
    if (!nome.trim()) {
      toast.error("Informe o nome do responsável técnico");
      return;
    }
    const campanha = campanhas.find((c) => c.id === campanhaId);
    if (!campanha) return;

    setGerando(true);
    try {
      // Salva o responsável técnico para reutilizar nas próximas emissões
      await salvarResponsavel();

      // Empresa: unidade ativa ou matriz do tenant
      let empresaQuery = supabase
        .from("empresa_cadastro")
        .select("razao_social, nome_fantasia, cnpj, endereco, numero, bairro, cidade, estado, cnae_principal, cnae_descricao, grau_risco")
        .eq("tenant_id", tenantId!);
      empresaQuery = empresaAtivaId
        ? empresaQuery.eq("id", empresaAtivaId)
        : empresaQuery.eq("tipo_unidade", "matriz");
      const { data: empresas, error: empErr } = await empresaQuery
        .order("created_at", { ascending: false })
        .limit(1);
      if (empErr) throw empErr;
      const empresa = empresas?.[0];
      if (!empresa) throw new Error("Cadastro da empresa não encontrado");

      // Anexo I: inventário de riscos da campanha
      const { data: riscos, error: riscosErr } = await fromTable("gro_riscos")
        .select("*")
        .eq("campanha_id", campanhaId)
        .eq("ativo", true)
        .order("nivel_risco", { ascending: true });
      if (riscosErr) throw riscosErr;
      const riscosCampanha = (riscos || []) as GRORisco[];

      if (riscosCampanha.length === 0) {
        toast.error(
          "Esta campanha ainda não tem inventário de riscos. Exporte os resultados para o GRO na aba Inventário PGR antes de emitir o documento.",
          { duration: 8000 }
        );
        return;
      }

      // Anexo II: ações vinculadas aos riscos + ações originadas da campanha
      const acaoIds = [...new Set(riscosCampanha.map((r) => r.acao_id).filter(Boolean))] as string[];
      const [vinculadasRes, origemRes] = await Promise.all([
        acaoIds.length
          ? supabase.from("plano_acoes").select("*").in("id", acaoIds)
          : Promise.resolve({ data: [], error: null } as any),
        supabase
          .from("plano_acoes")
          .select("*")
          .eq("tenant_id", tenantId!)
          .eq("origem_modulo", "psicossocial")
          .ilike("origem_descricao", `%${campanha.nome}%`),
      ]);
      if (vinculadasRes.error) throw vinculadasRes.error;
      if (origemRes.error) throw origemRes.error;

      const acoesMap = new Map<string, AcaoDocumento & { id: string }>();
      [...(vinculadasRes.data || []), ...(origemRes.data || [])].forEach((a: any) => {
        acoesMap.set(a.id, a);
      });
      const acoes = [...acoesMap.values()];

      // Ordena os riscos do mais grave para o menos grave
      const pesoNivel: Record<string, number> = { critico: 0, alto: 1, medio: 2, baixo: 3 };
      riscosCampanha.sort(
        (a, b) => (pesoNivel[a.nivel_risco] ?? 9) - (pesoNivel[b.nivel_risco] ?? 9)
      );

      await gerarDocumentoFatoresRiscoPsicossocial({
        empresa,
        responsavel: {
          nome: nome.trim(),
          ocupacao: ocupacao.trim() || null,
          registro_profissional: registro.trim() || null,
        },
        campanha: {
          nome: campanha.nome,
          data_inicio: campanha.data_inicio,
          data_fim: campanha.data_fim,
          instrumento: campanha.instrumento,
          total_respostas: campanha.total_respostas,
        },
        riscos: riscosCampanha,
        acoes,
      });

      toast.success("Documento gerado! O PDF está pronto para conferência e assinatura.");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao gerar o documento");
    } finally {
      setGerando(false);
    }
  };

  return (
    <Card className="border-purple-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSignature className="h-5 w-5 text-purple-600" />
          Documento de Fatores de Risco Psicossociais (PGR / GRO)
        </CardTitle>
        <CardDescription>
          Emite o documento oficial da campanha com identificação da empresa, metodologia,
          Anexo I (Inventário de Riscos) e Anexo II (Plano de Ação 5W2H), pronto para assinatura
          do responsável técnico.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Campanha</Label>
            <Select value={campanhaId} onValueChange={setCampanhaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a campanha" />
              </SelectTrigger>
              <SelectContent>
                {campanhasOrdenadas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} {c.status === "encerrada" ? "· encerrada" : c.status === "ativa" ? "· ativa" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {campanhaId && previa && (
              <div className="flex items-center gap-2 pt-1">
                <Badge variant="outline" className="gap-1 text-[11px]">
                  <ClipboardList className="h-3 w-3" />
                  {previa.totalRiscos} risco(s) no inventário
                </Badge>
                <Badge variant="outline" className="gap-1 text-[11px]">
                  <Target className="h-3 w-3" />
                  {previa.totalAcoesVinculadas} ação(ões) vinculada(s)
                </Badge>
              </div>
            )}
            {campanhaId && previa?.totalRiscos === 0 && (
              <p className="text-xs text-amber-600 flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Campanha sem inventário no GRO. Exporte os resultados na aba "Inventário PGR"
                antes de emitir o documento.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Responsável técnico (assina o documento)</Label>
            <Input
              placeholder="Nome completo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Ocupação (ex.: Psicóloga)"
                value={ocupacao}
                onChange={(e) => setOcupacao(e.target.value)}
              />
              <Input
                placeholder="Registro (ex.: CRP 08/12345)"
                value={registro}
                onChange={(e) => setRegistro(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Os dados da empresa são preenchidos automaticamente a partir do cadastro. O responsável
            técnico fica salvo para as próximas emissões.
          </p>
          <Button
            onClick={handleGerar}
            disabled={gerando || !campanhaId || !nome.trim()}
            className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
          >
            {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {gerando ? "Gerando documento..." : "Gerar Documento (PDF)"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
