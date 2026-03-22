import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard, UserPlus, UserMinus, Umbrella, AlertOctagon,
  FileBarChart, Stethoscope, FileQuestion, List, BarChart2, Settings,
  Kanban, Users, Clock
} from "lucide-react";
import { useHubProcessos } from "@/hooks/useHubProcessos";
import { HubPainel } from "@/components/hub-contabil/HubPainel";
import { HubProcessoLista } from "@/components/hub-contabil/HubProcessoLista";
import { HubProcessoDetalhe } from "@/components/hub-contabil/HubProcessoDetalhe";
import { HubNovoProcessoModal } from "@/components/hub-contabil/HubNovoProcessoModal";
import { HubRelatorios } from "@/components/hub-contabil/HubRelatorios";
import { HubSlaConfig } from "@/components/hub-contabil/HubSlaConfig";
import { HubFeriasIntegracao } from "@/components/hub-contabil/HubFeriasIntegracao";
import { HubKanban } from "@/components/hub-contabil/HubKanban";
import { HubColaboradorTimeline } from "@/components/hub-contabil/HubColaboradorTimeline";

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
  { value: "kanban", label: "Kanban", icon: Kanban, tipo: undefined },
  { value: "colaboradores", label: "Colaboradores", icon: Users, tipo: undefined },
  { value: "relatorios", label: "Relatórios", icon: BarChart2, tipo: undefined },
  { value: "configuracoes", label: "Config.", icon: Settings, tipo: undefined },
];

const HubContabil = () => {
  const [activeTab, setActiveTab] = useState("painel");
  const [processoSelecionado, setProcessoSelecionado] = useState<string | null>(null);
  const [modalNovo, setModalNovo] = useState(false);
  const [tipoNovo, setTipoNovo] = useState<string | undefined>(undefined);

  const { processos, contabilidades, loading, criarProcesso, fetchAll } = useHubProcessos();

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
      {/* Integração automática de férias */}
      <HubFeriasIntegracao />

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
              let count = 0;
              if (tab.tipo) {
                count = processos.filter(p => p.tipo === tab.tipo && !["concluido", "cancelado"].includes(p.status)).length;
              } else if (tab.value === "todos") {
                count = processos.filter(p => !["concluido", "cancelado"].includes(p.status)).length;
              }

              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="gap-1.5 text-xs whitespace-nowrap px-3 py-2"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {count > 0 && (
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

        {/* Kanban */}
        <TabsContent value="kanban" className="mt-5">
          <HubKanban
            processos={processos}
            onNovoProcesso={() => handleNovoProcesso()}
            onVerProcesso={id => setProcessoSelecionado(id)}
            onRefresh={fetchAll}
          />
        </TabsContent>

        {/* Linha do tempo por colaborador */}
        <TabsContent value="colaboradores" className="mt-5">
          <HubColaboradorTimeline
            processos={processos}
            onVerProcesso={id => setProcessoSelecionado(id)}
          />
        </TabsContent>

        {/* Relatórios */}
        <TabsContent value="relatorios" className="mt-5">
          <HubRelatorios processos={processos} loading={loading} />
        </TabsContent>

        {/* Configurações */}
        <TabsContent value="configuracoes" className="mt-5">
          <HubSlaConfig contabilidades={contabilidades} onRefresh={fetchAll} />
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
