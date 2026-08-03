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
import { useSeveridadesCatalogo } from "@/hooks/useSeveridadesCatalogo";
import { usePsicossocialResultadosGHE } from "@/hooks/usePsicossocialResultadosGHE";
import { calcularFatoresRisco } from "@/lib/fatoresRiscoPsicossocial";
import { NIVEL15_ORDEM, type NivelGRO15 } from "@/lib/groPsicossocial15";
import { isEntrevistaInstrumento, type CampanhaPsicossocial } from "@/types/psicossocial";
import {
  construirInventarioDiagnostico,
  campanhaTemDiagnostico,
} from "@/utils/inventarioDiagnosticoPsicossocial";
import {
  gerarDocumentoFatoresRiscoPsicossocial,
  type AcaoPlanoPGRDocumento,
  type InventarioGHEDocumento,
} from "@/utils/gerarDocumentoFatoresRiscoPsicossocial";

interface DocumentoFatoresRiscoPGRProps {
  campanhas: CampanhaPsicossocial[];
}

export function DocumentoFatoresRiscoPGR({ campanhas }: DocumentoFatoresRiscoPGRProps) {
  const { tenantId } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const queryClient = useQueryClient();
  const { data: sevCatalogo } = useSeveridadesCatalogo();

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

  const campanhaSelecionada = campanhas.find((c) => c.id === campanhaId) || null;
  const temDiagnostico = campanhaSelecionada ? campanhaTemDiagnostico(campanhaSelecionada) : false;

  // Prévia do Anexo I: mesmo cálculo do Relatório de Diagnóstico Psicossocial (Inventário PGR)
  const inventarioPrevia = useMemo(
    () =>
      campanhaSelecionada && temDiagnostico
        ? construirInventarioDiagnostico(campanhaSelecionada, sevCatalogo)
        : [],
    [campanhaSelecionada, temDiagnostico, sevCatalogo]
  );

  // Anexo II: ações do Plano de Ação PGR vinculadas à campanha.
  // O vínculo que vale é ação <-> campanha (campanha_ids): NÃO filtra pela unidade
  // ativa, pois o empresa_id da ação é só um retrato da unidade selecionada no
  // momento da criação — filtrar por ele esconderia ações legítimas da campanha.
  const { data: acoesPlano = [] } = useQuery({
    queryKey: ["psico-doc-acoes-pgr", tenantId, campanhaId],
    queryFn: async (): Promise<AcaoPlanoPGRDocumento[]> => {
      const { data, error } = await fromTable("psicossocial_plano_acao")
        .select("*")
        .eq("tenant_id", tenantId)
        .overlaps("campanha_ids", [campanhaId])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as AcaoPlanoPGRDocumento[];
    },
    enabled: !!tenantId && !!campanhaId,
  });

  // Ordena como o módulo apresenta: por GHE e, dentro dele, do risco mais grave ao menor
  const acoesPGR = useMemo<AcaoPlanoPGRDocumento[]>(
    () =>
      [...acoesPlano].sort((a, b) => {
        const ghe = (a.ghe_nome || "").localeCompare(b.ghe_nome || "");
        if (ghe !== 0) return ghe;
        return (
          (NIVEL15_ORDEM[a.nivel_gro as NivelGRO15] ?? 9) -
          (NIVEL15_ORDEM[b.nivel_gro as NivelGRO15] ?? 9)
        );
      }),
    [acoesPlano]
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
    if (!campanhaSelecionada) {
      toast.error("Selecione a campanha do documento");
      return;
    }
    if (!nome.trim()) {
      toast.error("Informe o nome do responsável técnico");
      return;
    }
    if (!temDiagnostico || inventarioPrevia.length === 0) {
      toast.error(
        "Esta campanha ainda não tem diagnóstico liberado (mínimo de respostas não atingido ou sem resultados processados).",
        { duration: 7000 }
      );
      return;
    }

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

      await gerarDocumentoFatoresRiscoPsicossocial({
        empresa,
        responsavel: {
          nome: nome.trim(),
          ocupacao: ocupacao.trim() || null,
          registro_profissional: registro.trim() || null,
        },
        campanha: {
          nome: campanhaSelecionada.nome,
          data_inicio: campanhaSelecionada.data_inicio,
          data_fim: campanhaSelecionada.data_fim,
          instrumento: campanhaSelecionada.instrumento,
          total_respostas: campanhaSelecionada.total_respostas,
        },
        inventario: inventarioPrevia,
        acoes: acoesPGR,
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
          Anexo I (Inventário de Riscos — Diagnóstico Psicossocial) e Anexo II (Plano de Ação PGR
          5W2H), pronto para assinatura do responsável técnico.
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
            {campanhaSelecionada && temDiagnostico && (
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <Badge variant="outline" className="gap-1 text-[11px]">
                  <ClipboardList className="h-3 w-3" />
                  {inventarioPrevia.length} fator(es) no diagnóstico
                </Badge>
                <Badge variant="outline" className="gap-1 text-[11px]">
                  <Target className="h-3 w-3" />
                  {acoesPGR.length} ação(ões) no Plano PGR
                </Badge>
              </div>
            )}
            {campanhaSelecionada && !temDiagnostico && (
              <p className="text-xs text-amber-600 flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Campanha sem diagnóstico liberado: é preciso atingir o mínimo de respostas
                (5 para questionário, 1 para entrevista) para emitir o documento.
              </p>
            )}
            {campanhaSelecionada && temDiagnostico && acoesPGR.length === 0 && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Sem ações no Plano de Ação PGR para esta campanha — o Anexo II sairá vazio.
                Monte o plano na aba "Plano de Ação PGR" se quiser incluí-lo.
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
            disabled={gerando || !campanhaId || !nome.trim() || !temDiagnostico}
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
