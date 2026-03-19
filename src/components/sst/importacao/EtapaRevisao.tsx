import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Building2, Users, Briefcase, AlertTriangle, Target, UserCheck,
  AlertCircle, CheckCircle2, Minus, Info, Sparkles, ArrowUpRight, CheckCheck,
  Stethoscope, Layers, FlaskConical, Zap, ChevronDown, ChevronRight
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

// Tipo expandido para suportar campos específicos por documento
type AcaoItem = DadosExtraidos["plano_acao"][0] & {
  what?: string; why?: string; where?: string; who?: string;
  when?: string; how?: string; how_much?: string; trecho_origem?: string;
};

type DadosExtraidosExtended = DadosExtraidos & {
  tipo_documento?: string;
  matriz_exames?: {
    cargo: string; setor?: string; risco_relacionado?: string;
    exames_clinicos?: string[]; exames_complementares?: string[];
    periodicidade?: string; tipo_exame?: string; observacoes?: string;
    confianca: "alta" | "media" | "baixa";
  }[];
  fatores_ergonomicos?: {
    posto?: string; cargo?: string; postura?: string; repetitividade?: string;
    esforco_fisico?: string; mobiliario?: string; organizacao_trabalho?: string;
    aspectos_cognitivos?: string; nivel_risco?: string; confianca: "alta" | "media" | "baixa";
  }[];
  plano_acao: AcaoItem[];
};

type RiscoItem = DadosExtraidos["inventario_riscos"][0] & {
  limite_tolerancia?: string; caracterizado?: boolean;
  grau_insalubridade?: string; conclusao?: string;
  condicao_perigosa?: string; enquadramento_legal?: string; habitualidade?: string;
  fator_ergonomico?: string; nivel_risco?: string; conclusao_previdenciaria?: string; acima_limite?: boolean;
};

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
  const [dados, setDados] = useState<DadosExtraidosExtended>(state.dadosExtraidos as DadosExtraidosExtended);
  const [salvando, setSalvando] = useState(false);
  const [modoRascunho, setModoRascunho] = useState(false);
  const [acoesSalvas, setAcoesSalvas] = useState<Set<number>>(new Set());
  const [importandoTodas, setImportandoTodas] = useState(false);
  const [acaoExpandida, setAcaoExpandida] = useState<number | null>(null);

  const score = dados.score_qualidade;
  const tipo = dados.tipo_documento || state.tipoDetectado || "PGR";

  // Adapta labels e ícones por tipo documental
  const isMedico = tipo === "PCMSO";
  const isErgonomico = tipo === "AET";

  const getInventarioLabel = () => {
    if (isMedico) return "Exames";
    if (isErgonomico) return "Ergonomia";
    if (tipo === "LTCAT") return "Agentes Nocivos";
    if (tipo === "LAUDO_INSALUBRIDADE") return "Insalubridade";
    if (tipo === "LAUDO_PERICULOSIDADE") return "Periculosidade";
    return "Riscos";
  };

  const InventarioIcon = isMedico ? Stethoscope
    : isErgonomico ? Layers
    : tipo === "LAUDO_INSALUBRIDADE" || tipo === "LAUDO_PERICULOSIDADE" ? FlaskConical
    : tipo === "LTCAT" ? Zap
    : AlertTriangle;

  const inventarioCount = isMedico
    ? (dados.matriz_exames?.length || 0) + (dados.inventario_riscos?.length || 0)
    : isErgonomico
    ? (dados.fatores_ergonomicos?.length || 0) + (dados.inventario_riscos?.length || 0)
    : dados.inventario_riscos?.length || 0;

  const parseDateString = (dateStr: string | undefined): string | null => {
    if (!dateStr) return null;
    const s = dateStr.trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split("/");
      return `${y}-${m}-${d}`;
    }
    const MESES: Record<string, string> = {
      janeiro: "01", fevereiro: "02", março: "03", marco: "03",
      abril: "04", maio: "05", junho: "06", julho: "07",
      agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
    };
    const lower = s.toLowerCase();
    for (const [nome, num] of Object.entries(MESES)) {
      if (lower.includes(nome)) {
        const yearMatch = s.match(/\d{4}/);
        if (yearMatch) return `${yearMatch[0]}-${num}-01`;
        return null;
      }
    }
    const yearMonthMatch = s.match(/^(\d{4})[/-](\d{2})$/);
    if (yearMonthMatch) return `${yearMonthMatch[1]}-${yearMonthMatch[2]}-01`;
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) return parsed.toISOString().split("T")[0];
    return null;
  };

  const parsePrazo = (prazoStr: string | undefined): string | null => {
    if (!prazoStr) return null;
    const hoje = new Date();
    const lower = prazoStr.toLowerCase();
    if (lower.includes("imediato") || lower.includes("urgente")) { hoje.setDate(hoje.getDate() + 7); return hoje.toISOString().split("T")[0]; }
    if (lower.includes("curto") || lower.includes("30 dias") || lower.includes("1 mês")) { hoje.setMonth(hoje.getMonth() + 1); return hoje.toISOString().split("T")[0]; }
    if (lower.includes("médio") || lower.includes("medio") || lower.includes("90 dias") || lower.includes("3 meses")) { hoje.setMonth(hoje.getMonth() + 3); return hoje.toISOString().split("T")[0]; }
    if (lower.includes("longo") || lower.includes("6 meses") || lower.includes("1 ano")) { hoje.setMonth(hoje.getMonth() + 6); return hoje.toISOString().split("T")[0]; }
    if (lower.includes("contínu") || lower.includes("continu")) { hoje.setFullYear(hoje.getFullYear() + 1); return hoje.toISOString().split("T")[0]; }
    return parseDateString(prazoStr);
  };

  const enviarAcaoPlano = async (acao: AcaoItem, index: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada"); return; }
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", session.user.id).maybeSingle();
      if (!profile?.tenant_id) { toast.error("Tenant não encontrado"); return; }

      // Normalizar prioridade para o enum do banco: baixo | medio | urgente | imediato
      const prioridadeMap: Record<string, string> = {
        alta: "urgente", media: "medio", baixa: "baixo",
        urgente: "urgente", imediato: "imediato", medio: "medio", baixo: "baixo",
      };

      // Texto base da ação — prioriza what (5W2H), depois recomendacao
      const textoBase = acao.what || acao.recomendacao || "Ação extraída de documento SST";
      const titulo = textoBase.length > 200 ? textoBase.substring(0, 197) + "..." : textoBase;
      const descricao = acao.recomendacao || acao.what || textoBase;
      const porque = acao.why || `Recomendação extraída de documento ${tipo} via Importação Inteligente`;
      const onde = acao.where || acao.setor || "A definir";
      const como = acao.how || descricao;
      const quem = acao.who || acao.responsavel || "A definir";
      const prazoDate = parsePrazo(acao.when || acao.prazo);

      // Mapear tipo: corretiva para prioridade alta, melhoria para baixa, preventiva para demais
      const tipoAcao = acao.prioridade === "alta" ? "corretiva"
        : acao.prioridade === "baixa" ? "melhoria"
        : "preventiva";

      const { error } = await supabase.from("plano_acoes").insert([{
        tenant_id: profile.tenant_id,
        codigo: `SST-${Date.now()}`, // será sobrescrito pelo trigger gerar_codigo_acao
        titulo,
        descricao,
        porque,
        onde,
        como,
        responsavel_nome: quem,
        prazo: prazoDate || null,
        tipo: tipoAcao,
        prioridade: (prioridadeMap[acao.prioridade] || "medio") as any,
        status: "pendente" as any,
        origem_modulo: "manual",
        origem_descricao: `Importado de: ${state.arquivo?.name || "documento SST"} (${tipo})`,
        criado_por: session.user.id,
        criado_por_nome: session.user.email,
        progresso: 0,
        exige_evidencia: false,
        tempo_gasto_minutos: 0,
      }]);

      if (error) throw error;
      setAcoesSalvas(prev => new Set([...prev, index]));
      toast.success("Ação enviada para o Plano de Ação!");
    } catch (err: any) {
      console.error("Erro enviarAcaoPlano:", err);
      toast.error("Erro ao enviar ação: " + err.message);
    }
  };

  const enviarTodasAcoes = async () => {
    if (!dados.plano_acao?.length) return;
    setImportandoTodas(true);
    let enviadas = 0;
    for (let i = 0; i < dados.plano_acao.length; i++) {
      if (!acoesSalvas.has(i)) { await enviarAcaoPlano(dados.plano_acao[i], i); enviadas++; }
    }
    setImportandoTodas(false);
    toast.success(`${enviadas} ação(ões) importada(s) para o Plano de Ação!`);
  };

  const updateDadosGerais = (campo: string, valor: string) => {
    setDados(prev => ({ ...prev, dados_gerais: { ...prev.dados_gerais, [campo]: { ...prev.dados_gerais[campo], valor } } }));
  };

  const handleSalvar = async () => {
    if (!state.arquivo) return;
    setSalvando(true);
    try {
      await uploadDocumento.mutateAsync({
        file: state.arquivo,
        tipo: state.tipoDetectado,
        data_emissao: parseDateString(dados.dados_gerais?.data_emissao?.valor) || undefined,
        data_vigencia: parseDateString(dados.dados_gerais?.data_vigencia?.valor) || undefined,
        profissional_responsavel: dados.responsaveis_tecnicos?.[0]?.nome || undefined,
        empresa_emissora: dados.dados_gerais?.empresa?.valor || undefined,
        observacoes: modoRascunho ? "[RASCUNHO] Importação inteligente SST" : "Importação inteligente SST",
        // Persistir todos os dados extraídos pela IA
        analise_ia: dados,
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
      {/* Tipo do documento */}
      <div className="flex items-center gap-2 px-1">
        <Badge variant="secondary" className="text-xs">{tipo}</Badge>
        <span className="text-xs text-muted-foreground">
          {inventarioCount} {getInventarioLabel().toLowerCase()} identificado(s)
          {" · "}{dados.plano_acao?.length || 0} ação(ões) extraída(s)
        </span>
      </div>

      {/* Score header */}
      <Card className={score.geral >= 70 ? "border-green-200 bg-green-50/50 dark:bg-green-950/10" : score.geral >= 40 ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/10" : "border-destructive/30 bg-destructive/5"}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {score.geral >= 70 ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-amber-600" />}
              <span className="font-semibold">Score de Qualidade da Extração</span>
            </div>
            <span className={`text-2xl font-bold ${score.geral >= 70 ? "text-green-600" : score.geral >= 40 ? "text-amber-600" : "text-destructive"}`}>{score.geral}%</span>
          </div>
          <div className="space-y-1.5">
            <ScoreBar label="Dados Gerais" value={score.dados_gerais} />
            <ScoreBar label={getInventarioLabel()} value={score.inventario} />
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
              <TabsTrigger value="inventario" className="text-xs py-1.5">
                <InventarioIcon className="w-3.5 h-3.5 mr-1" />{getInventarioLabel()}
                {inventarioCount > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1 h-4">{inventarioCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="plano_acao" className="text-xs py-1.5">
                <Target className="w-3.5 h-3.5 mr-1" />Plano
                {(dados.plano_acao?.length || 0) > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1 h-4">{dados.plano_acao.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="responsaveis" className="text-xs py-1.5">
                <UserCheck className="w-3.5 h-3.5 mr-1" />Responsáveis
              </TabsTrigger>
              <TabsTrigger value="pendencias" className="text-xs py-1.5">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />Pendências
                {dados.pendencias?.length > 0 && <Badge variant="destructive" className="ml-1 text-[10px] px-1 h-4">{dados.pendencias.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            {/* Dados Gerais */}
            <TabsContent value="dados_gerais" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(dados.dados_gerais || {}).map(([campo, info]) => (
                  <div key={campo} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-muted-foreground capitalize">{campo.replace(/_/g, " ")}</label>
                      <ConfiancaBadge confianca={info.confianca} />
                    </div>
                    <Input value={info.valor || ""} onChange={e => updateDadosGerais(campo, e.target.value)} placeholder={`${campo.replace(/_/g, " ")}...`} className="h-8 text-sm" />
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
                  ) : <p className="text-sm text-muted-foreground italic">Nenhuma unidade identificada</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Setores</p>
                    <div className="flex flex-wrap gap-1.5">
                      {dados.estrutura_organizacional?.setores?.length > 0
                        ? dados.estrutura_organizacional.setores.map((s, i) => <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>)
                        : <p className="text-xs text-muted-foreground italic">Nenhum identificado</p>}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Departamentos</p>
                    <div className="flex flex-wrap gap-1.5">
                      {dados.estrutura_organizacional?.departamentos?.length > 0
                        ? dados.estrutura_organizacional.departamentos.map((d, i) => <Badge key={i} variant="outline" className="text-xs">{d}</Badge>)
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
                  ) : <p className="text-sm text-muted-foreground italic text-center py-8">Nenhuma função/cargo identificado</p>}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Inventário adaptado por tipo */}
            <TabsContent value="inventario" className="mt-4">
              <ScrollArea className="h-80">
                <div className="space-y-3 pr-2">

                  {/* PCMSO: Matriz de Exames */}
                  {isMedico && dados.matriz_exames && dados.matriz_exames.length > 0 && (
                    <>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Matriz de Exames por Cargo</p>
                      {dados.matriz_exames.map((e, i) => (
                        <div key={i} className="p-3 rounded-lg border">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <Stethoscope className="w-4 h-4 text-primary" />
                              <span className="font-medium text-sm">{e.cargo}</span>
                              {e.setor && <Badge variant="outline" className="text-xs">{e.setor}</Badge>}
                            </div>
                            <ConfiancaBadge confianca={e.confianca} />
                          </div>
                          <div className="space-y-1.5 text-xs text-muted-foreground">
                            {e.risco_relacionado && <p><strong>Risco:</strong> {e.risco_relacionado}</p>}
                            {e.periodicidade && <p><strong>Periodicidade:</strong> {e.periodicidade}</p>}
                            {e.tipo_exame && <p><strong>Tipo:</strong> {e.tipo_exame}</p>}
                            {e.exames_clinicos && e.exames_clinicos.length > 0 && (
                              <div><strong>Clínicos:</strong>
                                <div className="flex flex-wrap gap-1 mt-1">{e.exames_clinicos.map((ex, j) => <Badge key={j} variant="secondary" className="text-[10px]">{ex}</Badge>)}</div>
                              </div>
                            )}
                            {e.exames_complementares && e.exames_complementares.length > 0 && (
                              <div><strong>Complementares:</strong>
                                <div className="flex flex-wrap gap-1 mt-1">{e.exames_complementares.map((ex, j) => <Badge key={j} variant="outline" className="text-[10px]">{ex}</Badge>)}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* AET: Fatores Ergonômicos */}
                  {isErgonomico && dados.fatores_ergonomicos && dados.fatores_ergonomicos.length > 0 && (
                    <>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Fatores Ergonômicos</p>
                      {dados.fatores_ergonomicos.map((f, i) => (
                        <div key={i} className="p-3 rounded-lg border">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <Layers className="w-4 h-4 text-primary" />
                              <span className="font-medium text-sm">{f.posto || f.cargo || "Posto analisado"}</span>
                              {f.nivel_risco && (
                                <Badge variant={f.nivel_risco === "alto" ? "destructive" : f.nivel_risco === "medio" ? "secondary" : "outline"} className="text-[10px]">{f.nivel_risco}</Badge>
                              )}
                            </div>
                            <ConfiancaBadge confianca={f.confianca} />
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {f.postura && <span><strong>Postura:</strong> {f.postura}</span>}
                            {f.repetitividade && <span><strong>Repetitividade:</strong> {f.repetitividade}</span>}
                            {f.esforco_fisico && <span><strong>Esforço físico:</strong> {f.esforco_fisico}</span>}
                            {f.mobiliario && <span><strong>Mobiliário:</strong> {f.mobiliario}</span>}
                            {f.organizacao_trabalho && <span className="col-span-2"><strong>Org. trabalho:</strong> {f.organizacao_trabalho}</span>}
                            {f.aspectos_cognitivos && <span className="col-span-2"><strong>Cognitivos:</strong> {f.aspectos_cognitivos}</span>}
                          </div>
                        </div>
                      ))}
                      {dados.inventario_riscos?.length > 0 && <p className="text-xs font-medium text-muted-foreground mt-3 mb-2">Riscos Ergonômicos</p>}
                    </>
                  )}

                  {/* Inventário de Riscos (todos os tipos) */}
                  {dados.inventario_riscos && dados.inventario_riscos.length > 0 && (
                    (dados.inventario_riscos as RiscoItem[]).map((r, i) => (
                      <div key={`risco-${i}`} className="p-3 rounded-lg border">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <InventarioIcon className="w-4 h-4 text-amber-500 flex-shrink-0" />
                            <span className="font-medium text-sm">{r.risco}</span>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Badge variant="outline" className="text-[10px]">{r.tipo_risco}</Badge>
                            <ConfiancaBadge confianca={r.confianca} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {r.setor && r.setor !== "null" && <span><strong>Setor:</strong> {r.setor}</span>}
                          {r.funcao && r.funcao !== "null" && <span><strong>Função:</strong> {r.funcao}</span>}
                          {r.fonte_geradora && r.fonte_geradora !== "null" && <span><strong>Fonte:</strong> {r.fonte_geradora}</span>}
                          {r.intensidade && r.intensidade !== "null" && <span><strong>Intensidade:</strong> {r.intensidade}</span>}
                          {r.limite_tolerancia && r.limite_tolerancia !== "null" && <span><strong>Limite:</strong> {r.limite_tolerancia}</span>}
                          {r.acima_limite !== undefined && r.acima_limite !== null && (
                            <span><strong>Acima do LT:</strong>
                              <Badge variant={r.acima_limite ? "destructive" : "secondary"} className="ml-1 text-[10px]">{r.acima_limite ? "Sim" : "Não"}</Badge>
                            </span>
                          )}
                          {r.caracterizado !== undefined && r.caracterizado !== null && (
                            <span><strong>Caracterizado:</strong>
                              <Badge variant={r.caracterizado ? "destructive" : "secondary"} className="ml-1 text-[10px]">{r.caracterizado ? "Sim" : "Não"}</Badge>
                            </span>
                          )}
                          {r.grau_insalubridade && r.grau_insalubridade !== "null" && <span><strong>Grau:</strong> {r.grau_insalubridade}</span>}
                          {r.condicao_perigosa && r.condicao_perigosa !== "null" && <span className="col-span-2"><strong>Condição perigosa:</strong> {r.condicao_perigosa}</span>}
                          {r.conclusao && r.conclusao !== "null" && <span className="col-span-2"><strong>Conclusão:</strong> {r.conclusao}</span>}
                          {r.conclusao_previdenciaria && r.conclusao_previdenciaria !== "null" && <span className="col-span-2"><strong>Conclusão prev.:</strong> {r.conclusao_previdenciaria}</span>}
                          {r.metodologia && r.metodologia !== "null" && <span className="col-span-2"><strong>Metodologia:</strong> {r.metodologia}</span>}
                          {r.danos && r.danos !== "null" && <span className="col-span-2"><strong>Danos:</strong> {r.danos}</span>}
                        </div>
                        {r.controles_existentes && r.controles_existentes.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {r.controles_existentes.map((c, j) => <Badge key={j} variant="secondary" className="text-[10px]">{c}</Badge>)}
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  {inventarioCount === 0 && (
                    <p className="text-sm text-muted-foreground italic text-center py-8">Nenhum item identificado nesta categoria</p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Plano de Ação com 5W2H expandível */}
            <TabsContent value="plano_acao" className="mt-4">
              {dados.plano_acao?.length > 0 && (
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">{acoesSalvas.size}/{dados.plano_acao.length} enviada(s)</span>
                  <Button size="sm" variant="outline" onClick={enviarTodasAcoes}
                    disabled={importandoTodas || acoesSalvas.size === dados.plano_acao.length} className="gap-1.5 text-xs">
                    {importandoTodas ? <><Sparkles className="w-3.5 h-3.5 animate-pulse" />Importando...</>
                      : acoesSalvas.size === dados.plano_acao.length
                      ? <><CheckCheck className="w-3.5 h-3.5 text-green-600" />Todas importadas</>
                      : <><ArrowUpRight className="w-3.5 h-3.5" />Importar todas</>}
                  </Button>
                </div>
              )}
              <ScrollArea className="h-80">
                <div className="space-y-3 pr-2">
                  {dados.plano_acao?.length > 0 ? (
                    dados.plano_acao.map((a, i) => (
                      <div key={i} className={`rounded-lg border transition-colors ${acoesSalvas.has(i) ? "border-green-200 bg-green-50/40 dark:bg-green-950/10" : ""}`}>
                        <div className="flex items-start gap-2 p-3 cursor-pointer" onClick={() => setAcaoExpandida(acaoExpandida === i ? null : i)}>
                          <Target className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug">{a.what || a.recomendacao}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              <Badge variant={a.prioridade === "alta" ? "destructive" : a.prioridade === "media" ? "secondary" : "outline"} className="text-[10px]">{a.prioridade}</Badge>
                              {a.setor && <Badge variant="outline" className="text-[10px]">{a.setor}</Badge>}
                              {a.prazo && <Badge variant="outline" className="text-[10px]">📅 {a.prazo}</Badge>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {acoesSalvas.has(i)
                              ? <div className="flex items-center gap-1 text-xs text-green-600"><CheckCheck className="w-3.5 h-3.5" /><span>Enviada</span></div>
                              : <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary hover:bg-primary/10"
                                  onClick={e => { e.stopPropagation(); enviarAcaoPlano(a, i); }}>
                                  <ArrowUpRight className="w-3 h-3" />Enviar ao Plano
                                </Button>
                            }
                            {acaoExpandida === i ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                          </div>
                        </div>
                        {/* 5W2H expandido */}
                        {acaoExpandida === i && (
                          <div className="border-t px-3 pb-3 pt-2.5 bg-muted/20">
                            <p className="text-[10px] font-semibold text-muted-foreground mb-2 tracking-wide uppercase">Estrutura 5W2H</p>
                            <div className="grid grid-cols-1 gap-1.5 text-xs">
                              {(a.what || a.recomendacao) && <div className="flex gap-2"><span className="font-semibold text-primary w-24 flex-shrink-0">O quê (What)</span><span className="text-muted-foreground">{a.what || a.recomendacao}</span></div>}
                              {a.why && <div className="flex gap-2"><span className="font-semibold text-primary w-24 flex-shrink-0">Por quê (Why)</span><span className="text-muted-foreground">{a.why}</span></div>}
                              {(a.where || a.setor) && <div className="flex gap-2"><span className="font-semibold text-primary w-24 flex-shrink-0">Onde (Where)</span><span className="text-muted-foreground">{a.where || a.setor}</span></div>}
                              {(a.who || a.responsavel) && <div className="flex gap-2"><span className="font-semibold text-primary w-24 flex-shrink-0">Quem (Who)</span><span className="text-muted-foreground">{a.who || a.responsavel}</span></div>}
                              {(a.when || a.prazo) && <div className="flex gap-2"><span className="font-semibold text-primary w-24 flex-shrink-0">Quando (When)</span><span className="text-muted-foreground">{a.when || a.prazo}</span></div>}
                              {a.how && <div className="flex gap-2"><span className="font-semibold text-primary w-24 flex-shrink-0">Como (How)</span><span className="text-muted-foreground">{a.how}</span></div>}
                              {a.how_much && <div className="flex gap-2"><span className="font-semibold text-primary w-24 flex-shrink-0">Custo (How Much)</span><span className="text-muted-foreground">{a.how_much}</span></div>}
                            </div>
                            {a.trecho_origem && (
                              <div className="mt-2 pt-2 border-t">
                                <p className="text-[10px] text-muted-foreground">📌 <em>"{a.trecho_origem}"</em></p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground italic text-center py-8">Nenhum item de plano de ação identificado</p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Responsáveis Técnicos */}
            <TabsContent value="responsaveis" className="mt-4">
              <div className="space-y-3">
                {dados.responsaveis_tecnicos?.length > 0 ? (
                  dados.responsaveis_tecnicos.map((r, i) => {
                    const resp = r as typeof r & { funcao?: string };
                    return (
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
                            {resp.funcao && !r.funcao_no_doc && <Badge variant="outline" className="text-xs">{resp.funcao}</Badge>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground italic text-center py-8">Nenhum responsável técnico identificado</p>
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
                      p.severidade === "media" ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/10" : "bg-muted/30"
                    }`}>
                      <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${p.severidade === "critica" ? "text-destructive" : p.severidade === "media" ? "text-amber-600" : "text-muted-foreground"}`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{p.campo}</p>
                        <p className="text-xs text-muted-foreground">{p.motivo}</p>
                      </div>
                      <Badge variant={p.severidade === "critica" ? "destructive" : "secondary"} className="text-[10px] ml-auto flex-shrink-0">{p.severidade}</Badge>
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
        <Button variant="outline" onClick={() => { setModoRascunho(true); handleSalvar(); }} disabled={salvando}>
          Salvar como Rascunho
        </Button>
        <Button onClick={() => { setModoRascunho(false); handleSalvar(); }} disabled={salvando}>
          {salvando ? "Salvando..." : "Confirmar Importação"}
        </Button>
      </div>
    </div>
  );
}
