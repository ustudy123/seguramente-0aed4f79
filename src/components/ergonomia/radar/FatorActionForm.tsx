import { useState } from "react";
import { ResponsavelSelect } from "@/components/planoAcao/ResponsavelSelect";
import { Plus, Lightbulb, Check, HelpCircle } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AcaoPrioridade } from "@/types/ergonomia";
import type { SugestaoAcao } from "./radarConfig";

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
  sugestoes: readonly SugestaoAcao[];
  onSubmit: (acao: {
    titulo: string;
    descricao: string;
    tipo: 'corretiva' | 'preventiva' | 'melhoria';
    prioridade: AcaoPrioridade;
    fator_radar: string;
    radar_type: string;
    // 5W2H fields
    responsavel_nome: string;
    prazo: string;
    onde: string;
    porque: string;
    como: string;
    custo_estimado: string;
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
    // 5W2H
    responsavel_nome: "",
    prazo: "",
    onde: "",
    porque: "",
    como: "",
    custo_estimado: "",
  });
  const [selectedSugestao, setSelectedSugestao] = useState<string | null>(null);

  const handleSugestaoSelect = (sugestao: SugestaoAcao) => {
    setSelectedSugestao(sugestao.titulo);
    setFormData(prev => ({
      ...prev,
      titulo: sugestao.titulo,
      porque: sugestao.porque,
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

  const LabelWithTooltip = ({ label, tooltip, required = false }: { label: string; tooltip: string; required?: boolean }) => (
    <div className="flex items-center gap-1">
      <span className="text-xs">{label}{required && ' *'}</span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova Ação para: {fatorLabel}
        </CardTitle>
        <p className="text-xs text-muted-foreground">Preencha os campos 5W2H para uma ação bem estruturada</p>
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
                  variant={selectedSugestao === sugestao.titulo ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer text-xs transition-all",
                    selectedSugestao === sugestao.titulo 
                      ? "bg-primary" 
                      : "hover:bg-primary/10"
                  )}
                  onClick={() => handleSugestaoSelect(sugestao)}
                >
                  {selectedSugestao === sugestao.titulo && <Check className="h-3 w-3 mr-1" />}
                  {sugestao.titulo}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* WHAT - O QUÊ */}
          <div className="space-y-2">
            <LabelWithTooltip 
              label="O QUÊ (What)" 
              tooltip="Descreva qual ação será realizada"
              required 
            />
            <Input
              value={formData.titulo}
              onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
              placeholder="Título da ação a ser executada..."
              className="text-sm h-9"
              required
              maxLength={200}
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

          <Separator className="my-2" />

          {/* 5W2H Fields */}
          <div className="grid grid-cols-2 gap-3">
            {/* WHY - POR QUÊ */}
            <div className="space-y-2 col-span-2">
              <LabelWithTooltip 
                label="POR QUÊ (Why)" 
                tooltip="Justificativa ou motivo para realizar esta ação"
              />
              <Input
                value={formData.porque}
                onChange={(e) => setFormData(prev => ({ ...prev, porque: e.target.value }))}
                placeholder="Por que esta ação é necessária?"
                className="text-sm h-9"
                maxLength={300}
              />
            </div>

            {/* WHERE - ONDE */}
            <div className="space-y-2">
              <LabelWithTooltip 
                label="ONDE (Where)" 
                tooltip="Local, setor ou departamento onde a ação será aplicada"
              />
              <Input
                value={formData.onde}
                onChange={(e) => setFormData(prev => ({ ...prev, onde: e.target.value }))}
                placeholder="Setor / Departamento"
                className="text-sm h-9"
                maxLength={100}
              />
            </div>

            {/* WHEN - QUANDO */}
            <div className="space-y-2">
              <LabelWithTooltip 
                label="QUANDO (When)" 
                tooltip="Data limite para conclusão da ação"
              />
              <Input
                type="date"
                value={formData.prazo}
                onChange={(e) => setFormData(prev => ({ ...prev, prazo: e.target.value }))}
                className="text-sm h-9"
              />
            </div>

            {/* WHO - QUEM */}
            <div className="space-y-2">
              <LabelWithTooltip 
                label="QUEM (Who)" 
                tooltip="Responsável pela execução da ação"
              />
              <Input
                value={formData.responsavel_nome}
                onChange={(e) => setFormData(prev => ({ ...prev, responsavel_nome: e.target.value }))}
                placeholder="Nome do responsável"
                className="text-sm h-9"
                maxLength={100}
              />
            </div>

            {/* HOW MUCH - QUANTO */}
            <div className="space-y-2">
              <LabelWithTooltip 
                label="QUANTO (How much)" 
                tooltip="Custo estimado para implementar a ação"
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.custo_estimado}
                onChange={(e) => setFormData(prev => ({ ...prev, custo_estimado: e.target.value }))}
                placeholder="R$ 0,00"
                className="text-sm h-9"
              />
            </div>
          </div>

          {/* HOW - COMO */}
          <div className="space-y-2">
            <LabelWithTooltip 
              label="COMO (How)" 
              tooltip="Descreva como a ação será executada, os passos ou método"
            />
            <Textarea
              value={formData.como}
              onChange={(e) => setFormData(prev => ({ ...prev, como: e.target.value }))}
              placeholder="Descreva o método ou passos para execução..."
              rows={2}
              className="text-sm"
              maxLength={1000}
            />
          </div>

          {/* Additional description */}
          <div className="space-y-2">
            <Label className="text-xs">Observações adicionais</Label>
            <Textarea
              value={formData.descricao}
              onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              placeholder="Outras informações relevantes..."
              rows={2}
              className="text-sm"
              maxLength={1000}
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
