import { useState, useMemo, useRef, useEffect } from "react";
import { format, differenceInYears, differenceInDays, parseISO } from "date-fns";
import { UserMinus, AlertTriangle, Shield, FileCheck, Upload, X, FileText, Loader2, CheckCircle2, Info } from "lucide-react";
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
import { useEnviarParaHub } from "@/hooks/useEnviarParaHub";

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
    status?: string;
    cpf?: string;
  };
  onConfirmar: (id: string, dados: Record<string, any>) => Promise<void>;
}

export const DesligamentoForm = ({ open, onOpenChange, admissao, onConfirmar }: Props) => {
  const { tenantId, user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { enviarParaHub } = useEnviarParaHub();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [asoFile, setAsoFile] = useState<File | null>(null);
  const [uploadingAso, setUploadingAso] = useState(false);

  // NR-07: ASO anterior válido para desligamento
  const [usarAsoAnterior, setUsarAsoAnterior] = useState(false);
  const [asoValidacao, setAsoValidacao] = useState<{
    grauRisco: number | null;
    limiteValidade: number;
    ultimoAso: { data: string; subtipo: string; resultado: string } | null;
    diasDesdeUltimoAso: number | null;
    asoValido: boolean;
    carregando: boolean;
  }>({
    grauRisco: null,
    limiteValidade: 135,
    ultimoAso: null,
    diasDesdeUltimoAso: null,
    asoValido: false,
    carregando: false,
  });

  // RNDES25 – Estabilidades
  const [estabilidades, setEstabilidades] = useState<string[]>([]);
  const [estabilidadesCarregando, setEstabilidadesCarregando] = useState(false);

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

  // Buscar grau de risco da empresa e último ASO do colaborador ao abrir o diálogo
  useEffect(() => {
    if (!open || !tenantId) return;

    const buscarDadosNR07 = async () => {
      setAsoValidacao(prev => ({ ...prev, carregando: true }));
      try {
        // Buscar empresa_id do colaborador
        const { data: admissaoData } = await supabase
          .from("admissoes")
          .select("empresa_id")
          .eq("id", admissao.id)
          .single();

        let grauRisco: number | null = null;

        if (admissaoData?.empresa_id) {
          const { data: empresa } = await supabase
            .from("empresa_cadastro")
            .select("grau_risco, grau_risco_ajustado")
            .eq("id", admissaoData.empresa_id)
            .single();

          grauRisco = empresa?.grau_risco_ajustado ?? empresa?.grau_risco ?? null;
        }

        // Limite por grau de risco: GR 1 e 2 = 135 dias, GR 3 e 4 = 90 dias
        const limiteValidade = grauRisco && grauRisco >= 3 ? 90 : 135;

        // Buscar último ASO ocupacional do colaborador
        const { data: atestados } = await supabase
          .from("atestados")
          .select("data_emissao, subtipo_ocupacional, aptidao")
          .eq("tenant_id", tenantId)
          .eq("colaborador_id", admissao.id)
          .eq("tipo", "ocupacional")
          .in("subtipo_ocupacional", ["admissional", "periodico", "retorno_trabalho", "mudanca_funcao"])
          .order("data_emissao", { ascending: false })
          .limit(1);

        const ultimoAso = atestados?.[0] ?? null;
        let diasDesdeUltimoAso: number | null = null;
        let asoValido = false;

        if (ultimoAso) {
          diasDesdeUltimoAso = differenceInDays(new Date(), parseISO(ultimoAso.data_emissao));
          asoValido = diasDesdeUltimoAso <= limiteValidade;
        }

        setAsoValidacao({
          grauRisco,
          limiteValidade,
          ultimoAso: ultimoAso
            ? {
                data: ultimoAso.data_emissao,
                subtipo: ultimoAso.subtipo_ocupacional ?? "",
                resultado: ultimoAso.aptidao ?? "",
              }
            : null,
          diasDesdeUltimoAso,
          asoValido,
          carregando: false,
        });
      } catch {
        setAsoValidacao(prev => ({ ...prev, carregando: false }));
      }
    };

    buscarDadosNR07();
  }, [open, admissao.id, tenantId]);

  // RNDES25 – Verificar estabilidades do colaborador
  useEffect(() => {
    if (!open || !tenantId) return;

    const verificarEstabilidades = async () => {
      setEstabilidadesCarregando(true);
      const found: string[] = [];
      try {
        // Verificar afastamento por acidente de trabalho (estabilidade 12 meses após retorno)
        const { data: afastamentos } = await supabase
          .from("afastamentos")
          .select("status, nexo_trabalho, data_fim, motivo_principal")
          .eq("tenant_id", tenantId)
          .or(`colaborador_id.eq.${admissao.id},colaborador_nome.eq.${admissao.nome_completo}`)
          .in("nexo_trabalho", ["sim"] as any[]);

        if (afastamentos) {
          for (const af of afastamentos) {
            if (af.data_fim) {
              const mesesDesdeRetorno = differenceInDays(new Date(), parseISO(af.data_fim)) / 30;
              if (mesesDesdeRetorno < 12) {
                found.push(`Estabilidade acidentária: retorno em ${format(parseISO(af.data_fim), "dd/MM/yyyy")} — 12 meses de garantia (art. 118, Lei 8.213/91)`);
              }
            } else if (af.status === "ativo" || af.status === "beneficio_inss") {
              found.push("Colaborador em afastamento previdenciário ativo com nexo de trabalho — desligamento bloqueado");
            }
          }
        }

        // Verificar afastamento previdenciário ativo (RNDES26)
        const { data: afastAtivos } = await supabase
          .from("afastamentos")
          .select("status, data_fim")
          .eq("tenant_id", tenantId)
          .or(`colaborador_id.eq.${admissao.id},colaborador_nome.eq.${admissao.nome_completo}`)
          .in("status", ["ativo", "beneficio_inss"] as any[])
          .is("data_fim", null);

        if (afastAtivos && afastAtivos.length > 0) {
          found.push("Colaborador em afastamento previdenciário ativo — necessário retorno formal antes do desligamento (RNDES26)");
        }

        // Verificar gestante (buscar nos eventos de saúde ou atestados com CID relacionado)
        const { data: atestadosGestante } = await supabase
          .from("atestados")
          .select("cid_codigo, data_emissao")
          .eq("tenant_id", tenantId)
          .or(`colaborador_id.eq.${admissao.id},colaborador_nome.eq.${admissao.nome_completo}`)
          .like("cid_codigo", "O%")
          .order("data_emissao", { ascending: false })
          .limit(1);

        if (atestadosGestante && atestadosGestante.length > 0) {
          found.push("Possível estabilidade gestante (CID obstétrico encontrado) — confirmação da CIPA/5 meses pós-parto (art. 10, II, b, ADCT)");
        }

        setEstabilidades(found);
      } catch {
        // silently fail
      } finally {
        setEstabilidadesCarregando(false);
      }
    };

    verificarEstabilidades();
  }, [open, admissao.id, admissao.nome_completo, tenantId]);

  // Se ativar "usar ASO anterior", limpar campos do exame demissional novo
  useEffect(() => {
    if (usarAsoAnterior) {
      setForm(f => ({ ...f, data_exame_demissional: "", resultado_exame_demissional: "", medico_exame_demissional: "", crm_exame_demissional: "" }));
      setAsoFile(null);
    }
  }, [usarAsoAnterior]);

  // Calcular dias de aviso prévio (Lei 12.506/2011)
  const diasAvisoPrevio = useMemo(() => {
    if (!admissao.data_admissao || !form.data_desligamento) return 30;
    const anos = differenceInYears(new Date(form.data_desligamento), new Date(admissao.data_admissao));
    return Math.min(30 + Math.max(0, anos) * 3, 90);
  }, [admissao.data_admissao, form.data_desligamento]);

  // Elegibilidade seguro desemprego
  const elegibilidadeSeguro = useMemo(() => {
    const motivo = form.motivo_desligamento;
    return motivo === "sem_justa_causa" || motivo === "rescisao_indireta";
  }, [form.motivo_desligamento]);

  // Multa FGTS automática
  const temMultaFGTS = useMemo(() => {
    const motivo = form.motivo_desligamento;
    if (motivo === "sem_justa_causa" || motivo === "rescisao_indireta") return 40;
    if (motivo === "acordo_mutuo") return 20;
    return 0;
  }, [form.motivo_desligamento]);

  // RNDES02 – Validação de data
  const errosData = useMemo(() => {
    const erros: string[] = [];
    if (!form.data_desligamento) return erros;
    const dataDesl = parseISO(form.data_desligamento);
    if (admissao.data_admissao) {
      const dataAdm = parseISO(admissao.data_admissao);
      if (dataDesl < dataAdm) {
        erros.push("Data de desligamento não pode ser anterior à data de admissão");
      }
    }
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    if (dataDesl > hoje) {
      erros.push("Data de desligamento não pode ser futura (salvo desligamento programado)");
    }
    return erros;
  }, [form.data_desligamento, admissao.data_admissao]);

  // RNDES16 – ASO obrigatório não preenchido = bloqueio
  const asoObrigatorioNaoPreenchido = useMemo(() => {
    // Se está usando ASO anterior válido, não bloqueia
    if (usarAsoAnterior && asoValidacao.asoValido) return false;
    // Se não tem ASO anterior válido, exame demissional é obrigatório
    if (!asoValidacao.asoValido && !form.data_exame_demissional) return true;
    // Se não está usando ASO anterior e não preencheu o exame
    if (!usarAsoAnterior && !form.data_exame_demissional) return true;
    return false;
  }, [usarAsoAnterior, asoValidacao.asoValido, form.data_exame_demissional]);

  // RNDES25 – Estabilidade ativa bloqueia (a menos que justa causa)
  const bloqueioEstabilidade = useMemo(() => {
    if (estabilidades.length === 0) return false;
    // Justa causa pode desligar mesmo com estabilidade
    if (form.motivo_desligamento === "com_justa_causa") return false;
    // Falecimento também
    if (form.motivo_desligamento === "falecimento") return false;
    return true;
  }, [estabilidades, form.motivo_desligamento]);

  // Alertas
  const alertas = useMemo(() => {
    const items: string[] = [];
    // Erros de data (RNDES02)
    items.push(...errosData);
    // Estabilidades (RNDES25)
    items.push(...estabilidades);
    // ASO
    if (asoObrigatorioNaoPreenchido) {
      items.push("🚫 ASO demissional obrigatório não preenchido — confirmação bloqueada (NR-7, RNDES16)");
    }
    if (usarAsoAnterior && !asoValidacao.asoValido) {
      items.push(`ASO anterior fora do prazo de validade (${asoValidacao.limiteValidade} dias para GR ${asoValidacao.grauRisco ?? "desconhecido"}).`);
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
    if (bloqueioEstabilidade) {
      items.push("🚫 Desligamento bloqueado por estabilidade ativa — apenas justa causa ou falecimento permitidos");
    }
    return items;
  }, [form, admissao, usarAsoAnterior, asoValidacao]);

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
        desligado_por: user?.id || null,
        desligado_por_nome: profile?.nome_completo || user?.email || null,
      });

      const competencia = form.data_desligamento.slice(0, 7);

      // ── Gerar verbas rescisórias no módulo Financeiro ──
      if (tenantId) {
        try {
          // Buscar salário do colaborador
          const { data: admissaoData } = await supabase
            .from("admissoes")
            .select("salario, cpf, departamento, empresa_id")
            .eq("id", admissao.id)
            .single();

          const salarioBase = admissaoData?.salario || 0;

          // Calcular verbas
          const multaFgtsValor = salarioBase * (temMultaFGTS / 100);
          const avisoPrevioIndenizadoValor =
            form.tipo_aviso_previo === "indenizado" ? (salarioBase / 30) * diasAvisoPrevio : 0;

          const totalProventos = salarioBase + avisoPrevioIndenizadoValor;
          const totalDescontos = 0; // simplificado — INSS/IR calculados à parte
          const totalLiquido = totalProventos - totalDescontos + multaFgtsValor;

          // Buscar ou criar período rescisório
          const { data: periodoExistente } = await supabase
            .from("folha_periodos" as never)
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("competencia", competencia)
            .eq("status", "rescisao" as never)
            .maybeSingle() as any;

          let periodoId: string;

          if (periodoExistente?.id) {
            periodoId = periodoExistente.id;
          } else {
            const { data: novoPeriodo, error: errPeriodo } = await supabase
              .from("folha_periodos" as never)
              .insert({
                tenant_id: tenantId,
                competencia,
                status: "aberto",
                observacoes: `Verbas rescisórias — ${competencia}`,
                total_bruto: 0,
                total_descontos: 0,
                total_liquido: 0,
                total_colaboradores: 0,
              } as never)
              .select("id")
              .single() as any;

            if (errPeriodo) throw errPeriodo;
            periodoId = novoPeriodo.id;
          }

          // Inserir item de verba rescisória
          await supabase
            .from("folha_itens" as never)
            .insert({
              tenant_id: tenantId,
              periodo_id: periodoId,
              colaborador_id: admissao.id,
              colaborador_nome: admissao.nome_completo,
              colaborador_cpf: admissaoData?.cpf || null,
              cargo: admissao.cargo || null,
              departamento: admissaoData?.departamento || null,
              salario_base: salarioBase,
              total_proventos: totalProventos,
              total_descontos: totalDescontos,
              total_liquido: totalLiquido,
              status: "pendente",
              observacoes: `Rescisão ${MOTIVOS_DESLIGAMENTO[form.motivo_desligamento] || form.motivo_desligamento} | Aviso: ${diasAvisoPrevio}d | Multa FGTS: ${temMultaFGTS}% (R$ ${multaFgtsValor.toFixed(2)}) | Seguro-desemprego: ${elegibilidadeSeguro ? "Elegível" : "Não elegível"}`,
            } as never);

          queryClient.invalidateQueries({ queryKey: ["folha-periodos"] });
          queryClient.invalidateQueries({ queryKey: ["folha-itens"] });
          toast.success("Verbas rescisórias registradas no módulo Financeiro!");
        } catch (err: any) {
          // Não bloqueia o desligamento por erro no financeiro
          console.error("Erro ao gerar verbas rescisórias:", err);
          toast.warning("Desligamento registrado, mas houve erro ao lançar verbas no Financeiro.");
        }
      }

      // Registrar rescisão no Hub Contábil
      await enviarParaHub({
        tipo: "calculo_rescisorio",
        competencia,
        descricao: `Rescisão — ${MOTIVOS_DESLIGAMENTO[form.motivo_desligamento] || form.motivo_desligamento}`,
        colaborador_nome: admissao.nome_completo,
      });

      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao confirmar desligamento:", err);
      toast.error(err?.message || "Erro ao processar o desligamento. Tente novamente.");
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
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
            <AlertTriangle className="h-4 w-4 text-destructive" />
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
              <Switch
                checked={form.aviso_previo_cumprido}
                onCheckedChange={v => set("aviso_previo_cumprido", v)}
                disabled={form.tipo_aviso_previo !== "trabalhado"}
              />
              <Label className={`text-sm ${form.tipo_aviso_previo !== "trabalhado" ? "text-muted-foreground" : ""}`}>Aviso prévio cumprido</Label>
            </div>
          </div>

          <Separator />

          {/* Exame Demissional (NR-7) */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-primary" />
              Exame Demissional (NR-7)
            </h3>

            {/* Painel NR-07: usar ASO anterior */}
            <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground leading-relaxed">
                  <strong>NR-07:</strong> Empresas de Grau de Risco 1 e 2 podem usar ASO anterior com até{" "}
                  <strong>135 dias</strong>. Grau de Risco 3 e 4 até <strong>90 dias</strong>.
                </div>
              </div>

              {asoValidacao.carregando ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Verificando ASO anterior...
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Grau de risco da empresa */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Grau de Risco da empresa:</span>
                    {asoValidacao.grauRisco ? (
                      <Badge variant="outline" className="text-xs">GR {asoValidacao.grauRisco} — validade {asoValidacao.limiteValidade} dias</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Não informado no cadastro</Badge>
                    )}
                  </div>

                  {/* Último ASO */}
                  {asoValidacao.ultimoAso ? (
                    <div className={`flex items-center gap-2 p-2 rounded-md text-xs border ${asoValidacao.asoValido ? "bg-primary/5 text-primary border-primary/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
                      {asoValidacao.asoValido
                        ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      }
                      <span>
                        Último ASO: <strong>{format(parseISO(asoValidacao.ultimoAso.data), "dd/MM/yyyy")}</strong>
                        {" "}({asoValidacao.diasDesdeUltimoAso} dias atrás)
                        {" — "}
                        {asoValidacao.asoValido
                          ? `Dentro do prazo (${asoValidacao.limiteValidade - (asoValidacao.diasDesdeUltimoAso ?? 0)} dias restantes)`
                          : `Fora do prazo — exame demissional obrigatório`
                        }
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-muted text-muted-foreground text-xs border border-border">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                      Nenhum ASO ocupacional encontrado — exame demissional obrigatório.
                    </div>
                  )}

                  {/* Toggle para usar ASO anterior */}
                  {asoValidacao.asoValido && (
                    <div className="flex items-center gap-2 pt-1">
                      <Switch
                        checked={usarAsoAnterior}
                        onCheckedChange={setUsarAsoAnterior}
                        id="usar-aso-anterior"
                      />
                      <Label htmlFor="usar-aso-anterior" className="text-sm cursor-pointer">
                        Usar ASO anterior no lugar do exame demissional (NR-07)
                      </Label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Campos do novo exame — ocultos se usando ASO anterior */}
            {!usarAsoAnterior && (
              <>
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
              </>
            )}
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
