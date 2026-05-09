import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, Sparkles, Loader2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
    </div>
  );
}
