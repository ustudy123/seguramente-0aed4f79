import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Brain, Shield, AlertTriangle, UserCheck, FileText, Info, Calendar, RefreshCw } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import { BLOCOS_DINAMICOS, INSTRUMENTOS, type CampanhaPsicossocial, type InstrumentoPsicossocial } from "@/types/psicossocial";
import { format, addDays } from "date-fns";

const MENSAGEM_INSTITUCIONAL_PADRAO = `Você pode optar por se identificar caso deseje acompanhamento individual.
Sua identificação será utilizada apenas para ações de cuidado e não para punição.`;

const POLITICA_USO_DADOS_PADRAO = `Suas respostas serão utilizadas exclusivamente para fins de diagnóstico organizacional e melhoria das condições de trabalho. Os dados são tratados de acordo com a LGPD e as respostas individuais não serão utilizadas para decisões punitivas.`;

const MOTIVOS_EXTRAORDINARIA = [
  { value: 'acidente', label: 'Acidente de trabalho' },
  { value: 'denuncia', label: 'Denúncia grave' },
  { value: 'reestruturacao', label: 'Reestruturação organizacional' },
  { value: 'conflito', label: 'Conflito relevante' },
  { value: 'ia_sugestao', label: 'Sugestão da IA (preventivo)' },
  { value: 'solicitacao_colaborador', label: 'Solicitação de colaborador' },
];

const formSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  descricao: z.string().optional(),
  tipo: z.enum(['regular', 'extraordinaria']).default('regular'),
  instrumento: z.enum(['copsoq', 'hse', 'proart', 'customizado']).default('copsoq'),
  periodicidade: z.enum(['mensal', 'trimestral', 'semestral', 'anual']).optional(),
  data_inicio: z.string().min(1, "Data de início é obrigatória"),
  data_fim: z.string().min(1, "Data de término é obrigatória"),
  anonimo: z.boolean().default(true),
  permite_identificacao_voluntaria: z.boolean().default(true),
  mensagem_institucional: z.string().optional(),
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
  campanhaAnterior?: CampanhaPsicossocial; // Para reaplicação baseada em campanha anterior
}

export function CampanhaForm({ open, onOpenChange, campanhaAnterior }: CampanhaFormProps) {
  const { criarCampanha, campanhas } = usePsicossocial();

  const isReaplicacao = !!campanhaAnterior;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: isReaplicacao ? `Reaplicação - ${campanhaAnterior.nome}` : "",
      descricao: "",
      tipo: isReaplicacao ? 'extraordinaria' : 'regular',
      periodicidade: 'trimestral',
      data_inicio: format(new Date(), "yyyy-MM-dd"),
      data_fim: format(addDays(new Date(), 30), "yyyy-MM-dd"),
      anonimo: campanhaAnterior?.anonimo ?? true,
      permite_identificacao_voluntaria: campanhaAnterior?.permite_identificacao_voluntaria ?? true,
      mensagem_institucional: campanhaAnterior?.mensagem_institucional ?? MENSAGEM_INSTITUCIONAL_PADRAO,
      politica_uso_dados: campanhaAnterior?.politica_uso_dados ?? POLITICA_USO_DADOS_PADRAO,
      blocos_dinamicos: campanhaAnterior?.blocos_dinamicos ?? [],
      campanha_anterior_id: campanhaAnterior?.id,
    },
  });

  const anonimo = form.watch("anonimo");
  const tipo = form.watch("tipo");

  const onSubmit = async (data: FormValues) => {
    await criarCampanha.mutateAsync({
      nome: data.nome,
      descricao: data.descricao,
      tipo: data.tipo,
      instrumento: data.instrumento,
      periodicidade: data.tipo === 'regular' ? data.periodicidade : undefined,
      data_inicio: data.data_inicio,
      data_fim: data.data_fim,
      anonimo: data.anonimo,
      permite_identificacao_voluntaria: data.anonimo ? data.permite_identificacao_voluntaria : false,
      mensagem_institucional: data.anonimo && data.permite_identificacao_voluntaria ? data.mensagem_institucional : undefined,
      politica_uso_dados: data.politica_uso_dados,
      blocos_dinamicos: data.blocos_dinamicos,
      motivo_extraordinaria: data.tipo === 'extraordinaria' ? data.motivo_extraordinaria : undefined,
      evento_gatilho_tipo: data.tipo === 'extraordinaria' ? data.evento_gatilho_tipo : undefined,
      campanha_anterior_id: data.campanha_anterior_id,
    });
    form.reset();
    onOpenChange(false);
  };

  // Campanhas anteriores para seleção (apenas regulares encerradas)
  const campanhasAnteriores = campanhas.filter(c => c.status === 'encerrada');

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
                    <span className="font-medium">Configuração de Privacidade</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 space-y-4">
                  {/* Anonimato */}
                  <FormField
                    control={form.control}
                    name="anonimo"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-emerald-50/50">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-emerald-600" />
                            <FormLabel className="text-base">Anônimo por Padrão</FormLabel>
                          </div>
                          <FormDescription>
                            Nome e CPF não são exibidos. Metadados (setor, cargo, turno) são preservados para análise.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Identificação Voluntária - só aparece se anônimo */}
                  {anonimo && (
                    <FormField
                      control={form.control}
                      name="permite_identificacao_voluntaria"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-blue-50/50">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4 text-blue-600" />
                              <FormLabel className="text-base">Permitir Identificação Voluntária</FormLabel>
                            </div>
                            <FormDescription>
                              Colaborador pode optar por se identificar para receber acompanhamento individual
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Mensagem Institucional - só aparece se identificação voluntária */}
                  {anonimo && form.watch("permite_identificacao_voluntaria") && (
                    <FormField
                      control={form.control}
                      name="mensagem_institucional"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Info className="h-4 w-4 text-blue-600" />
                            Mensagem Institucional
                          </FormLabel>
                          <FormDescription>
                            Exibida ao colaborador ao escolher se identificar
                          </FormDescription>
                          <FormControl>
                            <Textarea 
                              placeholder="Mensagem sobre uso dos dados..."
                              rows={3}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Política de Uso de Dados */}
                  <FormField
                    control={form.control}
                    name="politica_uso_dados"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-600" />
                          Política de Uso dos Dados (LGPD)
                        </FormLabel>
                        <FormDescription>
                          Texto exibido a todos os colaboradores antes de iniciar
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
                    Selecione os blocos adicionais para condições especiais de trabalho
                  </FormDescription>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {BLOCOS_DINAMICOS.map((bloco) => (
                      <div
                        key={bloco.id}
                        className="flex items-start space-x-3 rounded-lg border p-3"
                      >
                        <Checkbox
                          id={bloco.id}
                          checked={field.value?.includes(bloco.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              field.onChange([...field.value, bloco.id]);
                            } else {
                              field.onChange(field.value.filter((id: string) => id !== bloco.id));
                            }
                          }}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <label
                            htmlFor={bloco.id}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {bloco.titulo}
                          </label>
                          <p className="text-xs text-muted-foreground">
                            {bloco.perguntas.length} perguntas adicionais
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </FormItem>
              )}
            />

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
