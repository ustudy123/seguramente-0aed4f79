import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, ArrowLeftRight, TrendingDown } from "lucide-react";

interface Props { hub: any; }

interface ConferenciaItem {
  tipo: string;
  label: string;
  valorFolha: number;
  valorGuia: number;
  diferenca: number;
  percentual: number;
  status: "ok" | "divergente" | "sem_guia";
}

export function HubConferenciaCruzada({ hub }: Props) {
  const { guias, competencias } = hub;
  const [competenciaSel, setCompetenciaSel] = useState<string>("");
  const [conferencias, setConferencias] = useState<ConferenciaItem[]>([]);

  const competenciasList = competencias.map((c: any) => c.competencia);

  useEffect(() => {
    if (!competenciaSel) {
      if (competenciasList.length > 0) setCompetenciaSel(competenciasList[0]);
      return;
    }

    const guiasComp = guias.filter((g: any) => g.competencia === competenciaSel);

    // Simulação: em produção, esses valores viriam de cálculos reais da folha
    // Por ora, montamos a conferência com base nas guias existentes
    const tiposConferencia = [
      { tipo: "inss", label: "INSS (Empresa + Empregado)" },
      { tipo: "fgts", label: "FGTS" },
      { tipo: "irrf", label: "IRRF" },
      { tipo: "darf", label: "DARF PIS/COFINS/CSLL" },
      { tipo: "iss", label: "ISS" },
      { tipo: "contribuicao_sindical", label: "Contribuição Sindical" },
    ];

    const items: ConferenciaItem[] = tiposConferencia.map(tc => {
      const guia = guiasComp.find((g: any) => g.tipo === tc.tipo);
      const valorGuia = guia ? Number(guia.valor) : 0;
      // Valor folha seria calculado a partir dos dados reais — aqui serve como placeholder
      const valorFolha = 0; // TODO: integrar com cálculo real da folha
      const diferenca = Math.abs(valorFolha - valorGuia);
      const percentual = valorGuia > 0 && valorFolha > 0 ? (diferenca / valorFolha) * 100 : 0;

      return {
        tipo: tc.tipo,
        label: tc.label,
        valorFolha,
        valorGuia,
        diferenca,
        percentual,
        status: !guia ? "sem_guia" : diferenca === 0 ? "ok" : "divergente",
      };
    });

    setConferencias(items);
  }, [competenciaSel, guias, competenciasList]);

  const totalGuias = conferencias.reduce((s, c) => s + c.valorGuia, 0);
  const divergentes = conferencias.filter(c => c.status === "divergente").length;
  const semGuia = conferencias.filter(c => c.status === "sem_guia").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5" /> Conferência Cruzada
        </h2>
        <Select value={competenciaSel} onValueChange={setCompetenciaSel}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Competência" /></SelectTrigger>
          <SelectContent>
            {competenciasList.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Guias</p>
            <p className="text-xl font-bold">R$ {totalGuias.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Divergências</p>
            <p className={`text-xl font-bold ${divergentes > 0 ? "text-amber-600" : "text-emerald-600"}`}>{divergentes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Sem Guia Registrada</p>
            <p className={`text-xl font-bold ${semGuia > 0 ? "text-destructive" : "text-emerald-600"}`}>{semGuia}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de conferência */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento — {competenciaSel}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="grid grid-cols-5 text-xs font-medium text-muted-foreground px-3 py-1">
              <span>Tributo</span>
              <span className="text-right">Valor Folha</span>
              <span className="text-right">Valor Guia</span>
              <span className="text-right">Diferença</span>
              <span className="text-right">Status</span>
            </div>
            {conferencias.map(c => (
              <div key={c.tipo} className={`grid grid-cols-5 items-center text-sm px-3 py-2 rounded border ${c.status === "divergente" ? "border-amber-300 bg-amber-50" : c.status === "sem_guia" ? "border-red-200 bg-red-50" : "border-border"}`}>
                <span className="font-medium">{c.label}</span>
                <span className="text-right text-muted-foreground">
                  {c.valorFolha > 0 ? `R$ ${c.valorFolha.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                </span>
                <span className="text-right">
                  {c.valorGuia > 0 ? `R$ ${c.valorGuia.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                </span>
                <span className={`text-right ${c.diferenca > 0 ? "text-amber-600 font-medium" : ""}`}>
                  {c.diferenca > 0 ? `R$ ${c.diferenca.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                </span>
                <span className="text-right">
                  {c.status === "ok" && <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" /> OK</Badge>}
                  {c.status === "divergente" && <Badge className="bg-amber-100 text-amber-800"><AlertTriangle className="w-3 h-3 mr-1" /> Divergente</Badge>}
                  {c.status === "sem_guia" && <Badge className="bg-red-100 text-red-800"><TrendingDown className="w-3 h-3 mr-1" /> Sem guia</Badge>}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            ℹ️ A coluna "Valor Folha" será preenchida automaticamente quando o módulo de cálculo de folha estiver integrado.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
