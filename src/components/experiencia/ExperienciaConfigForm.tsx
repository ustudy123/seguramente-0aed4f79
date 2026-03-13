import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Settings2, Shield, Bell, Save, Loader2, Info } from "lucide-react";
import { useExperienciaConfig, ExperienciaConfig } from "@/hooks/useExperienciaConfig";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { Skeleton } from "@/components/ui/skeleton";

export function ExperienciaConfigForm() {
  const { config, isLoading, salvar, salvando } = useExperienciaConfig();
  const { empresaAtivaId } = useEmpresaAtiva();

  const [form, setForm] = useState({
    modelo_periodos: "2_periodos" as "1_periodo" | "2_periodos",
    duracao_primeiro_periodo: 45,
    duracao_segundo_periodo: 45 as number | null,
    clausula_assecuratoria_padrao: false,
    dias_antecedencia_acao: 5,
    alerta_15_dias: true,
    alerta_7_dias: true,
    alerta_2_dias: true,
    politica_interna: "",
  });

  useEffect(() => {
    if (config) {
      setForm({
        modelo_periodos: config.modelo_periodos,
        duracao_primeiro_periodo: config.duracao_primeiro_periodo,
        duracao_segundo_periodo: config.duracao_segundo_periodo,
        clausula_assecuratoria_padrao: config.clausula_assecuratoria_padrao,
        dias_antecedencia_acao: config.dias_antecedencia_acao,
        alerta_15_dias: config.alerta_15_dias,
        alerta_7_dias: config.alerta_7_dias,
        alerta_2_dias: config.alerta_2_dias,
        politica_interna: config.politica_interna || "",
      });
    }
  }, [config]);

  const totalDias = form.modelo_periodos === "1_periodo"
    ? form.duracao_primeiro_periodo
    : form.duracao_primeiro_periodo + (form.duracao_segundo_periodo || 0);

  const excedeLimite = totalDias > 90;

  const handleSalvar = async () => {
    await salvar(form as Partial<ExperienciaConfig>);
  };

  if (!empresaAtivaId) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Info className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Selecione uma empresa no seletor global para configurar as regras de contrato de experiência.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <Card><CardContent className="py-6 space-y-4"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-32" /><Skeleton className="h-20" /></CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      {/* Modelo de Períodos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            Modelo de Períodos
          </CardTitle>
          <CardDescription>Defina como a empresa estrutura o contrato de experiência (máx. 90 dias – CLT art. 445).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Modelo padrão</Label>
            <Select value={form.modelo_periodos} onValueChange={(v) => setForm(f => ({ ...f, modelo_periodos: v as any }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1_periodo">1 único período (ex.: 90 dias)</SelectItem>
                <SelectItem value="2_periodos">2 períodos (ex.: 45 + 45)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duração do 1º período (dias)</Label>
              <Input type="number" min={1} max={90}
                value={form.duracao_primeiro_periodo}
                onChange={(e) => setForm(f => ({ ...f, duracao_primeiro_periodo: Number(e.target.value) }))} />
            </div>
            {form.modelo_periodos === "2_periodos" && (
              <div className="space-y-2">
                <Label>Duração do 2º período (dias)</Label>
                <Input type="number" min={1} max={90 - form.duracao_primeiro_periodo}
                  value={form.duracao_segundo_periodo || ""}
                  onChange={(e) => setForm(f => ({ ...f, duracao_segundo_periodo: Number(e.target.value) }))} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Badge variant={excedeLimite ? "destructive" : "secondary"} className="text-sm">
              Total: {totalDias} dias {excedeLimite && "(excede 90!)"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Cláusula Assecuratória */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Cláusula Assecuratória
          </CardTitle>
          <CardDescription>Define se contratos de experiência desta empresa incluem cláusula de rescisão antecipada por padrão.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Incluir cláusula assecuratória por padrão</p>
              <p className="text-xs text-muted-foreground">Com cláusula: aviso prévio como contrato indeterminado. Sem cláusula: indenização art. 479/480 CLT.</p>
            </div>
            <Switch checked={form.clausula_assecuratoria_padrao}
              onCheckedChange={(v) => setForm(f => ({ ...f, clausula_assecuratoria_padrao: v }))} />
          </div>
        </CardContent>
      </Card>

      {/* Alertas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            Alertas e Política Interna
          </CardTitle>
          <CardDescription>Configure alertas de vencimento e regras internas da empresa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Alerta 15 dias antes do vencimento</Label>
              <Switch checked={form.alerta_15_dias} onCheckedChange={(v) => setForm(f => ({ ...f, alerta_15_dias: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Alerta 7 dias antes do vencimento</Label>
              <Switch checked={form.alerta_7_dias} onCheckedChange={(v) => setForm(f => ({ ...f, alerta_7_dias: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Alerta 2 dias antes do vencimento</Label>
              <Switch checked={form.alerta_2_dias} onCheckedChange={(v) => setForm(f => ({ ...f, alerta_2_dias: v }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dias de antecedência para ação (efetivar/encerrar)</Label>
            <Input type="number" min={1} max={30}
              value={form.dias_antecedencia_acao}
              onChange={(e) => setForm(f => ({ ...f, dias_antecedencia_acao: Number(e.target.value) }))} />
            <p className="text-xs text-muted-foreground">Ex.: "5" significa que o sistema sugere ação 5 dias antes do término.</p>
          </div>

          <div className="space-y-2">
            <Label>Política interna (observações)</Label>
            <Textarea value={form.politica_interna}
              onChange={(e) => setForm(f => ({ ...f, politica_interna: e.target.value }))}
              placeholder="Ex.: Sempre efetivar com 5 dias de antecedência. Avaliação de desempenho obrigatória antes da efetivação..."
              rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* Salvar */}
      <div className="flex justify-end">
        <Button onClick={handleSalvar} disabled={salvando || excedeLimite} size="lg">
          {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Configuração
        </Button>
      </div>
    </div>
  );
}
