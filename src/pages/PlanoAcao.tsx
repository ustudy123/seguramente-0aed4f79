import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Target, 
  Plus, 
  Inbox, 
  BarChart3, 
  AlertTriangle,
  Filter,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlanoAcaoStats } from "@/components/planoAcao/PlanoAcaoStats";
import { PlanoAcaoList } from "@/components/planoAcao/PlanoAcaoList";
import { PlanoAcaoInbox } from "@/components/planoAcao/PlanoAcaoInbox";
import { PlanoAcaoFormModal } from "@/components/planoAcao/PlanoAcaoFormModal";
import { PlanoAcaoFilters } from "@/components/planoAcao/PlanoAcaoFilters";
import { PlanoAcaoIAAssistant } from "@/components/planoAcao/PlanoAcaoIAAssistant";
import { usePlanoAcao } from "@/hooks/usePlanoAcao";
import type { PlanoAcaoFilters as FilterType } from "@/types/planoAcao";

export default function PlanoAcao() {
  const [activeTab, setActiveTab] = useState("todas");
  const [showFormModal, setShowFormModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterType>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [activeStatFilter, setActiveStatFilter] = useState<string | null>(null);

  const { 
    acoes, 
    isLoadingAcoes, 
    stats, 
    isLoadingStats,
    minhasResponsavel,
    minhasCriadas,
    isLoadingMinhasAcoes,
  } = usePlanoAcao({ 
    ...filters, 
    busca: searchTerm || undefined 
  });

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const handleStatClick = (key: string) => {
    if (activeStatFilter === key) {
      // Toggle off
      setActiveStatFilter(null);
      setFilters(prev => ({ ...prev, status: undefined }));
      setActiveTab("todas");
      return;
    }

    setActiveStatFilter(key);
    setActiveTab("todas");

    const statusMap: Record<string, FilterType["status"]> = {
      pendentes: ["pendente"],
      em_andamento: ["em_andamento"],
      concluidas: ["concluida"],
    };

    if (key === "total") {
      setFilters(prev => ({ ...prev, status: undefined }));
    } else if (key === "atrasadas") {
      // "Atrasadas" is not a status, handled via tab
      setFilters(prev => ({ ...prev, status: undefined }));
      setActiveTab("criticas");
    } else if (statusMap[key]) {
      setFilters(prev => ({ ...prev, status: statusMap[key] }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-7 w-7 text-primary" />
            Plano de Ação
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestão estratégica de ações com metodologia 5W2H e Matriz GUT
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? "bg-primary/10" : ""}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
          <Button onClick={() => setShowFormModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Ação
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <PlanoAcaoStats stats={stats} isLoading={isLoadingStats} activeStatFilter={activeStatFilter} onStatClick={handleStatClick} />

      {/* Assistente IA */}
      <PlanoAcaoIAAssistant />

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, título, descrição ou responsável..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Chips rápidos de Status */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { v: "pendente", label: "Pendentes" },
              { v: "em_andamento", label: "Em andamento" },
              { v: "concluida", label: "Concluídas" },
            ].map((s) => {
              const active = filters.status?.includes(s.v as any);
              return (
                <Badge
                  key={s.v}
                  variant={active ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    const cur = filters.status || [];
                    const upd = cur.includes(s.v as any)
                      ? cur.filter((x) => x !== s.v)
                      : [...cur, s.v as any];
                    setFilters({ ...filters, status: upd.length ? upd : undefined });
                  }}
                >
                  {s.label}
                </Badge>
              );
            })}
          </div>

          {/* Chips rápidos de Prioridade */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { v: "imediato", label: "🔴 Imediato" },
              { v: "urgente", label: "🟠 Urgente" },
            ].map((p) => {
              const active = filters.prioridade?.includes(p.v as any);
              return (
                <Badge
                  key={p.v}
                  variant={active ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    const cur = filters.prioridade || [];
                    const upd = cur.includes(p.v as any)
                      ? cur.filter((x) => x !== p.v)
                      : [...cur, p.v as any];
                    setFilters({ ...filters, prioridade: upd.length ? upd : undefined });
                  }}
                >
                  {p.label}
                </Badge>
              );
            })}
          </div>

          {(searchTerm || Object.keys(filters).length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setFilters({});
                setActiveStatFilter(null);
              }}
            >
              <X className="h-4 w-4 mr-1" /> Limpar
            </Button>
          )}
        </div>

        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <PlanoAcaoFilters 
              filters={filters} 
              onChange={setFilters} 
              onClear={() => setFilters({})}
            />
          </motion.div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="todas" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Todas
          </TabsTrigger>
          <TabsTrigger value="minhas" className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Minha Caixa
            {(minhasResponsavel.length + minhasCriadas.length) > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                {minhasResponsavel.length + minhasCriadas.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="criticas" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Críticas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todas">
          <PlanoAcaoList 
            acoes={acoes} 
            isLoading={isLoadingAcoes} 
          />
        </TabsContent>

        <TabsContent value="minhas">
          <PlanoAcaoInbox 
            responsavel={minhasResponsavel} 
            criadas={minhasCriadas}
            isLoading={isLoadingMinhasAcoes} 
          />
        </TabsContent>

        <TabsContent value="criticas">
          <PlanoAcaoList 
            acoes={acoes.filter(a => 
              a.prioridade === 'imediato' || 
              a.prioridade === 'urgente' ||
              (a.prazo && new Date(a.prazo) < new Date())
            )} 
            isLoading={isLoadingAcoes} 
            emptyMessage="Nenhuma ação crítica ou atrasada"
          />
        </TabsContent>
      </Tabs>

      {/* Modal de criação */}
      <PlanoAcaoFormModal
        open={showFormModal}
        onOpenChange={setShowFormModal}
      />
    </div>
  );
}
