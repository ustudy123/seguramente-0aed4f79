import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useMetas } from "@/hooks/useMetas";
import { useColaboradores } from "@/hooks/useColaboradores";
import { useDepartamentos } from "@/hooks/useCadastros";
import type { MetaInsert } from "@/types/avaliacao";

const formSchema = z.object({
  titulo: z.string().min(3, "Título deve ter pelo menos 3 caracteres"),
  descricao: z.string().optional(),
  tipo: z.string().default("individual"),
  categoria_meta: z.string().default("operacional"),
  origem_meta: z.string().default("gestor"),
  periodo: z.enum(["mensal", "trimestral", "semestral", "anual"]).default("trimestral"),
  ano: z.number().min(2024).max(2030),
  trimestre: z.number().min(1).max(4).optional(),
  colaborador_id: z.string().optional(),
  departamento_id: z.string().optional(),
  // data_inicio e data_fim removidos do schema conforme solicitação

  peso: z.number().min(0.1).max(10).default(1),
  premiacao_tipo: z.string().optional(),
  premiacao_descricao: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface MetaFormProps {
  onSuccess: () => void;
}

export function MetaForm({ onSuccess }: MetaFormProps) {
  const { createMeta, isCreatingMeta } = useMetas();
  const { colaboradores } = useColaboradores();
  const { departamentos } = useDepartamentos();
  
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      tipo: "individual",
      categoria_meta: "operacional",
      origem_meta: "gestor",
      periodo: "trimestral",
      ano: currentYear,
      trimestre: currentQuarter,
      peso: 1,
    },
  });

  const tipo = form.watch("tipo");
  const periodo = form.watch("periodo");

  const onSubmit = async (data: FormData) => {
    const colaborador = colaboradores.find(c => c.id === data.colaborador_id);
    const departamento = departamentos.find(d => d.id === data.departamento_id);

    const metaData: MetaInsert = {
      titulo: data.titulo,
      descricao: data.descricao,
      tipo: data.tipo,
      periodo: data.periodo,
      ano: data.ano,
      trimestre: periodo === "trimestral" ? data.trimestre : undefined,
      colaborador_id: data.colaborador_id,
      colaborador_nome: colaborador?.nome_completo,
      departamento_id: data.departamento_id,
      departamento_nome: departamento?.nome,
      peso: data.peso,
    };

    await createMeta({
      ...metaData,
      categoria_meta: data.categoria_meta,
      origem_meta: data.origem_meta,
      premiacao_tipo: data.premiacao_tipo,
      premiacao_descricao: data.premiacao_descricao,
    } as any);
    onSuccess();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="titulo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título da Meta</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Aumentar vendas em 20%" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="descricao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Descreva o objetivo desta meta..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="categoria_meta"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="operacional">Operacional</SelectItem>
                    <SelectItem value="estrategica">Estratégica</SelectItem>
                    <SelectItem value="desenvolvimento">Desenvolvimento</SelectItem>
                    <SelectItem value="compliance">Compliance / Legal</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="origem_meta"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Origem</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="rh">RH</SelectItem>
                    <SelectItem value="pdi">PDI</SelectItem>
                    <SelectItem value="modelo_funcao">Modelo da Função</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="tipo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="equipe">Equipe</SelectItem>
                    <SelectItem value="departamento">Departamento</SelectItem>
                    <SelectItem value="empresa">Empresa</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="periodo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Período</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="ano"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ano</FormLabel>
                <Select 
                  onValueChange={(v) => field.onChange(parseInt(v))} 
                  value={field.value.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {periodo === "trimestral" && (
            <FormField
              control={form.control}
              name="trimestre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trimestre</FormLabel>
                  <Select 
                    onValueChange={(v) => field.onChange(parseInt(v))} 
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">Trimestre 1</SelectItem>
                      <SelectItem value="2">Trimestre 2</SelectItem>
                      <SelectItem value="3">Trimestre 3</SelectItem>
                      <SelectItem value="4">Trimestre 4</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {tipo === "individual" && (
          <FormField
            control={form.control}
            name="colaborador_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Colaborador Responsável</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um colaborador" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {colaboradores.map((colab) => (
                      <SelectItem key={colab.id} value={colab.id}>
                        {colab.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {(tipo === "equipe" || tipo === "departamento") && (
          <FormField
            control={form.control}
            name="departamento_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Departamento</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um departamento" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {departamentos.filter(d => d.ativo).map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="premiacao_tipo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Premiação</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Sem premiação" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="sem_premiacao">Sem Premiação</SelectItem>
                    <SelectItem value="financeira">Financeira</SelectItem>
                    <SelectItem value="nao_financeira">Não Financeira</SelectItem>
                    <SelectItem value="hibrida">Híbrida</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="premiacao_descricao"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição da Premiação</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Bônus de R$ 500" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="peso"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Peso na Avaliação</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="0.1" 
                  min="0.1" 
                  max="10"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                />
              </FormControl>
              <FormDescription>
                Quanto maior o peso, mais impacto na avaliação final
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isCreatingMeta}>
            {isCreatingMeta ? "Criando..." : "Criar Meta"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
