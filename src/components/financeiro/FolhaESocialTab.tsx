import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CompetenciaInput } from "@/components/ui/competencia-input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileCode, Send, DollarSign, Building2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  gerarEventoS1200,
  gerarEventoS1210,
  gerarResumoDCTFWeb,
  gerarResumoFGTSDigital,
} from "@/lib/folha/integracoes-fiscais";

export function FolhaESocialTab() {
  const { tenantId } = useTenant();
  const [competencia, setCompetencia] = useState(format(new Date(), "yyyy-MM"));
  const [gerando, setGerando] = useState(false);

  // Buscar folha items da competência
  const { data: folhaItens = [] } = useQuery({
    queryKey: ["folha-itens-esocial", tenantId, competencia],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("folha_itens" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("competencia", competencia) as { data: any[] | null };
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Gerar resumos em memória
  const resumos = useMemo(() => {
    if (folhaItens.length === 0) return null;

    const totalRemuneracao = folhaItens.reduce((s: number, i: any) => s + (i.total_proventos || i.salario_base || 0), 0);
    const totalINSS = folhaItens.reduce((s: number, i: any) => s + (i.valor_inss || 0), 0);

    const dctfweb = gerarResumoDCTFWeb({
      competencia,
      totalColaboradores: folhaItens.length,
      totalRemuneracao,
      totalINSSEmpregados: totalINSS,
    });

    const fgtsDigital = gerarResumoFGTSDigital({
      competencia,
      colaboradores: folhaItens.map((i: any) => ({
        cpf: i.colaborador_cpf || "000.000.000-00",
        nome: i.colaborador_nome || "N/I",
        remuneracao: i.total_proventos || i.salario_base || 0,
        aliquotaFGTS: 8,
      })),
    });

    // Gerar S-1200 para cada colaborador
    const eventosS1200 = folhaItens.map((i: any) =>
      gerarEventoS1200({
        competencia,
        cpf: i.colaborador_cpf || "",
        proventos: [{ descricao: "Salário Base", tipo: "salario_base", valor: i.salario_base || 0 }],
        descontos: [
          { descricao: "INSS", tipo: "desc_inss", valor: i.valor_inss || 0 },
          { descricao: "IRRF", tipo: "desc_irrf", valor: i.valor_irrf || 0 },
        ],
      })
    );

    return { dctfweb, fgtsDigital, eventosS1200 };
  }, [folhaItens, competencia]);

  const gerarEventos = () => {
    if (!resumos || folhaItens.length === 0) {
      toast.warning("Sem dados de folha para gerar eventos.");
      return;
    }
    toast.success(`Eventos eSocial gerados: ${resumos.eventosS1200.length} S-1200 preparados para ${competencia}.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileCode className="w-5 h-5 text-primary" /> eSocial & Integrações Fiscais
          </h3>
          <p className="text-sm text-muted-foreground">Geração de eventos S-1200/S-1210, DCTFWeb e FGTS Digital</p>
        </div>
        <div className="flex items-center gap-3">
          <CompetenciaInput value={competencia} onChange={setCompetencia} />
          <Button onClick={gerarEventos} size="sm">
            <Send className="w-4 h-4 mr-1" /> Gerar Eventos
          </Button>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* DCTFWeb */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4" /> DCTFWeb
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resumos ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">INSS Empregados</span><span className="font-medium">R$ {resumos.dctfweb.inss_empregados.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">INSS Patronal (20%)</span><span className="font-medium">R$ {resumos.dctfweb.inss_patronal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">RAT</span><span className="font-medium">R$ {resumos.dctfweb.rat.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Terceiros</span><span className="font-medium">R$ {resumos.dctfweb.terceiros.toFixed(2)}</span></div>
                <div className="flex justify-between border-t pt-2"><span className="font-semibold">Total</span><span className="font-bold text-primary">R$ {resumos.dctfweb.totalContribuicoes.toFixed(2)}</span></div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados para esta competência.</p>
            )}
          </CardContent>
        </Card>

        {/* FGTS Digital */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> FGTS Digital
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resumos ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Colaboradores</span><span className="font-medium">{resumos.fgtsDigital.totalColaboradores}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Base de Cálculo</span><span className="font-medium">R$ {resumos.fgtsDigital.baseCalculo.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Alíquota Média</span><span className="font-medium">{resumos.fgtsDigital.aliquotaMedia}%</span></div>
                <div className="flex justify-between border-t pt-2"><span className="font-semibold">Total FGTS</span><span className="font-bold text-primary">R$ {resumos.fgtsDigital.valorTotal.toFixed(2)}</span></div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados para esta competência.</p>
            )}
          </CardContent>
        </Card>

        {/* Eventos eSocial */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileCode className="w-4 h-4" /> Eventos eSocial
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resumos ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">S-1200 (Remuneração)</span><Badge variant="outline">{resumos.eventosS1200.length}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">S-1210 (Pagamentos)</span><Badge variant="secondary">Pendente</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Ambiente</span><Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-200">Homologação</Badge></div>
                <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">Status</span><Badge>Apurado</Badge></div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados para esta competência.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detalhamento S-1200 */}
      {resumos && resumos.eventosS1200.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Eventos S-1200 — Remuneração ({competencia})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Evento</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead className="text-center">Rubricas</TableHead>
                  <TableHead className="text-center">Ambiente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumos.eventosS1200.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="font-mono text-xs">{ev.id}</TableCell>
                    <TableCell>{ev.cpfTrab.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</TableCell>
                    <TableCell className="text-center">{ev.dmDev[0]?.itensRemun.length || 0}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={ev.tpAmb === 1 ? "default" : "secondary"}>
                        {ev.tpAmb === 1 ? "Produção" : "Homologação"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
