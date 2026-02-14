import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Shield, LayoutDashboard, List, BarChart3 } from "lucide-react";
import { useEventosSST } from "@/hooks/useEventosSST";
import { EventoSSTStats } from "@/components/incidentes/EventoSSTStats";
import { EventoSSTList } from "@/components/incidentes/EventoSSTList";
import { EventoSSTForm } from "@/components/incidentes/EventoSSTForm";
import { EventoSSTDetail } from "@/components/incidentes/EventoSSTDetail";
import { EventoSSTDashboard } from "@/components/incidentes/EventoSSTDashboard";
import { PiramideSeguranca } from "@/components/incidentes/PiramideSeguranca";
import type { EventoSST } from "@/types/eventoSST";

export default function IncidentesAcidentes() {
  const { eventos, isLoading, stats, createEvento, updateEvento } = useEventosSST();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EventoSST | null>(null);
  const [selected, setSelected] = useState<EventoSST | null>(null);
  const [filters, setFilters] = useState({ tipo: "todos", status: "todos", search: "" });

  if (selected) {
    return (
      <div className="p-6 space-y-6">
        <EventoSSTDetail evento={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" />
            Incidentes & Acidentes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registro, rastreabilidade e ações preventivas/corretivas em SST.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Registrar Evento
        </Button>
      </div>

      <EventoSSTStats stats={stats} />

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista"><List className="w-4 h-4 mr-1" /> Ocorrências</TabsTrigger>
          <TabsTrigger value="dashboard"><LayoutDashboard className="w-4 h-4 mr-1" /> Análise</TabsTrigger>
          <TabsTrigger value="piramide"><BarChart3 className="w-4 h-4 mr-1" /> Pirâmide</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
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
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="em_aberto">Em Aberto</SelectItem>
                <SelectItem value="em_analise">Em Análise</SelectItem>
                <SelectItem value="acoes_andamento">Ações em Andamento</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : (
            <EventoSSTList eventos={eventos} onSelect={setSelected} filters={filters} />
          )}
        </TabsContent>

        <TabsContent value="dashboard">
          <EventoSSTDashboard eventos={eventos} />
        </TabsContent>

        <TabsContent value="piramide">
          <div className="max-w-lg mx-auto">
            <PiramideSeguranca eventos={eventos} />
          </div>
        </TabsContent>
      </Tabs>

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
  );
}
