import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { EpiTipo, EpiCompleto } from "@/types/epi";
import { CATEGORIAS_EPI, UNIDADES_MEDIDA, TIPOS_DURABILIDADE } from "@/types/epi";

const schema = z.object({
  tipo_id: z.string().min(1, "Selecione o Nome do EPI"),
  codigo: z.string().optional(),
  ca: z.string().optional(),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  tamanho: z.string().optional(),
  data_fabricacao: z.string().optional(),
  data_validade: z.string().optional(),
  quantidade_estoque: z.coerce.number().min(0, "Quantidade deve ser maior ou igual a 0"),
  quantidade_minima: z.coerce.number().min(1, "Quantidade mínima deve ser pelo menos 1"),
  custo_unitario: z.coerce.number().min(0).optional(),
  localizacao: z.string().optional(),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// Schema for inline new tipo creation
const tipoSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  descricao: z.string().optional(),
  unidade_medida: z.string().min(1, "Selecione a unidade"),
  tipo_durabilidade: z.string().min(1, "Selecione o tipo"),
  validade_meses: z.coerce.number().min(0).optional().nullable(),
  ca_numero: z.string().optional(),
  ca_validade: z.string().optional(),
  fabricante: z.string().optional(),
  marca: z.string().optional(),
  estoque_minimo: z.coerce.number().min(0).optional().nullable(),
  estoque_inicial: z.coerce.number().min(0).optional().nullable(),
});

interface EpiFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FormData) => Promise<void>;
  onCreateTipo: (data: {
    nome: string;
    descricao?: string;
    categoria?: string;
    unidade_medida?: string;
    tipo_durabilidade?: string;
    validade_meses?: number | null;
    ca_numero?: string;
    ca_validade?: string;
    marca?: string;
    fabricante?: string;
    estoque_minimo?: number | null;
    estoque_inicial?: number | null;
  }) => Promise<void>;
  onCreateCategoria?: (nome: string) => Promise<void>;
  tipos: EpiTipo[];
  customCategorias?: string[];
  epi?: EpiCompleto | null;
  isLoading?: boolean;
}

export function EpiForm({
  open,
  onOpenChange,
  onSubmit,
  onCreateTipo,
  onCreateCategoria,
  tipos,
  customCategorias = [],
  epi,
  isLoading,
}: EpiFormProps) {
  const [showTipoForm, setShowTipoForm] = useState(false);
  const [isCreatingTipo, setIsCreatingTipo] = useState(false);
  const [selectedCategoria, setSelectedCategoria] = useState<string>("");
  const [showNewCategoriaInput, setShowNewCategoriaInput] = useState(false);
  const [newCategoriaName, setNewCategoriaName] = useState("");
  const [isCreatingCategoria, setIsCreatingCategoria] = useState(false);

  // Inline tipo form state
  const [tipoFormData, setTipoFormData] = useState({
    nome: "", descricao: "", unidade_medida: "unidade", tipo_durabilidade: "duravel",
    validade_meses: "", ca_numero: "", ca_validade: "", marca: "", fabricante: "",
    estoque_minimo: "5", estoque_inicial: "100",
  });

  const categorias = useMemo(() => {
    const existingCategories = tipos
      .filter(t => t.is_active !== false && t.categoria)
      .map(t => t.categoria as string);
    const allCategories = [...new Set([...CATEGORIAS_EPI, ...existingCategories, ...customCategorias])];
    return allCategories.sort();
  }, [tipos, customCategorias]);

  const tiposFiltrados = useMemo(() => {
    if (!selectedCategoria) return [];
    return tipos.filter(t => t.is_active !== false && t.categoria === selectedCategoria);
  }, [tipos, selectedCategoria]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo_id: epi?.tipo_id || "",
      codigo: epi?.codigo || "",
      ca: epi?.ca || "",
      marca: epi?.marca || "",
      modelo: epi?.modelo || "",
      tamanho: epi?.tamanho || "",
      data_fabricacao: epi?.data_fabricacao || "",
      data_validade: epi?.data_validade || "",
      quantidade_estoque: epi?.quantidade_estoque || 0,
      quantidade_minima: epi?.quantidade_minima || 5,
      custo_unitario: epi?.custo_unitario ? Number(epi.custo_unitario) : undefined,
      localizacao: epi?.localizacao || "",
      observacoes: epi?.observacoes || "",
    },
  });

  useEffect(() => {
    if (epi?.tipo?.categoria) {
      setSelectedCategoria(epi.tipo.categoria);
    }
  }, [epi]);

  const handleSubmit = async (data: FormData) => {
    await onSubmit(data);
    form.reset();
    onOpenChange(false);
  };

  const handleCreateTipo = async () => {
    if (!tipoFormData.nome.trim()) return;
    setIsCreatingTipo(true);
    try {
      await onCreateTipo({
        nome: tipoFormData.nome,
        descricao: tipoFormData.descricao || undefined,
        categoria: selectedCategoria,
        unidade_medida: tipoFormData.unidade_medida,
        tipo_durabilidade: tipoFormData.tipo_durabilidade,
        validade_meses: tipoFormData.validade_meses ? Number(tipoFormData.validade_meses) : null,
        ca_numero: tipoFormData.ca_numero || undefined,
        ca_validade: tipoFormData.ca_validade || undefined,
        marca: tipoFormData.marca || undefined,
        fabricante: tipoFormData.fabricante || undefined,
        estoque_minimo: tipoFormData.estoque_minimo ? Number(tipoFormData.estoque_minimo) : null,
        estoque_inicial: tipoFormData.estoque_inicial ? Number(tipoFormData.estoque_inicial) : null,
      });
      setShowTipoForm(false);
      setTipoFormData({
        nome: "", descricao: "", unidade_medida: "unidade", tipo_durabilidade: "duravel",
        validade_meses: "", ca_numero: "", ca_validade: "", marca: "", fabricante: "",
        estoque_minimo: "5", estoque_inicial: "100",
      });
    } finally {
      setIsCreatingTipo(false);
    }
  };

  const handleTipoChange = (value: string) => {
    if (value === "__new__") {
      setShowTipoForm(true);
    } else {
      form.setValue("tipo_id", value);
    }
  };

  const handleCategoriaChange = (value: string) => {
    if (value === "__new_cat__") {
      setShowNewCategoriaInput(true);
      return;
    }
    setSelectedCategoria(value);
    form.setValue("tipo_id", "");
  };

  const handleCreateCategoria = async () => {
    if (!newCategoriaName.trim() || !onCreateCategoria) return;
    setIsCreatingCategoria(true);
    try {
      await onCreateCategoria(newCategoriaName.trim());
      setSelectedCategoria(newCategoriaName.trim());
      setNewCategoriaName("");
      setShowNewCategoriaInput(false);
      form.setValue("tipo_id", "");
    } finally {
      setIsCreatingCategoria(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{epi ? "Editar EPI" : "Cadastrar Novo EPI"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Categoria */}
              <FormItem>
                <FormLabel className="flex items-center gap-1.5">
                  Categoria *
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" align="start" className="max-w-xs z-[100]">
                        <p>Categoria é o agrupamento do EPI (ex: Proteção Auditiva). Selecione para filtrar os tipos disponíveis.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </FormLabel>
                {showNewCategoriaInput ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome da nova categoria"
                      value={newCategoriaName}
                      onChange={(e) => setNewCategoriaName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateCategoria(); } }}
                      autoFocus
                    />
                    <Button type="button" size="sm" onClick={handleCreateCategoria} disabled={isCreatingCategoria || !newCategoriaName.trim()}>
                      {isCreatingCategoria ? "..." : "OK"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => { setShowNewCategoriaInput(false); setNewCategoriaName(""); }}>
                      ✕
                    </Button>
                  </div>
                ) : (
                  <Select onValueChange={handleCategoriaChange} value={selectedCategoria}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                      <Separator className="my-1" />
                      <SelectItem value="__new_cat__" className="text-primary font-medium">
                        <span className="flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          Nova categoria
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </FormItem>

              {/* Nome do EPI */}
              <FormField
                control={form.control}
                name="tipo_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      Nome do EPI *
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="right" align="start" className="max-w-xs z-[100]">
                            <p>Nome específico do EPI dentro da categoria selecionada.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FormLabel>
                    <Select onValueChange={handleTipoChange} value={field.value} disabled={!selectedCategoria}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={selectedCategoria ? "Selecione o EPI" : "Selecione a categoria primeiro"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tiposFiltrados.map((tipo) => (
                          <SelectItem key={tipo.id} value={tipo.id}>{tipo.nome}</SelectItem>
                        ))}
                        {tiposFiltrados.length === 0 && selectedCategoria && (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum EPI cadastrado nesta categoria</div>
                        )}
                        <Separator className="my-1" />
                        <SelectItem value="__new__" className="text-primary font-medium">
                          <span className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Cadastrar novo EPI
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Inline new tipo form */}
            {showTipoForm && (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <h4 className="font-medium text-sm">Novo EPI na categoria "{selectedCategoria}"</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-sm font-medium">Nome do EPI *</label>
                    <Input placeholder="Ex: Protetor Auricular" value={tipoFormData.nome} onChange={(e) => setTipoFormData(p => ({ ...p, nome: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Unidade de Medida *</label>
                    <Select value={tipoFormData.unidade_medida} onValueChange={(v) => setTipoFormData(p => ({ ...p, unidade_medida: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNIDADES_MEDIDA.map((um) => <SelectItem key={um.value} value={um.value}>{um.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Tipo *</label>
                    <Select value={tipoFormData.tipo_durabilidade} onValueChange={(v) => setTipoFormData(p => ({ ...p, tipo_durabilidade: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_DURABILIDADE.map((td) => <SelectItem key={td.value} value={td.value}>{td.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">C.A.</label>
                    <Input placeholder="Ex: 12345" value={tipoFormData.ca_numero} onChange={(e) => setTipoFormData(p => ({ ...p, ca_numero: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Validade do C.A.</label>
                    <Input type="date" value={tipoFormData.ca_validade} onChange={(e) => setTipoFormData(p => ({ ...p, ca_validade: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Marca</label>
                    <Input placeholder="Ex: 3M" value={tipoFormData.marca} onChange={(e) => setTipoFormData(p => ({ ...p, marca: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Fabricante</label>
                    <Input placeholder="Ex: 3M do Brasil" value={tipoFormData.fabricante} onChange={(e) => setTipoFormData(p => ({ ...p, fabricante: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Validade (meses)</label>
                    <Input type="number" placeholder="12" value={tipoFormData.validade_meses} onChange={(e) => setTipoFormData(p => ({ ...p, validade_meses: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Estoque Mínimo</label>
                    <Input type="number" placeholder="5" value={tipoFormData.estoque_minimo} onChange={(e) => setTipoFormData(p => ({ ...p, estoque_minimo: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Estoque Inicial</label>
                    <Input type="number" placeholder="100" value={tipoFormData.estoque_inicial} onChange={(e) => setTipoFormData(p => ({ ...p, estoque_inicial: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-sm font-medium">Descrição</label>
                    <Textarea placeholder="Descrição do EPI" value={tipoFormData.descricao} onChange={(e) => setTipoFormData(p => ({ ...p, descricao: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowTipoForm(false)}>Cancelar</Button>
                  <Button type="button" size="sm" onClick={handleCreateTipo} disabled={isCreatingTipo || !tipoFormData.nome.trim()}>
                    {isCreatingTipo ? "Criando..." : "Criar EPI"}
                  </Button>
                </div>
              </div>
            )}

            {/* Remaining fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="codigo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Código / Nº Série</FormLabel>
                  <FormControl><Input placeholder="Código único" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="ca" render={({ field }) => (
                <FormItem>
                  <FormLabel>CA (Certificado de Aprovação)</FormLabel>
                  <FormControl><Input placeholder="Número do CA" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="marca" render={({ field }) => (
                <FormItem>
                  <FormLabel>Marca</FormLabel>
                  <FormControl><Input placeholder="Fabricante" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="modelo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelo</FormLabel>
                  <FormControl><Input placeholder="Modelo do EPI" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="tamanho" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tamanho</FormLabel>
                  <FormControl><Input placeholder="P, M, G, 38, etc" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="data_fabricacao" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Fabricação</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="data_validade" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Validade</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="quantidade_estoque" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade em Estoque *</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="quantidade_minima" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade Mínima (Alerta)</FormLabel>
                  <FormControl><Input type="number" min={1} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="custo_unitario" render={({ field }) => (
                <FormItem>
                  <FormLabel>Custo Unitário (R$)</FormLabel>
                  <FormControl><Input type="number" step="0.01" min={0} placeholder="0,00" {...field} value={field.value || ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="localizacao" render={({ field }) => (
                <FormItem>
                  <FormLabel>Localização no Estoque</FormLabel>
                  <FormControl><Input placeholder="Ex: Armário A, Prateleira 3" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="observacoes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl><Textarea placeholder="Observações adicionais" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Salvando..." : epi ? "Salvar Alterações" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
