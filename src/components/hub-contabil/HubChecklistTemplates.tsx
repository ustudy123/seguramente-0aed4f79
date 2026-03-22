import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CheckSquare, Plus, Trash2, Edit2, Globe, Building2, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";

const TIPOS = [
  { value: "admissao", label: "Admissão" },
  { value: "demissao", label: "Demissão / Rescisão" },
  { value: "ferias", label: "Férias" },
  { value: "advertencia", label: "Advertência" },
  { value: "atestado_afastamento", label: "Atestado / Afastamento" },
  { value: "ponto_folha", label: "Ponto / Folha" },
  { value: "eventos_variaveis", label: "Eventos Variáveis" },
  { value: "solicitacao_geral", label: "Solicitação Geral" },
];

interface Template {
  id: string;
  tipo: string;
  item: string;
  descricao: string | null;
  obrigatorio: boolean;
  ordem: number;
  ativo: boolean;
  tenant_id: string | null;
}

const tipoLabel = (tipo: string) => TIPOS.find(t => t.value === tipo)?.label || tipo;

export function HubChecklistTemplates() {
  const { profile } = useAuthContext();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipoSelecionado, setTipoSelecionado] = useState("admissao");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set(["admissao"]));
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Template | null>(null);
  const [form, setForm] = useState({ tipo: "admissao", item: "", descricao: "", obrigatorio: true, ordem: 0 });

  const fetchTemplates = async () => {
    if (!profile?.tenant_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("hub_checklist_templates" as any)
      .select("*")
      .or(`tenant_id.is.null,tenant_id.eq.${profile.tenant_id}`)
      .order("tipo")
      .order("ordem");
    setTemplates((data as unknown as Template[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, [profile?.tenant_id]);

  const handleSalvar = async () => {
    if (!profile?.tenant_id || !form.item.trim()) return;
    if (editando) {
      // Só pode editar itens do próprio tenant (não os globais)
      if (!editando.tenant_id) {
        toast.error("Não é possível editar templates globais do sistema. Crie um customizado.");
        return;
      }
      const { error } = await supabase
        .from("hub_checklist_templates" as any)
        .update({ item: form.item, descricao: form.descricao || null, obrigatorio: form.obrigatorio, ordem: form.ordem })
        .eq("id", editando.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Item atualizado!");
    } else {
      const { error } = await supabase
        .from("hub_checklist_templates" as any)
        .insert({ tenant_id: profile.tenant_id, tipo: form.tipo, item: form.item, descricao: form.descricao || null, obrigatorio: form.obrigatorio, ordem: form.ordem });
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Item adicionado ao checklist!");
    }
    setModalAberto(false);
    setEditando(null);
    fetchTemplates();
  };

  const handleToggleAtivo = async (t: Template) => {
    if (!t.tenant_id) {
      toast.info("Templates globais não podem ser desativados diretamente. Crie um customizado para sobrescrever.");
      return;
    }
    await supabase.from("hub_checklist_templates" as any).update({ ativo: !t.ativo }).eq("id", t.id);
    fetchTemplates();
  };

  const handleExcluir = async (t: Template) => {
    if (!t.tenant_id) { toast.error("Templates globais não podem ser excluídos."); return; }
    await supabase.from("hub_checklist_templates" as any).delete().eq("id", t.id);
    toast.success("Item removido!");
    fetchTemplates();
  };

  const abrirNovo = (tipo?: string) => {
    setEditando(null);
    const proximaOrdem = templates.filter(t => t.tipo === (tipo || tipoSelecionado)).length + 1;
    setForm({ tipo: tipo || tipoSelecionado, item: "", descricao: "", obrigatorio: true, ordem: proximaOrdem });
    setModalAberto(true);
  };

  const abrirEditar = (t: Template) => {
    setEditando(t);
    setForm({ tipo: t.tipo, item: t.item, descricao: t.descricao || "", obrigatorio: t.obrigatorio, ordem: t.ordem });
    setModalAberto(true);
  };

  const toggleExpand = (tipo: string) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      next.has(tipo) ? next.delete(tipo) : next.add(tipo);
      return next;
    });
  };

  const templatesPorTipo = TIPOS.map(t => ({
    ...t,
    items: templates.filter(tp => tp.tipo === t.value),
    customCount: templates.filter(tp => tp.tipo === t.value && tp.tenant_id).length,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-primary" />
            Templates de Checklist
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Itens que aparecem automaticamente no checklist ao criar cada tipo de processo
          </p>
        </div>
        <Button size="sm" onClick={() => abrirNovo()}>
          <Plus className="w-4 h-4 mr-1" /> Novo Item
        </Button>
      </div>

      <div className="rounded-lg border bg-amber-50 border-amber-200 p-3 flex gap-2 text-xs text-amber-800">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          <strong>Itens globais</strong> (<Globe className="w-3 h-3 inline" />) são padrões do sistema e não podem ser editados.
          Para personalizar, adicione novos itens com o seu tenant — eles têm <strong>prioridade</strong> sobre os globais de mesmo nome.
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Carregando templates...</p>
      ) : (
        <div className="space-y-2">
          {templatesPorTipo.map(grupo => (
            <Card key={grupo.value} className="overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left"
                onClick={() => toggleExpand(grupo.value)}
              >
                <div className="flex items-center gap-3">
                  {expandidos.has(grupo.value) ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <span className="font-medium text-sm">{grupo.label}</span>
                  <Badge variant="secondary" className="text-xs">{grupo.items.filter(i => i.ativo).length} itens ativos</Badge>
                  {grupo.customCount > 0 && (
                    <Badge variant="outline" className="text-xs text-primary border-primary/40">
                      {grupo.customCount} customizados
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={(e) => { e.stopPropagation(); abrirNovo(grupo.value); }}
                >
                  <Plus className="w-3 h-3 mr-1" /> Adicionar
                </Button>
              </button>

              {expandidos.has(grupo.value) && (
                <CardContent className="p-0 border-t">
                  {grupo.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-4 text-center">Nenhum item configurado</p>
                  ) : (
                    <div className="divide-y">
                      {grupo.items.map(item => (
                        <div key={item.id} className={`flex items-start gap-3 p-3 ${!item.ativo ? "opacity-50" : ""}`}>
                          <div className="pt-0.5">
                            {item.tenant_id ? (
                              <Building2 className="w-3.5 h-3.5 text-primary" title="Template personalizado do seu tenant" />
                            ) : (
                              <Globe className="w-3.5 h-3.5 text-muted-foreground" title="Template global do sistema" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{item.item}</span>
                              {item.obrigatorio ? (
                                <Badge variant="destructive" className="text-xs py-0 h-4">obrigatório</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs py-0 h-4">opcional</Badge>
                              )}
                            </div>
                            {item.descricao && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.descricao}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Switch
                              checked={item.ativo}
                              onCheckedChange={() => handleToggleAtivo(item)}
                              className="scale-75"
                            />
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => abrirEditar(item)}>
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            {item.tenant_id && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleExcluir(item)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal criar/editar */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Item" : "Novo Item de Checklist"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editando && (
              <div className="space-y-1">
                <Label>Tipo de Processo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Descrição do Item *</Label>
              <Input
                value={form.item}
                onChange={e => setForm(f => ({ ...f, item: e.target.value }))}
                placeholder="Ex: Contrato assinado pelo colaborador"
              />
            </div>
            <div className="space-y-1">
              <Label>Orientação (opcional)</Label>
              <Textarea
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Detalhes de como verificar ou executar este item"
                rows={2}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.obrigatorio}
                  onCheckedChange={v => setForm(f => ({ ...f, obrigatorio: v }))}
                />
                <Label>Obrigatório</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  className="w-16 h-8"
                  value={form.ordem}
                  onChange={e => setForm(f => ({ ...f, ordem: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={!form.item.trim()}>
              {editando ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
