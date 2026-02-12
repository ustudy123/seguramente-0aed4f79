import { useState } from "react";
import {
  Settings,
  Shield,
  Layers,
  Scale,
  Bell,
  Info,
  Eye,
  EyeOff,
  Users,
  Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const DIMENSOES_CONFIG = [
  { id: "entrega", nome: "Entrega e Qualidade", peso: 30, ativa: true, descricao: "Performance técnica e resultados" },
  { id: "competencias", nome: "Competências", peso: 25, ativa: true, descricao: "Função e comportamento" },
  { id: "evolucao", nome: "Evolução e Aprendizado", peso: 25, ativa: true, descricao: "Desenvolvimento contínuo" },
  { id: "contexto", nome: "Contexto de Trabalho", peso: 20, ativa: true, descricao: "Ergonomia cognitiva + risco humano" },
];

export function AvaliacaoConfig() {
  const [dimensoes, setDimensoes] = useState(DIMENSOES_CONFIG);
  const [justificativaObrigatoria, setJustificativaObrigatoria] = useState(true);
  const [autoavaliacao, setAutoavaliacao] = useState(true);
  const [devolutivaColaborador, setDevolutivaColaborador] = useState(true);
  const [psicossocialVisivel, setPsicossocialVisivel] = useState("rh");
  const [escalaMin, setEscalaMin] = useState(1);
  const [escalaMax, setEscalaMax] = useState(5);

  const totalPeso = dimensoes.filter(d => d.ativa).reduce((s, d) => s + d.peso, 0);

  return (
    <div className="space-y-4">
      {/* Demo banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-sm text-amber-800">
        <Info className="h-4 w-4 shrink-0" />
        <span className="font-medium">Modo Demonstração</span> — Configurações de visualização.
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Dimensões e Pesos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Dimensões e Pesos
            </CardTitle>
            <CardDescription className="text-xs">
              Configure as dimensões avaliadas e seus pesos relativos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dimensoes.map((dim, idx) => (
              <div key={dim.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Switch
                  checked={dim.ativa}
                  onCheckedChange={(checked) => {
                    const next = [...dimensoes];
                    next[idx] = { ...dim, ativa: checked };
                    setDimensoes(next);
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{dim.nome}</p>
                  <p className="text-[10px] text-muted-foreground">{dim.descricao}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={dim.peso}
                    onChange={(e) => {
                      const next = [...dimensoes];
                      next[idx] = { ...dim, peso: parseInt(e.target.value) || 0 };
                      setDimensoes(next);
                    }}
                    className="w-16 h-8 text-center text-sm"
                    disabled={!dim.ativa}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total dos pesos</span>
              <Badge variant={totalPeso === 100 ? "default" : "destructive"}>
                {totalPeso}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Escala */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Escala de Avaliação
            </CardTitle>
            <CardDescription className="text-xs">
              Defina a escala e labels utilizados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Mínimo</Label>
                <Select value={escalaMin.toString()} onValueChange={(v) => setEscalaMin(parseInt(v))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1].map((n) => (
                      <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Máximo</Label>
                <Select value={escalaMax.toString()} onValueChange={(v) => setEscalaMax(parseInt(v))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[4, 5, 10].map((n) => (
                      <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              {Array.from({ length: escalaMax - escalaMin + 1 }, (_, i) => escalaMin + i).map((n) => (
                <div key={n} className="flex items-center gap-2">
                  <Badge variant="secondary" className="w-8 justify-center">{n}</Badge>
                  <Input
                    defaultValue={
                      n === 1 ? "Insuficiente" :
                      n === 2 ? "Em Desenvolvimento" :
                      n === 3 ? "Atende" :
                      n === 4 ? "Supera" :
                      n === 5 ? "Excepcional" : ""
                    }
                    className="h-8 text-sm"
                    placeholder={`Label para nota ${n}`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Regras */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Regras de Avaliação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Justificativa obrigatória em notas extremas</Label>
                <p className="text-[10px] text-muted-foreground">
                  Exigir justificativa quando nota = {escalaMin} ou {escalaMax}
                </p>
              </div>
              <Switch checked={justificativaObrigatoria} onCheckedChange={setJustificativaObrigatoria} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Permitir autoavaliação</Label>
                <p className="text-[10px] text-muted-foreground">
                  Colaborador pode avaliar a si mesmo
                </p>
              </div>
              <Switch checked={autoavaliacao} onCheckedChange={setAutoavaliacao} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Devolutiva ao colaborador</Label>
                <p className="text-[10px] text-muted-foreground">
                  Colaborador recebe resultado após finalização
                </p>
              </div>
              <Switch checked={devolutivaColaborador} onCheckedChange={setDevolutivaColaborador} />
            </div>
          </CardContent>
        </Card>

        {/* Permissões */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Permissões e Visibilidade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {[
                { perfil: "Gestor", permissoes: ["Desempenho do time", "Evidências", "Alertas agregados"], icon: Users },
                { perfil: "RH", permissoes: ["Tudo + indicadores", "Cruzamentos", "Psicossocial (se config.)"], icon: Shield },
                { perfil: "Diretoria", permissoes: ["Dashboards consolidados", "Relatórios exportáveis"], icon: Eye },
                { perfil: "Colaborador", permissoes: ["Autoavaliação", "Devolutiva (se habilitado)"], icon: Lock },
              ].map((p) => (
                <div key={p.perfil} className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{p.perfil}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p.permissoes.map((perm) => (
                      <Badge key={perm} variant="secondary" className="text-[10px]">{perm}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Psicossocial identificado visível para</Label>
                <p className="text-[10px] text-muted-foreground">
                  Dados identificados de questionário psicossocial
                </p>
              </div>
              <Select value={psicossocialVisivel} onValueChange={setPsicossocialVisivel}>
                <SelectTrigger className="w-36 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rh">Somente RH</SelectItem>
                  <SelectItem value="rh_saude">RH + Saúde Ocup.</SelectItem>
                  <SelectItem value="gestor">Gestor + RH</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => toast.success("Configurações salvas com sucesso!")} className="gap-2">
          <Settings className="h-4 w-4" />
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
