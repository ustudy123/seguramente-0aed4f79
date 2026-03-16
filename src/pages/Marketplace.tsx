import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Search, Store, Users, ShoppingBag, History, UserPlus, Briefcase, CheckCircle2, MapPin, Locate, Shield, Star, Link2, ShieldAlert, Package, BarChart3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMarketplace, type MarketplaceServico, type MarketplaceContratacao } from "@/hooks/useMarketplace";
import { MarketplaceStats } from "@/components/marketplace/MarketplaceStats";
import { MarketplaceCategorias } from "@/components/marketplace/MarketplaceCategorias";
import { ProfissionalCard } from "@/components/marketplace/ProfissionalCard";
import { ServicoCard } from "@/components/marketplace/ServicoCard";
import { ContratacoesList } from "@/components/marketplace/ContratacoesList";
import { ContratacaoModal } from "@/components/marketplace/ContratacaoModal";
import { ProfissionalFormModal } from "@/components/marketplace/ProfissionalFormModal";
import { ServicoFormModal } from "@/components/marketplace/ServicoFormModal";
import { ConfirmacaoExecucaoModal } from "@/components/marketplace/ConfirmacaoExecucaoModal";
import { AvaliacaoModal } from "@/components/marketplace/AvaliacaoModal";
import { ValidacaoProfissionais } from "@/components/marketplace/ValidacaoProfissionais";
import { AfiliadosDashboard } from "@/components/marketplace/AfiliadosDashboard";
import { DenunciasList } from "@/components/marketplace/DenunciasList";
import { DenunciaForm } from "@/components/marketplace/DenunciaForm";
import { PacotesServicos } from "@/components/marketplace/PacotesServicos";
import { PerformanceDashboard } from "@/components/marketplace/PerformanceDashboard";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Marketplace() {
  const queryClient = useQueryClient();
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
  const [showProfissionalForm, setShowProfissionalForm] = useState(false);
  const [showServicoForm, setShowServicoForm] = useState(false);
  const [contratacaoParaConfirmar, setContratacaoParaConfirmar] = useState<MarketplaceContratacao | null>(null);
  const [contratacaoParaAvaliar, setContratacaoParaAvaliar] = useState<MarketplaceContratacao | null>(null);
  const [denunciaTarget, setDenunciaTarget] = useState<{ id: string; nome: string } | null>(null);
  const [localizando, setLocalizando] = useState(false);

  const ativarLocalizacao = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Seu navegador não suporta geolocalização");
      return;
    }
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFilters((f) => ({
          ...f,
          userLat: pos.coords.latitude,
          userLng: pos.coords.longitude,
        }));
        setLocalizando(false);
        toast.success("Localização ativada! Profissionais serão ordenados por proximidade.");
      },
      () => {
        setLocalizando(false);
        toast.error("Não foi possível obter sua localização");
      }
    );
  }, [setFilters]);

  const totalConcluidas = contratacoes.filter((c) => c.status === "concluida").length;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["marketplace-profissionais"] });
    queryClient.invalidateQueries({ queryKey: ["marketplace-servicos"] });
    queryClient.invalidateQueries({ queryKey: ["marketplace-contratacoes"] });
  };

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
                Rede de Parceiros
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
          <div className="flex gap-2 mt-4">
            <Button
              size="sm"
              onClick={() => setShowProfissionalForm(true)}
              className="bg-white/10 text-white border border-white/20 hover:bg-white/20"
            >
              <UserPlus className="h-4 w-4 mr-1.5" />
              Cadastrar como Profissional
            </Button>
            <Button
              size="sm"
              onClick={() => setShowServicoForm(true)}
              className="bg-white/10 text-white border border-white/20 hover:bg-white/20"
            >
              <Briefcase className="h-4 w-4 mr-1.5" />
              Ofertar Serviço
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <MarketplaceStats
        totalProfissionais={profissionais.length}
        totalServicos={servicos.length}
        totalContratacoes={contratacoes.length}
        totalConcluidas={totalConcluidas}
      />

      {/* Search + Location */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar serviços, profissionais ou especialidades..."
            value={filters.busca || ""}
            onChange={(e) => setFilters((f) => ({ ...f, busca: e.target.value }))}
            className="pl-10"
          />
        </div>
        <Button
          variant={filters.userLat ? "default" : "outline"}
          size="sm"
          onClick={ativarLocalizacao}
          disabled={localizando}
          className="shrink-0 gap-1.5"
        >
          <Locate className="h-4 w-4" />
          {localizando ? "Localizando..." : filters.userLat ? "Proximidade ativa" : "Buscar por proximidade"}
        </Button>
      </div>

      {/* Categories */}
      <MarketplaceCategorias
        categorias={categorias}
        selectedId={filters.categoria_id}
        onSelect={(id) => setFilters((f) => ({ ...f, categoria_id: id }))}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="servicos" className="gap-1.5">
            <ShoppingBag className="h-4 w-4" /> Serviços
          </TabsTrigger>
          <TabsTrigger value="pacotes" className="gap-1.5">
            <Package className="h-4 w-4" /> Pacotes
          </TabsTrigger>
          <TabsTrigger value="profissionais" className="gap-1.5">
            <Users className="h-4 w-4" /> Profissionais
          </TabsTrigger>
          <TabsTrigger value="contratacoes" className="gap-1.5">
            <History className="h-4 w-4" /> Minhas Contratações
          </TabsTrigger>
          <TabsTrigger value="validacao" className="gap-1.5">
            <Shield className="h-4 w-4" /> Validação
          </TabsTrigger>
          <TabsTrigger value="afiliados" className="gap-1.5">
            <Link2 className="h-4 w-4" /> Afiliados
          </TabsTrigger>
          <TabsTrigger value="denuncias" className="gap-1.5">
            <ShieldAlert className="h-4 w-4" /> Denúncias
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Performance
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
                  onDenunciar={(id, nome) => setDenunciaTarget({ id, nome })}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Contratações */}
        <TabsContent value="contratacoes" className="mt-4">
          <ContratacoesList
            contratacoes={contratacoes}
            onConfirmarExecucao={setContratacaoParaConfirmar}
            onAvaliar={setContratacaoParaAvaliar}
          />
        </TabsContent>

        {/* Validação Admin */}
        <TabsContent value="validacao" className="mt-4">
          <ValidacaoProfissionais />
        </TabsContent>

        {/* Afiliados */}
        <TabsContent value="afiliados" className="mt-4">
          <AfiliadosDashboard />
        </TabsContent>

        {/* Pacotes */}
        <TabsContent value="pacotes" className="mt-4">
          <PacotesServicos />
        </TabsContent>

        {/* Denúncias */}
        <TabsContent value="denuncias" className="mt-4">
          <DenunciasList />
        </TabsContent>

        {/* Performance */}
        <TabsContent value="performance" className="mt-4">
          <PerformanceDashboard />
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

      {/* Professional registration */}
      <ProfissionalFormModal
        open={showProfissionalForm}
        onClose={() => setShowProfissionalForm(false)}
        onSuccess={invalidateAll}
      />

      {/* Service offering - needs a profissional_id, use first one for now */}
      {showServicoForm && (
        <ServicoFormModal
          open={showServicoForm}
          onClose={() => setShowServicoForm(false)}
          onSuccess={invalidateAll}
          profissionalId={profissionais[0]?.id || ""}
          categorias={categorias}
        />
      )}

      {/* Confirmation flow */}
      <ConfirmacaoExecucaoModal
        contratacao={contratacaoParaConfirmar}
        open={!!contratacaoParaConfirmar}
        onClose={() => setContratacaoParaConfirmar(null)}
        onSuccess={invalidateAll}
      />

      {/* Avaliação pós-serviço */}
      <AvaliacaoModal
        contratacao={contratacaoParaAvaliar}
        open={!!contratacaoParaAvaliar}
        onClose={() => setContratacaoParaAvaliar(null)}
        onSuccess={invalidateAll}
      />

      {/* Denúncia form */}
      {denunciaTarget && (
        <DenunciaForm
          profissionalId={denunciaTarget.id}
          profissionalNome={denunciaTarget.nome}
          open={!!denunciaTarget}
          onClose={() => setDenunciaTarget(null)}
          onSuccess={invalidateAll}
        />
      )}
    </div>
  );
}
