import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Plus, Trash2 } from "lucide-react";
import type { AEPAcaoRecomendada, TipoAcao, PrioridadeAcao } from "@/types/aep";
import { TIPO_ACAO_LABELS, PRIORIDADE_ACAO_LABELS } from "@/types/aep";
import { cn } from "@/lib/utils";

interface AEPFormAcoesProps {
  acoes: AEPAcaoRecomendada[];
  onChange: (acoes: AEPAcaoRecomendada[]) => void;
}

const PRIORIDADE_COLORS: Record<PrioridadeAcao, string> = {
  baixa: 'bg-muted text-muted-foreground',
  media: 'bg-warning/10 text-warning',
  alta: 'bg-orange-500/10 text-orange-600',
  urgente: 'bg-destructive/10 text-destructive',
};

export function AEPFormAcoes({ acoes, onChange }: AEPFormAcoesProps) {
  const [novaAcao, setNovaAcao] = useState<Omit<AEPAcaoRecomendada, 'id'>>({
    acao: '',
    tipo: 'engenharia',
    prioridade: 'media',
  });

  const handleAddAcao = () => {
    if (novaAcao.acao.trim()) {
      onChange([
        ...acoes,
        { ...novaAcao, id: crypto.randomUUID() },
      ]);
      setNovaAcao({ acao: '', tipo: 'engenharia', prioridade: 'media' });
    }
  };

  const handleRemoveAcao = (id: string) => {
    onChange(acoes.filter(a => a.id !== id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          8. Recomendações e Ações Sugeridas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          As recomendações abaixo foram geradas a partir dos riscos identificados e priorizadas 
          considerando prevenção de afastamentos, segurança operacional e impacto potencial no FAP.
        </p>

        {/* Formulário para adicionar ação */}
        <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3 space-y-2">
              <Label htmlFor="novaAcao">Ação Recomendada</Label>
              <Input
                id="novaAcao"
                value={novaAcao.acao}
                onChange={(e) => setNovaAcao({ ...novaAcao, acao: e.target.value })}
                placeholder="Descreva a ação recomendada..."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tipoAcao">Tipo</Label>
              <Select
                value={novaAcao.tipo}
                onValueChange={(value) => setNovaAcao({ ...novaAcao, tipo: value as TipoAcao })}
              >
                <SelectTrigger id="tipoAcao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_ACAO_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="prioridadeAcao">Prioridade</Label>
              <Select
                value={novaAcao.prioridade}
                onValueChange={(value) => setNovaAcao({ ...novaAcao, prioridade: value as PrioridadeAcao })}
              >
                <SelectTrigger id="prioridadeAcao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORIDADE_ACAO_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button type="button" onClick={handleAddAcao} className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </div>
          </div>
        </div>

        {/* Lista de ações */}
        {acoes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium">Ação Recomendada</th>
                  <th className="text-left py-2 px-2 font-medium w-32">Tipo</th>
                  <th className="text-left py-2 px-2 font-medium w-28">Prioridade</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {acoes.map((acao) => (
                  <tr key={acao.id} className="border-b">
                    <td className="py-2 px-2">{acao.acao}</td>
                    <td className="py-2 px-2">
                      <Badge variant="outline">{TIPO_ACAO_LABELS[acao.tipo]}</Badge>
                    </td>
                    <td className="py-2 px-2">
                      <Badge className={cn(PRIORIDADE_COLORS[acao.prioridade])}>
                        {PRIORIDADE_ACAO_LABELS[acao.prioridade]}
                      </Badge>
                    </td>
                    <td className="py-2 px-2">
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleRemoveAcao(acao.id)}
                        className="h-8 w-8 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-sm text-muted-foreground mt-4">
          📌 As ações devem ser registradas e acompanhadas no Módulo de Ações do YourEyes.
        </p>
      </CardContent>
    </Card>
  );
}
