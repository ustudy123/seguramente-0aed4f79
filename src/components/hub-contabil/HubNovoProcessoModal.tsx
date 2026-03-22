import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, ChevronsUpDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompetenciaInput } from "@/components/ui/competencia-input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { HubContabilidade } from "@/hooks/useHubProcessos";
import { useColaboradores } from "@/hooks/useColaboradores";

const schema = z.object({
  tipo: z.string().min(1, "Selecione o tipo"),
  titulo: z.string().min(3, "Título obrigatório"),
  descricao: z.string().optional(),
  colaborador_nome: z.string().optional(),
  colaborador_cpf: z.string().optional(),
  competencia: z.string().optional(),
  prioridade: z.string().default("normal"),
  contabilidade_id: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FormData) => Promise<void>;
  contabilidades: HubContabilidade[];
  tipoInicial?: string;
}

const TIPOS = [
  { value: "admissao", label: "Admissão" },
  { value: "demissao", label: "Demissão / Rescisão" },
  { value: "ferias", label: "Férias" },
  { value: "advertencia", label: "Advertência" },
  { value: "atestado_afastamento", label: "Atestado / Afastamento" },
  { value: "ponto_folha", label: "Ponto / Folha" },
  { value: "eventos_variaveis", label: "Eventos Variáveis" },
  { value: "alteracao_contratual", label: "Alteração Contratual" },
  { value: "mudanca_salarial", label: "Mudança Salarial" },
  { value: "cat", label: "CAT" },
  { value: "ppp_ltcat", label: "PPP / LTCAT" },
  { value: "pro_labore", label: "Pró-Labore" },
  { value: "solicitacao_geral", label: "Solicitação Geral" },
];

function ColaboradorCombobox({
  value,
  cpf,
  onSelect,
}: {
  value: string;
  cpf: string;
  onSelect: (nome: string, cpf: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { colaboradores, isLoading } = useColaboradores();

  const filtered = useMemo(() => {
    if (!search) return colaboradores.slice(0, 20);
    const lower = search.toLowerCase();
    return colaboradores
      .filter(
        (c) =>
          c.nome_completo.toLowerCase().includes(lower) ||
          c.cpf?.replace(/\D/g, "").includes(lower.replace(/\D/g, "")) ||
          c.cargo?.toLowerCase().includes(lower)
      )
      .slice(0, 20);
  }, [colaboradores, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal h-9 px-3",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">{value || "Buscar colaborador..."}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder="Pesquisar por nome, CPF ou cargo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
            autoFocus
          />
        </div>
        <div className="max-h-[200px] overflow-y-auto p-1">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-2 text-center">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2 text-center">Nenhum colaborador encontrado</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                className={cn(
                  "flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent cursor-pointer",
                  value === c.nome_completo && "bg-accent"
                )}
                onClick={() => {
                  onSelect(c.nome_completo, c.cpf || "");
                  setOpen(false);
                  setSearch("");
                }}
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    value === c.nome_completo ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.nome_completo}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.cargo && <span>{c.cargo}</span>}
                    {c.cargo && c.cpf && <span> · </span>}
                    {c.cpf && <span>{c.cpf}</span>}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
        {value && (
          <div className="border-t p-1">
            <button
              type="button"
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-accent cursor-pointer text-muted-foreground"
              onClick={() => {
                onSelect("", "");
                setOpen(false);
                setSearch("");
              }}
            >
              Limpar seleção
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function HubNovoProcessoModal({ open, onOpenChange, onSubmit, contabilidades, tipoInicial }: Props) {
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: tipoInicial || "",
      titulo: "",
      prioridade: "normal",
      colaborador_nome: "",
      colaborador_cpf: "",
    },
  });

  const handleSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await onSubmit(data);
      form.reset();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const colaboradorNome = form.watch("colaborador_nome") || "";
  const colaboradorCpf = form.watch("colaborador_cpf") || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Solicitação</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="tipo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Processo *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="prioridade" render={({ field }) => (
                <FormItem>
                  <FormLabel>Prioridade</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="titulo" render={({ field }) => (
              <FormItem>
                <FormLabel>Título *</FormLabel>
                <FormControl><Input placeholder="Ex: Admissão — João Silva" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Colaborador com busca integrada ao cadastro */}
            <FormField control={form.control} name="colaborador_nome" render={() => (
              <FormItem>
                <FormLabel>Colaborador</FormLabel>
                <ColaboradorCombobox
                  value={colaboradorNome}
                  cpf={colaboradorCpf}
                  onSelect={(nome, cpf) => {
                    form.setValue("colaborador_nome", nome);
                    form.setValue("colaborador_cpf", cpf);
                    // Auto-preenche título se ainda estiver vazio
                    const tipo = form.getValues("tipo");
                    const tipoLabel = TIPOS.find(t => t.value === tipo)?.label;
                    const tituloAtual = form.getValues("titulo");
                    if (!tituloAtual && nome && tipoLabel) {
                      form.setValue("titulo", `${tipoLabel} — ${nome}`);
                    }
                  }}
                />
                <FormMessage />
              </FormItem>
            )} />

            {/* CPF preenchido automaticamente ou editável manualmente */}
            <FormField control={form.control} name="colaborador_cpf" render={({ field }) => (
              <FormItem>
                <FormLabel>CPF</FormLabel>
                <FormControl>
                  <Input
                    placeholder="000.000.000-00"
                    {...field}
                    className={colaboradorNome ? "bg-muted/40" : ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="competencia" render={({ field }) => (
                <FormItem>
                  <FormLabel>Competência</FormLabel>
                  <FormControl><Input placeholder="YYYY-MM" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {contabilidades.length > 0 && (
                <FormField control={form.control} name="contabilidade_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contabilidade</FormLabel>
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {contabilidades.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </div>

            <FormField control={form.control} name="descricao" render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição / Observações</FormLabel>
                <FormControl><Textarea placeholder="Informações adicionais..." rows={3} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Criando..." : "Criar Processo"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
