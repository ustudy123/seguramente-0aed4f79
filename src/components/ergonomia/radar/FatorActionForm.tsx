import { useState } from "react";
import { Plus, Lightbulb, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AcaoPrioridade } from "@/types/ergonomia";

const PRIORIDADE_LABELS: Record<AcaoPrioridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

const PRIORIDADE_COLORS: Record<AcaoPrioridade, string> = {
  baixa: 'bg-success/10 text-success',
  media: 'bg-warning/10 text-warning',
  alta: 'bg-orange-500/10 text-orange-600',
  urgente: 'bg-destructive/10 text-destructive',
};

interface FatorActionFormProps {
  fatorKey: string;
  fatorLabel: string;
  radarType: 'burnout' | 'boreout' | 'energia';
  sugestoes: readonly string[];
  onSubmit: (acao: {
    titulo: string;
    descricao: string;
    tipo: 'corretiva' | 'preventiva' | 'melhoria';
    prioridade: AcaoPrioridade;
    fator_radar: string;
    radar_type: string;
  }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function FatorActionForm({
  fatorKey,
  fatorLabel,
  radarType,
  sugestoes,
  onSubmit,
  onCancel,
  isLoading = false,
}: FatorActionFormProps) {
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    tipo: "corretiva" as 'corretiva' | 'preventiva' | 'melhoria',
    prioridade: "media" as AcaoPrioridade,
  });
  const [selectedSugestao, setSelectedSugestao] = useState<string | null>(null);

  const handleSugestaoSelect = (sugestao: string) => {
    setSelectedSugestao(sugestao);
    setFormData(prev => ({
      ...prev,
      titulo: sugestao,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      ...formData,
      fator_radar: fatorKey,
      radar_type: radarType,
    });
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova Ação para: {fatorLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sugestões */}
        {sugestoes.length > 0 && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs">
              <Lightbulb className="h-3 w-3 text-warning" />
              Sugestões de ação
            </Label>
            <div className="flex flex-wrap gap-2">
              {sugestoes.map((sugestao, idx) => (
                <Badge
                  key={idx}
                  variant={selectedSugestao === sugestao ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer text-xs transition-all",
                    selectedSugestao === sugestao 
                      ? "bg-primary" 
                      : "hover:bg-primary/10"
                  )}
                  onClick={() => handleSugestaoSelect(sugestao)}
                >
                  {selectedSugestao === sugestao && <Check className="h-3 w-3 mr-1" />}
                  {sugestao}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="titulo" className="text-xs">Título da Ação *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
              placeholder="Ou digite sua própria ação..."
              className="text-sm h-9"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value: 'corretiva' | 'preventiva' | 'melhoria') => 
                  setFormData(prev => ({ ...prev, tipo: value }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corretiva">Corretiva</SelectItem>
                  <SelectItem value="preventiva">Preventiva</SelectItem>
                  <SelectItem value="melhoria">Melhoria</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Prioridade</Label>
              <Select
                value={formData.prioridade}
                onValueChange={(value: AcaoPrioridade) => 
                  setFormData(prev => ({ ...prev, prioridade: value }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORIDADE_LABELS) as AcaoPrioridade[]).map((prio) => (
                    <SelectItem key={prio} value={prio}>
                      <Badge className={cn("text-xs", PRIORIDADE_COLORS[prio])}>
                        {PRIORIDADE_LABELS[prio]}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao" className="text-xs">Descrição (opcional)</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              placeholder="Descreva detalhes da ação..."
              rows={2}
              className="text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isLoading || !formData.titulo}>
              {isLoading ? "Salvando..." : "Cadastrar Ação"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
