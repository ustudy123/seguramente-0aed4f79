import { motion } from "framer-motion";
import { Brain, Cog, Heart, BarChart3, Loader2 } from "lucide-react";
import { PilarCard } from "./PilarCard";
import { useDashboardData } from "@/hooks/useDashboardData";

export const DashboardPilares = () => {
  const { data, isLoading, error } = useDashboardData();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-64 bg-muted/50 rounded-xl animate-pulse flex items-center justify-center"
          >
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 text-center">
        <p className="text-destructive">Erro ao carregar dados do dashboard</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Pilar 1 - Organização do Trabalho */}
      <PilarCard
        title="Organização do Trabalho"
        description="Papéis, responsabilidades e estrutura"
        icon={Brain}
        score={data.organizacao.score}
        color="navy"
        delay={0.1}
        pilarIndicator="organizacao"
        hasData={data.organizacao.cargosDefinidos > 0 || data.organizacao.departamentos > 0 || data.organizacao.admissoesAndamento > 0}
        metrics={[
          {
            label: "Funções Definidas",
            value: data.organizacao.cargosDefinidos,
            link: "/cadastros/cargos",
            indicatorType: "cargos",
          },
          {
            label: "Departamentos",
            value: data.organizacao.departamentos,
            link: "/cadastros/departamentos",
            indicatorType: "departamentos",
          },
          {
            label: "Admissões em Andamento",
            value: data.organizacao.admissoesAndamento,
            link: "/admissao",
            indicatorType: "admissoes",
          },
        ]}
      />

      {/* Pilar 2 - Condições de Execução */}
      <PilarCard
        title="Condições de Execução"
        description="Ergonomia, EPIs e ambiente"
        icon={Cog}
        score={data.condicoes.score}
        color="green"
        delay={0.2}
        pilarIndicator="condicoes"
        hasData={data.condicoes.itensNr17Total > 0 || data.condicoes.episDisponiveis > 0 || data.condicoes.riscosAtivos > 0}
        metrics={[
          {
            label: "NR-17 Atendidos",
            value: `${data.condicoes.itensNr17Atendidos}/${data.condicoes.itensNr17Total}`,
            link: "/ergonomia",
            indicatorType: "nr17",
          },
          {
            label: "EPIs Disponíveis",
            value: data.condicoes.episDisponiveis,
            link: "/epis",
            indicatorType: "epis",
          },
          {
            label: "Riscos Ativos",
            value: data.condicoes.riscosAtivos,
            link: "/ergonomia",
            indicatorType: "riscos",
          },
        ]}
      />

      {/* Pilar 3 - Experiência Humana */}
      <PilarCard
        title="Experiência Humana"
        description="Bem-estar, clima e engajamento"
        icon={Heart}
        score={data.experiencia.score}
        color="purple"
        delay={0.3}
        pilarIndicator="experiencia"
        hasData={data.experiencia.humorTotal >= 3 || data.experiencia.ouvidoriaPendente > 0 || data.experiencia.feedPostsHoje > 0}
        metrics={[
          {
            label: "Humor Positivo (7d)",
            value: data.experiencia.humorTotal > 0 
              ? `${Math.round((data.experiencia.humorPositivo / data.experiencia.humorTotal) * 100)}%` 
              : "—",
            indicatorType: "humor",
          },
          {
            label: "Ouvidoria Pendente",
            value: data.experiencia.ouvidoriaPendente,
            change: data.experiencia.ouvidoriaPendente > 0 ? data.experiencia.ouvidoriaPendente : undefined,
            link: "/ouvidoria",
            indicatorType: "ouvidoria",
          },
          {
            label: "Posts Hoje",
            value: data.experiencia.feedPostsHoje,
            link: "/feed",
            indicatorType: "feed",
          },
        ]}
      />

      {/* Pilar 4 - Governança e Impacto */}
      <PilarCard
        title="Governança e Impacto"
        description="Ações, evidências e compliance"
        icon={BarChart3}
        score={data.governanca.score}
        color="amber"
        delay={0.4}
        pilarIndicator="governanca"
        hasData={data.governanca.acoesTotal > 0 || data.governanca.evidenciasEnviadas > 0 || data.governanca.terceirosAtivos > 0}
        metrics={[
          {
            label: "Ações em Andamento",
            value: data.governanca.acoesEmAndamento,
            link: "/ergonomia",
            indicatorType: "acoes",
          },
          {
            label: "Ações Concluídas",
            value: `${data.governanca.acoesConcluidas}/${data.governanca.acoesTotal}`,
            indicatorType: "acoes",
          },
          {
            label: "Evidências Enviadas",
            value: data.governanca.evidenciasEnviadas,
            indicatorType: "evidencias",
          },
        ]}
      />
    </div>
  );
};