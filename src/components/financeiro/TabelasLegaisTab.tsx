import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFolhaCalculo } from "@/hooks/useFolhaCalculo";
import { 
  TABELA_INSS_2025, TETO_INSS_2025, 
  TABELA_IRRF_2025, DEDUCAO_DEPENDENTE_IRRF_2025,
  MATRIZ_VINCULOS_PADRAO 
} from "@/lib/folha/calculos";
import { Settings2 } from "lucide-react";

const fmtMoeda = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export function TabelasLegaisTab() {
  const { useTabelasINSS, useTabelasIRRF, useVinculosConfig } = useFolhaCalculo();
  const { data: tabelasINSS = [] } = useTabelasINSS();
  const { data: tabelasIRRF = [] } = useTabelasIRRF();
  const { data: vinculos = MATRIZ_VINCULOS_PADRAO } = useVinculosConfig();

  // Usar tabelas salvas ou padrão
  const faixasINSS = tabelasINSS.length > 0 ? (tabelasINSS[0] as any).faixas : TABELA_INSS_2025;
  const tetoINSS = tabelasINSS.length > 0 ? (tabelasINSS[0] as any).teto : TETO_INSS_2025;
  const faixasIRRF = tabelasIRRF.length > 0 ? (tabelasIRRF[0] as any).faixas : TABELA_IRRF_2025;
  const deducaoDep = tabelasIRRF.length > 0 ? (tabelasIRRF[0] as any).deducao_por_dependente : DEDUCAO_DEPENDENTE_IRRF_2025;

  const VINCULOS_LABELS: Record<string, string> = {
    CLT_PRAZO_INDETERMINADO: "CLT Indeterminado",
    CLT_EXPERIENCIA: "CLT Experiência",
    CLT_INTERMITENTE: "CLT Intermitente",
    CLT_TEMPO_PARCIAL: "CLT Tempo Parcial",
    APRENDIZ: "Aprendiz",
    ESTAGIO: "Estágio",
    TEMPORARIO_LEI6019: "Temporário (Lei 6.019)",
    PJ: "PJ",
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-primary" /> Tabelas Legais e Configurações
        </h3>
        <p className="text-sm text-muted-foreground">INSS, IRRF e matriz de encargos por vínculo — vigência 2025</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* INSS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Tabela INSS
              <Badge variant="outline">Teto: R$ {fmtMoeda(tetoINSS)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Faixa</TableHead>
                  <TableHead className="text-right">Alíquota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faixasINSS.map((f: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>R$ {fmtMoeda(f.de)} a R$ {fmtMoeda(f.ate)}</TableCell>
                    <TableCell className="text-right font-mono">{f.aliquota}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* IRRF */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Tabela IRRF
              <Badge variant="outline">Dedução/dep: R$ {fmtMoeda(deducaoDep)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Faixa</TableHead>
                  <TableHead className="text-right">Alíquota</TableHead>
                  <TableHead className="text-right">Dedução</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faixasIRRF.map((f: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>R$ {fmtMoeda(f.de)} a R$ {f.ate > 99999 ? "∞" : `R$ ${fmtMoeda(f.ate)}`}</TableCell>
                    <TableCell className="text-right font-mono">{f.aliquota}%</TableCell>
                    <TableCell className="text-right">R$ {fmtMoeda(f.deducao)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Matriz de Vínculos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matriz de Encargos por Tipo de Vínculo</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de Vínculo</TableHead>
                <TableHead className="text-center">INSS</TableHead>
                <TableHead className="text-center">FGTS</TableHead>
                <TableHead className="text-center">Alíq. FGTS</TableHead>
                <TableHead className="text-center">Multa FGTS</TableHead>
                <TableHead className="text-center">13º</TableHead>
                <TableHead className="text-center">Férias</TableHead>
                <TableHead className="text-center">Aviso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(vinculos as any[]).map((v: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{VINCULOS_LABELS[v.tipo_vinculo] || v.tipo_vinculo}</TableCell>
                  <TableCell className="text-center">{v.inss_empregado ? <Badge className="bg-emerald-100 text-emerald-800 text-xs">Sim</Badge> : <Badge variant="secondary" className="text-xs">Não</Badge>}</TableCell>
                  <TableCell className="text-center">{v.fgts ? <Badge className="bg-emerald-100 text-emerald-800 text-xs">Sim</Badge> : <Badge variant="secondary" className="text-xs">Não</Badge>}</TableCell>
                  <TableCell className="text-center font-mono">{v.aliquota_fgts}%</TableCell>
                  <TableCell className="text-center font-mono">{v.multa_fgts_dispensa}%</TableCell>
                  <TableCell className="text-center">{v.direito_13 ? "✓" : "—"}</TableCell>
                  <TableCell className="text-center">{v.direito_ferias ? "✓" : "—"}</TableCell>
                  <TableCell className="text-center">{v.direito_aviso_previo ? "✓" : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
