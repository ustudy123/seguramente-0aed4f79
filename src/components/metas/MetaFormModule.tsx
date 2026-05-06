import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Search, Building2, Users, User, Target, BarChart3, Calendar, FileText } from "lucide-react";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { toast } from "sonner";
import type { MetaCompleta, MetaNivel, MetaParticipante } from "@/types/metas-module";
import {
  NIVEL_LABELS, INDICADOR_TIPO_LABELS,
} from "@/types/metas-module";
import { MetaParticipantesEditor } from "./MetaParticipantesEditor";
import { useQuery } from "@tanstack/react-query";

interface MetaFormModuleProps {
  nivel?: MetaNivel;
  metaPai?: MetaCompleta;
  initialData?: Partial<MetaCompleta>;
  onSave: (data: Partial<MetaCompleta>) => Promise<unknown>;
  onCancel: () => void;
  isSaving?: boolean;
}

type MetaFormState = Partial<Omit<MetaCompleta, "participantes">> & {
  participantes?: Partial<MetaParticipante>[];
};

export function MetaFormModule({
  nivel: defaultNivel, metaPai, initialData, onSave, onCancel, isSaving,
}: MetaFormModuleProps) {
  const { tenantId } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();

  const [form, setForm] = useState<MetaFormState>({
    titulo: "",
    descricao: "",
    nivel: defaultNivel || "individual",
    tipo: "individual",
    periodo: "trimestral",
    ano: new Date().getFullYear(),
    peso: 1,
    indicador_tipo: "quantitativo",
    indicador_direcao: "maior_melhor",
    workflow_status: "rascunho",
    status: "nao_iniciada",
    progresso: 0,
    compartilhada: initialData?.compartilhada ?? Boolean(initialData?.participantes?.length),
    participantes: initialData?.participantes || [],
    ...initialData,
    ...(metaPai ? { meta_pai_id: metaPai.id, objetivo_estrategico: metaPai.objetivo_estrategico } : {}),
  });
  const [isSugerindo, setIsSugerindo] = useState(false);
  const [sugestoes, setSugestoes] = useState<any[]>([]);
  const [openUnidade, setOpenUnidade] = useState(false);
  const [openSetor, setOpenSetor] = useState(false);
  const [openColaborador, setOpenColaborador] = useState(false);
  const [searchUnidade, setSearchUnidade] = useState("");
  const [searchSetor, setSearchSetor] = useState("");
  const [searchColaborador, setSearchColaborador] = useState("");

  const set = (field: string, value: unknown) => setForm(p => ({ ...p, [field]: value }));

  // Buscar unidades (empresas)
  const { data: unidades = [] } = useQuery({
    queryKey: ["empresas-meta-form", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("empresa_cadastro")
        .select("id, razao_social, nome_fantasia")
        .eq("tenant_id", tenantId)
        .order("razao_social");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Buscar setores/departamentos
  const { data: setores = [] } = useQuery({
    queryKey: ["departamentos-meta-form", tenantId, empresaAtivaId],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase
        .from("departamentos")
        .select("id, nome")
        .eq("tenant_id", tenantId)
        .order("nome");
      if (empresaAtivaId) q = q.eq("empresa_id", empresaAtivaId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Buscar colaboradores
  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores-meta-form", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, nome_completo")
        .eq("tenant_id", tenantId)
        .order("nome_completo");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const unidadesFiltradas = useMemo(() => {
    if (!searchUnidade) return unidades;
    const s = searchUnidade.toLowerCase();
    return unidades.filter(u => (u.razao_social || "").toLowerCase().includes(s) || (u.nome_fantasia || "").toLowerCase().includes(s));
  }, [unidades, searchUnidade]);

  const setoresFiltrados = useMemo(() => {
    if (!searchSetor) return setores;
    const s = searchSetor.toLowerCase();
    return setores.filter(d => (d.nome || "").toLowerCase().includes(s));
  }, [setores, searchSetor]);

  const colaboradoresFiltrados = useMemo(() => {
    if (!searchColaborador) return colaboradores;
    const s = searchColaborador.toLowerCase();
    return colaboradores.filter(c => (c.nome_completo || "").toLowerCase().includes(s));
  }, [colaboradores, searchColaborador]);

  const handleSugerirIA = async () => {
    setIsSugerindo(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-metas", {
        body: {
          acao: "sugerir",
          nivelDestino: form.nivel,
          contexto: form.objetivo_estrategico || form.descricao || "Empresa de segurança do trabalho",
          meta: metaPai ? { titulo: metaPai.titulo, descricao: metaPai.descricao } : undefined,
        },
      });
      if (error) throw error;
      if (data?.sugestoes) {
        setSugestoes(data.sugestoes);
        toast.success("Sugestões geradas!");
      }
    } catch (e: any) {
      toast.error(`Erro IA: ${e.message}`);
    } finally {
      setIsSugerindo(false);
    }
  };

  const [isSugerindoIndicador, setIsSugerindoIndicador] = useState(false);
  const handleSugerirIndicadorIA = async () => {
    if (!form.titulo?.trim()) {
      toast.error("Preencha o título da meta primeiro");
      return;
    }
    setIsSugerindoIndicador(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-metas", {
        body: {
          acao: "sugerir_indicador",
          meta: { titulo: form.titulo, descricao: form.descricao },
        },
      });
      if (error) throw error;
      if (data) {
        setForm(prev => ({
          ...prev,
          indicador_nome: data.indicador_nome ?? prev.indicador_nome,
          indicador_tipo: data.indicador_tipo ?? prev.indicador_tipo,
          indicador_unidade: data.indicador_unidade ?? prev.indicador_unidade,
          valor_alvo: data.valor_alvo ?? prev.valor_alvo,
        }));
        toast.success(data.justificativa ? `Indicador sugerido! ${data.justificativa}` : "Indicador sugerido!");
      }
    } catch (e: any) {
      toast.error(`Erro IA: ${e.message}`);
    } finally {
      setIsSugerindoIndicador(false);
    }
  };

  const [isSugerindoTitulo, setIsSugerindoTitulo] = useState(false);
  const handleSugerirTituloIA = async () => {
    setIsSugerindoTitulo(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-metas", {
        body: {
          acao: "sugerir_titulo",
          meta: { titulo: form.titulo, descricao: form.descricao, nivel: form.nivel },
        },
      });
      if (error) throw error;
      if (data?.titulo) {
        setForm(prev => ({ ...prev, titulo: data.titulo }));
        toast.success(data.justificativa ? `Título sugerido! ${data.justificativa}` : "Título sugerido!");
      }
    } catch (e: any) {
      toast.error(`Erro IA: ${e.message}`);
    } finally {
      setIsSugerindoTitulo(false);
    }
  };

  const [isSugerindoDescricao, setIsSugerindoDescricao] = useState(false);
  const handleSugerirDescricaoIA = async () => {
    if (!form.titulo?.trim()) {
      toast.error("Preencha o título da meta primeiro");
      return;
    }
    setIsSugerindoDescricao(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-metas", {
        body: {
          acao: "sugerir_descricao",
          meta: { titulo: form.titulo, descricao: form.descricao, nivel: form.nivel },
        },
      });
      if (error) throw error;
      if (data?.descricao) {
        setForm(prev => ({ ...prev, descricao: data.descricao }));
        toast.success("Descrição sugerida!");
      }
    } catch (e: any) {
      toast.error(`Erro IA: ${e.message}`);
    } finally {
      setIsSugerindoDescricao(false);
    }
  };

  const aplicarSugestao = (s: any) => {
    setForm(prev => ({
      ...prev,
      titulo: s.titulo,
      descricao: s.descricao,
      indicador_nome: s.indicador_nome,
      indicador_tipo: s.indicador_tipo || "quantitativo",
      indicador_unidade: s.indicador_unidade,
      valor_alvo: s.valor_alvo,
      periodo: s.periodo || prev.periodo,
    }));
    setSugestoes([]);
    toast.success("Sugestão aplicada!");
  };

  // Efeito para identificar automaticamente o trimestre e ano pela data fim
  useEffect(() => {
    if (form.data_fim) {
      const dataFim = new Date(form.data_fim + "T00:00:00");
      if (!isNaN(dataFim.getTime())) {
        const mes = dataFim.getMonth();
        const trimestreSugerido = Math.floor(mes / 3) + 1;
        const anoSugerido = dataFim.getFullYear();

        if (form.periodo === "trimestral" && form.trimestre !== trimestreSugerido) {
          set("trimestre", trimestreSugerido);
        }
        
        if (form.ano !== anoSugerido) {
          set("ano", anoSugerido);
        }
      }
    }
  }, [form.data_fim, form.periodo]);

  const handleSubmit = async () => {
    if (!form.titulo?.trim()) {
      toast.error("Informe o título da meta");
      return;
    }
    await onSave(form as Partial<MetaCompleta>);
  };

  return (
    <div className="space-y-5">
      {/* Sugestões IA */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSugerirIA}
          disabled={isSugerindo}
          className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
        >
          {isSugerindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Sugerir com IA
        </Button>
      </div>

      {sugestoes.length > 0 && (
        <div className="grid gap-2">
          {sugestoes.map((s, i) => (
            <Card key={i} className="border-dashed border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
              onClick={() => aplicarSugestao(s)}>
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    <Sparkles className="h-3 w-3 mr-1" /> IA
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{s.titulo}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{s.descricao}</p>
                    {s.justificativa && (
                      <p className="text-xs text-muted-foreground mt-1 italic">💡 {s.justificativa}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Seção: Informações Gerais */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3 border-b bg-muted/30">
          <CardTitle className="text-sm flex items-center gap-2 text-foreground">
            <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            Informações Gerais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label>Nível *</Label>
            <Select value={form.nivel} onValueChange={v => set("nivel", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(NIVEL_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between min-h-[24px]">
              <Label>Título *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSugerirTituloIA}
                disabled={isSugerindoTitulo}
                className="h-6 px-2 text-xs gap-1 text-primary hover:bg-primary/10"
                title="Sugerir título com IA (usa título/descrição atuais como contexto)"
              >
                {isSugerindoTitulo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Sugerir com IA
              </Button>
            </div>
            <Input value={form.titulo || ""} onChange={e => set("titulo", e.target.value)} placeholder="Ex: Reduzir taxa de acidentes em 30%" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between min-h-[24px]">
              <Label>Descrição</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSugerirDescricaoIA}
                disabled={isSugerindoDescricao || !form.titulo?.trim()}
                className="h-6 px-2 text-xs gap-1 text-primary hover:bg-primary/10"
                title={!form.titulo?.trim() ? "Preencha o título primeiro" : "Sugerir descrição com IA"}
              >
                {isSugerindoDescricao ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Sugerir com IA
              </Button>
            </div>
            <Textarea value={form.descricao || ""} onChange={e => set("descricao", e.target.value)} rows={3}
              placeholder="Descreva o que se espera alcançar..." />
          </div>

        </CardContent>
      </Card>

      {/* Seção: Período */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3 border-b bg-muted/30">
          <CardTitle className="text-sm flex items-center gap-2 text-foreground">
            <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            Período
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Ano *</Label>
              <Input type="number" value={form.ano || new Date().getFullYear()} onChange={e => set("ano", parseInt(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Trimestre da Entrega</Label>
              <Select disabled value={form.trimestre?.toString() || ""} onValueChange={v => set("trimestre", v ? parseInt(v) : undefined)}>
                <SelectTrigger className="bg-muted cursor-not-allowed"><SelectValue placeholder="Automático" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1º Trimestre</SelectItem>
                  <SelectItem value="2">2º Trimestre</SelectItem>
                  <SelectItem value="3">3º Trimestre</SelectItem>
                  <SelectItem value="4">4º Trimestre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Data Início</Label>
              <Input type="date" value={form.data_inicio || ""} onChange={e => set("data_inicio", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data Fim</Label>
              <Input type="date" value={form.data_fim || ""} onChange={e => set("data_fim", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção: Indicador */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3 border-b bg-muted/30">
          <CardTitle className="text-sm flex items-center gap-2 text-foreground">
            <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            Indicador de Medição
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between min-h-[24px]">
                <Label>Nome do Indicador</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSugerirIndicadorIA}
                  disabled={isSugerindoIndicador || !form.titulo?.trim()}
                  className="h-6 px-2 text-xs gap-1 text-primary hover:bg-primary/10"
                  title={!form.titulo?.trim() ? "Preencha o título da meta primeiro" : "Sugerir indicador com IA"}
                >
                  {isSugerindoIndicador ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Sugerir com IA
                </Button>
              </div>
              <Input value={form.indicador_nome || ""} onChange={e => set("indicador_nome", e.target.value)}
                placeholder="Ex: Taxa de acidentes" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.indicador_tipo || "quantitativo"} onValueChange={v => set("indicador_tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INDICADOR_TIPO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v as string}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unidade de Medida</Label>
              <Select
                value={form.indicador_unidade || ""}
                onValueChange={v => set("indicador_unidade", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {form.indicador_tipo === "quantitativo" && (
                    <>
                      <SelectItem value="%">Porcentagem (%)</SelectItem>
                      <SelectItem value="un">Unidades (un)</SelectItem>
                      <SelectItem value="qtd">Quantidade (qtd)</SelectItem>
                      <SelectItem value="horas">Horas</SelectItem>
                      <SelectItem value="dias">Dias</SelectItem>
                    </>
                  )}
                  {form.indicador_tipo === "financeiro" && (
                    <>
                      <SelectItem value="R$">Real (R$)</SelectItem>
                      <SelectItem value="US$">Dólar (US$)</SelectItem>
                      <SelectItem value="€">Euro (€)</SelectItem>
                    </>
                  )}
                  {form.indicador_tipo === "qualitativo" && (
                    <>
                      <SelectItem value="nivel">Nível (1-5)</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="conceito">Conceito (A-E)</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-primary" />
                Valor Alvo
              </Label>
              <Input type="number" value={form.valor_alvo ?? ""} onChange={e => set("valor_alvo", parseFloat(e.target.value) || undefined)} placeholder="Meta a alcançar" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção: Responsabilidades */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3 border-b bg-muted/30">
          <CardTitle className="text-sm flex items-center gap-2 text-foreground">
            <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            Responsabilidades
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid md:grid-cols-2 gap-4">
        {/* Unidade - aparece para nível unidade, setor e individual */}
        {(form.nivel === "unidade" || form.nivel === "setor" || form.nivel === "individual") && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Unidade
            </Label>
            <Popover open={openUnidade} onOpenChange={setOpenUnidade}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-10">
                  {form.unidade_nome || "Selecionar unidade..."}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <div className="p-2 border-b">
                  <Input
                    placeholder="Buscar unidade..."
                    value={searchUnidade}
                    onChange={(e) => setSearchUnidade(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="max-h-[240px] overflow-y-auto p-1">
                  {unidadesFiltradas.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma unidade encontrada.</p>
                  ) : (
                    unidadesFiltradas.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          set("unidade_id", u.id);
                          set("unidade_nome", u.nome_fantasia || u.razao_social);
                          setOpenUnidade(false);
                          setSearchUnidade("");
                        }}
                        className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2"
                      >
                        <span className="truncate">{u.nome_fantasia || u.razao_social}</span>
                        {u.nome_fantasia && (
                          <span className="ml-auto text-xs text-muted-foreground truncate">{u.razao_social}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Setor/Departamento - aparece para nível setor e individual */}
        {(form.nivel === "setor" || form.nivel === "individual") && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Setor / Departamento
            </Label>
            <Popover open={openSetor} onOpenChange={setOpenSetor}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-10">
                  {form.setor_nome || form.departamento_nome || "Selecionar setor..."}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Buscar setor..." value={searchSetor} onValueChange={setSearchSetor} />
                  <CommandList>
                    <CommandEmpty>Nenhum setor encontrado.</CommandEmpty>
                    <CommandGroup>
                      {setoresFiltrados.filter(d => d.id && d.nome).map(d => (
                        <CommandItem
                          key={d.id}
                          value={d.nome || d.id}
                          onSelect={() => {
                            set("setor_id", d.id);
                            set("setor_nome", d.nome);
                            set("departamento_id", d.id);
                            set("departamento_nome", d.nome);
                            setOpenSetor(false);
                            setSearchSetor("");
                          }}
                        >
                          {d.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Colaborador - aparece para nível individual */}
        {form.nivel === "individual" && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Colaborador
            </Label>
            <Popover open={openColaborador} onOpenChange={setOpenColaborador}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-10">
                  {form.colaborador_nome || "Selecionar colaborador..."}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Buscar colaborador..." value={searchColaborador} onValueChange={setSearchColaborador} />
                  <CommandList>
                    <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                    <CommandGroup>
                      {colaboradoresFiltrados.map(c => (
                        <CommandItem
                          key={c.user_id}
                          value={c.nome_completo}
                          onSelect={() => {
                            set("colaborador_id", c.user_id);
                            set("colaborador_nome", c.nome_completo);
                            set("responsavel_id", c.user_id);
                            set("responsavel_nome", c.nome_completo);
                            setOpenColaborador(false);
                            setSearchColaborador("");
                          }}
                        >
                          {c.nome_completo}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Responsável - sempre visível para estratégica, ou como fallback */}
        {form.nivel === "estrategica" && (
          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Input value={form.responsavel_nome || ""} onChange={e => set("responsavel_nome", e.target.value)} placeholder="Nome do responsável" />
          </div>
        )}
          </div>
        </CardContent>
      </Card>

      <MetaParticipantesEditor
        compartilhada={Boolean(form.compartilhada)}
        onCompartilhadaChange={(value) => set("compartilhada", value)}
        participantes={form.participantes || []}
        onParticipantesChange={(participantes) => {
          setForm((prev) => ({
            ...prev,
            compartilhada: participantes.length > 0 ? true : Boolean(prev.compartilhada),
            participantes,
          }));
        }}
      />

      {metaPai && (
        <div className="p-3 bg-muted/50 rounded-lg text-sm">
          <span className="text-muted-foreground">Meta superior: </span>
          <span className="font-medium">{metaPai.titulo}</span>
        </div>
      )}

      {/* Ações */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {initialData?.id ? "Atualizar" : "Criar Meta"}
        </Button>
      </div>
    </div>
  );
}
