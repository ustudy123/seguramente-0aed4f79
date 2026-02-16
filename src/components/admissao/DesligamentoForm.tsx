import { useState, useMemo } from "react";
import { format, differenceInYears } from "date-fns";
import { UserMinus, AlertTriangle, Shield, FileCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

const MOTIVOS_DESLIGAMENTO: Record<string, string> = {
  sem_justa_causa: "Dispensa sem justa causa",
  com_justa_causa: "Dispensa com justa causa (art. 482 CLT)",
  pedido_demissao: "Pedido de demissão",
  acordo_mutuo: "Acordo mútuo (art. 484-A CLT)",
  termino_contrato: "Término de contrato",
  aposentadoria: "Aposentadoria",
  falecimento: "Falecimento",
  rescisao_indireta: "Rescisão indireta (art. 483 CLT)",
  culpa_reciproca: "Culpa recíproca",
};

const TIPOS_AVISO: Record<string, string> = {
  trabalhado: "Trabalhado",
  indenizado: "Indenizado",
  dispensado: "Dispensado",
  nao_aplicavel: "Não aplicável",
};

const RESULTADOS_EXAME: Record<string, string> = {
  apto: "Apto",
  inapto: "Inapto",
  apto_restricoes: "Apto com restrições",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admissao: {
    id: string;
    nome_completo: string;
    cargo: string;
    data_admissao: string | null;
    tipo_contrato: string | null;
  };
  onConfirmar: (id: string, dados: Record<string, any>) => Promise<void>;
}

export const DesligamentoForm = ({ open, onOpenChange, admissao, onConfirmar }: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    data_desligamento: "",
    motivo_desligamento: "",
    tipo_aviso_previo: "indenizado",
    data_aviso_previo: "",
    aviso_previo_cumprido: false,
    data_exame_demissional: "",
    resultado_exame_demissional: "",
    medico_exame_demissional: "",
    crm_exame_demissional: "",
    data_homologacao: "",
    sindicato_homologacao: "",
    multa_fgts: false,
    seguro_desemprego_elegivel: false,
    chave_conectividade: "",
    observacoes_desligamento: "",
  });

  // Calcular dias de aviso prévio (Lei 12.506/2011)
  const diasAvisoPrevio = useMemo(() => {
    if (!admissao.data_admissao || !form.data_desligamento) return 30;
    const anos = differenceInYears(new Date(form.data_desligamento), new Date(admissao.data_admissao));
    // 30 dias base + 3 dias por ano trabalhado, máximo 90 dias
    return Math.min(30 + Math.max(0, anos) * 3, 90);
  }, [admissao.data_admissao, form.data_desligamento]);

  // Elegibilidade seguro desemprego
  const elegibilidadeSeguro = useMemo(() => {
    const motivo = form.motivo_desligamento;
    // Apenas sem justa causa e rescisão indireta geram direito
    return motivo === "sem_justa_causa" || motivo === "rescisao_indireta";
  }, [form.motivo_desligamento]);

  // Multa FGTS automática
  const temMultaFGTS = useMemo(() => {
    const motivo = form.motivo_desligamento;
    if (motivo === "sem_justa_causa" || motivo === "rescisao_indireta") return 40;
    if (motivo === "acordo_mutuo") return 20;
    return 0;
  }, [form.motivo_desligamento]);

  // Alertas
  const alertas = useMemo(() => {
    const items: string[] = [];
    if (!form.data_exame_demissional) {
      items.push("Exame demissional é obrigatório (NR-7, item 7.5.11)");
    }
    if (admissao.data_admissao) {
      const anos = differenceInYears(new Date(), new Date(admissao.data_admissao));
      if (anos >= 1 && !form.data_homologacao && form.motivo_desligamento !== "pedido_demissao") {
        items.push("Homologação pode ser necessária conforme convenção coletiva");
      }
    }
    if (form.motivo_desligamento === "com_justa_causa") {
      items.push("Justa causa requer documentação comprobatória robusta");
    }
    return items;
  }, [form, admissao]);

  const handleSubmit = async () => {
    if (!form.data_desligamento || !form.motivo_desligamento) return;
    setSubmitting(true);
    try {
      await onConfirmar(admissao.id, {
        ...form,
        dias_aviso_previo: diasAvisoPrevio,
        multa_fgts: temMultaFGTS > 0,
        seguro_desemprego_elegivel: elegibilidadeSeguro,
        data_desligamento: form.data_desligamento,
        data_aviso_previo: form.data_aviso_previo || null,
        data_exame_demissional: form.data_exame_demissional || null,
        resultado_exame_demissional: form.resultado_exame_demissional || null,
        medico_exame_demissional: form.medico_exame_demissional || null,
        crm_exame_demissional: form.crm_exame_demissional || null,
        data_homologacao: form.data_homologacao || null,
        sindicato_homologacao: form.sindicato_homologacao || null,
        chave_conectividade: form.chave_conectividade || null,
        observacoes_desligamento: form.observacoes_desligamento || null,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <UserMinus className="h-5 w-5" />
            Desligamento de Colaborador
          </DialogTitle>
          <DialogDescription>
            Registre o desligamento de <strong>{admissao.nome_completo}</strong> — {admissao.cargo}
          </DialogDescription>
        </DialogHeader>

        {alertas.length > 0 && (
          <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs space-y-1">
              {alertas.map((a, i) => (
                <p key={i}>⚠️ {a}</p>
              ))}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-5">
          {/* Dados do Desligamento */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <FileCheck className="h-4 w-4 text-primary" />
              Dados do Desligamento
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data do Desligamento *</Label>
                <Input type="date" value={form.data_desligamento} onChange={e => set("data_desligamento", e.target.value)} />
              </div>
              <div>
                <Label>Motivo *</Label>
                <Select value={form.motivo_desligamento} onValueChange={v => set("motivo_desligamento", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MOTIVOS_DESLIGAMENTO).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Aviso Prévio */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Aviso Prévio</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de Aviso Prévio</Label>
                <Select value={form.tipo_aviso_previo} onValueChange={v => set("tipo_aviso_previo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPOS_AVISO).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data do Aviso</Label>
                <Input type="date" value={form.data_aviso_previo} onChange={e => set("data_aviso_previo", e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">Dias de aviso prévio (Lei 12.506/2011)</p>
                <p className="text-xs text-muted-foreground">30 dias base + 3 por ano trabalhado, máx. 90 dias</p>
              </div>
              <Badge variant="outline" className="text-base font-bold">{diasAvisoPrevio} dias</Badge>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Switch checked={form.aviso_previo_cumprido} onCheckedChange={v => set("aviso_previo_cumprido", v)} />
              <Label className="text-sm">Aviso prévio cumprido</Label>
            </div>
          </div>

          <Separator />

          {/* Exame Demissional (NR-7) */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-primary" />
              Exame Demissional (NR-7)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data do Exame *</Label>
                <Input type="date" value={form.data_exame_demissional} onChange={e => set("data_exame_demissional", e.target.value)} />
              </div>
              <div>
                <Label>Resultado</Label>
                <Select value={form.resultado_exame_demissional} onValueChange={v => set("resultado_exame_demissional", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(RESULTADOS_EXAME).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Médico Responsável</Label>
                <Input value={form.medico_exame_demissional} onChange={e => set("medico_exame_demissional", e.target.value)} placeholder="Dr(a). Nome" />
              </div>
              <div>
                <Label>CRM</Label>
                <Input value={form.crm_exame_demissional} onChange={e => set("crm_exame_demissional", e.target.value)} placeholder="CRM/UF 00000" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Homologação e Verbas */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Homologação e Verbas</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data da Homologação</Label>
                <Input type="date" value={form.data_homologacao} onChange={e => set("data_homologacao", e.target.value)} />
              </div>
              <div>
                <Label>Sindicato (se aplicável)</Label>
                <Input value={form.sindicato_homologacao} onChange={e => set("sindicato_homologacao", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Multa FGTS</p>
                  <p className="text-xs text-muted-foreground">
                    {temMultaFGTS === 40 ? "40% (sem justa causa)" : temMultaFGTS === 20 ? "20% (acordo mútuo)" : "Não aplicável"}
                  </p>
                </div>
                <Badge variant={temMultaFGTS > 0 ? "default" : "secondary"} className="text-xs">
                  {temMultaFGTS}%
                </Badge>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Seguro Desemprego</p>
                  <p className="text-xs text-muted-foreground">
                    {elegibilidadeSeguro ? "Elegível" : "Não elegível para este motivo"}
                  </p>
                </div>
                <Badge variant={elegibilidadeSeguro ? "default" : "secondary"} className="text-xs">
                  {elegibilidadeSeguro ? "Sim" : "Não"}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Chave FGTS e Observações */}
          <div className="space-y-3">
            <div>
              <Label>Chave de Conectividade Social (FGTS)</Label>
              <Input value={form.chave_conectividade} onChange={e => set("chave_conectividade", e.target.value)} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes_desligamento}
                onChange={e => set("observacoes_desligamento", e.target.value)}
                rows={3}
                placeholder="Observações adicionais sobre o desligamento..."
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleSubmit}
              disabled={!form.data_desligamento || !form.motivo_desligamento || submitting}
              className="flex-1"
            >
              {submitting ? "Processando..." : "Confirmar Desligamento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
