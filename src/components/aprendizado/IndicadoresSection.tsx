import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, BarChart3, Loader2, Target, Pencil, X } from "lucide-react";
import { toast } from "sonner";

interface IndicadoresSectionProps {
  cargoId: string;
}

interface Indicador {
  id: string;
  nome: string;
  descricao: string | null;
  meta: string | null;
  periodicidade: string;
}

const periodicidadeOptions = [
  { value: "diaria", label: "Diária" },
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

export function IndicadoresSection({ cargoId }: IndicadoresSectionProps) {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [meta, setMeta] = useState("");
  const [periodicidade, setPeriodicidade] = useState("mensal");

  const { data: indicadores = [], isLoading } = useQuery({
    queryKey: ["funcao_indicadores", cargoId, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await fromTable("funcao_indicadores")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("cargo_id", cargoId)
        .order("created_at") as { data: Indicador[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const resetForm = () => {
    setNome("");
    setDescricao("");
    setMeta("");
    setPeriodicidade("mensal");
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (ind: Indicador) => {
    setEditingId(ind.id);
    setNome(ind.nome);
    setDescricao(ind.descricao || "");
    setMeta(ind.meta || "");
    setPeriodicidade(ind.periodicidade);
    setShowForm(true);
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !nome.trim()) throw new Error("Preencha o nome");
      const { error } = await fromTable("funcao_indicadores").insert({
        tenant_id: tenantId,
        cargo_id: cargoId,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        meta: meta.trim() || null,
        periodicidade,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funcao_indicadores", cargoId] });
      resetForm();
      toast.success("Indicador adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId || !nome.trim()) throw new Error("Preencha o nome");
      const { error } = await fromTable("funcao_indicadores")
        .update({
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          meta: meta.trim() || null,
          periodicidade,
        } as any)
        .eq("id", editingId) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funcao_indicadores", cargoId] });
      resetForm();
      toast.success("Indicador atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("funcao_indicadores").delete().eq("id", id) as { error: Error | null };
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funcao_indicadores", cargoId] });
      toast.success("Indicador removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSave = () => {
    if (editingId) {
      updateMutation.mutate();
    } else {
      addMutation.mutate();
    }
  };

  const isSaving = addMutation.isPending || updateMutation.isPending;

  const periodicidadeLabel = (v: string) =>
    periodicidadeOptions.find((o) => o.value === v)?.label || v;

  if (isLoading) return <div className="text-muted-foreground text-sm">Carregando indicadores...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Indicadores de Desempenho ({indicadores.length})
        </h3>
        <Button size="sm" variant="outline" onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}>
          {showForm ? <><X className="w-4 h-4 mr-1" /> Cancelar</> : <><Plus className="w-4 h-4 mr-1" /> Adicionar</>}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <Input placeholder="Nome do indicador *" value={nome} onChange={(e) => setNome(e.target.value)} />
            <Textarea placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input placeholder="Meta (ex: ≥ 95%, ≤ 5 dias)" value={meta} onChange={(e) => setMeta(e.target.value)} />
              <Select value={periodicidade} onValueChange={setPeriodicidade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {periodicidadeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving || !nome.trim()}>
                {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {editingId ? "Atualizar" : "Salvar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {indicadores.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Target className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum indicador definido para esta função.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {indicadores.map((ind) => (
            <Card key={ind.id}>
              <CardContent className="p-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{ind.nome}</p>
                  {ind.descricao && <p className="text-xs text-muted-foreground mt-0.5">{ind.descricao}</p>}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {ind.meta && <Badge variant="outline" className="text-xs">Meta: {ind.meta}</Badge>}
                    <Badge variant="secondary" className="text-xs">{periodicidadeLabel(ind.periodicidade)}</Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => startEdit(ind)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(ind.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
