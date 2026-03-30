import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Calculator, BarChart3, Target, Sparkles, Loader2, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MetaCompleta, MetaNivel } from "@/types/metas-module";
import { NIVEL_LABELS, NIVEL_CORES } from "@/types/metas-module";

interface MetasConsolidacaoPanelProps {
  metas: MetaCompleta[];
}

interface ConsolidacaoNivel {
  nivel: MetaNivel;
  total: number;
  concluidas: number;
  progressoMedio: number;
  pesoTotal: number;
  atingimentoPonderado: number;
  metas: MetaCompleta[];
}

export function MetasConsolidacaoPanel({ metas }: MetasConsolidacaoPanelProps) {
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [isGenerating, setIsGenerating] = useState(false);
  const [resumoExecutivo, setResumoExecutivo] = useState<any>(null);

  const anos = useMemo(() => {
    const set = new Set(metas.map(m => m.ano));
    return Array.from(set).sort((a, b) => b - a);
  }, [metas]);

  const metasFiltradas = metas.filter(m => m.ano === parseInt(filtroAno));

  const consolidacao = useMemo((): ConsolidacaoNivel[] => {
    const niveis: MetaNivel[] = ["estrategica", "unidade", "setor", "individual"];
    return niveis.map(nivel => {
      const metasNivel = metasFiltradas.filter(m => m.nivel === nivel);
      const total = metasNivel.length;
      const concluidas = metasNivel.filter(m => m.status === "concluida").length;
      const progressoMedio = total > 0
        ? Math.round(metasNivel.reduce((a, m) => a + (m.progresso || 0), 0) / total)
        : 0;
      const pesoTotal = metasNivel.reduce((a, m) => a + (m.peso || 1), 0);
      const atingimentoPonderado = pesoTotal > 0
        ? Math.round(metasNivel.reduce((a, m) => a + (m.progresso || 0) * (m.peso || 1), 0) / pesoTotal)
        : 0;
      return { nivel, total, concluidas, progressoMedio, pesoTotal, atingimentoPonderado, metas: metasNivel };
    }).filter(c => c.total > 0);
  }, [metasFiltradas]);

  const totalGeral = metasFiltradas.length;
  const pesoGeralTotal = metasFiltradas.reduce((a, m) => a + (m.peso || 1), 0);
  const atingimentoGeral = pesoGeralTotal > 0
    ? Math.round(metasFiltradas.reduce((a, m) => a + (m.progresso || 0) * (m.peso || 1), 0) / pesoGeralTotal)
    : 0;

  const getConceito = (val: number) => {
    if (val >= 90) return { label: "Excelente", color: "bg-green-100 text-green-700" };
    if (val >= 70) return { label: "Bom", color: "bg-blue-100 text-blue-700" };
    if (val >= 50) return { label: "Regular", color: "bg-amber-100 text-amber-700" };
    return { label: "Insuficiente", color: "bg-red-100 text-red-700" };
  };

  const handleResumoIA = async () => {
    setIsGenerating(true);
    try {
      const resumoMetas = metasFiltradas.map(m => ({
        titulo: m.titulo, nivel: m.nivel, progresso: m.progresso,
        status: m.status, peso: m.peso, valor_atual: m.valor_atual, valor_alvo: m.valor_alvo,
      }));
      const { data, error } = await supabase.functions.invoke("ai-metas", {
        body: { acao: "resumo_executivo", meta: resumoMetas },
      });
      if (error) throw error;
      setResumoExecutivo(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const conceitoGeral = getConceito(atingimentoGeral);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Consolidação de Avaliação
        </h3>
        <div className="flex gap-2">
          <Select value={filtroAno} onValueChange={setFiltroAno}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {anos.map(a => <SelectItem key={a} value={a.toString()}>{a}</SelectItem>)}
              {anos.length === 0 && <SelectItem value={new Date().getFullYear().toString()}>{new Date().getFullYear()}</SelectItem>}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={handleResumoIA} disabled={isGenerating || metasFiltradas.length === 0} className="gap-1.5">
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Resumo Executivo IA
          </Button>
        </div>
      </div>

      {/* Resultado Geral */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-sm font-medium">Atingimento Geral Ponderado</span>
              <p className="text-xs text-muted-foreground">{totalGeral} metas · Peso total: {pesoGeralTotal.toFixed(1)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`${conceitoGeral.color} text-xs`}>{conceitoGeral.label}</Badge>
              <span className="text-2xl font-bold">{atingimentoGeral}%</span>
            </div>
          </div>
          <Progress value={atingimentoGeral} className="h-3" />
        </CardContent>
      </Card>

      {/* Por Nível */}
      <div className="grid md:grid-cols-2 gap-3">
        {consolidacao.map(c => {
          const conceito = getConceito(c.atingimentoPonderado);
          return (
            <Card key={c.nivel}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge className={`${NIVEL_CORES[c.nivel]} text-[10px]`}>
                    {NIVEL_LABELS[c.nivel]}
                  </Badge>
                  <Badge className={`${conceito.color} text-[10px]`}>{conceito.label}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{c.total} metas · {c.concluidas} concluídas</span>
                  <span className="font-bold">{c.atingimentoPonderado}%</span>
                </div>
                <Progress value={c.atingimentoPonderado} className="h-2" />
                <p className="text-[10px] text-muted-foreground">
                  Peso total: {c.pesoTotal.toFixed(1)} · Progresso simples: {c.progressoMedio}%
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Memória de Cálculo */}
      {consolidacao.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Memória de Cálculo
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <p className="text-muted-foreground mb-2">
              Atingimento Ponderado = Σ (Progresso × Peso) / Σ Peso
            </p>
            {metasFiltradas.slice(0, 10).map(m => (
              <div key={m.id} className="flex items-center justify-between py-1 border-b last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge className={`${NIVEL_CORES[m.nivel]} text-[8px]`}>{NIVEL_LABELS[m.nivel]}</Badge>
                  <span className="truncate">{m.titulo}</span>
                </div>
                <span className="shrink-0 text-muted-foreground">
                  {m.progresso}% × {m.peso || 1} = {((m.progresso || 0) * (m.peso || 1)).toFixed(0)}
                </span>
              </div>
            ))}
            {metasFiltradas.length > 10 && (
              <p className="text-muted-foreground text-center">...e mais {metasFiltradas.length - 10} metas</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resumo Executivo IA */}
      {resumoExecutivo && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" /> Resumo Executivo (IA)
            </h4>
            <p className="text-sm">{resumoExecutivo.resumo}</p>
            {resumoExecutivo.destaques_positivos?.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold mb-1 text-green-700">✅ Destaques Positivos</h5>
                <ul className="text-xs space-y-0.5">
                  {resumoExecutivo.destaques_positivos.map((d: string, i: number) => <li key={i}>• {d}</li>)}
                </ul>
              </div>
            )}
            {resumoExecutivo.pontos_atencao?.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold mb-1 text-amber-700">⚠️ Pontos de Atenção</h5>
                <ul className="text-xs space-y-0.5">
                  {resumoExecutivo.pontos_atencao.map((d: string, i: number) => <li key={i}>• {d}</li>)}
                </ul>
              </div>
            )}
            {resumoExecutivo.recomendacoes_prioritarias?.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold mb-1 text-blue-700">💡 Recomendações</h5>
                <ul className="text-xs space-y-0.5">
                  {resumoExecutivo.recomendacoes_prioritarias.map((d: string, i: number) => <li key={i}>• {d}</li>)}
                </ul>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Conteúdo gerado por IA — sujeito a revisão humana
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
