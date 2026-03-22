import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Clock, Save, Building2, Plus, Trash2, AlertTriangle } from "lucide-react";
import { HubContabilidade } from "@/hooks/useHubProcessos";

interface SlaRule {
  tipo: string;
  sla_horas: number;
}

interface Props {
  contabilidades: HubContabilidade[];
  onRefresh: () => void;
}

const TIPOS_PROCESSO = [
  { value: "admissao", label: "Admissão", sla_padrao: 48 },
  { value: "demissao", label: "Demissão / Rescisão", sla_padrao: 72 },
  { value: "ferias", label: "Férias", sla_padrao: 24 },
  { value: "advertencia", label: "Advertência", sla_padrao: 24 },
  { value: "atestado_afastamento", label: "Atestado / Afastamento", sla_padrao: 48 },
  { value: "ponto_folha", label: "Folha / Ponto", sla_padrao: 72 },
  { value: "eventos_variaveis", label: "Eventos Variáveis", sla_padrao: 48 },
  { value: "solicitacao_geral", label: "Solicitação Geral", sla_padrao: 96 },
];

const SLA_STATUS_COLOR = (horas: number) => {
  if (horas <= 24) return "bg-green-100 text-green-800";
  if (horas <= 48) return "bg-blue-100 text-blue-800";
  if (horas <= 72) return "bg-amber-100 text-amber-800";
  return "bg-orange-100 text-orange-800";
};

export function HubSlaConfig({ contabilidades, onRefresh }: Props) {
  const { profile } = useAuthContext();
  const tenantId = profile?.tenant_id;
  const [slaRules, setSlaRules] = useState<SlaRule[]>(
    TIPOS_PROCESSO.map(t => ({ tipo: t.value, sla_horas: t.sla_padrao }))
  );
  const [novaContabilidade, setNovaContabilidade] = useState({ nome: "", email_principal: "", responsavel_nome: "" });
  const [salvando, setSalvando] = useState(false);
  const [addingContab, setAddingContab] = useState(false);

  const handleSalvarSla = async () => {
    if (!tenantId) return;
    setSalvando(true);
    try {
      // Salva/atualiza configuração de SLA por tipo no hub_config
      const config = { sla_por_tipo: Object.fromEntries(slaRules.map(r => [r.tipo, r.sla_horas])) };
      const { error } = await supabase
        .from("hub_config")
        .upsert({ tenant_id: tenantId, ...config } as any, { onConflict: "tenant_id" });
      if (error) { toast.error(error.message); return; }
      toast.success("Configurações de SLA salvas!");
    } finally {
      setSalvando(false);
    }
  };

  const handleAddContabilidade = async () => {
    if (!tenantId || !novaContabilidade.nome) return;
    setAddingContab(true);
    try {
      const { error } = await supabase
        .from("hub_contabilidades")
        .insert({ tenant_id: tenantId, ...novaContabilidade } as any);
      if (error) { toast.error(error.message); return; }
      toast.success("Contabilidade cadastrada!");
      setNovaContabilidade({ nome: "", email_principal: "", responsavel_nome: "" });
      onRefresh();
    } finally {
      setAddingContab(false);
    }
  };

  const handleToggleContabilidade = async (id: string, ativo: boolean) => {
    const { error } = await supabase
      .from("hub_contabilidades")
      .update({ ativo: !ativo } as any)
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(ativo ? "Contabilidade desativada" : "Contabilidade ativada");
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Configurações do Hub</h2>
        <p className="text-sm text-muted-foreground">Gerencie SLAs, contabilidades parceiras e integrações</p>
      </div>

      {/* SLA por tipo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4" /> SLA por Tipo de Processo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Defina o prazo máximo (em horas) para resolução de cada tipo de processo.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {slaRules.map((rule, idx) => {
              const tipo = TIPOS_PROCESSO.find(t => t.value === rule.tipo);
              return (
                <div key={rule.tipo} className="flex items-center gap-3 p-2 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{tipo?.label || rule.tipo}</p>
                    <Badge className={`text-xs mt-0.5 ${SLA_STATUS_COLOR(rule.sla_horas)}`}>
                      {rule.sla_horas}h
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      value={rule.sla_horas}
                      onChange={e => {
                        const updated = [...slaRules];
                        updated[idx] = { ...rule, sla_horas: parseInt(e.target.value) || 24 };
                        setSlaRules(updated);
                      }}
                      className="h-8 w-20 text-sm text-center"
                      min={1}
                    />
                    <span className="text-xs text-muted-foreground">h</span>
                  </div>
                </div>
              );
            })}
          </div>
          <Button onClick={handleSalvarSla} disabled={salvando} className="gap-2">
            <Save className="w-4 h-4" />
            {salvando ? "Salvando..." : "Salvar SLAs"}
          </Button>
        </CardContent>
      </Card>

      {/* Contabilidades parceiras */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Contabilidades Parceiras
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Lista existente */}
          {contabilidades.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Nenhuma contabilidade cadastrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {contabilidades.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{c.nome}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                      {c.email_principal && <span>{c.email_principal}</span>}
                      {c.responsavel_nome && <span>Resp: {c.responsavel_nome}</span>}
                    </div>
                  </div>
                  <Badge className={c.ativo ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}>
                    {c.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleContabilidade(c.id, c.ativo)}
                    className="text-xs h-7"
                  >
                    {c.ativo ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Adicionar nova */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Adicionar Contabilidade
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Nome *</Label>
                <Input
                  value={novaContabilidade.nome}
                  onChange={e => setNovaContabilidade(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Razão social"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input
                  type="email"
                  value={novaContabilidade.email_principal}
                  onChange={e => setNovaContabilidade(p => ({ ...p, email_principal: e.target.value }))}
                  placeholder="contato@contabil.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Responsável</Label>
                <Input
                  value={novaContabilidade.responsavel_nome}
                  onChange={e => setNovaContabilidade(p => ({ ...p, responsavel_nome: e.target.value }))}
                  placeholder="Nome do responsável"
                  className="mt-1"
                />
              </div>
            </div>
            <Button
              onClick={handleAddContabilidade}
              disabled={addingContab || !novaContabilidade.nome}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              {addingContab ? "Cadastrando..." : "Cadastrar Contabilidade"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alertas de integração */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Integrações Automáticas Ativas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { modulo: "Admissão", evento: "Cadastro de admissão concluído", tipo: "admissao", ativo: true },
              { modulo: "Demissão", evento: "Solicitação de desligamento confirmada", tipo: "demissao", ativo: true },
              { modulo: "Férias", evento: "Férias aprovadas e documentos gerados", tipo: "ferias", ativo: true },
              { modulo: "Contratos de Experiência", evento: "Encerramento/efetivação de contrato", tipo: "ponto_folha", ativo: true },
              { modulo: "Holerites", evento: "Holerite arquivado no sistema", tipo: "ponto_folha", ativo: true },
              { modulo: "Advertências", evento: "Advertência emitida no módulo disciplinar", tipo: "advertencia", ativo: false },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-2 p-2 rounded-lg border text-sm">
                <div>
                  <p className="font-medium">{item.modulo}</p>
                  <p className="text-xs text-muted-foreground">{item.evento}</p>
                </div>
                <Badge className={item.ativo ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}>
                  {item.ativo ? "Ativo" : "Em desenvolvimento"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
