import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  BarChart3, Plus, Edit, Trash2, Loader2, Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  INDICADOR_TIPO_LABELS, INDICADOR_DIRECAO_LABELS,
} from "@/types/metas-module";
import type { MetaIndicadorConfig, IndicadorTipo, IndicadorDirecao } from "@/types/metas-module";

export function MetasIndicadoresConfig() {
  const { tenantId } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MetaIndicadorConfig | null>(null);
  const [busca, setBusca] = useState("");

  const { data: indicadores = [], isLoading } = useQuery({
    queryKey: ["metas-indicadores", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("metas_indicadores")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("nome");
      if (error) throw error;
      return (data || []) as unknown as MetaIndicadorConfig[];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async (form: Partial<MetaIndicadorConfig>) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      if (editing?.id) {
        const { error } = await supabase
          .from("metas_indicadores")
          .update(form as any)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("metas_indicadores")
          .insert({ ...form, tenant_id: tenantId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["metas-indicadores"] });
      toast.success(editing ? "Indicador atualizado!" : "Indicador criado!");
      setShowForm(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("metas_indicadores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["metas-indicadores"] });
      toast.success("Indicador excluído!");
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = indicadores.filter(i =>
    !busca || i.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Indicadores Reutilizáveis</h3>
          <Badge variant="secondary">{indicadores.length}</Badge>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-9 w-48"
            />
          </div>
          <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1">
            <Plus className="h-4 w-4" /> Novo Indicador
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {indicadores.length === 0 ? "Nenhum indicador cadastrado. Crie o primeiro!" : "Nenhum indicador encontrado."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(ind => (
            <Card key={ind.id}>
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{ind.nome}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {INDICADOR_TIPO_LABELS[ind.tipo]}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {INDICADOR_DIRECAO_LABELS[ind.direcao]}
                    </Badge>
                    {ind.unidade_medida && (
                      <Badge variant="secondary" className="text-[10px]">{ind.unidade_medida}</Badge>
                    )}
                    {!ind.ativo && (
                      <Badge variant="destructive" className="text-[10px]">Inativo</Badge>
                    )}
                  </div>
                  {ind.descricao && <p className="text-xs text-muted-foreground">{ind.descricao}</p>}
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {ind.formula && <span>📐 {ind.formula}</span>}
                    <span>🔄 {ind.frequencia_atualizacao}</span>
                    <span>📡 {ind.origem_dados}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(ind); setShowForm(true); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                    if (confirm("Excluir este indicador?")) deleteMutation.mutate(ind.id);
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <IndicadorFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        initialData={editing}
        onSave={(data) => saveMutation.mutateAsync(data)}
        isSaving={saveMutation.isPending}
      />
    </div>
  );
}

function IndicadorFormDialog({
  open, onOpenChange, initialData, onSave, isSaving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialData: MetaIndicadorConfig | null;
  onSave: (d: Partial<MetaIndicadorConfig>) => Promise<void>;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<Partial<MetaIndicadorConfig>>({});

  const resetForm = () => {
    setForm(initialData ? { ...initialData } : {
      nome: "",
      descricao: "",
      tipo: "quantitativo" as IndicadorTipo,
      unidade_medida: "",
      formula: "",
      direcao: "maior_melhor" as IndicadorDirecao,
      origem_dados: "manual",
      frequencia_atualizacao: "mensal",
      ativo: true,
    });
  };

  const set = (f: string, v: unknown) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async () => {
    if (!form.nome?.trim()) { toast.error("Informe o nome"); return; }
    await onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Indicador" : "Novo Indicador"}</DialogTitle>
          <DialogDescription>Configure um indicador reutilizável para suas metas</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.nome || ""} onChange={e => set("nome", e.target.value)} placeholder="Ex: Taxa de Frequência" />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={form.descricao || ""} onChange={e => set("descricao", e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo || "quantitativo"} onValueChange={v => set("tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INDICADOR_TIPO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Direção</Label>
              <Select value={form.direcao || "maior_melhor"} onValueChange={v => set("direcao", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INDICADOR_DIRECAO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unidade de Medida</Label>
              <Input value={form.unidade_medida || ""} onChange={e => set("unidade_medida", e.target.value)} placeholder="%, R$, un" />
            </div>
            <div className="space-y-1.5">
              <Label>Origem dos Dados</Label>
              <Select value={form.origem_dados || "manual"} onValueChange={v => set("origem_dados", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="integrado">Integrado</SelectItem>
                  <SelectItem value="hibrido">Híbrido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Frequência de Atualização</Label>
              <Select value={form.frequencia_atualizacao || "mensal"} onValueChange={v => set("frequencia_atualizacao", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diario">Diário</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={form.ativo !== false} onCheckedChange={v => set("ativo", v)} />
              <Label>Ativo</Label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Fórmula</Label>
            <Input value={form.formula || ""} onChange={e => set("formula", e.target.value)} placeholder="Ex: (acidentes / HHT) * 1.000.000" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {initialData ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
