import { useState } from "react";
import { X, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { PlanoAcaoFilters as FilterType, AcaoStatus, AcaoGutPrioridade, OrigemModulo } from "@/types/planoAcao";

interface PlanoAcaoFiltersProps {
  filters: FilterType;
  onChange: (filters: FilterType) => void;
  onClear: () => void;
}

const STATUS_OPTIONS: { value: AcaoStatus; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em Andamento" },
  { value: "pausada", label: "Pausada" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
];

const PRIORIDADE_OPTIONS: { value: AcaoGutPrioridade; label: string; color: string }[] = [
  { value: "baixo", label: "Baixa", color: "bg-success/10 text-success" },
  { value: "medio", label: "Média", color: "bg-warning/10 text-warning" },
  { value: "urgente", label: "Urgente", color: "bg-orange-500/10 text-orange-600" },
  { value: "imediato", label: "Imediato", color: "bg-destructive/10 text-destructive" },
];

const ORIGEM_OPTIONS: { value: OrigemModulo; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "ergonomia", label: "Ergonomia" },
  { value: "ouvidoria", label: "Ouvidoria" },
  { value: "epi", label: "EPIs" },
  { value: "ponto", label: "Ponto" },
  { value: "humor", label: "Humor" },
  { value: "psicossocial", label: "Psicossocial" },
  { value: "atestados", label: "Atestados" },
  { value: "sst", label: "SST" },
  { value: "compliance_sst", label: "Compliance SST" },
  { value: "compliance", label: "Compliance" },
  { value: "documentos", label: "Documentos" },
  { value: "avaliacoes", label: "Avaliações" },
  { value: "estrategia", label: "Estratégia" },
  { value: "gro", label: "GRO" },
];

export function PlanoAcaoFilters({ filters, onChange, onClear }: PlanoAcaoFiltersProps) {
  const toggleStatus = (status: AcaoStatus) => {
    const current = filters.status || [];
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    onChange({ ...filters, status: updated.length ? updated : undefined });
  };

  const togglePrioridade = (prioridade: AcaoGutPrioridade) => {
    const current = filters.prioridade || [];
    const updated = current.includes(prioridade)
      ? current.filter(p => p !== prioridade)
      : [...current, prioridade];
    onChange({ ...filters, prioridade: updated.length ? updated : undefined });
  };

  const toggleOrigem = (origem: OrigemModulo) => {
    const current = filters.origem_modulo || [];
    const updated = current.includes(origem)
      ? current.filter(o => o !== origem)
      : [...current, origem];
    onChange({ ...filters, origem_modulo: updated.length ? updated : undefined });
  };

  const hasFilters = filters.status?.length || filters.prioridade?.length || filters.origem_modulo?.length || filters.responsavel_id || filters.prazo_inicio || filters.prazo_fim;

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        {/* Período */}
        <div>
          <label className="text-sm font-medium mb-2 block">Período (Prazo)</label>
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-[160px] justify-start text-left font-normal", !filters.prazo_inicio && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {filters.prazo_inicio ? format(new Date(filters.prazo_inicio), "dd/MM/yyyy", { locale: ptBR }) : "Data início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.prazo_inicio ? new Date(filters.prazo_inicio) : undefined}
                  onSelect={(date) => onChange({ ...filters, prazo_inicio: date ? format(date, "yyyy-MM-dd") : undefined })}
                  className={cn("p-3 pointer-events-auto")}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <span className="text-sm text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-[160px] justify-start text-left font-normal", !filters.prazo_fim && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {filters.prazo_fim ? format(new Date(filters.prazo_fim), "dd/MM/yyyy", { locale: ptBR }) : "Data fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.prazo_fim ? new Date(filters.prazo_fim) : undefined}
                  onSelect={(date) => onChange({ ...filters, prazo_fim: date ? format(date, "yyyy-MM-dd") : undefined })}
                  className={cn("p-3 pointer-events-auto")}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Responsável */}
        <div>
          <label className="text-sm font-medium mb-2 block">Responsável</label>
          <Input
            placeholder="Buscar por nome do responsável..."
            value={filters.responsavel_id || ""}
            onChange={(e) => onChange({ ...filters, responsavel_id: e.target.value || undefined })}
            className="max-w-xs"
          />
        </div>

        {/* Status */}
        <div>
          <label className="text-sm font-medium mb-2 block">Status</label>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <Badge
                key={opt.value}
                variant={filters.status?.includes(opt.value) ? "default" : "outline"}
                className="cursor-pointer transition-all"
                onClick={() => toggleStatus(opt.value)}
              >
                {opt.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Prioridade */}
        <div>
          <label className="text-sm font-medium mb-2 block">Prioridade</label>
          <div className="flex flex-wrap gap-2">
            {PRIORIDADE_OPTIONS.map((opt) => (
              <Badge
                key={opt.value}
                variant="outline"
                className={cn(
                  "cursor-pointer transition-all",
                  filters.prioridade?.includes(opt.value) && opt.color
                )}
                onClick={() => togglePrioridade(opt.value)}
              >
                {opt.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Origem */}
        <div>
          <label className="text-sm font-medium mb-2 block">Origem</label>
          <div className="flex flex-wrap gap-2">
            {ORIGEM_OPTIONS.map((opt) => (
              <Badge
                key={opt.value}
                variant={filters.origem_modulo?.includes(opt.value) ? "default" : "outline"}
                className="cursor-pointer transition-all"
                onClick={() => toggleOrigem(opt.value)}
              >
                {opt.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Clear */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClear} className="mt-2">
            <X className="h-4 w-4 mr-1" />
            Limpar filtros
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
