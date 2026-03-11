import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Shield, Brain, Heart, Zap, Clock, Gauge, User } from "lucide-react";
import { useMetasErgonomicas } from "@/hooks/useMetasErgonomicas";
import { IermBadge } from "./IermBadge";
import {
  calcularIERM,
  EXIGENCIA_LABELS,
  type MetaAEMInsert,
  type ExigenciaNivel,
  type RitmoImposto,
  type PressaoPrazo,
  type GrauAutonomia,
  type AjusteMetodo,
  type HorasExtras,
  type CompatibilidadeNivel,
} from "@/types/mea";

interface AemFormProps {
  metaId: string;
  onSaved?: () => void;
}

export function AemForm({ metaId, onSaved }: AemFormProps) {
  const { aem, upsertAem, isSavingAem } = useMetasErgonomicas(metaId);

  const [form, setForm] = useState<MetaAEMInsert>({
    meta_id: metaId,
    exigencia_fisica: "nenhuma",
    exigencia_cognitiva: "nenhuma",
    exigencia_emocional: "nenhuma",
    ritmo_imposto: "autogerido",
    pressao_prazo: "nao",
    grau_autonomia: "alto",
    possibilidade_ajuste_metodo: "sim",
    impacta_jornada: false,
    exige_horas_extras: "nao",
    exige_atencao_continua: false,
    compativel_funcao: "sim",
    compativel_competencias: "sim",
  });

  useEffect(() => {
    if (aem) {
      setForm({
        meta_id: metaId,
        exigencia_fisica: aem.exigencia_fisica,
        exigencia_cognitiva: aem.exigencia_cognitiva,
        exigencia_emocional: aem.exigencia_emocional,
        ritmo_imposto: aem.ritmo_imposto,
        pressao_prazo: aem.pressao_prazo,
        grau_autonomia: aem.grau_autonomia,
        possibilidade_ajuste_metodo: aem.possibilidade_ajuste_metodo,
        impacta_jornada: aem.impacta_jornada,
        exige_horas_extras: aem.exige_horas_extras,
        exige_atencao_continua: aem.exige_atencao_continua,
        compativel_funcao: aem.compativel_funcao,
        compativel_competencias: aem.compativel_competencias,
      });
    }
  }, [aem, metaId]);

  const ierm = calcularIERM(form);

  const handleSave = async () => {
    await upsertAem(form);
    onSaved?.();
  };

  const RadioField = ({
    label,
    icon: Icon,
    value,
    onChange,
    options,
  }: {
    label: string;
    icon: React.ElementType;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </Label>
      <RadioGroup value={value} onValueChange={onChange} className="flex flex-wrap gap-3">
        {options.map((opt) => (
          <div key={opt.value} className="flex items-center gap-1.5">
            <RadioGroupItem value={opt.value} id={`${label}-${opt.value}`} />
            <Label htmlFor={`${label}-${opt.value}`} className="text-sm cursor-pointer">
              {opt.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );

  const exigenciaOpts = Object.entries(EXIGENCIA_LABELS).map(([v, l]) => ({ value: v, label: l }));

  return (
    <div className="space-y-6">
      {/* IERM Preview */}
      <IermBadge score={ierm.score} nivel={ierm.nivel} />

      {/* 2.2.1 Exigência */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Exigência da Meta</CardTitle>
          <CardDescription>Avalie o nível de exigência em cada dimensão</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioField
            label="Exigência Física"
            icon={Zap}
            value={form.exigencia_fisica || "nenhuma"}
            onChange={(v) => setForm((f) => ({ ...f, exigencia_fisica: v as ExigenciaNivel }))}
            options={exigenciaOpts}
          />
          <RadioField
            label="Exigência Cognitiva"
            icon={Brain}
            value={form.exigencia_cognitiva || "nenhuma"}
            onChange={(v) => setForm((f) => ({ ...f, exigencia_cognitiva: v as ExigenciaNivel }))}
            options={exigenciaOpts}
          />
          <RadioField
            label="Exigência Emocional"
            icon={Heart}
            value={form.exigencia_emocional || "nenhuma"}
            onChange={(v) => setForm((f) => ({ ...f, exigencia_emocional: v as ExigenciaNivel }))}
            options={exigenciaOpts}
          />
        </CardContent>
      </Card>

      {/* 2.2.2 Ritmo e Pressão */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ritmo e Pressão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioField
            label="Ritmo imposto pela meta"
            icon={Gauge}
            value={form.ritmo_imposto || "autogerido"}
            onChange={(v) => setForm((f) => ({ ...f, ritmo_imposto: v as RitmoImposto }))}
            options={[
              { value: "autogerido", label: "Autogerido" },
              { value: "moderado", label: "Moderado" },
              { value: "acelerado", label: "Acelerado" },
            ]}
          />
          <RadioField
            label="Pressão por prazo"
            icon={Clock}
            value={form.pressao_prazo || "nao"}
            onChange={(v) => setForm((f) => ({ ...f, pressao_prazo: v as PressaoPrazo }))}
            options={[
              { value: "nao", label: "Não" },
              { value: "eventual", label: "Eventual" },
              { value: "continua", label: "Contínua" },
            ]}
          />
        </CardContent>
      </Card>

      {/* 2.2.3 Autonomia */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Autonomia e Controle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioField
            label="Grau de autonomia"
            icon={User}
            value={form.grau_autonomia || "alto"}
            onChange={(v) => setForm((f) => ({ ...f, grau_autonomia: v as GrauAutonomia }))}
            options={[
              { value: "alto", label: "Alto" },
              { value: "medio", label: "Médio" },
              { value: "baixo", label: "Baixo" },
            ]}
          />
          <RadioField
            label="Possibilidade de ajustar método"
            icon={Shield}
            value={form.possibilidade_ajuste_metodo || "sim"}
            onChange={(v) => setForm((f) => ({ ...f, possibilidade_ajuste_metodo: v as AjusteMetodo }))}
            options={[
              { value: "sim", label: "Sim" },
              { value: "parcial", label: "Parcial" },
              { value: "nao", label: "Não" },
            ]}
          />
        </CardContent>
      </Card>

      {/* 2.2.4 Jornada */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Jornada e Pausas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Impacta jornada regular?
            </Label>
            <Switch
              checked={form.impacta_jornada || false}
              onCheckedChange={(v) => setForm((f) => ({ ...f, impacta_jornada: v }))}
            />
          </div>
          <RadioField
            label="Exige horas extras?"
            icon={Clock}
            value={form.exige_horas_extras || "nao"}
            onChange={(v) => setForm((f) => ({ ...f, exige_horas_extras: v as HorasExtras }))}
            options={[
              { value: "nao", label: "Não" },
              { value: "eventuais", label: "Eventuais" },
              { value: "frequentes", label: "Frequentes" },
            ]}
          />
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-muted-foreground" />
              Exige atenção contínua?
            </Label>
            <Switch
              checked={form.exige_atencao_continua || false}
              onCheckedChange={(v) => setForm((f) => ({ ...f, exige_atencao_continua: v }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2.2.5 Compatibilidade */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Compatibilidade Organizacional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioField
            label="Compatível com a função?"
            icon={User}
            value={form.compativel_funcao || "sim"}
            onChange={(v) => setForm((f) => ({ ...f, compativel_funcao: v as CompatibilidadeNivel }))}
            options={[
              { value: "sim", label: "Sim" },
              { value: "parcial", label: "Parcial" },
              { value: "nao", label: "Não" },
            ]}
          />
          <RadioField
            label="Compatível com competências atuais?"
            icon={Brain}
            value={form.compativel_competencias || "sim"}
            onChange={(v) => setForm((f) => ({ ...f, compativel_competencias: v as CompatibilidadeNivel }))}
            options={[
              { value: "sim", label: "Sim" },
              { value: "nao", label: "Não (sugere desenvolvimento)" },
            ]}
          />
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center justify-between">
        <IermBadge score={ierm.score} nivel={ierm.nivel} />
        <Button onClick={handleSave} disabled={isSavingAem}>
          {isSavingAem ? "Salvando..." : aem ? "Atualizar AEM" : "Salvar AEM"}
        </Button>
      </div>
    </div>
  );
}
