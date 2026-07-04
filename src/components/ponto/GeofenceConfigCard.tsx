import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Save, Loader2, LocateFixed, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useToast } from "@/hooks/use-toast";

interface GeofenceRow {
  id: string;
  latitude: number | null;
  longitude: number | null;
  raio_geofence_metros: number | null;
  geofence_ativo: boolean | null;
}

export function GeofenceConfigCard() {
  const { empresaAtivaId, empresaAtiva } = useEmpresaAtiva();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { capturarLocalizacao, loading: geoLoading } = useGeolocation();

  const { data, isLoading } = useQuery({
    queryKey: ["empresa-geofence", empresaAtivaId],
    queryFn: async (): Promise<GeofenceRow | null> => {
      if (!empresaAtivaId) return null;
      const { data, error } = await fromTable("empresa_cadastro")
        .select("id,latitude,longitude,raio_geofence_metros,geofence_ativo")
        .eq("id", empresaAtivaId)
        .maybeSingle();
      if (error) throw error;
      return data as GeofenceRow | null;
    },
    enabled: !!empresaAtivaId,
  });

  const [form, setForm] = useState({
    latitude: "",
    longitude: "",
    raio_geofence_metros: 150,
    geofence_ativo: false,
  });

  useEffect(() => {
    if (data) {
      setForm({
        latitude: data.latitude != null ? String(data.latitude) : "",
        longitude: data.longitude != null ? String(data.longitude) : "",
        raio_geofence_metros: data.raio_geofence_metros ?? 150,
        geofence_ativo: data.geofence_ativo ?? false,
      });
    }
  }, [data]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!empresaAtivaId) throw new Error("Selecione uma empresa ativa");
      const lat = form.latitude.trim() === "" ? null : Number(form.latitude);
      const lon = form.longitude.trim() === "" ? null : Number(form.longitude);
      if (form.geofence_ativo && (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon))) {
        throw new Error("Informe latitude e longitude para ativar a cerca");
      }
      const raio = Math.min(5000, Math.max(30, Number(form.raio_geofence_metros) || 150));
      const { error } = await fromTable("empresa_cadastro")
        .update({
          latitude: lat,
          longitude: lon,
          raio_geofence_metros: raio,
          geofence_ativo: form.geofence_ativo,
        })
        .eq("id", empresaAtivaId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresa-geofence"] });
      toast({ title: "Cerca de geolocalização salva" });
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const usarLocalAtual = async () => {
    const pos = await capturarLocalizacao();
    if (pos) {
      setForm((f) => ({ ...f, latitude: pos.latitude.toFixed(7), longitude: pos.longitude.toFixed(7) }));
      toast({ title: "Localização capturada", description: pos.endereco || `${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}` });
    }
  };

  if (!empresaAtivaId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="w-5 h-5 text-primary" /> Cerca de Geolocalização (Geofence)
        </CardTitle>
        <CardDescription>
          Define o ponto de referência do local de trabalho e o raio permitido para batidas. Batidas fora do raio
          <strong> não são bloqueadas</strong> — ficam sinalizadas apenas para gestores como evidência de auditoria.
          Configuração da empresa: <strong>{empresaAtiva?.razao_social || "—"}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <Label className="text-sm font-medium">Ativar cerca de geolocalização</Label>
                <p className="text-xs text-muted-foreground">
                  Quando ativa, cada batida é comparada com o ponto de referência abaixo.
                </p>
              </div>
              <Switch
                checked={form.geofence_ativo}
                onCheckedChange={(v) => setForm((f) => ({ ...f, geofence_ativo: v }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Latitude</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="-23.5505"
                  value={form.latitude}
                  onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Longitude</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="-46.6333"
                  value={form.longitude}
                  onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                />
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={usarLocalAtual}
              disabled={geoLoading}
              className="gap-2"
            >
              {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
              Usar minha localização atual
            </Button>

            <div className="space-y-1">
              <Label className="text-sm">Raio permitido (metros)</Label>
              <Input
                type="number"
                min={30}
                max={5000}
                step={10}
                value={form.raio_geofence_metros}
                onChange={(e) => setForm((f) => ({ ...f, raio_geofence_metros: Number(e.target.value) }))}
                className="max-w-[200px]"
              />
              <p className="text-[11px] text-muted-foreground">Padrão 150m. Ajuste conforme o tamanho da unidade (mín. 30m, máx. 5000m).</p>
            </div>

            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription className="text-xs">
                A cerca é <strong>informativa</strong>. Se um colaborador bater fora do raio, a marcação será aceita,
                mas aparecerá com o selo <span className="font-semibold text-amber-700">⚠ Fora</span> no espelho do gestor —
                útil para investigação e composição de contraprova documental.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end">
              <Button onClick={() => salvar.mutate()} disabled={salvar.isPending} className="gap-2">
                {salvar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar cerca
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
