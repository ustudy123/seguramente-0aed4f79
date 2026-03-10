import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AlertTriangle, Siren, ExternalLink, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface AlertaPsicossocial {
  id: string;
  campanha_id: string;
  dimensao_id: string;
  dimensao_nome: string;
  score_risco: number;
  score_ips: number;
  classificacao: string;
  acao_id: string | null;
  resolvido: boolean;
  created_at: string;
}

export function AlertasPsicossociaisPanel() {
  const { tenantId } = useAuth();
  const navigate = useNavigate();

  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ['psicossocial-alertas', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('psicossocial_alertas')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('resolvido', false)
        .order('score_risco', { ascending: false });
      if (error) throw error;
      return (data || []) as AlertaPsicossocial[];
    },
    enabled: !!tenantId,
  });

  if (isLoading || alertas.length === 0) return null;

  const criticos = alertas.filter(a => a.classificacao === 'critico');
  const elevados = alertas.filter(a => a.classificacao === 'elevado');

  return (
    <Card className={cn(
      "border-2",
      criticos.length > 0 ? "border-destructive/60 bg-destructive/5" : "border-orange-500/40 bg-orange-500/5"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {criticos.length > 0 ? (
            <Siren className="h-5 w-5 text-destructive animate-pulse" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-orange-500" />
          )}
          Alertas Psicossociais Ativos
          <Badge variant="destructive" className="ml-auto">
            {alertas.length} {alertas.length === 1 ? 'alerta' : 'alertas'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {criticos.length > 0 && (
          <div className="space-y-1.5">
            {criticos.map(alerta => (
              <div key={alerta.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">🚨</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-destructive truncate">
                      {alerta.dimensao_nome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Risco {alerta.score_risco}/100 — Ação obrigatória NR-01
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className="bg-destructive text-destructive-foreground text-xs">Crítico</Badge>
                  {alerta.acao_id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={() => navigate('/plano-acao')}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ver ação
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {elevados.length > 0 && (
          <div className="space-y-1.5">
            {elevados.map(alerta => (
              <div key={alerta.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/30">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">⚠️</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-orange-600 truncate">
                      {alerta.dimensao_nome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Risco {alerta.score_risco}/100 — Monitoramento recomendado
                    </p>
                  </div>
                </div>
                <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30 text-xs shrink-0">
                  Elevado
                </Badge>
              </div>
            ))}
          </div>
        )}

        {criticos.length > 0 && (
          <p className="text-xs text-destructive/80 pt-1">
            ⚖️ Eixos críticos geram ações obrigatórias automaticamente no Plano de Ação (NR-01 / ISO 45003).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
