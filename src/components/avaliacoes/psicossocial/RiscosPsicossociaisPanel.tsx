import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, Sparkles, Loader2, Lock, BookOpen, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

interface RiscoPsicossocial {
  id: string;
  tenant_id: string;
  nome: string;
  descricao: string | null;
  padrao: boolean;
  ativo: boolean;
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

export function RiscosPsicossociaisPanel() {
  const { tenantId } = useTenant();
  const qc = useQueryClient();

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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Fatores de Riscos Psicossociais
        </h2>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" />
          Catálogo padrão do sistema — {total} fatores (somente leitura)
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
              {riscos.map((r) => (
                <motion.div
                  key={r.id}
                  whileHover={{ y: -2 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Card className="h-full">
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
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
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
      </Tabs>
    </div>
  );
}
