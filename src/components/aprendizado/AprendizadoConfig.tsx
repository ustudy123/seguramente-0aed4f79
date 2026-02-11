import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Settings, Save } from "lucide-react";
import { useAprendizado } from "@/hooks/useAprendizado";

export function AprendizadoConfig() {
  const { config, salvarConfig } = useAprendizado();

  const [treinamentoObrigatorio, setTreinamentoObrigatorio] = useState(true);
  const [notaMinima, setNotaMinima] = useState(70);
  const [reaplicacaoMeses, setReaplicacaoMeses] = useState(12);
  const [ativarOnboarding, setAtivarOnboarding] = useState(true);
  const [ativarMudancaFuncao, setAtivarMudancaFuncao] = useState(true);

  useEffect(() => {
    if (config) {
      setTreinamentoObrigatorio(config.treinamento_epi_obrigatorio);
      setNotaMinima(config.nota_minima_padrao);
      setReaplicacaoMeses(config.reaplicacao_meses);
      setAtivarOnboarding(config.ativar_onboarding);
      setAtivarMudancaFuncao(config.ativar_mudanca_funcao);
    }
  }, [config]);

  const handleSave = async () => {
    await salvarConfig({
      treinamento_epi_obrigatorio: treinamentoObrigatorio,
      nota_minima_padrao: notaMinima,
      reaplicacao_meses: reaplicacaoMeses,
      ativar_onboarding: ativarOnboarding,
      ativar_mudanca_funcao: ativarMudancaFuncao,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="w-5 h-5" /> Configurações do Módulo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Treinamentos de EPI</h4>

            <div className="flex items-center justify-between">
              <Label>Treinamento de EPI obrigatório</Label>
              <Switch checked={treinamentoObrigatorio} onCheckedChange={setTreinamentoObrigatorio} />
            </div>

            <div className="space-y-1">
              <Label>Nota mínima para aprovação (%)</Label>
              <Input type="number" value={notaMinima} onChange={(e) => setNotaMinima(Number(e.target.value))} min={0} max={100} />
            </div>

            <div className="space-y-1">
              <Label>Reaplicação periódica (meses)</Label>
              <Input type="number" value={reaplicacaoMeses} onChange={(e) => setReaplicacaoMeses(Number(e.target.value))} min={1} max={60} />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-sm">Gatilhos Automáticos</h4>

            <div className="flex items-center justify-between">
              <Label>Ativar treinamento no onboarding</Label>
              <Switch checked={ativarOnboarding} onCheckedChange={setAtivarOnboarding} />
            </div>

            <div className="flex items-center justify-between">
              <Label>Ativar treinamento na mudança de função</Label>
              <Switch checked={ativarMudancaFuncao} onCheckedChange={setAtivarMudancaFuncao} />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" /> Salvar Configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
