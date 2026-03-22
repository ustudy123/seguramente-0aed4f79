import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard, UserPlus, UserMinus, Umbrella, AlertOctagon,
  FileBarChart, Stethoscope, FileQuestion, Settings, List
} from "lucide-react";
import { useHubProcessos } from "@/hooks/useHubProcessos";
import { HubPainel } from "@/components/hub-contabil/HubPainel";
import { HubProcessoLista } from "@/components/hub-contabil/HubProcessoLista";
import { HubProcessoDetalhe } from "@/components/hub-contabil/HubProcessoDetalhe";
import { HubNovoProcessoModal } from "@/components/hub-contabil/HubNovoProcessoModal";

const NAV_TABS = [
  { value: "painel", label: "Painel", icon: LayoutDashboard, tipo: undefined },
  { value: "admissao", label: "Admissão", icon: UserPlus, tipo: "admissao" },
  { value: "demissao", label: "Demissão", icon: UserMinus, tipo: "demissao" },
  { value: "ferias", label: "Férias", icon: Umbrella, tipo: "ferias" },
  { value: "advertencia", label: "Advertência", icon: AlertOctagon, tipo: "advertencia" },
  { value: "folha", label: "Folha/Ponto", icon: FileBarChart, tipo: "ponto_folha" },
  { value: "atestado", label: "Atestados", icon: Stethoscope, tipo: "atestado_afastamento" },
  { value: "geral", label: "Geral", icon: FileQuestion, tipo: "solicitacao_geral" },
  { value: "todos", label: "Todos", icon: List, tipo: undefined },
];

const HubContabil = () => {
  const [activeTab, setActiveTab] = useState("painel");
  const [processoSelecionado, setProcessoSelecionado] = useState<string | null>(null);
  const [modalNovo, setModalNovo] = useState(false);
  const [tipoNovo, setTipoNovo] = useState<string | undefined>(undefined);

  const { processos, contabilidades, loading, criarProcesso, fetchAll } = useHubProcessos();

  const currentNav = NAV_TABS.find(t => t.value === activeTab);

  const handleNovoProcesso = (tipo?: string) => {
    setTipoNovo(tipo);
    setModalNovo(true);
  };

  const handleSubmitNovo = async (data: any) => {
    await criarProcesso({
      tipo: data.tipo,
      titulo: data.titulo,
      descricao: data.descricao || null,
      colaborador_nome: data.colaborador_nome || null,
      colaborador_cpf: data.colaborador_cpf || null,
      competencia: data.competencia || null,
      prioridade: data.prioridade || "normal",
      contabilidade_id: data.contabilidade_id || null,
      status: "rascunho",
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Hub de Comunicação Contábil</h1>
        <p className="text-muted-foreground text-sm">
          Centralização e automação da comunicação entre DP, RH e Contabilidade
        </p>
      </div>

      {/* Navegação */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto">
          <TabsList className="flex w-max min-w-full h-auto p-1 gap-1">
            {NAV_TABS.map(tab => {
              const Icon = tab.icon;
              const count = tab.tipo
                ? processos.filter(p => p.tipo === tab.tipo && !["concluido", "cancelado"].includes(p.status)).length
                : tab.value === "todos"
                ? processos.filter(p => !["concluido", "cancelado"].includes(p.status)).length
                : processos.filter(p => !["concluido", "cancelado"].includes(p.status)).length;

              return (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 text-xs whitespace-nowrap px-3 py-2">
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.value !== "painel" && count > 0 && (
                    <span className="ml-1 bg-primary/20 text-primary text-xs rounded-full px-1.5 leading-5 font-medium">
                      {count}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Painel */}
        <TabsContent value="painel" className="mt-5">
          <HubPainel
            processos={processos}
            loading={loading}
            onNovoProcesso={() => handleNovoProcesso()}
            onVerProcesso={id => setProcessoSelecionado(id)}
          />
        </TabsContent>

        {/* Abas por tipo */}
        {NAV_TABS.filter(t => t.tipo).map(tab => (
          <TabsContent key={tab.value} value={tab.value} className="mt-5">
            <HubProcessoLista
              processos={processos}
              loading={loading}
              tipoFiltro={tab.tipo}
              onNovoProcesso={() => handleNovoProcesso(tab.tipo)}
              onVerProcesso={id => setProcessoSelecionado(id)}
            />
          </TabsContent>
        ))}

        {/* Todos */}
        <TabsContent value="todos" className="mt-5">
          <HubProcessoLista
            processos={processos}
            loading={loading}
            onNovoProcesso={() => handleNovoProcesso()}
            onVerProcesso={id => setProcessoSelecionado(id)}
          />
        </TabsContent>
      </Tabs>

      {/* Modal novo processo */}
      <HubNovoProcessoModal
        open={modalNovo}
        onOpenChange={setModalNovo}
        onSubmit={handleSubmitNovo}
        contabilidades={contabilidades}
        tipoInicial={tipoNovo}
      />

      {/* Detalhe do processo */}
      <HubProcessoDetalhe
        processoId={processoSelecionado}
        onClose={() => setProcessoSelecionado(null)}
        onStatusChange={fetchAll}
      />
    </div>
  );
};

export default HubContabil;
