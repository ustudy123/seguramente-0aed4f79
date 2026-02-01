import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type {
  ErgonomiaRisco,
  ErgonomiaEixo,
  RiscoSeveridade,
  ItemNR17,
} from "@/types/ergonomia";
import {
  EIXO_LABELS,
  EIXO_COLORS,
  SEVERIDADE_LABELS,
  SEVERIDADE_COLORS,
} from "@/types/ergonomia";

interface RiscoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (risco: Omit<ErgonomiaRisco, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => Promise<unknown>;
  itensNR17?: ItemNR17[];
  isLoading?: boolean;
}

export function RiscoForm({
  open,
  onOpenChange,
  onSubmit,
  itensNR17 = [],
  isLoading = false,
}: RiscoFormProps) {
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    eixo: "fisico" as ErgonomiaEixo,
    severidade: "medio" as RiscoSeveridade,
    probabilidade: "medio" as RiscoSeveridade,
    item_nr17_id: "",
    fonte: "",
    departamento: "",
    setor: "",
    impactos_potenciais: [] as string[],
    medidas_existentes: [] as string[],
    medidas_recomendadas: [] as string[],
  });

  const [newImpacto, setNewImpacto] = useState("");
  const [newMedidaExistente, setNewMedidaExistente] = useState("");
  const [newMedidaRecomendada, setNewMedidaRecomendada] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await onSubmit({
      ...formData,
      item_nr17_id: formData.item_nr17_id || undefined,
      ativo: true,
    });

    // Reset form
    setFormData({
      titulo: "",
      descricao: "",
      eixo: "fisico",
      severidade: "medio",
      probabilidade: "medio",
      item_nr17_id: "",
      fonte: "",
      departamento: "",
      setor: "",
      impactos_potenciais: [],
      medidas_existentes: [],
      medidas_recomendadas: [],
    });
    onOpenChange(false);
  };

  const addItem = (field: 'impactos_potenciais' | 'medidas_existentes' | 'medidas_recomendadas', value: string, setValue: (v: string) => void) => {
    if (value.trim()) {
      setFormData(prev => ({
        ...prev,
        [field]: [...prev[field], value.trim()],
      }));
      setValue("");
    }
  };

  const removeItem = (field: 'impactos_potenciais' | 'medidas_existentes' | 'medidas_recomendadas', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Cadastrar Risco Ergonômico
          </DialogTitle>
          <DialogDescription>
            Registre um novo risco identificado para acompanhamento e controle
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="titulo">Título do Risco *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
              placeholder="Ex: Postura inadequada em estações de trabalho"
              required
            />
          </div>

          {/* Eixo e Item NR-17 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Eixo Ergonômico *</Label>
              <Select
                value={formData.eixo}
                onValueChange={(value: ErgonomiaEixo) => setFormData(prev => ({ ...prev, eixo: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(EIXO_LABELS) as ErgonomiaEixo[]).map((eixo) => (
                    <SelectItem key={eixo} value={eixo}>
                      <div className="flex items-center gap-2">
                        <Badge className={EIXO_COLORS[eixo]} variant="outline">
                          {EIXO_LABELS[eixo]}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Vinculado ao Item NR-17</Label>
              <Select
                value={formData.item_nr17_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, item_nr17_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {itensNR17.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.codigo} - {item.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Severidade e Probabilidade */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Severidade *</Label>
              <Select
                value={formData.severidade}
                onValueChange={(value: RiscoSeveridade) => setFormData(prev => ({ ...prev, severidade: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SEVERIDADE_LABELS) as RiscoSeveridade[]).map((sev) => (
                    <SelectItem key={sev} value={sev}>
                      <Badge className={SEVERIDADE_COLORS[sev]}>
                        {SEVERIDADE_LABELS[sev]}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Probabilidade *</Label>
              <Select
                value={formData.probabilidade}
                onValueChange={(value: RiscoSeveridade) => setFormData(prev => ({ ...prev, probabilidade: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SEVERIDADE_LABELS) as RiscoSeveridade[]).map((prob) => (
                    <SelectItem key={prob} value={prob}>
                      <Badge className={SEVERIDADE_COLORS[prob]}>
                        {SEVERIDADE_LABELS[prob]}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              placeholder="Descreva o risco identificado, suas causas e contexto..."
              rows={3}
            />
          </div>

          {/* Fonte, Departamento, Setor */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fonte">Fonte do Risco</Label>
              <Input
                id="fonte"
                value={formData.fonte}
                onChange={(e) => setFormData(prev => ({ ...prev, fonte: e.target.value }))}
                placeholder="Ex: Estação de trabalho"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="departamento">Departamento</Label>
              <Input
                id="departamento"
                value={formData.departamento}
                onChange={(e) => setFormData(prev => ({ ...prev, departamento: e.target.value }))}
                placeholder="Ex: TI"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setor">Setor</Label>
              <Input
                id="setor"
                value={formData.setor}
                onChange={(e) => setFormData(prev => ({ ...prev, setor: e.target.value }))}
                placeholder="Ex: Desenvolvimento"
              />
            </div>
          </div>

          {/* Impactos Potenciais */}
          <div className="space-y-2">
            <Label>Impactos Potenciais</Label>
            <div className="flex gap-2">
              <Input
                value={newImpacto}
                onChange={(e) => setNewImpacto(e.target.value)}
                placeholder="Ex: LER/DORT, fadiga muscular..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem('impactos_potenciais', newImpacto, setNewImpacto);
                  }
                }}
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => addItem('impactos_potenciais', newImpacto, setNewImpacto)}
              >
                Adicionar
              </Button>
            </div>
            {formData.impactos_potenciais.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.impactos_potenciais.map((item, idx) => (
                  <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                    {item}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive" 
                      onClick={() => removeItem('impactos_potenciais', idx)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Medidas Existentes */}
          <div className="space-y-2">
            <Label>Medidas de Controle Existentes</Label>
            <div className="flex gap-2">
              <Input
                value={newMedidaExistente}
                onChange={(e) => setNewMedidaExistente(e.target.value)}
                placeholder="Ex: Cadeiras ergonômicas..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem('medidas_existentes', newMedidaExistente, setNewMedidaExistente);
                  }
                }}
              />
              <Button 
                type="button" 
                variant="outline"
                onClick={() => addItem('medidas_existentes', newMedidaExistente, setNewMedidaExistente)}
              >
                Adicionar
              </Button>
            </div>
            {formData.medidas_existentes.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.medidas_existentes.map((item, idx) => (
                  <Badge key={idx} variant="outline" className="flex items-center gap-1 bg-success/10 text-success">
                    {item}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive" 
                      onClick={() => removeItem('medidas_existentes', idx)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Medidas Recomendadas */}
          <div className="space-y-2">
            <Label>Medidas Recomendadas</Label>
            <div className="flex gap-2">
              <Input
                value={newMedidaRecomendada}
                onChange={(e) => setNewMedidaRecomendada(e.target.value)}
                placeholder="Ex: Treinamento de postura..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem('medidas_recomendadas', newMedidaRecomendada, setNewMedidaRecomendada);
                  }
                }}
              />
              <Button 
                type="button" 
                variant="outline"
                onClick={() => addItem('medidas_recomendadas', newMedidaRecomendada, setNewMedidaRecomendada)}
              >
                Adicionar
              </Button>
            </div>
            {formData.medidas_recomendadas.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.medidas_recomendadas.map((item, idx) => (
                  <Badge key={idx} variant="outline" className="flex items-center gap-1 bg-info/10 text-info">
                    {item}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive" 
                      onClick={() => removeItem('medidas_recomendadas', idx)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !formData.titulo}>
              {isLoading ? "Salvando..." : "Cadastrar Risco"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
