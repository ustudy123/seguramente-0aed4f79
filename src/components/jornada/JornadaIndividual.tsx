import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Search, Clock, AlertTriangle, TrendingUp, Shield } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const RISK_BADGE: Record<string, { variant: any; label: string }> = {
  baixo: { variant: "outline", label: "Risco Baixo" },
  moderado: { variant: "secondary", label: "Risco Moderado" },
  alto: { variant: "destructive", label: "Risco Alto" },
};

const CONFORMIDADE_BADGE: Record<string, { variant: any; label: string }> = {
  conforme: { variant: "outline", label: "Conforme" },
  atencao: { variant: "secondary", label: "Em Atenção" },
  nao_conforme: { variant: "destructive", label: "Não Conforme" },
};

export function JornadaIndividual() {
  const { tenantId } = useTenant();
  const [analises, setAnalises] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [pontoDiario, setPontoDiario] = useState<any[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("jornada_analises")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => setAnalises(data || []));
  }, [tenantId]);

  useEffect(() => {
    if (!selected || !tenantId) return;
    supabase
      .from("ponto_diario")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("colaborador_cpf", selected.colaborador_cpf)
      .gte("data", selected.periodo_inicio)
      .lte("data", selected.periodo_fim)
      .order("data", { ascending: true })
      .then(({ data }) => setPontoDiario(data || []));
  }, [selected, tenantId]);

  const filtered = analises.filter(a =>
    a.colaborador_nome?.toLowerCase().includes(search.toLowerCase()) ||
    a.colaborador_cpf?.includes(search)
  );

  // Unique collaborators (latest analysis each)
  const uniqueMap = new Map<string, any>();
  filtered.forEach(a => {
    if (!uniqueMap.has(a.colaborador_cpf)) uniqueMap.set(a.colaborador_cpf, a);
  });
  const uniqueList = Array.from(uniqueMap.values());

  const parseHours = (val: any) => {
    if (!val) return 0;
    const str = String(val);
    const m = str.match(/(\d+):(\d+)/);
    if (m) return parseInt(m[1]) + parseInt(m[2]) / 60;
    return parseFloat(str) || 0;
  };

  const chartData = pontoDiario.map(p => ({
    data: p.data?.slice(5),
    horas: parseHours(p.horas_trabalhadas),
    extras: parseHours(p.horas_extras),
  }));

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar colaborador por nome ou CPF..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="space-y-2 max-h-[600px] overflow-auto">
          {uniqueList.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma análise encontrada. Execute a análise no Dashboard primeiro.
            </p>
          )}
          {uniqueList.map(a => (
            <Card
              key={a.id}
              className={`cursor-pointer transition-all hover:border-primary/50 ${selected?.id === a.id ? "border-primary" : ""}`}
              onClick={() => setSelected(a)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{a.colaborador_nome}</p>
                    <p className="text-xs text-muted-foreground">{a.colaborador_cpf}</p>
                  </div>
                  <Badge {...RISK_BADGE[a.nivel_risco]} className="text-[10px]">
                    {RISK_BADGE[a.nivel_risco]?.label}
                  </Badge>
                </div>
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{Number(a.media_diaria_horas).toFixed(1)}h/dia</span>
                  <span>{Number(a.total_horas_extras).toFixed(0)}h extras</span>
                  <span>{a.total_atrasos} atrasos</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detail */}
        <div className="lg:col-span-2 space-y-4">
          {!selected ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                Selecione um colaborador para ver a análise individual
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{selected.colaborador_nome}</CardTitle>
                    <div className="flex gap-2">
                      <Badge {...RISK_BADGE[selected.nivel_risco]} className="text-[10px]">
                        {RISK_BADGE[selected.nivel_risco]?.label}
                      </Badge>
                      <Badge {...CONFORMIDADE_BADGE[selected.status_conformidade]} className="text-[10px]">
                        {CONFORMIDADE_BADGE[selected.status_conformidade]?.label}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Metric icon={Clock} label="Média diária" value={`${Number(selected.media_diaria_horas).toFixed(1)}h`} />
                    <Metric icon={TrendingUp} label="HE Total" value={`${Number(selected.total_horas_extras).toFixed(0)}h`} />
                    <Metric icon={AlertTriangle} label="Atrasos" value={selected.total_atrasos} />
                    <Metric icon={Shield} label="Violações" value={
                      Number(selected.violacoes_intervalo || 0) +
                      Number(selected.violacoes_interjornada || 0) +
                      Number(selected.violacoes_jornada_diaria || 0) +
                      Number(selected.violacoes_horas_extras || 0)
                    } />
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                    <div className="p-2 bg-muted/50 rounded">
                      <span className="text-muted-foreground">Violações intervalo:</span> {selected.violacoes_intervalo}
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <span className="text-muted-foreground">Violações interjornada:</span> {selected.violacoes_interjornada}
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <span className="text-muted-foreground">Jornada excedida:</span> {selected.violacoes_jornada_diaria}
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <span className="text-muted-foreground">HE excedida:</span> {selected.violacoes_horas_extras}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Jornada Diária</CardTitle></CardHeader>
                <CardContent>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="horas" name="Horas" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="extras" name="Extras" fill="hsl(var(--destructive))" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Sem dados de ponto para o período</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="text-center p-3 bg-muted/50 rounded-lg">
      <Icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
