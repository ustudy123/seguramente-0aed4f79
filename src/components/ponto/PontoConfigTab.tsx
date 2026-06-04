import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Settings, Monitor, Link2, Globe2, Camera, MapPin, Save, Loader2, Info, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { ConfigJustificativasModal } from "./ConfigJustificativasModal";

interface PontoConfig {
  id: string;
  modo_registro: string;
  exigir_selfie_link: boolean;
  exigir_selfie_interno: boolean;
  exigir_localizacao: boolean;
  tolerancia_atraso: number;
  tolerancia_hora_extra: number;
  permitir_registro_fora_horario: boolean;
  bloquear_dispositivo_nao_autorizado: boolean;
}

export function PontoConfigTab() {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showJustificativasModal, setShowJustificativasModal] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["ponto-config", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("ponto_configuracao" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data as any as PontoConfig | null;
    },
    enabled: !!tenantId,
  });

  const [form, setForm] = useState({
    modo_registro: "ambos",
    exigir_selfie_link: true,
    exigir_selfie_interno: false,
    exigir_localizacao: true,
    tolerancia_atraso: 10,
    tolerancia_hora_extra: 10,
    permitir_registro_fora_horario: false,
    bloquear_dispositivo_nao_autorizado: false,
  });

  useEffect(() => {
    if (config) {
      setForm({
        modo_registro: config.modo_registro || "ambos",
        exigir_selfie_link: config.exigir_selfie_link ?? true,
        exigir_selfie_interno: config.exigir_selfie_interno ?? false,
        exigir_localizacao: config.exigir_localizacao ?? true,
        tolerancia_atraso: config.tolerancia_atraso ?? 10,
        tolerancia_hora_extra: config.tolerancia_hora_extra ?? 10,
        permitir_registro_fora_horario: config.permitir_registro_fora_horario ?? false,
        bloquear_dispositivo_nao_autorizado: config.bloquear_dispositivo_nao_autorizado ?? false,
      });
    }
  }, [config]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      if (config?.id) {
        const { error } = await supabase
          .from("ponto_configuracao" as any)
          .update(form as any)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ponto_configuracao" as any)
          .insert({ ...form, tenant_id: tenantId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-config"] });
      toast({ title: "Configurações salvas com sucesso!" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const MODOS = [
    {
      value: "interno",
      label: "Somente Interno (REP-C)",
      desc: "Registro apenas pelo painel do gestor/RH. Ideal para operações presenciais com relógio de ponto fixo.",
      icon: <Monitor className="w-5 h-5" />,
    },
    {
      value: "link_externo",
      label: "Somente Link Externo (REP-P)",
      desc: "Cada colaborador registra pelo próprio celular via link único. Ideal para equipes de campo e home office.",
      icon: <Link2 className="w-5 h-5" />,
    },
    {
      value: "ambos",
      label: "Ambos (Recomendado)",
      desc: "Permite registro interno pelo gestor e via link individual pelo colaborador. Máxima flexibilidade operacional.",
      icon: <Globe2 className="w-5 h-5" />,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Modo de Registro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="w-5 h-5 text-primary" /> Modo de Registro
          </CardTitle>
          <CardDescription>
            Defina como os colaboradores poderão registrar ponto. Conforme Portaria 671/2021.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={form.modo_registro}
            onValueChange={(v) => setForm((f) => ({ ...f, modo_registro: v }))}
            className="space-y-3"
          >
            {MODOS.map((modo) => (
              <label
                key={modo.value}
                className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  form.modo_registro === modo.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <RadioGroupItem value={modo.value} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {modo.icon}
                    <span className="font-medium text-sm">{modo.label}</span>
                    {modo.value === "ambos" && (
                      <Badge variant="secondary" className="text-[10px]">Recomendado</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{modo.desc}</p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Verificação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="w-5 h-5 text-primary" /> Verificação e Segurança
          </CardTitle>
          <CardDescription>Configure selfie e geolocalização para prevenir fraudes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(form.modo_registro === "link_externo" || form.modo_registro === "ambos") && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">Selfie obrigatória (Link Externo)</Label>
                  <p className="text-xs text-muted-foreground">Colaborador deve tirar selfie ao registrar via link</p>
                </div>
              </div>
              <Switch
                checked={form.exigir_selfie_link}
                onCheckedChange={(v) => setForm((f) => ({ ...f, exigir_selfie_link: v }))}
              />
            </div>
          )}

          {(form.modo_registro === "interno" || form.modo_registro === "ambos") && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-muted-foreground" />
                <div>
                  <Label className="text-sm font-medium">Selfie obrigatória (Painel Interno)</Label>
                  <p className="text-xs text-muted-foreground">Exigir selfie no registro feito pelo gestor/RH</p>
                </div>
              </div>
              <Switch
                checked={form.exigir_selfie_interno}
                onCheckedChange={(v) => setForm((f) => ({ ...f, exigir_selfie_interno: v }))}
              />
            </div>
          )}

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Geolocalização obrigatória</Label>
                <p className="text-xs text-muted-foreground">Capturar localização em todos os registros</p>
              </div>
            </div>
            <Switch
              checked={form.exigir_localizacao}
              onCheckedChange={(v) => setForm((f) => ({ ...f, exigir_localizacao: v }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tolerâncias */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="w-5 h-5 text-primary" /> Tolerâncias (CLT Art. 58)
          </CardTitle>
          <CardDescription>Variações de até 5 min (entrada/saída) e 10 min diários não são descontadas nem pagas como extra.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm">Tolerância atraso (min)</Label>
              <input
                type="number"
                min={0}
                max={30}
                value={form.tolerancia_atraso}
                onChange={(e) => setForm((f) => ({ ...f, tolerancia_atraso: Number(e.target.value) }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Tolerância hora extra (min)</Label>
              <input
                type="number"
                min={0}
                max={30}
                value={form.tolerancia_hora_extra}
                onChange={(e) => setForm((f) => ({ ...f, tolerancia_hora_extra: Number(e.target.value) }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <Label className="text-sm font-medium">Permitir registro fora do horário</Label>
              <p className="text-xs text-muted-foreground">Permitir marcação fora da janela de tolerância</p>
            </div>
            <Switch
              checked={form.permitir_registro_fora_horario}
              onCheckedChange={(v) => setForm((f) => ({ ...f, permitir_registro_fora_horario: v }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Justificativas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-5 h-5 text-primary" /> Justificativas e Abonos
          </CardTitle>
          <CardDescription>Gerencie os motivos que os colaboradores podem usar para justificar ausências ou ajustes.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            variant="outline" 
            className="w-full sm:w-auto gap-2"
            onClick={() => setShowJustificativasModal(true)}
          >
            <FileText className="w-4 h-4" />
            Configurar Justificativas
          </Button>
        </CardContent>
      </Card>

      <ConfigJustificativasModal 
        open={showJustificativasModal} 
        onOpenChange={setShowJustificativasModal} 
      />

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending} className="min-w-[160px]">
          {salvar.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Configurações
        </Button>
      </div>
    </motion.div>
  );
}
