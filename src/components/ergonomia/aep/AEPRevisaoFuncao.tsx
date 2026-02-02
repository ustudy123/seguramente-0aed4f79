import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Building2, 
  Briefcase, 
  Users,
  AlertTriangle,
  CheckCircle2,
  Edit,
  ChevronRight
} from "lucide-react";
import { AEPAvaliacaoFuncao, ClassificacaoRisco } from "@/types/aep-multi";
import { AEPFormDescricao } from "./AEPFormDescricao";
import { AEPFormRiscos } from "./AEPFormRiscos";
import { AEPFormAcoes } from "./AEPFormAcoes";

interface AEPRevisaoFuncaoProps {
  avaliacoes: AEPAvaliacaoFuncao[];
  onUpdateAvaliacao: (id: string, updates: Partial<AEPAvaliacaoFuncao>) => void;
}

export function AEPRevisaoFuncao({
  avaliacoes,
  onUpdateAvaliacao
}: AEPRevisaoFuncaoProps) {
  const [selectedAvaliacao, setSelectedAvaliacao] = useState<string | null>(
    avaliacoes[0]?.id || null
  );
  const [editingTab, setEditingTab] = useState("descricao");

  const getClassificacaoColor = (classificacao: ClassificacaoRisco) => {
    switch (classificacao) {
      case 'baixo': return 'bg-success text-success-foreground';
      case 'medio': return 'bg-warning text-warning-foreground';
      case 'alto': return 'bg-destructive text-destructive-foreground';
    }
  };

  const getClassificacaoLabel = (classificacao: ClassificacaoRisco) => {
    switch (classificacao) {
      case 'baixo': return 'Baixo Risco';
      case 'medio': return 'Médio Risco';
      case 'alto': return 'Alto Risco';
    }
  };

  const currentAvaliacao = avaliacoes.find(a => a.id === selectedAvaliacao);

  if (avaliacoes.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">Nenhuma avaliação gerada</p>
          <p className="text-sm mt-1">As evidências ainda não foram analisadas pela IA</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Sidebar - Lista de funções */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Funções Avaliadas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-3">
          {avaliacoes.map(avaliacao => (
            <button
              key={avaliacao.id}
              onClick={() => setSelectedAvaliacao(avaliacao.id)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedAvaliacao === avaliacao.id 
                  ? 'bg-primary/10 border-primary' 
                  : 'hover:bg-muted/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <Building2 className="h-3 w-3" />
                    {avaliacao.setorNome}
                  </div>
                  <div className="font-medium text-sm truncate">
                    {avaliacao.funcaoNome}
                  </div>
                  {avaliacao.colaboradoresAvaliados.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Users className="h-3 w-3" />
                      {avaliacao.colaboradoresAvaliados.length} colaborador(es)
                    </div>
                  )}
                </div>
                <Badge className={`flex-shrink-0 ${getClassificacaoColor(avaliacao.classificacaoRisco)}`}>
                  {avaliacao.classificacaoRisco === 'baixo' ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <AlertTriangle className="h-3 w-3" />
                  )}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  {avaliacao.evidencias.length} evidência(s)
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {avaliacao.acoesRecomendadas.length} ação(ões)
                </Badge>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Main content - Edição da avaliação */}
      {currentAvaliacao && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Building2 className="h-4 w-4" />
                  {currentAvaliacao.setorNome}
                  <ChevronRight className="h-4 w-4" />
                  <Briefcase className="h-4 w-4" />
                  {currentAvaliacao.funcaoNome}
                </div>
                <CardTitle>Revisão da Avaliação</CardTitle>
              </div>
              <Badge className={getClassificacaoColor(currentAvaliacao.classificacaoRisco)}>
                {getClassificacaoLabel(currentAvaliacao.classificacaoRisco)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={editingTab} onValueChange={setEditingTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="descricao">Descrição</TabsTrigger>
                <TabsTrigger value="riscos">Riscos</TabsTrigger>
                <TabsTrigger value="acoes">Ações</TabsTrigger>
              </TabsList>

              <TabsContent value="descricao" className="mt-4">
                <AEPFormDescricao
                  data={currentAvaliacao.descricaoAtividade}
                  onChange={(descricaoAtividade) => 
                    onUpdateAvaliacao(currentAvaliacao.id, { descricaoAtividade })
                  }
                />
              </TabsContent>

              <TabsContent value="riscos" className="mt-4">
                <AEPFormRiscos
                  riscosFisicos={currentAvaliacao.riscosFisicos}
                  riscosCognitivos={currentAvaliacao.riscosCognitivos}
                  onChangeRiscosFisicos={(riscosFisicos) => 
                    onUpdateAvaliacao(currentAvaliacao.id, { riscosFisicos })
                  }
                  onChangeRiscosCognitivos={(riscosCognitivos) => 
                    onUpdateAvaliacao(currentAvaliacao.id, { riscosCognitivos })
                  }
                />
              </TabsContent>

              <TabsContent value="acoes" className="mt-4">
                <AEPFormAcoes
                  acoes={currentAvaliacao.acoesRecomendadas}
                  onChange={(acoesRecomendadas) => 
                    onUpdateAvaliacao(currentAvaliacao.id, { acoesRecomendadas })
                  }
                />
              </TabsContent>
            </Tabs>

            {/* Evidências usadas */}
            <Accordion type="single" collapsible className="mt-6">
              <AccordionItem value="evidencias">
                <AccordionTrigger className="text-sm">
                  Evidências utilizadas ({currentAvaliacao.evidencias.length})
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
                    {currentAvaliacao.evidencias.map(ev => (
                      <div 
                        key={ev.id}
                        className="relative rounded-lg overflow-hidden border bg-muted aspect-video"
                      >
                        {ev.tipo === 'foto' && ev.arquivoBase64 ? (
                          <img 
                            src={ev.arquivoBase64}
                            alt="Evidência"
                            className="w-full h-full object-cover"
                          />
                        ) : ev.tipo === 'video' && ev.videoFrames?.[0] ? (
                          <img 
                            src={ev.videoFrames[0]}
                            alt="Frame"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            {ev.tipo}
                          </div>
                        )}
                        <Badge 
                          variant="secondary" 
                          className="absolute bottom-1 right-1 text-xs"
                        >
                          {ev.tipo}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
