import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Building2, Users, Briefcase, AlertTriangle, Target, UserCheck,
  AlertCircle, CheckCircle2, Minus, Edit3, Info, Sparkles, ArrowUpRight, CheckCheck
} from "lucide-react";
import { ImportacaoState, DadosExtraidos } from "./ImportacaoInteligente";
import { useSSTDocumentos } from "@/hooks/useSSTDocumentos";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  state: ImportacaoState;
  updateState: (partial: Partial<ImportacaoState>) => void;
  resetar: () => void;
}

function ConfiancaBadge({ confianca }: { confianca: "alta" | "media" | "baixa" }) {
  if (confianca === "alta") return <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">✓ Alta</Badge>;
  if (confianca === "media") return <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">~ Média</Badge>;
  return <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">! Baixa</Badge>;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "bg-green-500" : value >= 40 ? "bg-amber-500" : "bg-destructive";
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium w-8 text-right">{value}%</span>
    </div>
  );
}

export function EtapaRevisao({ state, updateState, resetar }: Props) {
  const { uploadDocumento } = useSSTDocumentos();
  const [dados, setDados] = useState<DadosExtraidos>(state.dadosExtraidos!);
  const [salvando, setSalvando] = useState(false);
  const [modoRascunho, setModoRascunho] = useState(false);

  const score = dados.score_qualidade;

  const updateDadosGerais = (campo: string, valor: string) => {
    setDados(prev => ({
      ...prev,
      dados_gerais: {
        ...prev.dados_gerais,
        [campo]: { ...prev.dados_gerais[campo], valor },
      },
    }));
  };

  const handleSalvar = async () => {
    if (!state.arquivo) return;
    setSalvando(true);
    try {
      await uploadDocumento.mutateAsync({
        file: state.arquivo,
        tipo: state.tipoDetectado,
        data_emissao: dados.dados_gerais?.data_emissao?.valor || undefined,
        data_vigencia: dados.dados_gerais?.data_vigencia?.valor || undefined,
        profissional_responsavel: dados.responsaveis_tecnicos?.[0]?.nome || undefined,
        empresa_emissora: dados.dados_gerais?.empresa?.valor || undefined,
        observacoes: modoRascunho ? "[RASCUNHO] Importação inteligente SST" : "Importação inteligente SST",
      });
      updateState({ dadosExtraidos: dados, etapa: 5 });
      toast.success("Documento importado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Score header */}
      <Card className={score.geral >= 70 ? "border-green-200 bg-green-50/50 dark:bg-green-950/10" : score.geral >= 40 ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/10" : "border-destructive/30 bg-destructive/5"}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {score.geral >= 70 ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : score.geral >= 40 ? (
                <AlertCircle className="w-5 h-5 text-amber-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-destructive" />
              )}
              <span className="font-semibold">Score de Qualidade da Extração</span>
            </div>
            <span className={`text-2xl font-bold ${score.geral >= 70 ? "text-green-600" : score.geral >= 40 ? "text-amber-600" : "text-destructive"}`}>
              {score.geral}%
            </span>
          </div>
          <div className="space-y-1.5">
            <ScoreBar label="Dados Gerais" value={score.dados_gerais} />
            <ScoreBar label="Inventário" value={score.inventario} />
            <ScoreBar label="Plano de Ação" value={score.plano_acao} />
            <ScoreBar label="Responsáveis" value={score.responsaveis} />
          </div>
        </CardContent>
      </Card>

      {/* Tabs de revisão */}
      <Card>
        <CardContent className="pt-4">
          <Tabs defaultValue="dados_gerais">
            <TabsList className="grid grid-cols-4 md:grid-cols-7 w-full h-auto flex-wrap">
              <TabsTrigger value="dados_gerais" className="text-xs py-1.5">
                <Building2 className="w-3.5 h-3.5 mr-1" />Dados Gerais
              </TabsTrigger>
              <TabsTrigger value="estrutura" className="text-xs py-1.5">
                <Users className="w-3.5 h-3.5 mr-1" />Estrutura
              </TabsTrigger>
              <TabsTrigger value="funcoes" className="text-xs py-1.5">
                <Briefcase className="w-3.5 h-3.5 mr-1" />Funções
              </TabsTrigger>
              <TabsTrigger value="riscos" className="text-xs py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />Riscos
              </TabsTrigger>
              <TabsTrigger value="plano_acao" className="text-xs py-1.5">
                <Target className="w-3.5 h-3.5 mr-1" />Plano
              </TabsTrigger>
              <TabsTrigger value="responsaveis" className="text-xs py-1.5">
                <UserCheck className="w-3.5 h-3.5 mr-1" />Responsáveis
              </TabsTrigger>
              <TabsTrigger value="pendencias" className="text-xs py-1.5">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                Pendências
                {dados.pendencias?.length > 0 && (
                  <Badge variant="destructive" className="ml-1 text-[10px] px-1 h-4">{dados.pendencias.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Dados Gerais */}
            <TabsContent value="dados_gerais" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(dados.dados_gerais || {}).map(([campo, info]) => (
                  <div key={campo} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-muted-foreground capitalize">
                        {campo.replace(/_/g, " ")}
                      </label>
                      <ConfiancaBadge confianca={info.confianca} />
                    </div>
                    <Input
                      value={info.valor || ""}
                      onChange={e => updateDadosGerais(campo, e.target.value)}
                      placeholder={`${campo.replace(/_/g, " ")}...`}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Estrutura Organizacional */}
            <TabsContent value="estrutura" className="mt-4">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Unidades Identificadas</p>
                  {dados.estrutura_organizacional?.unidades?.length > 0 ? (
                    <div className="space-y-2">
                      {dados.estrutura_organizacional.unidades.map((u, i) => (
                        <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border text-sm">
                          <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span>{u.nome}</span>
                          {u.endereco && <span className="text-muted-foreground text-xs">— {u.endereco}</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Nenhuma unidade identificada</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Setores</p>
                    <div className="flex flex-wrap gap-1.5">
                      {dados.estrutura_organizacional?.setores?.length > 0
                        ? dados.estrutura_organizacional.setores.map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                        ))
                        : <p className="text-xs text-muted-foreground italic">Nenhum identificado</p>}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Departamentos</p>
                    <div className="flex flex-wrap gap-1.5">
                      {dados.estrutura_organizacional?.departamentos?.length > 0
                        ? dados.estrutura_organizacional.departamentos.map((d, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{d}</Badge>
                        ))
                        : <p className="text-xs text-muted-foreground italic">Nenhum identificado</p>}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Funções */}
            <TabsContent value="funcoes" className="mt-4">
              <ScrollArea className="h-72">
                <div className="space-y-3 pr-2">
                  {dados.funcoes_atividades?.length > 0 ? (
                    dados.funcoes_atividades.map((f, i) => (
                      <div key={i} className="p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Briefcase className="w-4 h-4 text-primary" />
                          <span className="font-medium text-sm">{f.cargo}</span>
                          {f.setor && <Badge variant="outline" className="text-xs">{f.setor}</Badge>}
                        </div>
                        <ul className="space-y-1">
                          {f.atividades?.map((a, j) => (
                            <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <Minus className="w-3 h-3 mt-0.5 flex-shrink-0" />{a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground italic text-center py-8">
                      Nenhuma função/cargo identificado no documento
                    </p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Inventário de Riscos */}
            <TabsContent value="riscos" className="mt-4">
              <ScrollArea className="h-72">
                <div className="space-y-3 pr-2">
                  {dados.inventario_riscos?.length > 0 ? (
                    dados.inventario_riscos.map((r, i) => (
                      <div key={i} className="p-3 rounded-lg border">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                            <span className="font-medium text-sm">{r.risco}</span>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Badge variant="outline" className="text-[10px]">{r.tipo_risco}</Badge>
                            <ConfiancaBadge confianca={r.confianca} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {r.setor && <span><strong>Setor:</strong> {r.setor}</span>}
                          {r.funcao && <span><strong>Função:</strong> {r.funcao}</span>}
                          {r.fonte_geradora && <span><strong>Fonte:</strong> {r.fonte_geradora}</span>}
                          {r.intensidade && <span><strong>Intensidade:</strong> {r.intensidade}</span>}
                          {r.metodologia && <span className="col-span-2"><strong>Metodologia:</strong> {r.metodologia}</span>}
                          {r.danos && <span className="col-span-2"><strong>Danos:</strong> {r.danos}</span>}
                        </div>
                        {r.controles_existentes && r.controles_existentes.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {r.controles_existentes.map((c, j) => (
                              <Badge key={j} variant="secondary" className="text-[10px]">{c}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground italic text-center py-8">
                      Nenhum risco identificado no documento
                    </p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Plano de Ação */}
            <TabsContent value="plano_acao" className="mt-4">
              <ScrollArea className="h-72">
                <div className="space-y-3 pr-2">
                  {dados.plano_acao?.length > 0 ? (
                    dados.plano_acao.map((a, i) => (
                      <div key={i} className="p-3 rounded-lg border">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-start gap-2">
                            <Target className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                            <span className="text-sm">{a.recomendacao}</span>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Badge variant={a.prioridade === "alta" ? "destructive" : a.prioridade === "media" ? "secondary" : "outline"} className="text-[10px]">
                              {a.prioridade}
                            </Badge>
                            <ConfiancaBadge confianca={a.confianca} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                          {a.responsavel && <span><strong>Responsável:</strong> {a.responsavel}</span>}
                          {a.prazo && <span><strong>Prazo:</strong> {a.prazo}</span>}
                          {a.setor && <span><strong>Setor:</strong> {a.setor}</span>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground italic text-center py-8">
                      Nenhum item de plano de ação identificado
                    </p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Responsáveis Técnicos */}
            <TabsContent value="responsaveis" className="mt-4">
              <div className="space-y-3">
                {dados.responsaveis_tecnicos?.length > 0 ? (
                  dados.responsaveis_tecnicos.map((r, i) => (
                    <div key={i} className="p-3 rounded-lg border flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                        <UserCheck className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{r.nome}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {r.formacao && <Badge variant="outline" className="text-xs">{r.formacao}</Badge>}
                          {r.conselho && <Badge variant="outline" className="text-xs">{r.conselho}</Badge>}
                          {r.registro && <Badge variant="secondary" className="text-xs font-mono">{r.registro}</Badge>}
                          {r.funcao_no_doc && <Badge variant="outline" className="text-xs">{r.funcao_no_doc}</Badge>}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground italic text-center py-8">
                    Nenhum responsável técnico identificado
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Pendências */}
            <TabsContent value="pendencias" className="mt-4">
              <div className="space-y-3">
                {dados.pendencias?.length > 0 ? (
                  dados.pendencias.map((p, i) => (
                    <div key={i} className={`p-3 rounded-lg border flex items-start gap-3 ${
                      p.severidade === "critica" ? "border-destructive/30 bg-destructive/5" :
                      p.severidade === "media" ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/10" :
                      "bg-muted/30"
                    }`}>
                      <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                        p.severidade === "critica" ? "text-destructive" :
                        p.severidade === "media" ? "text-amber-600" : "text-muted-foreground"
                      }`} />
                      <div>
                        <p className="text-sm font-medium">{p.campo}</p>
                        <p className="text-xs text-muted-foreground">{p.motivo}</p>
                      </div>
                      <Badge variant={p.severidade === "critica" ? "destructive" : "secondary"} className="text-[10px] ml-auto flex-shrink-0">
                        {p.severidade}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center py-8 gap-2">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Sem pendências!</p>
                    <p className="text-xs text-muted-foreground">Todos os campos foram extraídos com sucesso.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Aviso legal */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <span>Revise todos os dados antes de salvar. O sistema não substitui profissionais habilitados — os dados extraídos devem ser validados por responsável técnico.</span>
      </div>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => { setModoRascunho(true); handleSalvar(); }}
          disabled={salvando}
        >
          Salvar como Rascunho
        </Button>
        <Button onClick={() => { setModoRascunho(false); handleSalvar(); }} disabled={salvando}>
          {salvando ? "Salvando..." : "Confirmar Importação"}
        </Button>
      </div>
    </div>
  );
}
