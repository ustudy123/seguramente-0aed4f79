import { useMemo, useState, useEffect } from "react";
import {
  FileText,
  Download,
  AlertTriangle,
  ShieldAlert,
  Info,
  ChevronDown,
  ChevronUp,
  Loader2,
  ShieldCheck,
  Database,
  BookOpen,
  RefreshCw,
  Filter,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RelatorioModal } from "./RelatorioModal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CampanhaPsicossocial, RadarDimensao } from "@/types/psicossocial";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useGRORiscos } from "@/hooks/useGRORiscos";
import { PrivacidadeGrupoAlert } from "./PrivacidadeGrupoAlert";
import {
  aplicarRegrasPrivacidade,
  estimarContagemPorGrupo,
  MINIMO_RESPONDENTES_GRUPO,
} from "@/lib/psicossocial-privacy";
import {
  GRO_NIVEL_RISCO_LABELS,
  scoreToProbabilidade,
  scoreToSeveridade,
  calcularNivelGRO,
  GRO_PROBABILIDADE_LABELS,
  GRO_SEVERIDADE_LABELS,
} from "@/types/gro";
import {
  resolverFatorPorSubject,
  CATEGORIA_LABELS,
  type CategoriaRiscoPsicossocial,
} from "@/data/catalogoRiscosPsicossociais";
import { ExplicacaoPGRGRO } from "./ExplicacaoPGRGRO";

interface InventarioPGRProps {
  campanhas: CampanhaPsicossocial[];
}

const MINIMO_ANONIMATO = 5;

/**
 * Resolve a normativa e o fator a partir do catálogo unificado.
 * O catálogo (NR-01 + ISO 45003) substitui o antigo mapa hardcoded.
 */
function getNormativaForSubject(subject: string): {
  fator: string;
  norma: string;
  descricao: string;
  categoria: CategoriaRiscoPsicossocial | null;
  categoriaLabel: string;
  manifestacoes: string[];
} {
  const fator = resolverFatorPorSubject(subject);
  if (fator) {
    return {
      fator: fator.nome,
      norma: fator.baseNormativa.join(" / "),
      descricao: fator.descricao,
      categoria: fator.categoria,
      categoriaLabel: CATEGORIA_LABELS[fator.categoria],
      manifestacoes: fator.manifestacoes,
    };
  }
  return {
    fator: subject,
    norma: "NR-01 / ISO 45003",
    descricao: "Fator psicossocial não catalogado — avaliar enquadramento normativo manualmente.",
    categoria: null,
    categoriaLabel: "Não classificado",
    manifestacoes: [],
  };
}

interface InventarioItem {
  dimensao: string;
  fator: string;
  norma: string;
  descricao: string;
  categoriaLabel: string;
  manifestacoes: string[];
  scoreReal: number;
  probabilidadeLabel: string;
  severidadeLabel: string;
  nivelLabel: string;
  nivelKey: 'baixo' | 'medio' | 'alto' | 'critico';
  fonteCampanhas: number; // quantas campanhas contribuíram com score para essa dimensão
}

export function InventarioPGR({ campanhas }: InventarioPGRProps) {
  const [expanded, setExpanded] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [relatorioOpen, setRelatorioOpen] = useState(false);
  const [filtroCampanha, setFiltroCampanha] = useState<string>(campanhas.length === 1 ? campanhas[0].id : "todos");

  useEffect(() => {
    if (campanhas.length === 1) {
      setFiltroCampanha(campanhas[0].id);
    } else if (filtroCampanha !== "todos" && !campanhas.some(c => c.id === filtroCampanha)) {
      setFiltroCampanha("todos");
    }
  }, [campanhas, filtroCampanha]);

  const { importarDaCampanha, riscos: groRiscos } = useGRORiscos();

  // GAP-P2: Riscos GRO que precisam de reavaliação (pós-ação concluída)
  const pendentesReavaliacao = groRiscos.filter(r => r.necessita_reavaliacao).length;

  // Campanhas válidas (mín. anonimato e com radar_data real)
  const campanhasValidas = useMemo(() =>
    campanhas.filter(c =>
      c.ips_score != null &&
      (c.total_respostas || 0) >= MINIMO_ANONIMATO &&
      Array.isArray(c.radar_data) &&
      c.radar_data.length > 0
    ),
    [campanhas]
  );

  const isSipro = campanhasValidas[0]?.instrumento === 'sipro';
  const campanhaAtual = campanhasValidas[0];
  const semEscopoGRO = !campanhaAtual?.situacoes_trabalho || campanhaAtual.situacoes_trabalho.length === 0;

  // ── GAP A+B: Proteção de privacidade por grupo (ISO 45003) ──────────────────
  // Calcula quais pares setor+função têm respondentes suficientes,
  // aplica fallback automático (funcao → setor → empresa) para grupos pequenos.
  const privacidadeGrupos = useMemo(() => {
    if (!campanhaAtual) return null;
    const situacoes = campanhaAtual.situacoes_trabalho ?? [];
    const totalRespondentes = campanhaAtual.total_respostas ?? 0;
    const contagem = estimarContagemPorGrupo(totalRespondentes, situacoes);
    return aplicarRegrasPrivacidade(situacoes, contagem, totalRespondentes);
  }, [campanhaAtual]);

  /**
   * Agregação real das dimensões.
   * Para cada subject único no radar_data de todas as campanhas válidas,
   * calcula a média ponderada pelo total_respostas de cada campanha.
   */
  const inventario = useMemo((): InventarioItem[] => {
    if (campanhasValidas.length === 0) return [];

    const campanhasParaProcessar = filtroCampanha === "todos" 
      ? campanhasValidas 
      : campanhasValidas.filter(c => c.id === filtroCampanha);

    if (campanhasParaProcessar.length === 0) return [];

    // Agregar por subject — média ponderada pelo total_respostas
    const agregado: Record<string, { somaScore: number; pesoTotal: number; campanhas: number }> = {};

    campanhasParaProcessar.forEach(campanha => {
      const peso = campanha.total_respostas ?? 1;
      const radar = campanha.radar_data as RadarDimensao[];

      radar.forEach(dim => {
        if (!agregado[dim.subject]) {
          agregado[dim.subject] = { somaScore: 0, pesoTotal: 0, campanhas: 0 };
        }
        agregado[dim.subject].somaScore += dim.value * peso;
        agregado[dim.subject].pesoTotal += peso;
        agregado[dim.subject].campanhas += 1;
      });
    });

    const items: InventarioItem[] = Object.entries(agregado).map(([subject, agg]) => {
      const scoreReal = Math.round(agg.somaScore / agg.pesoTotal);
      const prob = scoreToProbabilidade(scoreReal, isSipro);
      const sev = scoreToSeveridade(scoreReal, isSipro);
      const nivel = calcularNivelGRO(prob, sev);
      const normativa = getNormativaForSubject(subject);

      return {
        dimensao: subject,
        fator: normativa.fator,
        norma: normativa.norma,
        descricao: normativa.descricao,
        categoriaLabel: normativa.categoriaLabel,
        manifestacoes: normativa.manifestacoes,
        scoreReal,
        probabilidadeLabel: GRO_PROBABILIDADE_LABELS[prob],
        severidadeLabel: GRO_SEVERIDADE_LABELS[sev],
        nivelLabel: GRO_NIVEL_RISCO_LABELS[nivel],
        nivelKey: nivel,
        fonteCampanhas: agg.campanhas,
      };
    });

    // Ordenar por gravidade (crítico → alto → médio → baixo)
    const ordem: Record<string, number> = { critico: 0, alto: 1, medio: 2, baixo: 3 };
    return items.sort((a, b) => (ordem[a.nivelKey] ?? 4) - (ordem[b.nivelKey] ?? 4));
  }, [campanhasValidas, isSipro, filtroCampanha]);

  const criticos = inventario.filter(i => i.nivelKey === 'critico').length;
  const altos = inventario.filter(i => i.nivelKey === 'alto').length;
  const medios = inventario.filter(i => i.nivelKey === 'medio').length;
  const baixos = inventario.filter(i => i.nivelKey === 'baixo').length;

  const handleImportarGRO = async () => {
    if (campanhasValidas.length === 0) return;
    // Importar da campanha mais recente com radar_data
    const campanha = campanhasValidas[0];
    const radar = campanha.radar_data as RadarDimensao[];
    const situacoes = campanha.situacoes_trabalho ?? [];

    if (situacoes.length === 0) {
      toast.error(
        "Esta campanha não possui situações de trabalho (Setor+Função) vinculadas. " +
        "Edite a campanha para adicionar pares Setor+Função antes de exportar ao GRO (NR-17).",
        { duration: 6000 }
      );
      return;
    }

    await importarDaCampanha.mutateAsync({
      campanhaId: campanha.id,
      campanhaName: campanha.nome,
      dimensoes: radar.map(d => ({ subject: d.subject, value: d.value })),
      empresaId: null,
      isSipro: campanha.instrumento === 'sipro',
      situacoes,
    });
  };

  const handleExportarPDF = async () => {
    if (inventario.length === 0) return;
    setExportando(true);
    try {
      const doc = new jsPDF({ orientation: "landscape" });

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("INVENTÁRIO DE RISCOS PSICOSSOCIAIS — NR-01 / ISO 45003", 14, 18);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Gerado em: ${new Date().toLocaleDateString("pt-BR")} | Campanhas: ${campanhasValidas.length} | Dados: Reais (radar agregado)`,
        14, 26
      );
      doc.text(
        `Instrumento: ${isSipro ? 'SIPRO' : (campanhasValidas[0]?.instrumento?.toUpperCase() ?? 'N/A')} | Score alto = maior risco`,
        14, 32
      );

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("1. INVENTÁRIO DE FATORES PSICOSSOCIAIS DE RISCO", 14, 42);

      autoTable(doc, {
        startY: 46,
        head: [["Dimensão / Fator", "Descrição do Risco", "Base Normativa", "Score Real", "Probabilidade", "Severidade", "Grau de Risco"]],
        body: inventario.map(item => [
          item.dimensao,
          item.fator,
          item.norma,
          `${item.scoreReal}%`,
          item.probabilidadeLabel,
          item.severidadeLabel,
          item.nivelLabel,
        ]),
        headStyles: { fillColor: [88, 28, 135], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 38 },
          1: { cellWidth: 55 },
          2: { cellWidth: 35 },
          3: { cellWidth: 20 },
          4: { cellWidth: 28 },
          5: { cellWidth: 25 },
          6: { cellWidth: 35 },
        },
        alternateRowStyles: { fillColor: [248, 245, 255] },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 6) {
            const val = data.cell.raw as string;
            if (val.includes("Crítico")) data.cell.styles.textColor = [185, 28, 28];
            else if (val.includes("Alto")) data.cell.styles.textColor = [194, 65, 12];
            else if (val.includes("Médio")) data.cell.styles.textColor = [180, 83, 9];
            else data.cell.styles.textColor = [5, 122, 85];
          }
        },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("2. MATRIZ DE RISCO PSICOSSOCIAL (NR-01)", 14, finalY);

      autoTable(doc, {
        startY: finalY + 4,
        head: [["Grau de Risco", "Qtde. de Dimensões", "Ação Recomendada", "Prazo"]],
        body: [
          ["Risco Crítico", String(criticos), "Intervenção imediata — revisão do PGR e plano de ação", "30 dias"],
          ["Risco Alto", String(altos), "Implementar medidas preventivas prioritárias", "60 dias"],
          ["Risco Médio", String(medios), "Monitoramento e ações de melhoria contínua", "90 dias"],
          ["Risco Baixo", String(baixos), "Manter vigilância e registrar evidências", "180 dias"],
        ],
        headStyles: { fillColor: [88, 28, 135], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 245, 255] },
      });

      doc.save(`Inventario_Riscos_Psicossociais_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf`);
      toast.success("Inventário de Riscos exportado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao exportar PDF.");
    } finally {
      setExportando(false);
    }
  };

  if (campanhasValidas.length === 0) {
    return (
      <div className="space-y-4">
        <ExplicacaoPGRGRO />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <ShieldAlert className="h-8 w-8 text-muted-foreground opacity-40" />
            <p className="text-sm font-medium">Inventário não disponível</p>
            <p className="text-xs text-muted-foreground">
              Necessário ao menos uma campanha encerrada com mín. {MINIMO_ANONIMATO} respostas e dados do radar calculados.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const nivelColors: Record<string, string> = {
    critico: "border-l-red-500",
    alto: "border-l-orange-500",
    medio: "border-l-amber-500",
    baixo: "border-l-emerald-500",
  };

  const nivelBadgeColors: Record<string, string> = {
    critico: "bg-red-50 text-red-700 border-red-200",
    alto: "bg-orange-50 text-orange-700 border-orange-200",
    medio: "bg-amber-50 text-amber-700 border-amber-200",
    baixo: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };

  return (
    <div className="space-y-4">
      <ExplicacaoPGRGRO />
      <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-600" />
              Inventário de Riscos Psicossociais
              <Badge variant="outline" className="text-[10px] font-mono bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                <ShieldCheck className="h-2.5 w-2.5" />
                Dados Reais
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              NR-01 · ISO 45003 — {inventario.length} dimensões avaliadas · {campanhasValidas.length} campanha(s) consolidada(s)
              {" · "}Instrumento: <strong>{isSipro ? "SIPRO" : campanhasValidas[0]?.instrumento?.toUpperCase()}</strong>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md border border-purple-100">
              <Filter className="h-3 w-3 text-purple-600/60" />
              <Select value={filtroCampanha} onValueChange={setFiltroCampanha}>
                <SelectTrigger className="w-[180px] h-7 text-[10px] border-none bg-transparent focus:ring-0">
                  <SelectValue placeholder="Filtrar Campanha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Campanhas</SelectItem>
                  {campanhasValidas.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {criticos > 0 && (
              <Badge className="bg-red-600 text-white gap-1">
                <AlertTriangle className="h-3 w-3" />
                {criticos} crítico(s)
              </Badge>
            )}
            {altos > 0 && (
              <Badge className="bg-orange-500 text-white">{altos} alto(s)</Badge>
            )}
            {pendentesReavaliacao > 0 && (
              <Badge className="bg-violet-100 text-violet-700 border border-violet-300 gap-1">
                <RefreshCw className="h-3 w-3" />
                {pendentesReavaliacao} reavaliar
              </Badge>
            )}
            {/* GAP 4: Botão Relatório completo com metodologia */}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setRelatorioOpen(true)}
              title="Gerar relatório estruturado com metodologia — NR-01 / ISO 45003"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Relatório
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleImportarGRO}
              disabled={importarDaCampanha.isPending}
              title={semEscopoGRO ? "Campanha sem Setor+Função vinculado — adicione situações de trabalho para exportar ao GRO com conformidade NR-17" : "Enviar riscos ao inventário GRO"}
            >
              {importarDaCampanha.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
              Enviar ao GRO
              {semEscopoGRO && <AlertTriangle className="h-3 w-3 text-amber-500" />}
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportarPDF} disabled={exportando}>
              {exportando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Exportar PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Matriz resumida */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Crítico", count: criticos, bg: "bg-red-50 border-red-200", text: "text-red-700" },
            { label: "Alto", count: altos, bg: "bg-orange-50 border-orange-200", text: "text-orange-700" },
            { label: "Médio", count: medios, bg: "bg-amber-50 border-amber-200", text: "text-amber-700" },
            { label: "Baixo", count: baixos, bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
          ].map(({ label, count, bg, text }) => (
            <div key={label} className={cn("p-3 rounded-lg border text-center", bg)}>
              <p className={cn("text-xl font-bold", text)}>{count}</p>
              <p className={cn("text-xs font-medium", text)}>Risco {label}</p>
            </div>
          ))}
        </div>

        {/* GAP C — Alerta de privacidade por grupo (ISO 45003) */}
        {privacidadeGrupos && (campanhaAtual?.situacoes_trabalho?.length ?? 0) > 0 && (
          <PrivacidadeGrupoAlert resultado={privacidadeGrupos} />
        )}

        {/* Tabela */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Dimensão / Fator</TableHead>
                <TableHead className="text-xs text-center">Score Real</TableHead>
                <TableHead className="text-xs">Base Normativa</TableHead>
                <TableHead className="text-xs text-center">Probabilidade</TableHead>
                <TableHead className="text-xs text-center">Severidade</TableHead>
                <TableHead className="text-xs text-center">Grau de Risco</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(expanded ? inventario : inventario.slice(0, 7)).map((item) => (
                <TableRow key={item.dimensao} className={cn("border-l-2", nivelColors[item.nivelKey])}>
                  <TableCell className="py-2 align-top max-w-[320px]">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <p className="font-medium text-sm leading-tight">{item.fator}</p>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-purple-50 text-purple-700 border-purple-200">
                        {item.categoriaLabel}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">{item.descricao}</p>
                    {item.dimensao !== item.fator && (
                      <p className="text-[10px] text-muted-foreground/70 italic mt-0.5">
                        Dimensão do instrumento: {item.dimensao}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-bold text-sm">{item.scoreReal}%</span>
                      <div className="w-16 bg-muted rounded-full h-1.5">
                        <div
                          className={cn("h-1.5 rounded-full", {
                            "bg-red-500": item.nivelKey === 'critico',
                            "bg-orange-500": item.nivelKey === 'alto',
                            "bg-amber-500": item.nivelKey === 'medio',
                            "bg-emerald-500": item.nivelKey === 'baixo',
                          })}
                          style={{ width: `${item.scoreReal}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge variant="outline" className="text-xs font-mono">{item.norma}</Badge>
                  </TableCell>
                  <TableCell className="py-2 text-center">
                    <span className="text-xs font-semibold">{item.probabilidadeLabel}</span>
                  </TableCell>
                  <TableCell className="py-2 text-center">
                    <span className="text-xs text-muted-foreground">{item.severidadeLabel}</span>
                  </TableCell>
                  <TableCell className="py-2 text-center">
                    <Badge className={cn("text-xs border", nivelBadgeColors[item.nivelKey])}>
                      {item.nivelLabel}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {inventario.length > 7 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-1 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <><ChevronUp className="h-3.5 w-3.5" /> Mostrar menos</>
            ) : (
              <><ChevronDown className="h-3.5 w-3.5" /> Ver todas as {inventario.length} dimensões</>
            )}
          </Button>
        )}

        {/* GAP 2: Alerta de ações obrigatórias para alto/crítico */}
        {(criticos > 0 || altos > 0) && (
          <div className="flex items-start gap-2 p-3 bg-orange-50/50 rounded-lg border border-orange-200 text-xs text-orange-800">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-orange-500" />
            <p>
              <strong>{criticos + altos} dimensão(ões) não tolerável(is)</strong> identificada(s).
              Ações obrigatórias foram geradas automaticamente no Plano de Ação Global
              {criticos > 0 && ` (${criticos} crítica(s) — prazo 30 dias`}{altos > 0 && `, ${altos} alta(s) — prazo 60 dias`}{(criticos > 0 || altos > 0) && ")"}. NR-01 / ISO 45003.
            </p>
          </div>
        )}

        {/* GAP 4: Metodologia sempre visível no Inventário PGR */}
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-purple-600" />
            Metodologia — NR-01 / NR-17 / ISO 45003
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-1.5">
              <span className="text-purple-600 font-bold shrink-0">1.</span>
              <span><strong>Coleta:</strong> Respostas agregadas anonimamente (mín. 5 respondentes por grupo)</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-purple-600 font-bold shrink-0">2.</span>
              <span><strong>Score real:</strong> Média ponderada por n° de respondentes de {campanhasValidas.length} campanha(s)</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-purple-600 font-bold shrink-0">3.</span>
              <span><strong>Probabilidade × Severidade:</strong> Calculados via mapeamento normativo SIPRO/COPSOQ</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-purple-600 font-bold shrink-0">4.</span>
              <span><strong>Nível GRO:</strong> Crítico / Alto / Médio / Baixo conforme matriz P×S (NR-01 Anexo I)</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-purple-600 font-bold shrink-0">5.</span>
              <span><strong>Ações 5W2H:</strong> Geradas automaticamente para Crítico (30d) e Alto (60d)</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-purple-600 font-bold shrink-0">6.</span>
              <span><strong>Auditabilidade:</strong> Use "Relatório" para exportar documento completo com rastreabilidade</span>
            </div>
          </div>
        </div>
      </CardContent>

      {/* GAP 4: Modal de relatório estruturado */}
      <RelatorioModal
        open={relatorioOpen}
        onClose={() => setRelatorioOpen(false)}
        campanhas={campanhas}
      />
      </Card>
    </div>
  );
}
