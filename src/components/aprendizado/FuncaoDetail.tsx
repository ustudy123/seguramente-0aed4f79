import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Brain, Shield, Briefcase, FileText, BarChart3, Wand2, Target, AlertTriangle, CheckCircle, Wrench, Users, BookOpen } from "lucide-react";
import { AtividadesSection } from "./AtividadesSection";
import { CompetenciasSection } from "./CompetenciasSection";
import { EpisSection } from "./EpisSection";
import { IndicadoresSection } from "./IndicadoresSection";
import { TreinamentosSection } from "./TreinamentosSection";
import { ResponsabilidadeField } from "./ResponsabilidadeField";
import { GerarVagaSection } from "./GerarVagaSection";
import { GerarPropostaSection } from "./GerarPropostaSection";
import { GerarFuncaoIAModal } from "./GerarFuncaoIAModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface Cargo {
  id: string;
  nome: string;
  nivel: string | null;
  descricao: string | null;
  responsabilidade?: string | null;
  subordinacao?: string | null;
  interfaces_cargo?: string | null;
  objetivo_funcao?: string | null;
  escopo_geral?: string | null;
  padroes_execucao?: string | null;
  cultura_esperada?: string | null;
  erros_riscos?: string | null;
  criterios_sucesso?: string | null;
  ferramentas_cargo?: string | null;
  requisitos_formacao?: string | null;
  requisitos_experiencia?: string | null;

  departamento?: { id: string; nome: string } | null;
}

interface FuncaoDetailProps {
  cargo: Cargo;
}

export function FuncaoDetail({ cargo }: FuncaoDetailProps) {
  const [iaModalOpen, setIaModalOpen] = useState(false);

  const nivelLabel: Record<string, string> = {
    operacional: "Operacional",
    tatico: "Tático",
    estrategico: "Estratégico",
  };

  const hasEnrichedData = cargo.objetivo_funcao || cargo.escopo_geral || cargo.subordinacao;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-bold text-foreground">{cargo.nome}</h2>
          {cargo.departamento?.nome && (
            <span className="text-sm text-muted-foreground">{cargo.departamento.nome}</span>
          )}
          {cargo.nivel && (
            <Badge variant="outline">{nivelLabel[cargo.nivel] || cargo.nivel}</Badge>
          )}
        </div>
        <Button
          variant="default"
          size="sm"
          className="gap-2"
          onClick={() => setIaModalOpen(true)}
        >
          <Wand2 className="w-4 h-4" />
          {hasEnrichedData ? "Regerar com IA" : "Gerar Função com IA"}
        </Button>
      </div>

      {cargo.descricao && (
        <p className="text-sm text-muted-foreground">{cargo.descricao}</p>
      )}

      {/* Identification & Overview Cards */}
      {hasEnrichedData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cargo.objetivo_funcao && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-2">
                  <Target className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Objetivo da Função</p>
                    <p className="text-sm text-foreground mt-1">{cargo.objetivo_funcao}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {cargo.escopo_geral && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-2">
                  <BookOpen className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Escopo Geral</p>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-line">{cargo.escopo_geral}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {cargo.subordinacao && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subordinação</p>
                    <p className="text-sm text-foreground mt-1">{cargo.subordinacao}</p>
                    {cargo.interfaces_cargo && (
                      <>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Interfaces</p>
                        <p className="text-sm text-foreground mt-0.5">{cargo.interfaces_cargo}</p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {cargo.ferramentas_cargo && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-2">
                  <Wrench className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ferramentas</p>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-line">{cargo.ferramentas_cargo}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Requisitos Section */}
      {(cargo.requisitos_formacao || cargo.requisitos_experiencia) && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-4">
              <div className="bg-primary/10 rounded-full p-2 mt-1 shrink-0">
                <ClipboardList className="w-5 h-5 text-primary" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {cargo.requisitos_formacao && (
                  <div>
                    <p className="text-xs font-bold text-primary uppercase tracking-wider">Formação Acadêmica</p>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-line leading-relaxed">
                      {cargo.requisitos_formacao}
                    </p>
                  </div>
                )}
                {cargo.requisitos_experiencia && (
                  <div>
                    <p className="text-xs font-bold text-primary uppercase tracking-wider">Experiência Profissional</p>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-line leading-relaxed">
                      {cargo.requisitos_experiencia}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Additional enriched fields */}
      {(cargo.padroes_execucao || cargo.erros_riscos || cargo.criterios_sucesso || cargo.cultura_esperada) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cargo.padroes_execucao && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Padrões de Execução</p>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-line">{cargo.padroes_execucao}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {cargo.criterios_sucesso && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-2">
                  <Target className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Critérios de Sucesso</p>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-line">{cargo.criterios_sucesso}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {cargo.erros_riscos && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Erros e Riscos</p>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-line">{cargo.erros_riscos}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {cargo.cultura_esperada && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-2">
                  <Brain className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cultura Esperada</p>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-line">{cargo.cultura_esperada}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Responsabilidade da Função */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <ResponsabilidadeField
            cargoId={cargo.id}
            cargoNome={cargo.nome}
            cargoDescricao={cargo.descricao}
            initialValue={cargo.responsabilidade}
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="atividades">
        <TabsList className="flex-wrap">
          <TabsTrigger value="atividades" className="gap-1">
            <ClipboardList className="w-4 h-4" /> Atividades
          </TabsTrigger>
          <TabsTrigger value="competencias" className="gap-1">
            <Brain className="w-4 h-4" /> Competências
          </TabsTrigger>
          <TabsTrigger value="indicadores" className="gap-1">
            <BarChart3 className="w-4 h-4" /> Indicadores
          </TabsTrigger>
          <TabsTrigger value="epis" className="gap-1">
            <Shield className="w-4 h-4" /> EPIs & Treinamento
          </TabsTrigger>
          <TabsTrigger value="vaga" className="gap-1">
            <Briefcase className="w-4 h-4" /> Gerar Vaga
          </TabsTrigger>
          <TabsTrigger value="proposta" className="gap-1">
            <FileText className="w-4 h-4" /> Gerar Proposta
          </TabsTrigger>
        </TabsList>

        <TabsContent value="atividades" className="mt-4">
          <AtividadesSection cargoId={cargo.id} funcaoNome={cargo.nome} nivel={cargo.nivel || undefined} />
        </TabsContent>
        <TabsContent value="competencias" className="mt-4">
          <CompetenciasSection cargoId={cargo.id} funcaoNome={cargo.nome} />
        </TabsContent>
        <TabsContent value="indicadores" className="mt-4">
          <IndicadoresSection cargoId={cargo.id} />
        </TabsContent>
        <TabsContent value="epis" className="mt-4">
          <div className="space-y-6">
            <TreinamentosSection cargoId={cargo.id} />
            <Separator />
            <EpisSection cargoId={cargo.id} />
          </div>
        </TabsContent>
        <TabsContent value="vaga" className="mt-4">
          <GerarVagaSection
            cargoId={cargo.id}
            cargoNome={cargo.nome}
            cargoDescricao={cargo.descricao}
            responsabilidade={cargo.responsabilidade}
          />
        </TabsContent>
        <TabsContent value="proposta" className="mt-4">
          <GerarPropostaSection
            cargoId={cargo.id}
            cargoNome={cargo.nome}
            cargoDescricao={cargo.descricao}
            responsabilidade={cargo.responsabilidade}
          />
        </TabsContent>
      </Tabs>

      <GerarFuncaoIAModal
        open={iaModalOpen}
        onClose={() => setIaModalOpen(false)}
        cargoId={cargo.id}
        cargoNome={cargo.nome}
      />
    </div>
  );
}
