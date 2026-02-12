import { useState } from "react";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal, Store, Users, ShoppingBag, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMarketplace, type MarketplaceServico } from "@/hooks/useMarketplace";
import { MarketplaceStats } from "@/components/marketplace/MarketplaceStats";
import { MarketplaceCategorias } from "@/components/marketplace/MarketplaceCategorias";
import { ProfissionalCard } from "@/components/marketplace/ProfissionalCard";
import { ServicoCard } from "@/components/marketplace/ServicoCard";
import { ContratacoesList } from "@/components/marketplace/ContratacoesList";
import { ContratacaoModal } from "@/components/marketplace/ContratacaoModal";

export default function Marketplace() {
  const {
    categorias,
    servicos,
    profissionais,
    contratacoes,
    filters,
    setFilters,
    contratar,
    isLoadingServicos,
    isLoadingProfissionais,
  } = useMarketplace();

  const [activeTab, setActiveTab] = useState("servicos");
  const [servicoSelecionado, setServicoSelecionado] = useState<MarketplaceServico | null>(null);

  const totalConcluidas = contratacoes.filter((c) => c.status === "concluida").length;

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 p-8 text-white"
      >
        {/* BG effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
          <div className="absolute top-1/3 left-1/2 w-40 h-40 bg-cyan-500/5 rounded-full blur-2xl animate-pulse [animation-delay:2s]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent">
                Marketplace de Serviços
              </h1>
              <p className="text-indigo-300/80 text-sm">
                Hub de serviços especializados orientado por risco, norma e ação
              </p>
            </div>
          </div>
          <p className="text-sm text-indigo-200/60 mt-3 max-w-2xl">
            Conecte sua empresa a profissionais legalmente habilitados. Cada serviço gera evidência, 
            cada evidência gera proteção. Segurança jurídica e ética profissional garantidas.
          </p>
        </div>
      </motion.div>

      {/* Stats */}
      <MarketplaceStats
        totalProfissionais={profissionais.length}
        totalServicos={servicos.length}
        totalContratacoes={contratacoes.length}
        totalConcluidas={totalConcluidas}
      />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar serviços, profissionais ou especialidades..."
          value={filters.busca || ""}
          onChange={(e) => setFilters((f) => ({ ...f, busca: e.target.value }))}
          className="pl-10"
        />
      </div>

      {/* Categories */}
      <MarketplaceCategorias
        categorias={categorias}
        selectedId={filters.categoria_id}
        onSelect={(id) => setFilters((f) => ({ ...f, categoria_id: id }))}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="servicos" className="gap-1.5">
            <ShoppingBag className="h-4 w-4" /> Serviços
          </TabsTrigger>
          <TabsTrigger value="profissionais" className="gap-1.5">
            <Users className="h-4 w-4" /> Profissionais
          </TabsTrigger>
          <TabsTrigger value="contratacoes" className="gap-1.5">
            <History className="h-4 w-4" /> Minhas Contratações
          </TabsTrigger>
        </TabsList>

        {/* Serviços */}
        <TabsContent value="servicos" className="mt-4">
          {isLoadingServicos ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Carregando serviços...</div>
          ) : servicos.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Nenhum serviço disponível no momento.</p>
              <p className="text-xs text-muted-foreground mt-1">Novos profissionais estão sendo validados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {servicos.map((servico) => (
                <ServicoCard
                  key={servico.id}
                  servico={servico}
                  onContratar={setServicoSelecionado}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Profissionais */}
        <TabsContent value="profissionais" className="mt-4">
          {isLoadingProfissionais ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Carregando profissionais...</div>
          ) : profissionais.length === 0 ? (
            <div className="text-center py-16">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Nenhum profissional ativo no momento.</p>
              <p className="text-xs text-muted-foreground mt-1">Profissionais estão sendo verificados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profissionais.map((prof) => (
                <ProfissionalCard
                  key={prof.id}
                  profissional={prof}
                  onVerServicos={(id) => {
                    setFilters((f) => ({ ...f, busca: "" }));
                    setActiveTab("servicos");
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Contratações */}
        <TabsContent value="contratacoes" className="mt-4">
          <ContratacoesList contratacoes={contratacoes} />
        </TabsContent>
      </Tabs>

      {/* Modal de contratação */}
      <ContratacaoModal
        servico={servicoSelecionado}
        open={!!servicoSelecionado}
        onClose={() => setServicoSelecionado(null)}
        onConfirm={(data) => {
          contratar.mutate(data, {
            onSuccess: () => setServicoSelecionado(null),
          });
        }}
        isLoading={contratar.isPending}
      />
    </div>
  );
}
