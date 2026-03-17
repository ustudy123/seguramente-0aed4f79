import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Brain, Shield, AlertTriangle, FileText, Calendar, RefreshCw, LockKeyhole, Sparkles, CheckCircle2, Info, Plus, Trash2, Building2, UserCog } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePsicossocial } from "@/hooks/usePsicossocial";
import { BLOCOS_DINAMICOS, INSTRUMENTOS, type CampanhaPsicossocial, type SituacaoTrabalhoCampanha } from "@/types/psicossocial";
import { format, addDays } from "date-fns";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { useAuth } from "@/hooks/useAuth";

const POLITICA_USO_DADOS_PADRAO = `Suas respostas serão utilizadas exclusivamente para fins de diagnóstico organizacional e melhoria das condições de trabalho. Este questionário é anônimo e não permite identificação individual. Os dados serão tratados de forma agregada, em conformidade com a LGPD, e não serão utilizados para decisões punitivas.`;

const MOTIVOS_EXTRAORDINARIA = [
  { value: 'acidente', label: 'Acidente de trabalho' },
  { value: 'denuncia', label: 'Denúncia grave' },
  { value: 'reestruturacao', label: 'Reestruturação organizacional' },
  { value: 'conflito', label: 'Conflito relevante' },
  { value: 'ia_sugestao', label: 'Sugestão da IA (preventivo)' },
  { value: 'solicitacao_colaborador', label: 'Solicitação de colaborador' },
];

// Mapeamento: campo do cadastro → id do bloco CET
const MAPA_EMPRESA_BLOCOS: Record<string, string> = {
  possui_terceiro_turno: 'cet_noturno',
  trabalho_altura: 'cet_altura',
  espaco_confinado: 'cet_confinado',
};

interface EmpresaDados {
  grau_risco: number | null;
  total_colaboradores: number | null;
  cnae_principal: string | null;
  possui_terceiro_turno: boolean | null;
  possui_escalas_especiais: boolean | null;
  trabalho_altura: boolean | null;
  espaco_confinado: boolean | null;
  insalubridade: boolean | null;
  periculosidade: boolean | null;
  aposentadoria_especial: boolean | null;
  razao_social: string | null;
}

const formSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  descricao: z.string().optional(),
  tipo: z.enum(['regular', 'extraordinaria']).default('regular'),
  instrumento: z.enum(['copsoq', 'hse', 'proart', 'sipro', 'customizado']).default('sipro'),
  periodicidade: z.enum(['mensal', 'trimestral', 'semestral', 'anual']).optional(),
  data_inicio: z.string().min(1, "Data de início é obrigatória"),
  data_fim: z.string().min(1, "Data de término é obrigatória"),
  politica_uso_dados: z.string().optional(),
  blocos_dinamicos: z.array(z.string()).default([]),
  motivo_extraordinaria: z.string().optional(),
  evento_gatilho_tipo: z.enum(['acidente', 'denuncia', 'reestruturacao', 'conflito', 'ia_sugestao', 'solicitacao_colaborador']).optional(),
  campanha_anterior_id: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CampanhaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campanhaAnterior?: CampanhaPsicossocial;
  instrumentoSugerido?: string;
}

export function CampanhaForm({ open, onOpenChange, campanhaAnterior, instrumentoSugerido }: CampanhaFormProps) {
  const { criarCampanha, campanhas } = usePsicossocial();
  const { empresaAtivaId } = useEmpresaAtiva();
  const { user } = useAuth();
  const [empresaDados, setEmpresaDados] = useState<EmpresaDados | null>(null);
  const [blocosAutoDetectados, setBlocosAutoDetectados] = useState<string[]>([]);
  // Situações de trabalho (pares Setor+Função) vinculadas à campanha
  const [situacoes, setSituacoes] = useState<SituacaoTrabalhoCampanha[]>(
    campanhaAnterior?.situacoes_trabalho ?? []
  );
  const [novoSetor, setNovoSetor] = useState('');
  const [novaFuncao, setNovaFuncao] = useState('');

  const isReaplicacao = !!campanhaAnterior;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: isReaplicacao ? `Reaplicação - ${campanhaAnterior.nome}` : "",
      descricao: "",
      tipo: isReaplicacao ? 'extraordinaria' : 'regular',
      instrumento: (instrumentoSugerido as FormValues['instrumento']) ?? 'sipro',
      periodicidade: 'trimestral',
      data_inicio: format(new Date(), "yyyy-MM-dd"),
      data_fim: format(addDays(new Date(), 30), "yyyy-MM-dd"),
      politica_uso_dados: campanhaAnterior?.politica_uso_dados ?? POLITICA_USO_DADOS_PADRAO,
      blocos_dinamicos: campanhaAnterior?.blocos_dinamicos ?? [],
      campanha_anterior_id: campanhaAnterior?.id,
    },
  });

  const tipo = form.watch("tipo");
  const instrumento = form.watch("instrumento");

  // Buscar dados da empresa ao abrir o form
  useEffect(() => {
    if (!open) return;
    const fetchEmpresa = async () => {
      try {
        const tenantId = user
          ? (await supabase.from('profiles').select('tenant_id').eq('user_id', user.id).single()).data?.tenant_id
          : null;
        if (!tenantId) return;

        const query = supabase
          .from('empresa_cadastro')
          .select(
            'grau_risco, total_colaboradores, cnae_principal, possui_terceiro_turno, possui_escalas_especiais, trabalho_altura, espaco_confinado, insalubridade, periculosidade, aposentadoria_especial, razao_social'
          )
          .eq('tenant_id', tenantId);

        const { data } = empresaAtivaId
          ? await query.eq('id', empresaAtivaId).single()
          : await query.limit(1).single();

        if (!data) return;
        setEmpresaDados(data as EmpresaDados);

        // Detectar blocos CET automaticamente
        const detectados: string[] = [];
        Object.entries(MAPA_EMPRESA_BLOCOS).forEach(([campo, blocoId]) => {
          if ((data as any)[campo] === true) detectados.push(blocoId);
        });
        setBlocosAutoDetectados(detectados);

        // Pré-selecionar blocos detectados (só se ainda não há seleção do campanhaAnterior)
        if (!campanhaAnterior && detectados.length > 0) {
          const atuais = form.getValues('blocos_dinamicos') ?? [];
          const merged = Array.from(new Set([...atuais, ...detectados]));
          form.setValue('blocos_dinamicos', merged);
        }
      } catch {
        // silencioso
      }
    };
    fetchEmpresa();
  }, [open, empresaAtivaId, user]);

  const addSituacao = () => {
    if (!novoSetor.trim() || !novaFuncao.trim()) return;
    const nova: SituacaoTrabalhoCampanha = {
      setorId: novoSetor.trim().toLowerCase().replace(/\s+/g, '_'),
      setorNome: novoSetor.trim(),
      funcaoId: novaFuncao.trim().toLowerCase().replace(/\s+/g, '_'),
      funcaoNome: novaFuncao.trim(),
    };
    setSituacoes(prev => [...prev, nova]);
    setNovoSetor('');
    setNovaFuncao('');
  };

  const removeSituacao = (idx: number) => {
    setSituacoes(prev => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = async (data: FormValues) => {
    // ── GAP-P1: Bloqueio obrigatório — NR-17 exige vínculo Setor+Função ──────
    if (situacoes.length === 0) {
      // Mostrar erro no formulário e rolar até a seção
      document.getElementById('situacoes-trabalho-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return; // bloqueia submissão
    }

    await criarCampanha.mutateAsync({
      nome: data.nome,
      descricao: data.descricao,
      tipo: data.tipo,
      instrumento: data.instrumento,
      periodicidade: data.tipo === 'regular' ? data.periodicidade : undefined,
      data_inicio: data.data_inicio,
      data_fim: data.data_fim,
      anonimo: true,
      permite_identificacao_voluntaria: false,
      mensagem_institucional: undefined,
      politica_uso_dados: data.politica_uso_dados,
      blocos_dinamicos: data.blocos_dinamicos,
      situacoes_trabalho: situacoes,
      motivo_extraordinaria: data.tipo === 'extraordinaria' ? data.motivo_extraordinaria : undefined,
      evento_gatilho_tipo: data.tipo === 'extraordinaria' ? data.evento_gatilho_tipo : undefined,
      campanha_anterior_id: data.campanha_anterior_id,
    });
    form.reset();
    setSituacoes([]);
    onOpenChange(false);
  };

  const campanhasAnteriores = campanhas.filter(c => c.status === 'encerrada');

  // Instrumentos que suportam blocos CET (SIPRO é o único por ora)
  const instrumentoSuportaCET = instrumento === 'sipro' || instrumento === 'customizado';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isReaplicacao ? (
              <RefreshCw className="h-5 w-5 text-amber-600" />
            ) : (
              <Brain className="h-5 w-5 text-purple-600" />
            )}
            {isReaplicacao ? 'Reaplicação Extraordinária' : 'Nova Campanha Psicossocial'}
          </DialogTitle>
          <DialogDescription>
            {isReaplicacao
              ? 'Configure uma reaplicação controlada baseada na campanha anterior'
              : 'Configure uma nova campanha de avaliação de riscos psicossociais'
            }
          </DialogDescription>
        </DialogHeader>

        {/* Banner do Assistente quando instrumento pré-selecionado */}
        {instrumentoSugerido && (
          <div className="flex items-start gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <Sparkles className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
            <p className="text-xs text-purple-800 leading-relaxed">
              <strong>Instrumento recomendado pelo Assistente:</strong> o instrumento <strong>{instrumentoSugerido.toUpperCase()}</strong> foi pré-selecionado com base na análise organizacional. Você pode alterá-lo abaixo se preferir.
            </p>
          </div>
        )}

        {/* Banner dados da empresa detectados */}
        {empresaDados && (
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-blue-500" />
              Perfil da empresa detectado automaticamente
            </p>
            <div className="flex flex-wrap gap-2">
              {empresaDados.grau_risco && (
                <Badge variant="outline" className="text-xs">
                  Grau de risco {empresaDados.grau_risco} (NR-04)
                </Badge>
              )}
              {empresaDados.cnae_principal && (
                <Badge variant="outline" className="text-xs">
                  CNAE {empresaDados.cnae_principal}
                </Badge>
              )}
              {empresaDados.insalubridade && (
                <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">
                  Insalubridade
                </Badge>
              )}
              {empresaDados.periculosidade && (
                <Badge variant="outline" className="text-xs text-red-700 border-red-300">
                  Periculosidade
                </Badge>
              )}
              {empresaDados.possui_terceiro_turno && (
                <Badge variant="outline" className="text-xs text-indigo-700 border-indigo-300">
                  3º Turno
                </Badge>
              )}
              {empresaDados.trabalho_altura && (
                <Badge variant="outline" className="text-xs text-orange-700 border-orange-300">
                  Trabalho em Altura
                </Badge>
              )}
              {empresaDados.espaco_confinado && (
                <Badge variant="outline" className="text-xs text-orange-700 border-orange-300">
                  Espaço Confinado
                </Badge>
              )}
              {empresaDados.aposentadoria_especial && (
                <Badge variant="outline" className="text-xs text-purple-700 border-purple-300">
                  Aposent. Especial
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Aviso de anonimato obrigatório */}
        <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <LockKeyhole className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-800 leading-relaxed">
            <strong>Anonimato obrigatório:</strong> Toda campanha psicossocial é 100% anônima por padrão. Não é possível vincular respostas a colaboradores individuais. Os resultados são exibidos apenas de forma agregada, com mínimo de 5 respostas para garantir o anonimato estatístico.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Tipo de Campanha */}
            {!isReaplicacao && (
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Campanha *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="regular">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-600" />
                            <span>Regular (ciclo programado)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="extraordinaria">
                          <div className="flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 text-amber-600" />
                            <span>Extraordinária (reaplicação controlada)</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {tipo === 'regular'
                        ? 'Avaliação periódica programada (trimestral, semestral, anual)'
                        : 'Reaplicação sob demanda por evento crítico ou necessidade'
                      }
                    </FormDescription>
                  </FormItem>
                )}
              />
            )}

            {/* Periodicidade - só para regular */}
            {tipo === 'regular' && (
              <FormField
                control={form.control}
                name="periodicidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Periodicidade</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a periodicidade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="trimestral">Trimestral (recomendado)</SelectItem>
                        <SelectItem value="semestral">Semestral</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Define a frequência do ciclo de avaliações
                    </FormDescription>
                  </FormItem>
                )}
              />
            )}

            {/* Campos de Reaplicação Extraordinária */}
            {tipo === 'extraordinaria' && (
              <>
                <FormField
                  control={form.control}
                  name="evento_gatilho_tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        Motivo da Reaplicação *
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o motivo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MOTIVOS_EXTRAORDINARIA.map(motivo => (
                            <SelectItem key={motivo.value} value={motivo.value}>
                              {motivo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Tipo de evento que motivou esta reaplicação
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="motivo_extraordinaria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição do Motivo</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva o evento ou situação que motivou esta reaplicação..."
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {!isReaplicacao && campanhasAnteriores.length > 0 && (
                  <FormField
                    control={form.control}
                    name="campanha_anterior_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campanha Base para Comparação</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma campanha anterior (opcional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {campanhasAnteriores.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nome} ({format(new Date(c.data_fim), 'dd/MM/yyyy')})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Permite comparar resultados antes × depois
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}

            {/* Instrumento */}
            <FormField
              control={form.control}
              name="instrumento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-600" />
                    Instrumento de Avaliação *
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o instrumento" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INSTRUMENTOS.map(inst => (
                        <SelectItem key={inst.id} value={inst.id}>
                          <div>
                            <span className="font-medium">{inst.nome}</span>
                            <span className="text-muted-foreground text-xs ml-2">— {inst.totalPerguntas} questões</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {INSTRUMENTOS.find(i => i.id === field.value)?.uso || 'Selecione o instrumento adequado ao objetivo da campanha'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Nome */}
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Campanha *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Avaliação Psicossocial Q1 2026"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Descrição */}
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o objetivo desta campanha..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Datas */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="data_inicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Início *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="data_fim"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Término *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Configuração de Privacidade */}
            <Accordion type="single" collapsible defaultValue="privacidade" className="w-full">
              <AccordionItem value="privacidade" className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-600" />
                    <span className="font-medium">Política de Dados (LGPD)</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 space-y-4">
                  {/* Anonimato sempre ativo */}
                  <div className="flex items-start gap-3 rounded-lg border p-4 bg-emerald-50/50">
                    <Shield className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-emerald-800 text-sm">Anonimato Total — Obrigatório</p>
                      <p className="text-xs text-emerald-700 mt-1">
                        Este questionário é 100% anônimo. Não é possível vincular respostas a colaboradores individuais. Os resultados são exibidos apenas de forma agregada (mínimo 5 respostas).
                      </p>
                    </div>
                  </div>

                  {/* Separação de módulos */}
                  <div className="flex items-start gap-3 rounded-lg border p-4 bg-blue-50/50">
                    <FileText className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800 text-sm">Separação entre Psicossocial e Ouvidoria</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Este módulo é destinado ao diagnóstico organizacional coletivo. Para manifestações individuais, solicitações de apoio ou denúncias, o colaborador deve utilizar o canal de Ouvidoria.
                      </p>
                    </div>
                  </div>

                  {/* Política de Uso de Dados */}
                  <FormField
                    control={form.control}
                    name="politica_uso_dados"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          Texto da Política de Dados
                        </FormLabel>
                        <FormDescription>
                          Exibido ao colaborador antes de iniciar o questionário
                        </FormDescription>
                        <FormControl>
                          <Textarea
                            placeholder="Política de privacidade..."
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Blocos Dinâmicos (CET) */}
            <FormField
              control={form.control}
              name="blocos_dinamicos"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Blocos Especiais (CET)
                  </FormLabel>
                  <FormDescription>
                    Perguntas adicionais para condições especiais de trabalho detectadas no cadastro da empresa
                  </FormDescription>

                  {/* Aviso se instrumento não suporta CET */}
                  {!instrumentoSuportaCET && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                      <span>
                        Os Blocos CET são exclusivos do <strong>SIPRO</strong>. Para o instrumento selecionado, estes blocos não serão aplicados mesmo que marcados. Para incluir blocos CET, selecione o SIPRO como instrumento.
                      </span>
                    </div>
                  )}

                  {/* Aviso de detecção automática */}
                  {blocosAutoDetectados.length > 0 && instrumentoSuportaCET && (
                    <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-600" />
                      <span>
                        <strong>Detecção automática:</strong> {blocosAutoDetectados.length} bloco(s) foram pré-selecionados com base no cadastro da empresa.
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {BLOCOS_DINAMICOS.map((bloco) => {
                      const isAutoDetectado = blocosAutoDetectados.includes(bloco.id);
                      return (
                        <div
                          key={bloco.id}
                          className={`flex items-start space-x-3 rounded-lg border p-3 transition-colors ${
                            isAutoDetectado
                              ? 'bg-blue-50/60 border-blue-200'
                              : 'bg-background'
                          }`}
                        >
                          <Checkbox
                            id={bloco.id}
                            checked={field.value?.includes(bloco.id)}
                            disabled={!instrumentoSuportaCET}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...field.value, bloco.id]);
                              } else {
                                field.onChange(field.value.filter((id: string) => id !== bloco.id));
                              }
                            }}
                          />
                          <div className="grid gap-1 leading-none">
                            <label
                              htmlFor={bloco.id}
                              className={`text-sm font-medium leading-none cursor-pointer ${!instrumentoSuportaCET ? 'opacity-50' : ''}`}
                            >
                              {bloco.titulo}
                              {isAutoDetectado && (
                                <Badge variant="secondary" className="ml-1.5 text-[10px] py-0 h-4 bg-blue-100 text-blue-700">
                                  auto
                                </Badge>
                              )}
                            </label>
                            <p className="text-xs text-muted-foreground">
                              {bloco.perguntas.length} perguntas adicionais
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </FormItem>
              )}
            />

            {/* ── GAP-P1: Situações de Trabalho (NR-17) — OBRIGATÓRIO ── */}
            <div id="situacoes-trabalho-section" className="space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-sm">Situações de Trabalho (NR-17)</span>
                <Badge className="text-xs bg-red-100 text-red-700 border-red-200 border">
                  Obrigatório
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Vincule pares de <strong>Setor + Função</strong> que serão analisados nesta campanha.
                <strong className="text-red-700"> Obrigatório</strong> para conformidade NR-17 — sem vínculo a campanha não pode ser criada.
              </p>

              {/* Lista de situações adicionadas */}
              {situacoes.length > 0 && (
                <div className="space-y-2">
                  {situacoes.map((sit, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                      <div className="flex items-center gap-2 text-sm">
                        <UserCog className="h-3.5 w-3.5 text-purple-500" />
                        <span className="font-medium">{sit.funcaoNome}</span>
                        <span className="text-muted-foreground">em</span>
                        <span>{sit.setorNome}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => removeSituacao(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Adicionar nova situação */}
              <div className="rounded-lg border border-dashed p-3 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Adicionar situação de trabalho</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Setor (ex: Produção)"
                    value={novoSetor}
                    onChange={e => setNovoSetor(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="Função (ex: Operador)"
                    value={novaFuncao}
                    onChange={e => setNovaFuncao(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSituacao())}
                    className="h-8 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-xs"
                  disabled={!novoSetor.trim() || !novaFuncao.trim()}
                  onClick={addSituacao}
                >
                  <Plus className="h-3 w-3" />
                  Adicionar par Setor+Função
                </Button>
              </div>

              {/* GAP-P1: Bloqueio visual — erro quando tenta criar sem vínculo */}
              {situacoes.length === 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">
                    <strong>Obrigatório para criar a campanha:</strong> Adicione pelo menos um par Setor+Função.
                    Exigência NR-17 e ISO 45003 — necessário para rastreabilidade no GRO e conformidade legal.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={criarCampanha.isPending}>
                {criarCampanha.isPending ? "Criando..." : "Criar Campanha"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
