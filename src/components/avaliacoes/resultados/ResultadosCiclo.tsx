import { useState, useCallback } from "react";
import {
  BarChart3, TrendingUp, TrendingDown, Users, Download,
  FileText, Info, Filter, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useResultadosAvaliacao } from "@/hooks/useResultadosAvaliacao";
import { useAvaliacaoPermissoes } from "@/hooks/useAvaliacaoPermissoes";
import { Skeleton } from "@/components/ui/skeleton";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
      <BarChart3 className="h-8 w-8 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  if (delta > 0) return (
    <Badge className="bg-success/10 text-success border-success/20 gap-1 text-xs font-medium">
      <ArrowUpRight className="h-3 w-3" /> +{delta.toFixed(1)}
    </Badge>
  );
  if (delta < 0) return (
    <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1 text-xs font-medium">
      <ArrowDownRight className="h-3 w-3" /> {delta.toFixed(1)}
    </Badge>
  );
  return (
    <Badge variant="outline" className="gap-1 text-xs font-medium">
      <Minus className="h-3 w-3" /> Estável
    </Badge>
  );
}

export function ResultadosCiclo() {
  const { podeExportar, podeVerDashboardDiretoria } = useAvaliacaoPermissoes();
  const [selectedCicloId, setSelectedCicloId] = useState<string | undefined>();
  const [filtroSetor, setFiltroSetor] = useState<string>("__all__");
  const [filtroFuncao, setFiltroFuncao] = useState<string>("__all__");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingXls, setIsExportingXls] = useState(false);

  const {
    ciclos,
    cicloId,
    resumo,
    distribuicao,
    topColaboradores,
    porSetor,
    dimensoes,
    evolucaoCicloAnterior,
    setoresDisponiveis,
    funcoesDisponiveis,
    isLoading,
    hasDados,
    respostasBruto,
    profiles,
  } = useResultadosAvaliacao(
    selectedCicloId,
    {
      setor: filtroSetor !== "__all__" ? filtroSetor : undefined,
      funcao: filtroFuncao !== "__all__" ? filtroFuncao : undefined,
    }
  );

  const cicloAtual = ciclos.find(c => c.id === cicloId);

  // ── Exportação PDF individual ────────────────────────────────────────────────
  const exportarPDF = useCallback(async () => {
    if (!hasDados || !cicloAtual) { toast.error("Sem dados para exportar."); return; }
    setIsExportingPdf(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();

      // Cabeçalho
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, pageW, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Avaliação de Desempenho", 14, 12);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Ciclo: ${cicloAtual.nome}`, 14, 20);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, pageW - 14, 20, { align: "right" });

      // KPIs
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo do Ciclo", 14, 38);

      const kpis = [
        { label: "Média Geral", value: resumo.mediaGeral.toFixed(1) },
        { label: "Avaliações Concluídas", value: `${resumo.totalConcluidas}/${resumo.totalRespostas}` },
        { label: "Participação", value: `${resumo.taxaParticipacao}%` },
        { label: "PDIs Vinculados", value: String(resumo.pdisGerados) },
      ];
      kpis.forEach((k, i) => {
        const x = 14 + (i % 2) * 90;
        const y = 46 + Math.floor(i / 2) * 16;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(k.label, x, y);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text(k.value, x, y + 6);
      });

      if (evolucaoCicloAnterior?.deltaMedia !== null && evolucaoCicloAnterior?.deltaMedia !== undefined) {
        const delta = evolucaoCicloAnterior.deltaMedia;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(`Variação vs. ${evolucaoCicloAnterior.nomeCicloAnterior}:`, 14, 80);
        doc.setTextColor(delta >= 0 ? 34 : 239, delta >= 0 ? 197 : 68, delta >= 0 ? 94 : 68);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(`${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pontos`, 70, 80);
      }

      // Linha separadora
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 86, pageW - 14, 86);

      // Top colaboradores
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Top Colaboradores", 14, 94);

      topColaboradores.forEach((c, i) => {
        const y = 102 + i * 10;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(`${i + 1}. ${c.nome}`, 14, y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text(c.nota.toFixed(1), pageW - 14, y, { align: "right" });
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184);
        doc.text(c.setor, pageW - 30, y, { align: "right" });
      });

      // Por setor
      const sY = 160;
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Média por Setor", 14, sY);

      porSetor.slice(0, 6).forEach((s, i) => {
        const y = sY + 8 + i * 10;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(s.setor, 14, y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text(s.media.toFixed(1), pageW - 14, y, { align: "right" });
        doc.setTextColor(148, 163, 184);
        doc.setFont("helvetica", "normal");
        doc.text(`${s.colaboradores} avaliado(s)`, pageW - 30, y, { align: "right" });
      });

      // Rodapé
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("Gerado pelo YourEyes — Avaliação de Desempenho", pageW / 2, 285, { align: "center" });

      doc.save(`avaliacao-${cicloAtual.nome.replace(/\s+/g, "_")}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao gerar PDF: " + e.message);
    } finally {
      setIsExportingPdf(false);
    }
  }, [hasDados, cicloAtual, resumo, topColaboradores, porSetor, evolucaoCicloAnterior]);

  // ── Exportação Excel ──────────────────────────────────────────────────────────
  const exportarExcel = useCallback(async () => {
    if (!hasDados || !cicloAtual) { toast.error("Sem dados para exportar."); return; }
    setIsExportingXls(true);
    try {
      const wb = XLSX.utils.book_new();

      // Aba: Resumo
      const resumoData = [
        ["Ciclo", cicloAtual.nome],
        ["Gerado em", format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })],
        [],
        ["Indicador", "Valor"],
        ["Média Geral", resumo.mediaGeral],
        ["Total Avaliações", resumo.totalRespostas],
        ["Avaliações Concluídas", resumo.totalConcluidas],
        ["Taxa de Participação (%)", resumo.taxaParticipacao],
        ["PDIs Vinculados", resumo.pdisGerados],
        ...(evolucaoCicloAnterior
          ? [
              [],
              ["Ciclo Anterior", evolucaoCicloAnterior.nomeCicloAnterior],
              ["Média Anterior", evolucaoCicloAnterior.mediaAnterior ?? "—"],
              ["Variação", evolucaoCicloAnterior.deltaMedia ?? "—"],
            ]
          : []),
      ];
      const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

      // Aba: Colaboradores
      const colabData = [
        ["Nome", "Setor", "Nota Geral", "Status"],
        ...respostasBruto.map(r => {
          const p = profiles.find(pr => pr.user_id === r.avaliado_id);
          return [r.avaliado_nome, p?.departamento || "—", r.nota_geral ?? 0, r.status];
        }),
      ];
      const wsColab = XLSX.utils.aoa_to_sheet(colabData);
      XLSX.utils.book_append_sheet(wb, wsColab, "Colaboradores");

      // Aba: Por Setor
      const setorData = [
        ["Setor", "Média", "Colaboradores"],
        ...porSetor.map(s => [s.setor, s.media, s.colaboradores]),
      ];
      const wsSetor = XLSX.utils.aoa_to_sheet(setorData);
      XLSX.utils.book_append_sheet(wb, wsSetor, "Por Setor");

      // Aba: Distribuição
      const distData = [
        ["Faixa de Nota", "Quantidade"],
        ...distribuicao.map(d => [d.nota, d.quantidade]),
      ];
      const wsDist = XLSX.utils.aoa_to_sheet(distData);
      XLSX.utils.book_append_sheet(wb, wsDist, "Distribuição");

      XLSX.writeFile(wb, `avaliacao-${cicloAtual.nome.replace(/\s+/g, "_")}.xlsx`);
      toast.success("Excel gerado com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao gerar Excel: " + e.message);
    } finally {
      setIsExportingXls(false);
    }
  }, [hasDados, cicloAtual, resumo, respostasBruto, profiles, porSetor, distribuicao, evolucaoCicloAnterior]);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={cicloId || ""} onValueChange={v => setSelectedCicloId(v)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder={isLoading ? "Carregando…" : "Selecionar ciclo"} />
          </SelectTrigger>
          <SelectContent>
            {ciclos.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filtro setor */}
        {setoresDisponiveis.length > 0 && (
          <Select value={filtroSetor} onValueChange={setFiltroSetor}>
            <SelectTrigger className="w-44">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os setores</SelectItem>
              {setoresDisponiveis.map(s => (
                <SelectItem key={s} value={s!}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Filtro função */}
        {funcoesDisponiveis.length > 0 && (
          <Select value={filtroFuncao} onValueChange={setFiltroFuncao}>
            <SelectTrigger className="w-44">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Cargo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as funções</SelectItem>
              {funcoesDisponiveis.map(f => (
                <SelectItem key={f} value={f!}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Exportações */}
        {podeExportar && (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5"
              onClick={exportarPDF} disabled={isExportingPdf || !hasDados}>
              <Download className="h-3.5 w-3.5" />
              {isExportingPdf ? "Gerando…" : "PDF"}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5"
              onClick={exportarExcel} disabled={isExportingXls || !hasDados}>
              <Download className="h-3.5 w-3.5" />
              {isExportingXls ? "Gerando…" : "Excel"}
            </Button>
          </div>
        )}
      </div>

      {/* Sem ciclos */}
      {!isLoading && ciclos.length === 0 && (
        <Card>
          <CardContent className="py-10">
            <EmptyState message="Nenhum ciclo de avaliação encontrado. Crie um ciclo na aba Ciclos." />
          </CardContent>
        </Card>
      )}

      {/* Sem dados concluídos */}
      {!isLoading && ciclos.length > 0 && !hasDados && (
        <Card>
          <CardContent className="py-10">
            <EmptyState message={`O ciclo "${cicloAtual?.nome || ""}" ainda não possui avaliações concluídas.`} />
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dados */}
      {!isLoading && hasDados && (
        <>
          {/* Evolução vs ciclo anterior */}
          {evolucaoCicloAnterior && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Evolução vs. {evolucaoCicloAnterior.nomeCicloAnterior}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    Média anterior: <strong>{evolucaoCicloAnterior.mediaAnterior?.toFixed(1) ?? "—"}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Média atual: <strong>{resumo.mediaGeral.toFixed(1)}</strong>
                  </span>
                  <DeltaBadge delta={evolucaoCicloAnterior.deltaMedia} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* KPIs */}
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: "Média Geral", value: resumo.mediaGeral.toFixed(1), sub: "nota final do ciclo", icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
              { label: "Concluídas", value: `${resumo.totalConcluidas}/${resumo.totalRespostas}`, sub: `${resumo.taxaParticipacao}% participação`, icon: Users, color: "text-blue-600 bg-blue-50" },
              { label: "Notas Extremas", value: String(distribuicao[0].quantidade + distribuicao[distribuicao.length - 1].quantidade), sub: `${distribuicao[0].quantidade} baixas • ${distribuicao[distribuicao.length - 1].quantidade} altas`, icon: BarChart3, color: "text-amber-600 bg-amber-50" },
              { label: "PDIs Vinculados", value: String(resumo.pdisGerados), sub: "planos de desenvolvimento", icon: FileText, color: "text-purple-600 bg-purple-50" },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${s.color}`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.sub}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Distribuição */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Distribuição de Notas</CardTitle>
              </CardHeader>
              <CardContent>
                {distribuicao.every(d => d.quantidade === 0) ? (
                  <EmptyState message="Sem dados de distribuição." />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={distribuicao}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="nota" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <RechartsTooltip />
                      <Bar dataKey="quantidade" radius={[4, 4, 0, 0]}>
                        {distribuicao.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Radar por dimensão */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Média por Critério</CardTitle>
                <CardDescription className="text-xs">
                  Baseado em notas por critério das avaliações concluídas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dimensoes.length === 0 ? (
                  <EmptyState message="Sem dados de critérios disponíveis." />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={dimensoes} cx="50%" cy="50%">
                      <PolarGrid />
                      <PolarAngleAxis dataKey="dimensao" tick={{ fontSize: 11 }} />
                      <Radar
                        dataKey="media"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.3}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Top performers */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Top Colaboradores</CardTitle>
                <CardDescription className="text-xs">
                  Maiores notas no ciclo — {cicloAtual?.nome}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topColaboradores.length === 0 ? (
                  <EmptyState message="Sem avaliações concluídas ainda." />
                ) : (
                  <div className="space-y-3">
                    {topColaboradores.map((c, i) => (
                      <div key={c.nome + i} className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          i === 0 ? "bg-amber-100 text-amber-700" :
                          i === 1 ? "bg-slate-100 text-slate-700" :
                          i === 2 ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"
                        }`}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.nome}</p>
                          <p className="text-xs text-muted-foreground">{c.setor}</p>
                        </div>
                        <div className="flex items-center gap-3 text-right">
                          <div className="w-24">
                            <Progress value={(c.nota / 5) * 100} className="h-1.5" />
                          </div>
                          <p className="text-sm font-bold w-8">{c.nota.toFixed(1)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Por setor */}
            {podeVerDashboardDiretoria && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Média por Setor</CardTitle>
                  <CardDescription className="text-xs">Visão consolidada por departamento</CardDescription>
                </CardHeader>
                <CardContent>
                  {porSetor.length === 0 ? (
                    <EmptyState message="Sem dados por setor." />
                  ) : (
                    <div className="space-y-3">
                      {porSetor.map(s => (
                        <div key={s.setor} className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{s.setor}</p>
                            <p className="text-xs text-muted-foreground">{s.colaboradores} avaliado(s)</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-24">
                              <Progress value={(s.media / 5) * 100} className="h-1.5" />
                            </div>
                            <p className="text-sm font-bold w-8">{s.media.toFixed(1)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Exportações completas */}
          {podeExportar && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Relatórios Exportáveis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "PDF Consolidado", desc: "Relatório com todos os indicadores", icon: FileText, action: exportarPDF, loading: isExportingPdf },
                    { label: "CSV/Excel Completo", desc: "Dados brutos para análise", icon: Download, action: exportarExcel, loading: isExportingXls },
                    { label: "Relatório do Time", desc: "Visão consolidada por gestor", icon: Users, action: exportarPDF, loading: isExportingPdf },
                    { label: "Relatório Diretoria", desc: "Dashboard consolidado (PDF)", icon: BarChart3, action: exportarPDF, loading: isExportingPdf },
                  ].map(r => (
                    <Button key={r.label} variant="outline"
                      className="h-auto flex-col items-start p-4 gap-1"
                      onClick={r.action} disabled={r.loading || !hasDados}>
                      <r.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{r.label}</span>
                      <span className="text-[10px] text-muted-foreground">{r.desc}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
