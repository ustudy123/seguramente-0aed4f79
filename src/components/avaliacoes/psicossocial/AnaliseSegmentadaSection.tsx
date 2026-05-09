import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Briefcase, ShieldCheck, Info, Lock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { CampanhaPsicossocial } from "@/types/psicossocial";

type Dimensao = "departamento" | "cargo" | "ghe";
const MIN_AMOSTRA = 5;

interface Props {
  campanhas: CampanhaPsicossocial[];
}

interface RespostaSeg {
  campanha_id: string;
  setor_snapshot: string | null;
  cargo_snapshot: string | null;
  ghe_nome_snapshot: string | null;
  indicadores: any;
}

interface Agregado {
  segmento: string;
  n: number;
  ips: number | null;
  irps: number | null;
  ibo: number | null;
  ibd: number | null;
  irec: number | null;
  icop: number | null;
}

const dimLabel: Record<Dimensao, string> = {
  departamento: "Departamento / Setor",
  cargo: "Cargo",
  ghe: "GHE",
};

const dimIcon: Record<Dimensao, any> = {
  departamento: Building2,
  cargo: Briefcase,
  ghe: ShieldCheck,
};

function avg(arr: number[]): number | null {
  const v = arr.filter((n) => typeof n === "number" && !isNaN(n));
  if (v.length === 0) return null;
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
}

function corScore(score: number | null, invertido = false): string {
  if (score == null) return "text-muted-foreground";
  const v = invertido ? 100 - score : score;
  if (v >= 80) return "text-emerald-600";
  if (v >= 65) return "text-blue-600";
  if (v >= 50) return "text-amber-600";
  return "text-red-600";
}

export function AnaliseSegmentadaSection({ campanhas }: Props) {
  const [dimensao, setDimensao] = useState<Dimensao>("departamento");
  const [respostas, setRespostas] = useState<RespostaSeg[]>([]);
  const [loading, setLoading] = useState(false);

  const campanhaIds = useMemo(() => campanhas.map((c) => c.id), [campanhas]);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      if (campanhaIds.length === 0) {
        setRespostas([]);
        return;
      }
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("questionario_psicossocial_respostas")
        .select("campanha_id, setor_snapshot, cargo_snapshot, ghe_nome_snapshot, indicadores")
        .in("campanha_id", campanhaIds);
      if (cancelado) return;
      if (error) {
        console.error("[AnaliseSegmentada]", error);
        setRespostas([]);
      } else {
        setRespostas((data as RespostaSeg[]) || []);
      }
      setLoading(false);
    }
    carregar();
    return () => {
      cancelado = true;
    };
  }, [campanhaIds]);

  const { agregados, semSegmento, total } = useMemo(() => {
    const groups = new Map<string, RespostaSeg[]>();
    let sem = 0;
    respostas.forEach((r) => {
      const key =
        dimensao === "departamento"
          ? r.setor_snapshot
          : dimensao === "cargo"
          ? r.cargo_snapshot
          : r.ghe_nome_snapshot;
      if (!key || !key.trim()) {
        sem++;
        return;
      }
      const k = key.trim();
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    });

    const agg: Agregado[] = Array.from(groups.entries())
      .map(([segmento, rows]) => {
        const ind = rows.map((r) => r.indicadores || {});
        const ipsArr = ind.map((i) => Number(i.IPS)).filter((n) => !isNaN(n));
        return {
          segmento,
          n: rows.length,
          ips: avg(ipsArr),
          irps: avg(ind.map((i) => Number(i.IRP_S)).filter((n) => !isNaN(n))),
          ibo: avg(ind.map((i) => Number(i.IBO_S)).filter((n) => !isNaN(n))),
          ibd: avg(ind.map((i) => Number(i.IBD_S)).filter((n) => !isNaN(n))),
          irec: avg(ind.map((i) => Number(i.IREC_S)).filter((n) => !isNaN(n))),
          icop: avg(ind.map((i) => Number(i.ICOP_S)).filter((n) => !isNaN(n))),
        };
      })
      .sort((a, b) => b.n - a.n);

    return { agregados: agg, semSegmento: sem, total: respostas.length };
  }, [respostas, dimensao]);

  const visiveis = agregados.filter((a) => a.n >= MIN_AMOSTRA);
  const ocultados = agregados.filter((a) => a.n < MIN_AMOSTRA);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card className="border-purple-100">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-600" />
                Análise por Segmento
              </CardTitle>
              <CardDescription>
                Cruzamento dos indicadores psicossociais por Departamento, Cargo ou GHE — anonimato preservado (mín. {MIN_AMOSTRA} respostas por segmento).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Segmentar por:</span>
              <Select value={dimensao} onValueChange={(v) => setDimensao(v as Dimensao)}>
                <SelectTrigger className="w-[200px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="departamento">Departamento / Setor</SelectItem>
                  <SelectItem value="cargo">Cargo</SelectItem>
                  <SelectItem value="ghe">GHE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : total === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>Nenhuma resposta nas campanhas selecionadas.</AlertDescription>
            </Alert>
          ) : (
            <>
              {semSegmento > 0 && (
                <Alert className="mb-4 bg-amber-50/50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-900">
                    <strong>{semSegmento}</strong> resposta(s) sem segmentação — recebidas via link público anônimo (sem convite individual).
                    Apenas respostas via convite com Cargo/Setor/GHE são cruzadas.
                  </AlertDescription>
                </Alert>
              )}

              {visiveis.length === 0 ? (
                <Alert className="bg-muted/30">
                  <Lock className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Nenhum segmento atingiu o mínimo de {MIN_AMOSTRA} respostas para análise (LGPD/anonimato).
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">{dimLabel[dimensao]}</th>
                        <th className="px-3 py-2 text-center font-semibold">N</th>
                        <th className="px-3 py-2 text-center font-semibold">IPS</th>
                        <th className="px-3 py-2 text-center font-semibold" title="Burnout">IBO</th>
                        <th className="px-3 py-2 text-center font-semibold" title="Boreout">IBD</th>
                        <th className="px-3 py-2 text-center font-semibold" title="Recursos">IREC</th>
                        <th className="px-3 py-2 text-center font-semibold" title="Coping">ICOP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.map((a, idx) => (
                        <tr key={a.segmento} className={cn("border-t", idx % 2 === 1 && "bg-muted/20")}>
                          <td className="px-3 py-2 font-medium">{a.segmento}</td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant="outline" className="text-[11px]">{a.n}</Badge>
                          </td>
                          <td className={cn("px-3 py-2 text-center font-bold", corScore(a.ips))}>
                            {a.ips ?? "—"}
                          </td>
                          <td className={cn("px-3 py-2 text-center font-bold", corScore(a.ibo, true))}>
                            {a.ibo ?? "—"}
                          </td>
                          <td className={cn("px-3 py-2 text-center font-bold", corScore(a.ibd, true))}>
                            {a.ibd ?? "—"}
                          </td>
                          <td className={cn("px-3 py-2 text-center font-bold", corScore(a.irec))}>
                            {a.irec ?? "—"}
                          </td>
                          <td className={cn("px-3 py-2 text-center font-bold", corScore(a.icop))}>
                            {a.icop ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {ocultados.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  <span>
                    {ocultados.length} segmento(s) ocultado(s) por amostra insuficiente (&lt;{MIN_AMOSTRA}):
                  </span>
                  {ocultados.map((o) => (
                    <Badge key={o.segmento} variant="secondary" className="text-[10px]">
                      {o.segmento} ({o.n})
                    </Badge>
                  ))}
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> ≥80 Saudável</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> 65–79 Estável</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> 50–64 Atenção</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> &lt;50 Crítico</div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
