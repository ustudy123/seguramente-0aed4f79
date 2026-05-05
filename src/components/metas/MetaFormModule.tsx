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
import { Sparkles, Loader2, Search, Building2, Users, User } from "lucide-react";
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
  NIVEL_LABELS, PERIODO_LABELS, INDICADOR_TIPO_LABELS, INDICADOR_DIRECAO_LABELS,
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

  const handleSubmit = async () => {
    if (!form.titulo?.trim()) {
      toast.error("Informe o título da meta");
      return;
    }
    await onSave(form as Partial<MetaCompleta>);
  };

  return (
    <div className="space-y-4">
      {/* Sugestões IA */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleSugerirIA} disabled={isSugerindo} className="gap-1.5">
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

      {/* Formulário */}
      <div className="grid md:grid-cols-2 gap-4">
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
          <Label>Período *</Label>
          <Select value={form.periodo} onValueChange={v => set("periodo", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PERIODO_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Título *</Label>
        <Input value={form.titulo || ""} onChange={e => set("titulo", e.target.value)} placeholder="Ex: Reduzir taxa de acidentes em 30%" />
      </div>

      <div className="space-y-1.5">
        <Label>Descrição</Label>
        <Textarea value={form.descricao || ""} onChange={e => set("descricao", e.target.value)} rows={3}
          placeholder="Descreva o que se espera alcançar..." />
      </div>

      <div className="space-y-1.5">
        <Label>Objetivo Estratégico Vinculado</Label>
        <Input value={form.objetivo_estrategico || ""} onChange={e => set("objetivo_estrategico", e.target.value)}
          placeholder="Ex: Excelência em SST" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Ano *</Label>
          <Input type="number" value={form.ano || new Date().getFullYear()} onChange={e => set("ano", parseInt(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>Trimestre</Label>
          <Select value={form.trimestre?.toString() || ""} onValueChange={v => set("trimestre", v ? parseInt(v) : undefined)}>
            <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Trimestre 1</SelectItem>
              <SelectItem value="2">Trimestre 2</SelectItem>
              <SelectItem value="3">Trimestre 3</SelectItem>
              <SelectItem value="4">Trimestre 4</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Datas removidas conforme solicitação */}

      {/* Indicador */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">📊 Indicador</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome do Indicador</Label>
              <Input value={form.indicador_nome || ""} onChange={e => set("indicador_nome", e.target.value)}
                placeholder="Ex: Taxa de acidentes" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.indicador_tipo || "quantitativo"} onValueChange={v => set("indicador_tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INDICADOR_TIPO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Input value={form.indicador_unidade || ""} onChange={e => set("indicador_unidade", e.target.value)} placeholder="%, R$, un" />
            </div>
            <div className="space-y-1.5">
              <Label>Valor Alvo</Label>
              <Input type="number" value={form.valor_alvo || ""} onChange={e => set("valor_alvo", parseFloat(e.target.value) || undefined)} />
            </div>
            <div className="space-y-1.5">
              <Label>Baseline</Label>
              <Input type="number" value={form.valor_baseline || ""} onChange={e => set("valor_baseline", parseFloat(e.target.value) || undefined)} />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Direção</Label>
              <Select value={form.indicador_direcao || "maior_melhor"} onValueChange={v => set("indicador_direcao", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INDICADOR_DIRECAO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Peso</Label>
              <Input type="number" step="0.1" value={form.peso || 1} onChange={e => set("peso", parseFloat(e.target.value) || 1)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Fórmula de Medição</Label>
            <Input value={form.formula_medicao || ""} onChange={e => set("formula_medicao", e.target.value)}
              placeholder="Ex: (acidentes mês / total colaboradores) * 100" />
          </div>
        </CardContent>
      </Card>

      {/* Campos dinâmicos por nível */}
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
                <Command>
                  <CommandInput placeholder="Buscar unidade..." value={searchUnidade} onValueChange={setSearchUnidade} />
                  <CommandList>
                    <CommandEmpty>Nenhuma unidade encontrada.</CommandEmpty>
                    <CommandGroup>
                      {unidadesFiltradas.map(u => (
                        <CommandItem
                          key={u.id}
                          value={u.razao_social}
                          onSelect={() => {
                            set("unidade_id", u.id);
                            set("unidade_nome", u.nome_fantasia || u.razao_social);
                            setOpenUnidade(false);
                            setSearchUnidade("");
                          }}
                        >
                          <span className="truncate">{u.nome_fantasia || u.razao_social}</span>
                          {u.nome_fantasia && (
                            <span className="ml-2 text-xs text-muted-foreground truncate">{u.razao_social}</span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
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
                <Command>
                  <CommandInput placeholder="Buscar setor..." value={searchSetor} onValueChange={setSearchSetor} />
                  <CommandList>
                    <CommandEmpty>Nenhum setor encontrado.</CommandEmpty>
                    <CommandGroup>
                      {setoresFiltrados.map(d => (
                        <CommandItem
                          key={d.id}
                          value={d.nome}
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
                <Command>
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
