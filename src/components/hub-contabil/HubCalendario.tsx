import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Calendar, ArrowUp, ArrowDown, CheckCircle2, Clock, Settings2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface CalendarioEnvio {
  id: string;
  tenant_id: string;
  titulo: string;
  tipo: string;
  categoria: string;
  dia_limite: number;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
}

interface CalendarioStatus {
  id: string;
  calendario_id: string;
  competencia: string;
  status: string;
  concluido_por: string | null;
  concluido_em: string | null;
  observacoes: string | null;
}

const categoriaLabels: Record<string, string> = {
  folha: "Folha de Pagamento",
  fgts: "FGTS / GFIP",
  inss: "INSS / GPS",
  irrf: "IRRF / DARF",
  darf: "DARF",
  gps: "GPS",
  esocial: "eSocial",
  dctfweb: "DCTFWeb",
  rais: "RAIS / DIRF",
  caged: "CAGED",
  outro: "Outro",
};

const categoriaOptions = Object.entries(categoriaLabels);

export function HubCalendario() {
  const { profile } = useAuthContext();
  const tenantId = profile?.tenant_id;
  const [itens, setItens] = useState<CalendarioEnvio[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, CalendarioStatus>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ titulo: "", tipo: "envio", categoria: "folha", dia_limite: "7", descricao: "" });

  const competenciaAtual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const fetchAll = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [itensRes, statusRes] = await Promise.all([
        supabase.from("hub_calendario_envios").select("*").eq("tenant_id", tenantId).order("dia_limite"),
        supabase.from("hub_calendario_status").select("*").eq("tenant_id", tenantId).eq("competencia", competenciaAtual),
      ]);
      if (itensRes.data) setItens(itensRes.data as unknown as CalendarioEnvio[]);
      if (statusRes.data) {
        const map: Record<string, CalendarioStatus> = {};
        (statusRes.data as unknown as CalendarioStatus[]).forEach((s) => { map[s.calendario_id] = s; });
        setStatusMap(map);
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId, competenciaAtual]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async () => {
    if (!tenantId || !form.titulo || !form.categoria) return;
    const { error } = await supabase.from("hub_calendario_envios").insert({
      tenant_id: tenantId,
      titulo: form.titulo,
      tipo: form.tipo,
      categoria: form.categoria,
      dia_limite: parseInt(form.dia_limite),
      descricao: form.descricao || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Item adicionado ao calendário!");
    setForm({ titulo: "", tipo: "envio", categoria: "folha", dia_limite: "7", descricao: "" });
    setDialogOpen(false);
    fetchAll();
  };

  const handleToggleAtivo = async (item: CalendarioEnvio) => {
    await supabase.from("hub_calendario_envios").update({ ativo: !item.ativo } as any).eq("id", item.id);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("hub_calendario_envios").delete().eq("id", id);
    toast.success("Item removido.");
    fetchAll();
  };

  const handleMarcarConcluido = async (item: CalendarioEnvio) => {
    const existing = statusMap[item.id];
    if (existing) {
      await supabase.from("hub_calendario_status").update({
        status: existing.status === "concluido" ? "pendente" : "concluido",
        concluido_por: existing.status === "concluido" ? null : profile?.nome_completo,
        concluido_em: existing.status === "concluido" ? null : new Date().toISOString(),
      } as any).eq("id", existing.id);
    } else {
      await supabase.from("hub_calendario_status").insert({
        tenant_id: tenantId,
        calendario_id: item.id,
        competencia: competenciaAtual,
        status: "concluido",
        concluido_por: profile?.nome_completo,
        concluido_em: new Date().toISOString(),
      } as any);
    }
    fetchAll();
  };

  const hoje = new Date().getDate();

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground">Carregando...</div>;

  const ativos = itens.filter((i) => i.ativo);
  const inativos = itens.filter((i) => !i.ativo);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Calendário de Envios</h2>
          <p className="text-sm text-muted-foreground">Competência atual: <strong>{competenciaAtual}</strong></p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo Item</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar ao Calendário</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Título *</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Envio da folha de pagamento" />
              </div>
              <div>
                <Label>Direção</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="envio">Envio (RH → Contabilidade)</SelectItem>
                    <SelectItem value="recebimento">Recebimento (Contabilidade → RH)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria *</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categoriaOptions.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dia limite do mês *</Label>
                <Input type="number" min={1} max={31} value={form.dia_limite} onChange={(e) => setForm({ ...form, dia_limite: e.target.value })} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Detalhes ou instruções" />
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={!form.titulo || !form.categoria}>
                Adicionar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {ativos.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhum item configurado. Adicione envios ou recebimentos recorrentes ao calendário.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {ativos.map((item) => {
            const st = statusMap[item.id];
            const concluido = st?.status === "concluido";
            const atrasado = !concluido && hoje > item.dia_limite;
            return (
              <Card key={item.id} className={concluido ? "opacity-70" : atrasado ? "border-destructive/50" : ""}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {item.tipo === "envio" ? <ArrowUp className="w-4 h-4 text-blue-500" /> : <ArrowDown className="w-4 h-4 text-green-500" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${concluido ? "line-through text-muted-foreground" : ""}`}>{item.titulo}</span>
                        <Badge variant="outline" className="text-xs">{categoriaLabels[item.categoria] || item.categoria}</Badge>
                        <Badge variant="outline" className="text-xs gap-1">
                          <Calendar className="w-2.5 h-2.5" /> Dia {item.dia_limite}
                        </Badge>
                        {atrasado && <Badge className="bg-destructive/10 text-destructive text-xs">Atrasado</Badge>}
                        {concluido && <Badge className="bg-green-100 text-green-800 text-xs">Concluído</Badge>}
                      </div>
                      {item.descricao && <p className="text-xs text-muted-foreground mt-0.5">{item.descricao}</p>}
                      {concluido && st?.concluido_por && (
                        <p className="text-xs text-muted-foreground">Por {st.concluido_por} • {st.concluido_em ? new Date(st.concluido_em).toLocaleDateString("pt-BR") : ""}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={concluido ? "outline" : "default"} onClick={() => handleMarcarConcluido(item)}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> {concluido ? "Reabrir" : "Concluir"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleToggleAtivo(item)} title={item.ativo ? "Desativar" : "Ativar"}>
                      <Settings2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {inativos.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium text-muted-foreground mb-2">Inativos ({inativos.length})</p>
          <div className="space-y-2 opacity-50">
            {inativos.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <span className="text-sm">{item.titulo} — Dia {item.dia_limite}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleToggleAtivo(item)}>Reativar</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
