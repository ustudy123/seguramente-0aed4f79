import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { Bell, CheckCircle, AlertTriangle, Clock, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const TIPO_LABELS: Record<string, string> = {
  excesso_horas_extras: "Excesso de Horas Extras",
  falta_intervalo: "Falta de Intervalo",
  descanso_insuficiente: "Descanso Insuficiente",
  ajustes_excessivos: "Ajustes Excessivos",
  atraso_recorrente: "Atraso Recorrente",
  jornada_excessiva: "Jornada Excessiva",
};

const SEVERIDADE_CONFIG: Record<string, { variant: any; color: string }> = {
  baixa: { variant: "outline", color: "text-blue-600" },
  media: { variant: "secondary", color: "text-yellow-600" },
  alta: { variant: "default", color: "text-orange-600" },
  critica: { variant: "destructive", color: "text-red-600" },
};

export function JornadaAlertas() {
  const { tenantId } = useTenant();
  const [alertas, setAlertas] = useState<any[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("pendentes");

  const fetchAlertas = async () => {
    if (!tenantId) return;
    let query = supabase
      .from("jornada_alertas")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200);
    
    if (filtroStatus === "pendentes") query = query.eq("resolvido", false);
    if (filtroStatus === "resolvidos") query = query.eq("resolvido", true);
    if (filtroTipo !== "todos") query = query.eq("tipo", filtroTipo);
    
    const { data } = await query;
    setAlertas(data || []);
  };

  useEffect(() => { fetchAlertas(); }, [tenantId, filtroTipo, filtroStatus]);

  const marcarResolvido = async (id: string) => {
    await supabase
      .from("jornada_alertas")
      .update({ resolvido: true, resolvido_em: new Date().toISOString() })
      .eq("id", id);
    toast.success("Alerta marcado como resolvido");
    fetchAlertas();
  };

  const pendentes = alertas.filter(a => !a.resolvido).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5" /> Alertas Inteligentes
          </h3>
          {pendentes > 0 && (
            <p className="text-sm text-muted-foreground">{pendentes} alerta(s) pendente(s)</p>
          )}
        </div>
        <div className="flex gap-2">
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="h-8 text-xs w-40">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {Object.entries(TIPO_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="h-8 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendentes">Pendentes</SelectItem>
              <SelectItem value="resolvidos">Resolvidos</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {alertas.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p>Nenhum alerta encontrado.</p>
            <p className="text-xs mt-1">Os alertas são gerados automaticamente ao executar a análise.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alertas.map(a => {
            const sevConfig = SEVERIDADE_CONFIG[a.severidade] || SEVERIDADE_CONFIG.media;
            return (
              <Card key={a.id} className={a.resolvido ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`h-5 w-5 mt-0.5 ${sevConfig.color}`} />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium">{a.titulo}</p>
                          <Badge variant={sevConfig.variant} className="text-[10px]">
                            {a.severidade}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {TIPO_LABELS[a.tipo] || a.tipo}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{a.descricao}</p>
                        {a.acao_sugerida && (
                          <p className="text-xs text-primary mt-1">
                            💡 {a.acao_sugerida}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-2">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {format(new Date(a.created_at), "dd/MM/yyyy HH:mm")}
                        </p>
                      </div>
                    </div>
                    {!a.resolvido && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => marcarResolvido(a.id)}
                        className="text-xs"
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Resolver
                      </Button>
                    )}
                    {a.resolvido && (
                      <Badge variant="outline" className="text-[10px] text-green-600">
                        ✓ Resolvido
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
