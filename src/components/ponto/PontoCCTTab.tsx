import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Scale, Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface CCTForm {
  nome: string;
  sindicato: string;
  categoria_profissional: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  jornada_semanal_horas: number;
  jornada_diaria_horas: number;
  he_percentual_dia_util: number;
  he_percentual_domingos: number;
  he_percentual_feriados: number;
  he_limite_diario_min: number;
  adicional_noturno_percentual: number;
  hora_noturna_inicio: string;
  hora_noturna_fim: string;
  usa_hora_ficta: boolean;
  intervalo_minimo_min: number;
  intervalo_maximo_min: number;
  banco_horas_permitido: boolean;
  banco_horas_prazo_compensacao_meses: number;
  dsr_proporcional: boolean;
  observacoes: string;
}

const defaultForm: CCTForm = {
  nome: "",
  sindicato: "",
  categoria_profissional: "",
  vigencia_inicio: "",
  vigencia_fim: "",
  jornada_semanal_horas: 44,
  jornada_diaria_horas: 8,
  he_percentual_dia_util: 50,
  he_percentual_domingos: 100,
  he_percentual_feriados: 100,
  he_limite_diario_min: 120,
  adicional_noturno_percentual: 20,
  hora_noturna_inicio: "22:00",
  hora_noturna_fim: "05:00",
  usa_hora_ficta: true,
  intervalo_minimo_min: 60,
  intervalo_maximo_min: 120,
  banco_horas_permitido: true,
  banco_horas_prazo_compensacao_meses: 6,
  dsr_proporcional: true,
  observacoes: "",
};

export function PontoCCTTab() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CCTForm>(defaultForm);
  const [salvando, setSalvando] = useState(false);

  const { data: ccts = [], isLoading } = useQuery({
    queryKey: ["ponto-cct-config", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await fromTable("ponto_cct_config")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }) as { data: any[] | null };
      return data || [];
    },
    enabled: !!tenantId,
  });

  const handleNova = () => {
    setForm(defaultForm);
    setEditId(null);
    setShowModal(true);
  };

  const handleEditar = (cct: any) => {
    setForm({
      nome: cct.nome || "",
      sindicato: cct.sindicato || "",
      categoria_profissional: cct.categoria_profissional || "",
      vigencia_inicio: cct.vigencia_inicio || "",
      vigencia_fim: cct.vigencia_fim || "",
      jornada_semanal_horas: cct.jornada_semanal_horas || 44,
      jornada_diaria_horas: cct.jornada_diaria_horas || 8,
      he_percentual_dia_util: cct.he_percentual_dia_util || 50,
      he_percentual_domingos: cct.he_percentual_domingos || 100,
      he_percentual_feriados: cct.he_percentual_feriados || 100,
      he_limite_diario_min: cct.he_limite_diario_min || 120,
      adicional_noturno_percentual: cct.adicional_noturno_percentual || 20,
      hora_noturna_inicio: cct.hora_noturna_inicio || "22:00",
      hora_noturna_fim: cct.hora_noturna_fim || "05:00",
      usa_hora_ficta: cct.usa_hora_ficta ?? true,
      intervalo_minimo_min: cct.intervalo_minimo_min || 60,
      intervalo_maximo_min: cct.intervalo_maximo_min || 120,
      banco_horas_permitido: cct.banco_horas_permitido ?? true,
      banco_horas_prazo_compensacao_meses: cct.banco_horas_prazo_compensacao_meses || 6,
      dsr_proporcional: cct.dsr_proporcional ?? true,
      observacoes: cct.observacoes || "",
    });
    setEditId(cct.id);
    setShowModal(true);
  };

  const handleSalvar = async () => {
    if (!form.nome || !tenantId) {
      toast.error("Nome da CCT é obrigatório");
      return;
    }
    setSalvando(true);
    try {
      const payload = { ...form, tenant_id: tenantId };

      if (editId) {
        await fromTable("ponto_cct_config").update(payload as any).eq("id", editId);
        toast.success("CCT atualizada!");
      } else {
        await fromTable("ponto_cct_config").insert(payload as any);
        toast.success("CCT cadastrada!");
      }

      queryClient.invalidateQueries({ queryKey: ["ponto-cct-config"] });
      setShowModal(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id: string) => {
    await fromTable("ponto_cct_config").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["ponto-cct-config"] });
    toast.success("CCT removida");
  };

  const updateForm = (field: keyof CCTForm, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" /> Convenções Coletivas (CCT)
          </h3>
          <p className="text-sm text-muted-foreground">Parametrize regras por sindicato, empresa ou categoria</p>
        </div>
        <Button onClick={handleNova}><Plus className="w-4 h-4 mr-2" /> Nova CCT</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Sindicato</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-center">Jornada</TableHead>
                <TableHead className="text-center">HE Dia Útil</TableHead>
                <TableHead className="text-center">HE Dom/Fer</TableHead>
                <TableHead className="text-center">Vigência</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : ccts.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma CCT cadastrada. Use os padrões CLT.</TableCell></TableRow>
              ) : ccts.map((cct: any) => (
                <TableRow key={cct.id}>
                  <TableCell className="font-medium">{cct.nome}</TableCell>
                  <TableCell>{cct.sindicato || "—"}</TableCell>
                  <TableCell>{cct.categoria_profissional || "—"}</TableCell>
                  <TableCell className="text-center">{cct.jornada_semanal_horas}h/sem</TableCell>
                  <TableCell className="text-center">{cct.he_percentual_dia_util}%</TableCell>
                  <TableCell className="text-center">{cct.he_percentual_domingos}% / {cct.he_percentual_feriados}%</TableCell>
                  <TableCell className="text-center">
                    {cct.vigencia_inicio && cct.vigencia_fim
                      ? `${format(new Date(cct.vigencia_inicio), "MM/yy")} — ${format(new Date(cct.vigencia_fim), "MM/yy")}`
                      : <Badge variant="outline">Sem vigência</Badge>}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditar(cct)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleExcluir(cct.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar CCT" : "Nova Convenção Coletiva"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Identificação */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da CCT *</Label>
                <Input value={form.nome} onChange={e => updateForm("nome", e.target.value)} placeholder="Ex: CCT Metalúrgicos SP 2025" />
              </div>
              <div className="space-y-2">
                <Label>Sindicato</Label>
                <Input value={form.sindicato} onChange={e => updateForm("sindicato", e.target.value)} placeholder="Nome do sindicato" />
              </div>
              <div className="space-y-2">
                <Label>Categoria Profissional</Label>
                <Input value={form.categoria_profissional} onChange={e => updateForm("categoria_profissional", e.target.value)} placeholder="Ex: Metalúrgicos" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Vigência Início</Label>
                  <Input type="date" value={form.vigencia_inicio} onChange={e => updateForm("vigencia_inicio", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Vigência Fim</Label>
                  <Input type="date" value={form.vigencia_fim} onChange={e => updateForm("vigencia_fim", e.target.value)} />
                </div>
              </div>
            </div>

            {/* Jornada */}
            <div>
              <h4 className="font-medium mb-3">Jornada</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Jornada Semanal (h)</Label>
                  <Input type="number" value={form.jornada_semanal_horas} onChange={e => updateForm("jornada_semanal_horas", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Jornada Diária (h)</Label>
                  <Input type="number" value={form.jornada_diaria_horas} onChange={e => updateForm("jornada_diaria_horas", Number(e.target.value))} />
                </div>
              </div>
            </div>

            {/* Horas Extras */}
            <div>
              <h4 className="font-medium mb-3">Horas Extras</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>% Dia Útil</Label>
                  <Input type="number" value={form.he_percentual_dia_util} onChange={e => updateForm("he_percentual_dia_util", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>% Domingos</Label>
                  <Input type="number" value={form.he_percentual_domingos} onChange={e => updateForm("he_percentual_domingos", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>% Feriados</Label>
                  <Input type="number" value={form.he_percentual_feriados} onChange={e => updateForm("he_percentual_feriados", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Limite Diário (min)</Label>
                  <Input type="number" value={form.he_limite_diario_min} onChange={e => updateForm("he_limite_diario_min", Number(e.target.value))} />
                </div>
              </div>
            </div>

            {/* Adicional Noturno */}
            <div>
              <h4 className="font-medium mb-3">Adicional Noturno</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Percentual (%)</Label>
                  <Input type="number" value={form.adicional_noturno_percentual} onChange={e => updateForm("adicional_noturno_percentual", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Início</Label>
                  <Input type="time" value={form.hora_noturna_inicio} onChange={e => updateForm("hora_noturna_inicio", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Input type="time" value={form.hora_noturna_fim} onChange={e => updateForm("hora_noturna_fim", e.target.value)} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={form.usa_hora_ficta} onCheckedChange={v => updateForm("usa_hora_ficta", v)} />
                  <Label>Hora ficta (52m30s)</Label>
                </div>
              </div>
            </div>

            {/* Intervalos */}
            <div>
              <h4 className="font-medium mb-3">Intervalos</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Intervalo Mínimo (min)</Label>
                  <Input type="number" value={form.intervalo_minimo_min} onChange={e => updateForm("intervalo_minimo_min", Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Intervalo Máximo (min)</Label>
                  <Input type="number" value={form.intervalo_maximo_min} onChange={e => updateForm("intervalo_maximo_min", Number(e.target.value))} />
                </div>
              </div>
            </div>

            {/* Banco de Horas */}
            <div>
              <h4 className="font-medium mb-3">Banco de Horas & DSR</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={form.banco_horas_permitido} onCheckedChange={v => updateForm("banco_horas_permitido", v)} />
                  <Label>Banco de Horas Permitido</Label>
                </div>
                <div className="space-y-2">
                  <Label>Prazo Compensação (meses)</Label>
                  <Input type="number" value={form.banco_horas_prazo_compensacao_meses} onChange={e => updateForm("banco_horas_prazo_compensacao_meses", Number(e.target.value))} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.dsr_proporcional} onCheckedChange={v => updateForm("dsr_proporcional", v)} />
                  <Label>DSR Proporcional</Label>
                </div>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Input value={form.observacoes} onChange={e => updateForm("observacoes", e.target.value)} placeholder="Observações adicionais" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
