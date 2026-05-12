import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, Sparkles, Loader2, Lock, BookOpen, Layers, BarChart3, Inbox, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { usePsicossocial } from "@/hooks/usePsicossocial";
import { SEVERIDADE_ESCALA, getSeveridadeInfo } from "@/lib/psicossocial-severidade";

interface RiscoPsicossocial {
  id: string;
  tenant_id: string;
  nome: string;
  descricao: string | null;
  padrao: boolean;
  ativo: boolean;
  severidade: number | null;
  created_at: string;
}

interface InstrumentoMap {
  id: string;
  risco_nome: string;
  instrumento: string;
  dimensao: string;
  descricao: string | null;
}

const INSTRUMENTOS: { key: string; label: string; color: string }[] = [
  { key: "SIPRO", label: "SIPRO", color: "bg-primary/10 text-primary border-primary/30" },
  { key: "COPSOQ_III", label: "COPSOQ III", color: "bg-sky-500/10 text-sky-700 border-sky-500/30" },
  { key: "JCQ", label: "JCQ (Karasek)", color: "bg-violet-500/10 text-violet-700 border-violet-500/30" },
  { key: "ERI", label: "ERI (Siegrist)", color: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  { key: "HSE_MS", label: "HSE-MS", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
];

const instrLabel = (k: string) => INSTRUMENTOS.find((i) => i.key === k)?.label || k;
const instrColor = (k: string) => INSTRUMENTOS.find((i) => i.key === k)?.color || "bg-muted text-muted-foreground";

// Normaliza string para matching (remove acentos, símbolos, lowercase)
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Score 0-100: < 30 baixo (verde), 30-50 moderado (amarelo), 50-70 alto (laranja), > 70 crítico (vermelho)
const scoreColor = (v: number): string => {
  if (v < 30) return "text-emerald-600";
  if (v < 50) return "text-amber-600";
  if (v < 70) return "text-orange-600";
  return "text-rose-600";
};
const scoreBar = (v: number): string => {
  if (v < 30) return "[&>div]:bg-emerald-500";
  if (v < 50) return "[&>div]:bg-amber-500";
  if (v < 70) return "[&>div]:bg-orange-500";
  return "[&>div]:bg-rose-500";
};

export function RiscosPsicossociaisPanel() {
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const { campanhas, isLoadingCampanhas } = usePsicossocial();
  const [campanhaId, setCampanhaId] = useState<string | undefined>();
  const [riscoDetalhe, setRiscoDetalhe] = useState<RiscoPsicossocial | null>(null);

  const { data: riscos = [], isLoading } = useQuery({
    queryKey: ["psicossocial_riscos", tenantId],
    queryFn: async () => {
      const { data, error } = await fromTable("psicossocial_riscos")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("padrao", true)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data || []) as RiscoPsicossocial[];
    },
    enabled: !!tenantId,
  });

  const { data: mapeamentos = [] } = useQuery({
    queryKey: ["psicossocial_instrumento_dimensao"],
    queryFn: async () => {
      const { data, error } = await fromTable("psicossocial_instrumento_dimensao")
        .select("*")
        .order("risco_nome");
      if (error) throw error;
      return (data || []) as InstrumentoMap[];
    },
  });

  // Semeia os 13 riscos padrão na primeira visita.
  useEffect(() => {
    if (!tenantId || isLoading) return;
    if (riscos.length === 0) {
      (async () => {
        const { error } = await (supabase as any).rpc(
          "seed_psicossocial_riscos_padrao",
          { _tenant_id: tenantId },
        );
        if (!error) qc.invalidateQueries({ queryKey: ["psicossocial_riscos", tenantId] });
      })();
    }
  }, [tenantId, isLoading, riscos.length, qc]);

  const total = useMemo(() => riscos.length, [riscos]);

  const mapsPorRisco = useMemo(() => {
    const map: Record<string, InstrumentoMap[]> = {};
    mapeamentos.forEach((m) => {
      (map[m.risco_nome] ||= []).push(m);
    });
    return map;
  }, [mapeamentos]);

  // Campanhas com resultados (radar_data preenchido)
  const campanhasComResultado = useMemo(
    () => campanhas.filter((c) => Array.isArray(c.radar_data) && c.radar_data.length > 0),
    [campanhas],
  );

  // Pré-seleciona a campanha mais recente assim que estiverem disponíveis
  useEffect(() => {
    if (campanhaId || campanhasComResultado.length === 0) return;
    const maisRecente = [...campanhasComResultado].sort((a, b) => {
      const da = new Date((a as any).created_at ?? (a as any).data_inicio ?? 0).getTime();
      const db = new Date((b as any).created_at ?? (b as any).data_inicio ?? 0).getTime();
      return db - da;
    })[0];
    if (maisRecente) setCampanhaId(maisRecente.id);
  }, [campanhasComResultado, campanhaId]);

  const isConsolidado = campanhaId === "__all__";

  const campanhaSel = useMemo(
    () => (isConsolidado ? null : campanhasComResultado.find((c) => c.id === campanhaId)),
    [campanhasComResultado, campanhaId, isConsolidado],
  );

  // Consolidado: média das respostas de TODAS as campanhas com resultado, agrupado por subject
  const radarConsolidado = useMemo(() => {
    if (!isConsolidado) return [] as { subject: string; value: number }[];
    const acc: Record<string, { sum: number; n: number }> = {};
    campanhasComResultado.forEach((c) => {
      const radar = (c.radar_data || []) as { subject: string; value: number }[];
      radar.forEach((rd) => {
        if (!acc[rd.subject]) acc[rd.subject] = { sum: 0, n: 0 };
        acc[rd.subject].sum += rd.value;
        acc[rd.subject].n += 1;
      });
    });
    return Object.entries(acc).map(([subject, { sum, n }]) => ({ subject, value: sum / n }));
  }, [isConsolidado, campanhasComResultado]);

  const consolidadoMeta = useMemo(() => {
    if (!isConsolidado) return null;
    const totalRespostas = campanhasComResultado.reduce((s, c) => s + (c.total_respostas ?? 0), 0);
    const ipsList = campanhasComResultado.map((c) => c.ips_score).filter((v): v is number => v != null);
    const ipsMedio = ipsList.length > 0 ? ipsList.reduce((s, v) => s + v, 0) / ipsList.length : null;
    return { totalCampanhas: campanhasComResultado.length, totalRespostas, ipsMedio };
  }, [isConsolidado, campanhasComResultado]);

  // Para cada risco, casa as dimensões mapeadas com os subjects do radar (substring/normalize)
  const resultadosPorRisco = useMemo(() => {
    const radar = isConsolidado
      ? radarConsolidado
      : campanhaSel
      ? ((campanhaSel.radar_data || []) as { subject: string; value: number }[])
      : null;
    if (!radar) return {} as Record<string, { subject: string; value: number; instrumento: string }[]>;
    const out: Record<string, { subject: string; value: number; instrumento: string }[]> = {};
    riscos.forEach((r) => {
      const maps = mapsPorRisco[r.nome] || [];
      const matches: { subject: string; value: number; instrumento: string }[] = [];
      radar.forEach((rd) => {
        const subj = norm(rd.subject);
        const m = maps.find((mp) => {
          const dim = norm(mp.dimensao);
          // tokens de pelo menos 4 chars devem aparecer
          const tokens = dim.split(" ").filter((t) => t.length >= 4);
          if (tokens.length === 0) return subj.includes(dim) || dim.includes(subj);
          return tokens.some((t) => subj.includes(t));
        });
        if (m) matches.push({ subject: rd.subject, value: rd.value, instrumento: m.instrumento });
      });
      if (matches.length > 0) out[r.nome] = matches;
    });
    return out;
  }, [campanhaSel, isConsolidado, radarConsolidado, riscos, mapsPorRisco]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Riscos Psicossociais
        </h2>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" />
          Catálogo padrão do sistema — {total} riscos (somente leitura). Clique em um risco para ver a severidade.
        </p>
      </div>

      <Tabs defaultValue="catalogo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalogo" className="gap-1.5">
            <Layers className="h-4 w-4" /> Catálogo
          </TabsTrigger>
          <TabsTrigger value="instrumentos" className="gap-1.5">
            <BookOpen className="h-4 w-4" /> Instrumentos
          </TabsTrigger>
          <TabsTrigger value="resultados" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Resultados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo" className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
            </div>
          ) : riscos.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Os 13 riscos padrão serão criados automaticamente.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {riscos.map((r) => {
                const sev = getSeveridadeInfo(r.severidade);
                return (
                  <motion.div
                    key={r.id}
                    whileHover={{ y: -2 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <Card
                      className="h-full cursor-pointer hover:border-primary/40 transition-colors"
                      onClick={() => setRiscoDetalhe(r)}
                    >
                      <CardContent className="p-4 flex flex-col gap-2 h-full">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm leading-snug">{r.nome}</p>
                            {r.descricao && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                                {r.descricao}
                              </p>
                            )}
                          </div>
                          <Badge variant="secondary" className="gap-1 shrink-0">
                            <Sparkles className="h-3 w-3" /> Padrão
                          </Badge>
                        </div>
                        {sev && (
                          <div className="flex items-center justify-between gap-2 pt-2 mt-auto border-t">
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <ShieldAlert className="h-3 w-3" /> Severidade
                            </span>
                            <Badge variant="outline" className={`text-[10px] ${sev.badgeClass}`}>
                              {sev.valor} · {sev.label}
                            </Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="instrumentos" className="space-y-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                Cada fator psicossocial mapeia para uma ou mais dimensões dos instrumentos validados internacionalmente. Use esta referência para
                cruzar respostas vindas de questionários externos (COPSOQ III, JCQ, ERI, HSE-MS) com o catálogo padrão NR-01 / ISO 45003.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {INSTRUMENTOS.map((i) => (
                  <Badge key={i.key} variant="outline" className={`text-[10px] ${i.color}`}>
                    {i.label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {riscos.map((r) => {
              const maps = mapsPorRisco[r.nome] || [];
              return (
                <motion.div
                  key={r.id}
                  whileHover={{ y: -2 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Card className="h-full">
                    <CardContent className="p-4 flex flex-col gap-3 h-full">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm leading-snug flex-1">{r.nome}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {maps.length} {maps.length === 1 ? "dimensão" : "dimensões"}
                        </Badge>
                      </div>
                      {maps.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Sem mapeamento cadastrado.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {maps.map((m) => (
                            <li key={m.id} className="flex items-start gap-2 text-xs">
                              <Badge
                                variant="outline"
                                className={`text-[9px] shrink-0 ${instrColor(m.instrumento)}`}
                              >
                                {instrLabel(m.instrumento)}
                              </Badge>
                              <div className="flex-1">
                                <p className="font-medium leading-snug">{m.dimensao}</p>
                                {m.descricao && (
                                  <p className="text-muted-foreground text-[11px]">{m.descricao}</p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="resultados" className="space-y-3">
          <Card>
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">Selecione uma campanha</p>
                <p className="text-xs text-muted-foreground">
                  Cruzamento dos resultados da campanha com cada Fator de Risco Psicossocial.
                </p>
              </div>
              <Select value={campanhaId} onValueChange={setCampanhaId}>
                <SelectTrigger className="w-full sm:w-[340px]">
                  <SelectValue placeholder="Escolha uma campanha com resultados…" />
                </SelectTrigger>
                <SelectContent>
                  {campanhasComResultado.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">
                      Nenhuma campanha com resultados disponíveis.
                    </div>
                  ) : (
                    <>
                      <SelectItem value="__all__">
                        Todas as campanhas (consolidado)
                        <span className="ml-2 text-xs text-muted-foreground">
                          · {campanhasComResultado.length}{" "}
                          {campanhasComResultado.length === 1 ? "campanha" : "campanhas"}
                        </span>
                      </SelectItem>
                      {campanhasComResultado.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                          {c.ips_score != null && (
                            <span className="ml-2 text-xs text-muted-foreground">· IPS {Math.round(c.ips_score)}</span>
                          )}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {isLoadingCampanhas ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando campanhas…
            </div>
          ) : !campanhaSel && !isConsolidado ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <Inbox className="h-8 w-8 opacity-40" />
                Selecione uma campanha acima ou escolha "Todas as campanhas (consolidado)" para visualizar o cruzamento.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/20">
                <CardContent className="p-4 flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-xs text-muted-foreground">
                      {isConsolidado ? "Visão" : "Campanha"}
                    </p>
                    <p className="font-semibold text-sm">
                      {isConsolidado
                        ? `Consolidado · ${consolidadoMeta?.totalCampanhas ?? 0} ${
                            (consolidadoMeta?.totalCampanhas ?? 0) === 1 ? "campanha" : "campanhas"
                          }`
                        : campanhaSel!.nome}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Respostas</p>
                    <p className="font-semibold text-sm">
                      {isConsolidado
                        ? consolidadoMeta?.totalRespostas ?? 0
                        : campanhaSel!.total_respostas ?? 0}
                    </p>
                  </div>
                  {isConsolidado ? (
                    consolidadoMeta?.ipsMedio != null && (
                      <div>
                        <p className="text-xs text-muted-foreground">IPS médio</p>
                        <p className={`font-bold text-lg ${scoreColor(consolidadoMeta.ipsMedio)}`}>
                          {Math.round(consolidadoMeta.ipsMedio)}
                        </p>
                      </div>
                    )
                  ) : (
                    <>
                      {campanhaSel!.ips_score != null && (
                        <div>
                          <p className="text-xs text-muted-foreground">IPS</p>
                          <p className={`font-bold text-lg ${scoreColor(campanhaSel!.ips_score)}`}>
                            {Math.round(campanhaSel!.ips_score)}
                          </p>
                        </div>
                      )}
                      {campanhaSel!.ips_classificacao && (
                        <Badge variant="outline" className="capitalize">
                          {campanhaSel!.ips_classificacao}
                        </Badge>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {riscos.map((r) => {
                  const matches = resultadosPorRisco[r.nome] || [];
                  const avg =
                    matches.length > 0
                      ? matches.reduce((acc, m) => acc + m.value, 0) / matches.length
                      : null;
                  return (
                    <motion.div
                      key={r.id}
                      whileHover={{ y: -2 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <Card className={`h-full ${matches.length === 0 ? "opacity-60" : ""}`}>
                        <CardContent className="p-4 flex flex-col gap-3 h-full">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-sm leading-snug flex-1">{r.nome}</p>
                            {avg != null ? (
                              <Badge variant="outline" className={`shrink-0 ${scoreColor(avg)}`}>
                                {Math.round(avg)}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] shrink-0 text-muted-foreground">
                                sem dado
                              </Badge>
                            )}
                          </div>

                          {matches.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">
                              Esta campanha não cobre dimensões mapeadas para este fator.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {matches.map((m, i) => (
                                <div key={i} className="space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <Badge
                                        variant="outline"
                                        className={`text-[9px] shrink-0 ${instrColor(m.instrumento)}`}
                                      >
                                        {instrLabel(m.instrumento)}
                                      </Badge>
                                      <p className="text-xs truncate">{m.subject}</p>
                                    </div>
                                    <span className={`text-xs font-bold ${scoreColor(m.value)}`}>
                                      {Math.round(m.value)}
                                    </span>
                                  </div>
                                  <Progress value={m.value} className={`h-1.5 ${scoreBar(m.value)}`} />
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!riscoDetalhe} onOpenChange={(o) => !o && setRiscoDetalhe(null)}>
        <DialogContent className="max-w-2xl">
          {riscoDetalhe && (() => {
            const sev = getSeveridadeInfo(riscoDetalhe.severidade);
            const maps = mapsPorRisco[riscoDetalhe.nome] || [];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-amber-600" />
                    {riscoDetalhe.nome}
                  </DialogTitle>
                  {riscoDetalhe.descricao && (
                    <DialogDescription>{riscoDetalhe.descricao}</DialogDescription>
                  )}
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Severidade atribuída</p>
                    {sev ? (
                      <div className={`rounded-lg border p-4 ${sev.badgeClass}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold">{sev.label}</span>
                          <Badge variant="outline" className={sev.badgeClass}>
                            Nível {sev.valor} de 5
                          </Badge>
                        </div>
                        <p className="text-xs">{sev.exemplo}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Severidade não definida.</p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Escala de severidade (referência)</p>
                    <div className="space-y-1.5">
                      {SEVERIDADE_ESCALA.map((s) => (
                        <div
                          key={s.valor}
                          className={`flex items-start gap-3 p-2 rounded-md border text-xs ${
                            sev?.valor === s.valor ? s.badgeClass + " font-medium" : "bg-muted/30"
                          }`}
                        >
                          <span className={`shrink-0 w-6 h-6 rounded-full ${s.bgClass} text-white flex items-center justify-center text-[11px] font-bold`}>
                            {s.valor}
                          </span>
                          <div className="flex-1">
                            <p className="font-semibold">{s.label}</p>
                            <p className="text-muted-foreground">{s.exemplo}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {maps.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                        Dimensões mapeadas em instrumentos ({maps.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {maps.map((m) => (
                          <Badge key={m.id} variant="outline" className={`text-[10px] ${instrColor(m.instrumento)}`}>
                            {instrLabel(m.instrumento)} · {m.dimensao}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground border-t pt-3">
                    A severidade compõe a matriz de riscos junto com a probabilidade (calculada a partir do
                    cruzamento das respostas dos instrumentos com este risco).
                  </p>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
