import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Building2, LayoutDashboard, List, Clock, ClipboardCheck, BookOpen, Upload } from "lucide-react";
import { ImportarTerceirosModal } from "@/components/terceiros/ImportarTerceirosModal";
import { useTerceiros } from "@/hooks/useTerceiros";
import { TerceiroDashboard } from "@/components/terceiros/TerceiroDashboard";
import { TerceiroList } from "@/components/terceiros/TerceiroList";
import { TerceiroForm } from "@/components/terceiros/TerceiroForm";
import { TerceiroDetail } from "@/components/terceiros/TerceiroDetail";
import { VencimentosPanel } from "@/components/terceiros/VencimentosPanel";
import { PermissaoTrabalhoPanel } from "@/components/terceiros/PermissaoTrabalhoPanel";
import { GuiaRapidoTerceiros } from "@/components/terceiros/GuiaRapidoTerceiros";
import type { Terceiro } from "@/types/terceiros";

export default function Terceiros() {
  const { terceiros, isLoading, createTerceiro, updateTerceiro, deleteTerceiro } = useTerceiros();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Terceiro | null>(null);
  const [selected, setSelected] = useState<Terceiro | null>(null);
  const [showGuia, setShowGuia] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const filtered = terceiros.filter(
    (t) =>
      t.razao_social.toLowerCase().includes(search.toLowerCase()) ||
      t.cnpj.includes(search) ||
      (t.nome_fantasia || "").toLowerCase().includes(search.toLowerCase())
  );

  if (selected) {
    return (
      <div className="p-6 space-y-6">
        <TerceiroDetail terceiro={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-7 h-7 text-primary" />
            Gestão de Terceiros & SST
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compliance, controle documental e prova jurídica de prestadores de serviço.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowGuia(true)}>
            <BookOpen className="w-4 h-4 mr-2" /> Guia Rapido
          </Button>
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4 mr-2" /> Importar
          </Button>
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Novo Terceiro
          </Button>
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard"><LayoutDashboard className="w-4 h-4 mr-1" /> Dashboard</TabsTrigger>
          <TabsTrigger value="terceiros"><List className="w-4 h-4 mr-1" /> Terceiros</TabsTrigger>
          <TabsTrigger value="permissoes"><ClipboardCheck className="w-4 h-4 mr-1" /> Permissões de Trabalho</TabsTrigger>
          <TabsTrigger value="vencimentos"><Clock className="w-4 h-4 mr-1" /> Vencimentos</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <TerceiroDashboard terceiros={terceiros} />
        </TabsContent>

        <TabsContent value="terceiros" className="space-y-4">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Buscar por razão social, CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : (
            <TerceiroList
              terceiros={filtered}
              onSelect={setSelected}
              onEdit={(t) => { setEditing(t); setShowForm(true); }}
              onDelete={(id) => deleteTerceiro.mutate(id)}
            />
          )}
        </TabsContent>

        <TabsContent value="permissoes">
          <PermissaoTrabalhoPanel />
        </TabsContent>

        <TabsContent value="vencimentos">
          <VencimentosPanel />
        </TabsContent>
      </Tabs>

      {/* Form */}
      <TerceiroForm
        open={showForm}
        onOpenChange={setShowForm}
        initial={editing}
        onSubmit={async (data) => {
          if (editing) {
            return await updateTerceiro.mutateAsync({ ...data, id: editing.id } as any);
          }
          return await createTerceiro.mutateAsync(data);
        }}
        isPending={createTerceiro.isPending || updateTerceiro.isPending}
      />

      <GuiaRapidoTerceiros open={showGuia} onOpenChange={setShowGuia} />
      <ImportarTerceirosModal open={showImport} onOpenChange={setShowImport} />
    </div>
  );
}
