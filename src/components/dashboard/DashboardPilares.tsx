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
        metrics={[
          {
            label: "Cargos Definidos",
            value: data.organizacao.cargosDefinidos,
            link: "/cadastros/cargos",
          },
          {
            label: "Departamentos",
            value: data.organizacao.departamentos,
            link: "/cadastros/departamentos",
          },
          {
            label: "Admissões em Andamento",
            value: data.organizacao.admissoesAndamento,
            link: "/admissao",
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
        metrics={[
          {
            label: "NR-17 Atendidos",
            value: `${data.condicoes.itensNr17Atendidos}/${data.condicoes.itensNr17Total}`,
            link: "/ergonomia",
          },
          {
            label: "EPIs Disponíveis",
            value: data.condicoes.episDisponiveis,
            link: "/epis",
          },
          {
            label: "Riscos Ativos",
            value: data.condicoes.riscosAtivos,
            change: data.condicoes.riscosAtivos > 5 ? 10 : -5,
            link: "/ergonomia",
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
        metrics={[
          {
            label: "Humor Positivo (7d)",
            value: data.experiencia.humorTotal > 0 
              ? `${Math.round((data.experiencia.humorPositivo / data.experiencia.humorTotal) * 100)}%` 
              : "—",
            change: data.experiencia.humorTotal > 0 ? 5 : undefined,
          },
          {
            label: "Ouvidoria Pendente",
            value: data.experiencia.ouvidoriaPendente,
            change: data.experiencia.ouvidoriaPendente > 0 ? data.experiencia.ouvidoriaPendente : undefined,
            link: "/ouvidoria",
          },
          {
            label: "Posts Hoje",
            value: data.experiencia.feedPostsHoje,
            link: "/feed",
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
        metrics={[
          {
            label: "Ações em Andamento",
            value: data.governanca.acoesEmAndamento,
            link: "/ergonomia",
          },
          {
            label: "Ações Concluídas",
            value: `${data.governanca.acoesConcluidas}/${data.governanca.acoesTotal}`,
            change: data.governanca.acoesTotal > 0 
              ? Math.round((data.governanca.acoesConcluidas / data.governanca.acoesTotal) * 100) - 50 
              : undefined,
          },
          {
            label: "Evidências Enviadas",
            value: data.governanca.evidenciasEnviadas,
          },
        ]}
      />
    </div>
  );
};
