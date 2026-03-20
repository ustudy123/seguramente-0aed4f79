import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Plus, Search, Shield, LayoutDashboard, List, BarChart3, BookOpen, TrendingUp, Calculator, Zap, Trophy } from "lucide-react";
import { useEventosSST } from "@/hooks/useEventosSST";
import { EventoSSTStats } from "@/components/incidentes/EventoSSTStats";
import { EventoSSTList } from "@/components/incidentes/EventoSSTList";
import { EventoSSTForm } from "@/components/incidentes/EventoSSTForm";
import { EventoSSTDetail } from "@/components/incidentes/EventoSSTDetail";
import { EventoSSTDashboard } from "@/components/incidentes/EventoSSTDashboard";
import { PiramideSeguranca } from "@/components/incidentes/PiramideSeguranca";
import { GuiaRapidoIncidentes } from "@/components/incidentes/GuiaRapidoIncidentes";
import { IndicadoresEstrategicos } from "@/components/incidentes/IndicadoresEstrategicos";
import { AnalyticsAvancado } from "@/components/incidentes/AnalyticsAvancado";
import { SimuladorFAP } from "@/components/incidentes/SimuladorFAP";
import { AnalysePreditiva } from "@/components/incidentes/AnalysePreditiva";
import { CulturaSeguranca } from "@/components/incidentes/CulturaSeguranca";
import type { EventoSST } from "@/types/eventoSST";

export default function IncidentesAcidentes() {
  const { eventos, isLoading, stats, createEvento, updateEvento } = useEventosSST();
  const [showForm, setShowForm] = useState(false);
  const [showGuia, setShowGuia] = useState(false);
  const [editing, setEditing] = useState<EventoSST | null>(null);
  const [selected, setSelected] = useState<EventoSST | null>(null);
  const [filters, setFilters] = useState({
    tipo: "todos",
    status: "todos",
    search: "",
    dataInicio: "",
    dataFim: "",
    unidade: "todos",
    turno: "todos",
  });

  if (selected) {
    return (
      <TooltipProvider>
        <div className="p-6 space-y-6">
          <EventoSSTDetail evento={selected} onBack={() => setSelected(null)} />
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" />
            Incidentes & Acidentes
          </h1>
          <p className="text-sm text-muted-foreground mt-1 italic">
            Cada incidente registrado é uma oportunidade de evitar o próximo acidente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowGuia(true)}>
            <BookOpen className="w-4 h-4 mr-2" /> Guia Rápido
          </Button>
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Registrar Evento
          </Button>
        </div>
      </div>

      <EventoSSTStats stats={stats} />

      <Tabs defaultValue="lista">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="lista"><List className="w-4 h-4 mr-1" /> Ocorrências</TabsTrigger>
          <TabsTrigger value="dashboard"><LayoutDashboard className="w-4 h-4 mr-1" /> Análise</TabsTrigger>
          <TabsTrigger value="indicadores"><TrendingUp className="w-4 h-4 mr-1" /> Indicadores</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="w-4 h-4 mr-1" /> Analytics</TabsTrigger>
          <TabsTrigger value="preditivo"><Zap className="w-4 h-4 mr-1" /> Preditivo</TabsTrigger>
          <TabsTrigger value="cultura"><Trophy className="w-4 h-4 mr-1" /> Cultura</TabsTrigger>
          <TabsTrigger value="fap"><Calculator className="w-4 h-4 mr-1" /> FAP</TabsTrigger>
          <TabsTrigger value="piramide"><Shield className="w-4 h-4 mr-1" /> Pirâmide</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Buscar por código, nome, setor..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
            <Select value={filters.tipo} onValueChange={(v) => setFilters((f) => ({ ...f, tipo: v }))}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                <SelectItem value="incidente">Incidentes</SelectItem>
                <SelectItem value="acidente">Acidentes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="em_aberto">Em Aberto</SelectItem>
                <SelectItem value="em_analise">Em Análise</SelectItem>
                <SelectItem value="acoes_andamento">Ações em Andamento</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.unidade} onValueChange={(v) => setFilters((f) => ({ ...f, unidade: v }))}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Unidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas Unidades</SelectItem>
                {[...new Set(eventos.map((e) => e.unidade).filter(Boolean))].map((u) => (
                  <SelectItem key={u!} value={u!}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.turno} onValueChange={(v) => setFilters((f) => ({ ...f, turno: v }))}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Turno" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Turnos</SelectItem>
                {["1º Turno", "2º Turno", "3º Turno", "Outro"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="w-36"
              placeholder="Data início"
              value={filters.dataInicio}
              onChange={(e) => setFilters((f) => ({ ...f, dataInicio: e.target.value }))}
            />
            <Input
              type="date"
              className="w-36"
              placeholder="Data fim"
              value={filters.dataFim}
              onChange={(e) => setFilters((f) => ({ ...f, dataFim: e.target.value }))}
            />
          </div>

          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : (
            <EventoSSTList
              eventos={eventos}
              onSelect={setSelected}
              onEdit={(e) => { setEditing(e); setShowForm(true); }}
              filters={filters}
            />
          )}
        </TabsContent>

        <TabsContent value="dashboard">
          <EventoSSTDashboard eventos={eventos} />
        </TabsContent>

        <TabsContent value="indicadores" className="space-y-4">
          <IndicadoresEstrategicos eventos={eventos} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <AnalyticsAvancado eventos={eventos} />
        </TabsContent>

        <TabsContent value="preditivo" className="space-y-4">
          <AnalysePreditiva eventos={eventos} />
        </TabsContent>

        <TabsContent value="cultura" className="space-y-4">
          <CulturaSeguranca eventos={eventos} />
        </TabsContent>

        <TabsContent value="fap" className="space-y-4">
          <SimuladorFAP eventos={eventos} />
        </TabsContent>

        <TabsContent value="piramide">
          <div className="max-w-lg mx-auto">
            <PiramideSeguranca eventos={eventos} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Guia Rápido */}
      <GuiaRapidoIncidentes open={showGuia} onOpenChange={setShowGuia} />

      {/* Form */}
      <EventoSSTForm
        open={showForm}
        onOpenChange={setShowForm}
        initial={editing}
        onSubmit={async (data) => {
          if (editing) {
            await updateEvento.mutateAsync({ ...data, id: editing.id } as any);
          } else {
            await createEvento.mutateAsync(data);
          }
        }}
        isPending={createEvento.isPending || updateEvento.isPending}
      />
    </div>
    </TooltipProvider>
  );
}

