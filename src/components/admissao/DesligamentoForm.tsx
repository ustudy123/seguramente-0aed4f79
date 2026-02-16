import { useState, useMemo, useRef } from "react";
import { format, differenceInYears } from "date-fns";
import { UserMinus, AlertTriangle, Shield, FileCheck, Upload, X, FileText, Loader2 } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

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
  const { tenantId, user, profile } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [asoFile, setAsoFile] = useState<File | null>(null);
  const [uploadingAso, setUploadingAso] = useState(false);
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

  // Upload ASO para storage e vincular à pasta do colaborador
  const uploadAsoFile = async () => {
    if (!asoFile || !tenantId || !user) return;
    setUploadingAso(true);
    try {
      const timestamp = Date.now();
      const safeFileName = asoFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `${tenantId}/colaboradores/${admissao.id}/${timestamp}_ASO_Demissional_${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(storagePath, asoFile, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      // Encontrar a pasta do colaborador (ano atual)
      const { data: pastasColab } = await supabase
        .from("documento_pastas")
        .select("id, tipo, ano, pasta_pai_id")
        .eq("tenant_id", tenantId)
        .eq("colaborador_id", admissao.id);

      let pastaId: string | null = null;
      if (pastasColab && pastasColab.length > 0) {
        const anoAtual = new Date().getFullYear();
        const pastaAno = pastasColab.find(p => p.tipo === "ano" && p.ano === anoAtual);
        const pastaColab = pastasColab.find(p => p.tipo === "colaborador");
        pastaId = pastaAno?.id || pastaColab?.id || null;
      }

      // Salvar metadados no banco
      const { error: dbError } = await supabase
        .from("documentos" as never)
        .insert({
          tenant_id: tenantId,
          colaborador_id: admissao.id,
          colaborador_nome: admissao.nome_completo,
          nome_arquivo: storagePath,
          nome_original: `ASO Demissional - ${admissao.nome_completo}.${asoFile.name.split('.').pop()}`,
          tipo: "ASO",
          tamanho: asoFile.size,
          mime_type: asoFile.type,
          storage_path: storagePath,
          data_validade: null,
          status: "valido",
          observacoes: `ASO Demissional - Exame realizado em ${form.data_exame_demissional || "data não informada"} - Resultado: ${RESULTADOS_EXAME[form.resultado_exame_demissional] || "não informado"}`,
          criado_por: user.id,
          criado_por_nome: profile?.nome_completo,
          pasta_id: pastaId,
        } as never);

      if (dbError) {
        await supabase.storage.from("documentos").remove([storagePath]);
        throw dbError;
      }

      queryClient.invalidateQueries({ queryKey: ["documentos"] });
      queryClient.invalidateQueries({ queryKey: ["documentos-com-pasta"] });
      toast.success("ASO Demissional salvo na pasta do colaborador!");
    } catch (err: any) {
      toast.error("Erro ao salvar ASO: " + err.message);
    } finally {
      setUploadingAso(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.data_desligamento || !form.motivo_desligamento) return;
    setSubmitting(true);
    try {
      // Upload ASO se houver arquivo
      if (asoFile) {
        await uploadAsoFile();
      }

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

            {/* Upload ASO */}
            <div className="mt-3">
              <Label>Anexar ASO Demissional</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                      toast.error("Arquivo muito grande (máx. 10MB)");
                      return;
                    }
                    setAsoFile(file);
                  }
                }}
              />
              {!asoFile ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-1 border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Selecionar arquivo (PDF, JPG, PNG)
                </Button>
              ) : (
                <div className="flex items-center gap-2 mt-1 p-2 rounded-lg bg-muted/50 border">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm truncate flex-1">{asoFile.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {(asoFile.size / 1024).toFixed(0)} KB
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => {
                      setAsoFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                O documento será salvo na pasta de documentos do colaborador
              </p>
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
              disabled={!form.data_desligamento || !form.motivo_desligamento || submitting || uploadingAso}
              className="flex-1"
            >
              {(submitting || uploadingAso) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {submitting ? "Processando..." : "Confirmar Desligamento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
