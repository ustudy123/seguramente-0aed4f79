/**
 * Auditoria de ajustes: motivo declarado × evidência anexada × recorrência.
 *
 * Pedido no chamado do dia 08/06/2026 (dois ajustes seguidos justificados
 * como "Falha no equipamento / aplicativo"): o RH precisa enxergar se um
 * motivo está sendo usado de forma legítima antes de aprovar o próximo.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, FileDown, Paperclip, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { format, startOfMonth, subMonths } from "date-fns";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { AcaoProtegida } from "@/components/shared/AcaoProtegida";
import {
  usePontoAuditoriaAjustes,
  precisaConferencia,
  type AuditoriaAjusteMotivo,
} from "@/hooks/usePontoAuditoriaAjustes";

const dataBR = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "-");

export function PontoAuditoriaAjustesTab() {
  const { empresaAtivaId } = useEmpresaAtiva();
  const [ini, setIni] = useState(format(startOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd"));
  const [fim, setFim] = useState(format(new Date(), "yyyy-MM-dd"));
  const [busca, setBusca] = useState("");
  const [soConferencia, setSoConferencia] = useState(false);

  const { linhas, resumo, carregando } = usePontoAuditoriaAjustes(empresaAtivaId, ini, fim);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (soConferencia && !precisaConferencia(l)) return false;
      if (!q) return true;
      return (
        l.colaborador_nome.toLowerCase().includes(q) ||
        l.motivo.toLowerCase().includes(q)
      );
    });
  }, [linhas, busca, soConferencia]);

  const totais = useMemo(() => {
    const ajustes = linhas.reduce((s, l) => s + l.qtd_ajustes, 0);
    const semAnexo = linhas.reduce((s, l) => s + l.qtd_sem_anexo, 0);
    const semAnexoExigido = linhas.reduce((s, l) => s + l.qtd_sem_anexo_exigido, 0);
    return {
      ajustes,
      semAnexo,
      semAnexoExigido,
      conferir: linhas.filter(precisaConferencia).length,
      pctSemAnexo: ajustes ? Math.round((1000 * semAnexo) / ajustes) / 10 : 0,
    };
  }, [linhas]);

  const exportar = () => {
    const dados = filtradas.map((l) => ({
      Colaborador: l.colaborador_nome,
      CPF: l.colaborador_cpf,
      Motivo: l.motivo,
      "Exige anexo": l.requer_anexo ? "Sim" : "Não",
      Ajustes: l.qtd_ajustes,
      "Com anexo": l.qtd_com_anexo,
      "Sem anexo": l.qtd_sem_anexo,
      "Sem anexo (exigido)": l.qtd_sem_anexo_exigido,
      Aprovados: l.qtd_aprovados,
      Pendentes: l.qtd_pendentes,
      "Dias distintos": l.dias_distintos,
      "Meses distintos": l.meses_distintos,
      "Média por mês": l.media_por_mes,
      Primeiro: dataBR(l.primeira_data),
      Último: dataBR(l.ultima_data),
      Conferir: precisaConferencia(l) ? "Sim" : "",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados), "Auditoria");
    XLSX.writeFile(wb, `Auditoria_ajustes_${ini}_a_${fim}.xlsx`);
  };

  const linhaClasse = (l: AuditoriaAjusteMotivo) =>
    precisaConferencia(l) ? "bg-amber-50/60" : "";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-primary" /> Auditoria de ajustes de ponto
        </h3>
        <p className="text-sm text-muted-foreground">
          Motivo declarado × evidência anexada × recorrência por colaborador.
          Um motivo que se repete sem anexo é fila de conferência, não acusação.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" className="h-9 w-[150px]" value={ini} onChange={(e) => setIni(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" className="h-9 w-[150px]" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="h-9 pl-8"
                placeholder="Colaborador ou motivo"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
          <Button
            variant={soConferencia ? "default" : "outline"}
            size="sm"
            onClick={() => setSoConferencia((v) => !v)}
          >
            Só o que precisa conferência ({totais.conferir})
          </Button>
          <AcaoProtegida modulo="colaboradores" acao="exportar">
            <Button variant="outline" size="sm" onClick={exportar} disabled={!filtradas.length}>
              <FileDown className="w-4 h-4 mr-1" /> Exportar
            </Button>
          </AcaoProtegida>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{totais.ajustes}</p>
          <p className="text-xs text-muted-foreground">Ajustes no período</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{totais.pctSemAnexo}%</p>
          <p className="text-xs text-muted-foreground">Sem evidência anexada</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{totais.semAnexoExigido}</p>
          <p className="text-xs text-muted-foreground">Sem anexo quando o motivo exige</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{totais.conferir}</p>
          <p className="text-xs text-muted-foreground">Pares colaborador × motivo a conferir</p>
        </CardContent></Card>
      </div>

      {resumo.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Por motivo</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Ajustes</TableHead>
                  <TableHead className="text-right">Colaboradores</TableHead>
                  <TableHead className="text-right">Com anexo</TableHead>
                  <TableHead className="text-right">Sem anexo</TableHead>
                  <TableHead className="text-right">% sem anexo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumo.map((r) => (
                  <TableRow key={r.motivo}>
                    <TableCell className="text-sm">{r.motivo}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{r.qtd_ajustes}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{r.qtd_colaboradores}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{r.qtd_com_anexo}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{r.qtd_sem_anexo}</TableCell>
                    <TableCell className={`text-right font-mono text-sm ${r.pct_sem_anexo >= 50 ? "text-red-600" : ""}`}>
                      {r.pct_sem_anexo}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Por colaborador × motivo</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Ajustes</TableHead>
                <TableHead className="text-right">Evidência</TableHead>
                <TableHead className="text-right">Recorrência</TableHead>
                <TableHead>Período</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregando ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-sm text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : filtradas.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-sm text-muted-foreground">Nenhum ajuste no período.</TableCell></TableRow>
              ) : filtradas.map((l) => (
                <TableRow key={`${l.colaborador_cpf}-${l.motivo}`} className={linhaClasse(l)}>
                  <TableCell className="text-sm font-medium">{l.colaborador_nome}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex flex-col gap-1">
                      <span>{l.motivo}</span>
                      <div className="flex gap-1">
                        {l.requer_anexo && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 w-fit">
                            <Paperclip className="w-2.5 h-2.5 mr-0.5" /> exige anexo
                          </Badge>
                        )}
                        {l.qtd_pendentes > 0 && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 w-fit border-sky-500 text-sky-700">
                            {l.qtd_pendentes} pendente(s)
                          </Badge>
                        )}
                        {precisaConferencia(l) && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 w-fit border-amber-500 text-amber-700">
                            conferir
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{l.qtd_ajustes}</TableCell>
                  <TableCell className="text-right text-sm">
                    <span className="font-mono">{l.qtd_com_anexo}</span>
                    <span className="text-muted-foreground"> com / </span>
                    <span className={`font-mono ${l.qtd_sem_anexo_exigido > 0 ? "text-red-600 font-semibold" : ""}`}>
                      {l.qtd_sem_anexo}
                    </span>
                    <span className="text-muted-foreground"> sem</span>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <span className="font-mono">{l.media_por_mes}</span>
                    <span className="text-muted-foreground">/mês</span>
                    <div className="text-[11px] text-muted-foreground">
                      {l.dias_distintos} dia(s) · {l.meses_distintos} mês(es)
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {dataBR(l.primeira_data)} → {dataBR(l.ultima_data)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
