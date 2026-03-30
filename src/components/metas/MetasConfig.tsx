import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Settings, Save, Loader2 } from "lucide-react";
import type { MetaConfiguracao } from "@/types/metas-module";

interface MetasConfigProps {
  configuracao: MetaConfiguracao | null;
  onSave: (data: Partial<MetaConfiguracao>) => Promise<void>;
}

export function MetasConfig({ configuracao, onSave }: MetasConfigProps) {
  const [form, setForm] = useState<Partial<MetaConfiguracao>>(configuracao || {
    niveis_habilitados: ["estrategica", "unidade", "setor", "individual"],
    exigir_objetivo_estrategico: false,
    exigir_indicador: true,
    exigir_aprovacao_estrategica: true,
    exigir_aprovacao_unidade: false,
    exigir_aprovacao_setor: false,
    exigir_aprovacao_individual: false,
    modelo_avaliacao: "quantitativo",
    escala_min: 0,
    escala_max: 100,
    permitir_desdobramento: true,
    permitir_metas_compartilhadas: true,
    frequencia_checkin: "mensal",
    dias_alerta_prazo: 7,
    integrar_avaliacao_desempenho: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  const set = (field: string, value: unknown) => setForm(p => ({ ...p, [field]: value }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(form);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" /> Configurações Gerais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { field: "exigir_objetivo_estrategico", label: "Exigir vínculo com objetivo estratégico" },
            { field: "exigir_indicador", label: "Exigir indicador em todas as metas" },
            { field: "permitir_desdobramento", label: "Permitir desdobramento de metas" },
            { field: "permitir_metas_compartilhadas", label: "Permitir metas compartilhadas" },
            { field: "integrar_avaliacao_desempenho", label: "Integrar com Avaliação de Desempenho" },
          ].map(item => (
            <div key={item.field} className="flex items-center justify-between">
              <Label className="text-sm">{item.label}</Label>
              <Switch checked={!!(form as any)[item.field]} onCheckedChange={v => set(item.field, v)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Aprovações por Nível</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { field: "exigir_aprovacao_estrategica", label: "Metas Estratégicas" },
            { field: "exigir_aprovacao_unidade", label: "Metas de Unidade" },
            { field: "exigir_aprovacao_setor", label: "Metas de Setor" },
            { field: "exigir_aprovacao_individual", label: "Metas Individuais" },
          ].map(item => (
            <div key={item.field} className="flex items-center justify-between">
              <Label className="text-sm">{item.label}</Label>
              <Switch checked={!!(form as any)[item.field]} onCheckedChange={v => set(item.field, v)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Parâmetros</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Frequência de Check-in</Label>
            <Select value={form.frequencia_checkin || "mensal"} onValueChange={v => set("frequencia_checkin", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="quinzenal">Quinzenal</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="trimestral">Trimestral</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Dias de alerta antes do prazo</Label>
            <Input type="number" value={form.dias_alerta_prazo || 7} onChange={e => set("dias_alerta_prazo", parseInt(e.target.value))} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="gap-1.5">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
