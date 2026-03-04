import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { Shield, CheckCircle, AlertTriangle, XCircle, Settings } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const STATUS_CONFIG = {
  conforme: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", label: "Conforme" },
  atencao: { icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50", label: "Em Atenção" },
  nao_conforme: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "Não Conforme" },
};

export function JornadaConformidade() {
  const { tenantId } = useTenant();
  const [analises, setAnalises] = useState<any[]>([]);
  const [parametros, setParametros] = useState<any>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [formParams, setFormParams] = useState({
    jornada_diaria_max: "8",
    jornada_semanal_max: "44",
    horas_extras_diaria_max: "2",
    intervalo_intrajornada_min: "60",
    descanso_interjornada_min: "11",
    descanso_semanal_min: "24",
  });

  useEffect(() => {
    if (!tenantId) return;
    
    Promise.all([
      supabase.from("jornada_analises").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(500),
      supabase.from("jornada_parametros").select("*").eq("tenant_id", tenantId).eq("ativo", true).limit(1).maybeSingle(),
    ]).then(([{ data: anal }, { data: params }]) => {
      setAnalises(anal || []);
      if (params) {
        setParametros(params);
        setFormParams({
          jornada_diaria_max: String(params.jornada_diaria_max),
          jornada_semanal_max: String(params.jornada_semanal_max),
          horas_extras_diaria_max: String(params.horas_extras_diaria_max),
          intervalo_intrajornada_min: String(params.intervalo_intrajornada_min),
          descanso_interjornada_min: String(params.descanso_interjornada_min),
          descanso_semanal_min: String(params.descanso_semanal_min),
        });
      }
    });
  }, [tenantId]);

  const salvarParametros = async () => {
    if (!tenantId) return;
    const payload = {
      tenant_id: tenantId,
      nome: "Padrão CLT",
      jornada_diaria_max: parseFloat(formParams.jornada_diaria_max),
      jornada_semanal_max: parseFloat(formParams.jornada_semanal_max),
      horas_extras_diaria_max: parseFloat(formParams.horas_extras_diaria_max),
      intervalo_intrajornada_min: parseFloat(formParams.intervalo_intrajornada_min),
      descanso_interjornada_min: parseFloat(formParams.descanso_interjornada_min),
      descanso_semanal_min: parseFloat(formParams.descanso_semanal_min),
      ativo: true,
    };

    if (parametros?.id) {
      await supabase.from("jornada_parametros").update(payload).eq("id", parametros.id);
    } else {
      await supabase.from("jornada_parametros").insert(payload);
    }
    toast.success("Parâmetros salvos com sucesso");
    setShowConfig(false);
  };

  const conformeCount = analises.filter(a => a.status_conformidade === "conforme").length;
  const atencaoCount = analises.filter(a => a.status_conformidade === "atencao").length;
  const naoConformeCount = analises.filter(a => a.status_conformidade === "nao_conforme").length;

  const pieData = [
    { name: "Conforme", value: conformeCount, fill: "#22c55e" },
    { name: "Atenção", value: atencaoCount, fill: "#f59e0b" },
    { name: "Não Conforme", value: naoConformeCount, fill: "#ef4444" },
  ].filter(d => d.value > 0);

  const totalViolacoes = analises.reduce((s, a) => s + 
    Number(a.violacoes_intervalo || 0) + 
    Number(a.violacoes_interjornada || 0) + 
    Number(a.violacoes_jornada_diaria || 0) + 
    Number(a.violacoes_horas_extras || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" /> Conformidade Legal (CLT)
          </h3>
          <p className="text-sm text-muted-foreground">
            Avaliação automática de critérios legais da CLT
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)}>
          <Settings className="h-4 w-4 mr-1" /> Parâmetros
        </Button>
      </div>

      {showConfig && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Parâmetros de Conformidade</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Configure os limites conforme a CLT ou convenção coletiva aplicável.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { key: "jornada_diaria_max", label: "Jornada diária máx (h)" },
                { key: "jornada_semanal_max", label: "Jornada semanal máx (h)" },
                { key: "horas_extras_diaria_max", label: "HE diária máx (h)" },
                { key: "intervalo_intrajornada_min", label: "Intervalo intrajornada (min)" },
                { key: "descanso_interjornada_min", label: "Descanso interjornada (h)" },
                { key: "descanso_semanal_min", label: "Descanso semanal (h)" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number"
                    value={(formParams as any)[key]}
                    onChange={e => setFormParams(prev => ({ ...prev, [key]: e.target.value }))}
                    className="h-8 text-sm mt-1"
                  />
                </div>
              ))}
            </div>
            <Button onClick={salvarParametros} size="sm">Salvar Parâmetros</Button>
          </CardContent>
        </Card>
      )}

      {analises.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Execute a análise no Dashboard para gerar dados de conformidade.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["conforme", "atencao", "nao_conforme"] as const).map(status => {
              const config = STATUS_CONFIG[status];
              const Icon = config.icon;
              const count = status === "conforme" ? conformeCount : status === "atencao" ? atencaoCount : naoConformeCount;
              return (
                <Card key={status} className={config.bg}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <Icon className={`h-8 w-8 ${config.color}`} />
                    <div>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground">{config.label}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">Distribuição de Conformidade</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                      {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Detalhamento de Violações</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "Intervalo intrajornada", key: "violacoes_intervalo" },
                    { label: "Descanso interjornada (11h)", key: "violacoes_interjornada" },
                    { label: "Jornada diária excedida", key: "violacoes_jornada_diaria" },
                    { label: "Horas extras excedidas", key: "violacoes_horas_extras" },
                    { label: "Descanso semanal (DSR)", key: "violacoes_dsr" },
                  ].map(({ label, key }) => {
                    const total = analises.reduce((s, a) => s + Number(a[key] || 0), 0);
                    return (
                      <div key={key} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <span className="text-sm">{label}</span>
                        <Badge variant={total > 0 ? "destructive" : "outline"} className="text-xs">
                          {total} violações
                        </Badge>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between p-2 bg-muted rounded font-medium">
                    <span className="text-sm">Total de Violações</span>
                    <Badge variant={totalViolacoes > 0 ? "destructive" : "outline"}>{totalViolacoes}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
