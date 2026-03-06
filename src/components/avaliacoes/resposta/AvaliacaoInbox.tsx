import { useState } from "react";
import { ClipboardCheck, Clock, User, ChevronRight, AlertCircle, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAvaliacoes } from "@/hooks/useAvaliacoes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TIPO_AVALIADOR_LABELS } from "@/types/avaliacao";
import type { AvaliacaoResposta } from "@/types/avaliacao";
import { AvaliacaoFormulario } from "@/components/avaliacoes/formulario/AvaliacaoFormulario";

export function AvaliacaoInbox() {
  const { minhasAvaliacoes, isLoadingMinhasAvaliacoes } = useAvaliacoes();
  const [avaliacaoSelecionada, setAvaliacaoSelecionada] = useState<AvaliacaoResposta | null>(null);

  // Se selecionou, mostra o formulário com botão de voltar
  if (avaliacaoSelecionada) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          className="gap-2"
          onClick={() => setAvaliacaoSelecionada(null)}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Minha Caixa
        </Button>
        <AvaliacaoFormulario
          resposta={avaliacaoSelecionada}
          onConcluir={() => setAvaliacaoSelecionada(null)}
        />
      </div>
    );
  }

  if (isLoadingMinhasAvaliacoes) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4 mx-auto" />
            <div className="h-8 bg-muted rounded w-1/2 mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (minhasAvaliacoes.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-muted rounded-full">
              <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Nenhuma avaliação pendente</h3>
              <p className="text-muted-foreground">
                Você não tem avaliações para responder no momento.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Avaliações Pendentes</h2>
          <p className="text-sm text-muted-foreground">
            Você tem {minhasAvaliacoes.length} avaliação(ões) para responder
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {minhasAvaliacoes.map((avaliacao) => {
          const ciclo = avaliacao.ciclo;
          const dataFim = ciclo?.data_fim ? new Date(ciclo.data_fim) : null;
          const isUrgent = dataFim && dataFim <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

          return (
            <Card
              key={avaliacao.id}
              onClick={() => setAvaliacaoSelecionada(avaliacao)}
              className={`hover:shadow-md transition-all cursor-pointer hover:border-primary/40 ${
                isUrgent ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">
                        {TIPO_AVALIADOR_LABELS[avaliacao.tipo_avaliador]}
                      </Badge>
                      {isUrgent && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Prazo próximo
                        </Badge>
                      )}
                      <Badge
                        variant={avaliacao.status === "pendente" ? "secondary" : "default"}
                      >
                        {avaliacao.status === "pendente" ? "Não iniciada" : "Em andamento"}
                      </Badge>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg">
                        Avaliar: {avaliacao.avaliado_nome}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Ciclo: {ciclo?.nome || "N/A"}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span>{avaliacao.avaliado_nome}</span>
                      </div>
                      {dataFim && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>
                            Prazo: {format(dataFim, "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setAvaliacaoSelecionada(avaliacao); }}>
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4 mx-auto" />
            <div className="h-8 bg-muted rounded w-1/2 mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (minhasAvaliacoes.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-muted rounded-full">
              <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Nenhuma avaliação pendente</h3>
              <p className="text-muted-foreground">
                Você não tem avaliações para responder no momento.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Avaliações Pendentes</h2>
          <p className="text-sm text-muted-foreground">
            Você tem {minhasAvaliacoes.length} avaliação(ões) para responder
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {minhasAvaliacoes.map((avaliacao) => {
          const ciclo = avaliacao.ciclo;
          const dataFim = ciclo?.data_fim ? new Date(ciclo.data_fim) : null;
          const isUrgent = dataFim && dataFim <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

          return (
            <Card 
              key={avaliacao.id} 
              className={`hover:shadow-md transition-shadow cursor-pointer ${
                isUrgent ? "border-amber-300 bg-amber-50/50" : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {TIPO_AVALIADOR_LABELS[avaliacao.tipo_avaliador]}
                      </Badge>
                      {isUrgent && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Prazo próximo
                        </Badge>
                      )}
                      <Badge 
                        variant={avaliacao.status === "pendente" ? "secondary" : "default"}
                      >
                        {avaliacao.status === "pendente" ? "Não iniciada" : "Em andamento"}
                      </Badge>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg">
                        Avaliar: {avaliacao.avaliado_nome}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Ciclo: {ciclo?.nome || "N/A"}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span>{avaliacao.avaliado_nome}</span>
                      </div>
                      {dataFim && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>
                            Prazo: {format(dataFim, "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button variant="ghost" size="icon">
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
