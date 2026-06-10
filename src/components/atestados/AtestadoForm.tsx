import { useState, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parse } from "date-fns";
import { useDropzone } from "react-dropzone";
import { 
  FileText, 
  Upload, 
  X, 
  CalendarIcon,
  User,
  Stethoscope,
  Building2,
  Sparkles,
  Loader2,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  Search,
  Check,
  ChevronsUpDown
} from "lucide-react";
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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useColaboradores, type Colaborador } from "@/hooks/useColaboradores";
import { useAfastamentosAtivos } from "@/hooks/useAfastamentosAtivos";
import { AfastadoBadge } from "@/components/shared/AfastadoBadge";
import type { AtestadoFormData, AfastamentoTipo, AtestadoExtractedData } from "@/types/atestado";
import { 
  AFASTAMENTO_TIPO_LABELS,
  SUBTIPO_LICENCAS_LABELS,
  SUBTIPO_ATESTADOS_LABELS,
  SUBTIPO_OCUPACIONAL_LABELS,
  GRUPO_CLINICO_LABELS,
  NEXO_TRABALHO_LABELS,
  APTIDAO_LABELS,
} from "@/types/atestado";

const formSchema = z.object({
  colaborador_id: z.string().optional(),
  colaborador_nome: z.string().min(1, "Nome do colaborador é obrigatório"),
  colaborador_cpf: z.string().optional(),
  colaborador_cargo: z.string().optional(),
  colaborador_departamento: z.string().optional(),
  
  tipo: z.enum(["ocupacional", "licencas", "atestados"]),
  subtipo_ocupacional: z.string().optional(),
  subtipo_licencas: z.string().optional(),
  subtipo_atestados: z.string().optional(),
  
  data_emissao: z.date({ required_error: "Data de emissão é obrigatória" }),
  profissional_nome: z.string().min(1, "Nome do emissor é obrigatório"),
  profissional_registro: z.string().optional(),
  profissional_uf: z.string().optional(),
  profissional_rqe: z.string().optional(),
  profissional_telefone: z.string().optional(),
  profissional_email: z.string().email("Email inválido").optional().or(z.literal("")),
  profissional_endereco: z.string().optional(),
  profissional_tipo: z.string().optional(),
  
  data_inicio_afastamento: z.date().optional(),
  data_fim_afastamento: z.date().optional(),
  dias_afastamento: z.number().optional(),
  horas_afastamento: z.number().optional(),
  unidade_afastamento: z.string().optional(),
  
  contem_cid: z.boolean().optional(),
  cid_codigo: z.string().optional(),
  cid_autorizado: z.boolean().optional(),
  grupo_clinico: z.string().optional(),
  nexo_trabalho: z.string().optional(),
  
  aptidao: z.string().optional(),
  restricoes: z.string().optional(),
  observacoes_ocupacionais: z.string().optional(),
  
  observacoes: z.string().optional(),
}).refine((data) => {
  if (data.tipo !== "licencas") {
    return !!data.profissional_registro && data.profissional_registro.length > 0;
  }
  return true;
}, {
  message: "Registro profissional (CRM/RMS) é obrigatório",
  path: ["profissional_registro"],
});

type FormValues = z.infer<typeof formSchema>;

interface AtestadoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { formData: AtestadoFormData; file?: File; colaboradorId?: string }) => Promise<void>;
  loading?: boolean;
}

export function AtestadoForm({ open, onOpenChange, onSubmit, loading }: AtestadoFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [tipoAfastamento, setTipoAfastamento] = useState<AfastamentoTipo>(window.location.pathname.includes('saude-ocupacional') ? "ocupacional" : "atestados");
  const [extracting, setExtracting] = useState(false);
  const [searchingCrm, setSearchingCrm] = useState(false);
  const [extractionSuccess, setExtractionSuccess] = useState(false);
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState<Colaborador | null>(null);
  const [openColaboradorPopover, setOpenColaboradorPopover] = useState(false);
  
  const { colaboradores, isLoading: loadingColaboradores } = useColaboradores();
  const { getAfastamento } = useAfastamentosAtivos();


  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo: window.location.pathname.includes('saude-ocupacional') ? "ocupacional" : "atestados",
      contem_cid: false,
      cid_autorizado: true, // Agora sempre true por padrão, pois o envio ao RH implica autorização
      nexo_trabalho: "nao",
      unidade_afastamento: "dias",
    },
  });

  // Efeito para calcular automaticamente a data de fim
  const watchDataInicio = form.watch("data_inicio_afastamento");
  const watchDiasAfastamento = form.watch("dias_afastamento");
  const watchUnidade = form.watch("unidade_afastamento");

  useEffect(() => {
    // Só calcula se for em dias e tiver data de início e quantidade de dias
    if (watchDataInicio && watchDiasAfastamento !== undefined && watchUnidade === "dias") {
      // Se dias for 0 ou negativo (prazo indeterminado ou apenas comparecimento), não gera data fim automática
      if (watchDiasAfastamento <= 0) {
        form.setValue("data_fim_afastamento", undefined);
        return;
      }
      
      const dataFim = new Date(watchDataInicio);
      dataFim.setDate(dataFim.getDate() + Number(watchDiasAfastamento) - 1); // -1 pois o dia inicial conta
      form.setValue("data_fim_afastamento", dataFim);
    }
  }, [watchDataInicio, watchDiasAfastamento, watchUnidade, form]);

  // Função para buscar CID e grupo clínico
  const handleCidLookup = async (codigo: string) => {
    if (!codigo || codigo.length < 3) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `https://diayjpsrcerycycyaxst.supabase.co/functions/v1/consultar-cid`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData?.session?.access_token}`,
          },
          body: JSON.stringify({ codigo }),
        }
      );

      const result = await response.json();

      if (result.success && result.data) {
        const { descricao, grupo_clinico } = result.data;
        if (grupo_clinico) {
          form.setValue("grupo_clinico", grupo_clinico);
        }
        toast.success(`CID encontrado: ${descricao}`);
      }
    } catch (error) {
      console.error("Erro ao buscar CID:", error);
    }
  };

  // Preencher dados do colaborador quando selecionado
  const handleColaboradorSelect = (colaborador: Colaborador) => {
    setColaboradorSelecionado(colaborador);
    setOpenColaboradorPopover(false);
    
    form.setValue("colaborador_id", colaborador.id);
    form.setValue("colaborador_nome", colaborador.nome_completo);
    form.setValue("colaborador_cpf", colaborador.cpf || "");
    form.setValue("colaborador_cargo", colaborador.cargo || "");
    form.setValue("colaborador_departamento", colaborador.departamento || "");
  };

  // Limpar seleção de colaborador
  const handleClearColaborador = () => {
    setColaboradorSelecionado(null);
    form.setValue("colaborador_id", "");
    form.setValue("colaborador_nome", "");
    form.setValue("colaborador_cpf", "");
    form.setValue("colaborador_cargo", "");
    form.setValue("colaborador_departamento", "");
  };

  const handleCrmLookup = async () => {
    const crm = form.getValues("profissional_registro");
    const uf = form.getValues("profissional_uf");

    if (!crm) {
      toast.error("Preencha o CRM para buscar.");
      return;
    }

    setSearchingCrm(true);
    try {
      // 1. Primeiro tenta no histórico local (mais rápido e gratuito)
      const { data: existingAtestado, error } = await supabase
        .from("atestados")
        .select("profissional_nome, profissional_rqe, profissional_telefone, profissional_email, profissional_endereco")
        .eq("profissional_registro", crm)
        .eq("profissional_uf", uf || "")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingAtestado) {
        form.setValue("profissional_nome", existingAtestado.profissional_nome || "");
        if (existingAtestado.profissional_rqe) form.setValue("profissional_rqe", existingAtestado.profissional_rqe);
        if (existingAtestado.profissional_telefone) form.setValue("profissional_telefone", existingAtestado.profissional_telefone);
        if (existingAtestado.profissional_email) form.setValue("profissional_email", existingAtestado.profissional_email);
        if (existingAtestado.profissional_endereco) form.setValue("profissional_endereco", existingAtestado.profissional_endereco);
        
        toast.success("Dados do médico recuperados do histórico.");
        setSearchingCrm(false);
        return;
      }

      // 2. Se não encontrou no histórico, tenta a validação/busca externa (simulada via Edge Function)
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `https://diayjpsrcerycycyaxst.supabase.co/functions/v1/consultar-crm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData?.session?.access_token}`,
          },
          body: JSON.stringify({ crm, uf }),
        }
      );

      const result = await response.json();

      if (result.success && result.data) {
        const { data } = result;
        if (data.nome) form.setValue("profissional_nome", data.nome);
        if (data.rqe) form.setValue("profissional_rqe", data.rqe);
        toast.success("Médico encontrado na base nacional.");
      } else {
        toast.info(result.message || "Médico não encontrado no histórico. Verifique os dados manualmente.");
      }
    } catch (error) {
      console.error("Erro ao buscar CRM:", error);
      toast.error("Erro ao validar CRM.");
    } finally {
      setSearchingCrm(false);
    }
  };

  const extractDataFromFile = async (uploadedFile: File) => {

    setExtracting(true);
    setExtractionSuccess(false);
    
    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);

      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await fetch(
        `https://diayjpsrcerycycyaxst.supabase.co/functions/v1/extract-atestado`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionData?.session?.access_token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (result.success && result.data) {
        const data: AtestadoExtractedData = result.data;
        
        // Preencher campos do formulário
        if (data.colaborador_nome) form.setValue("colaborador_nome", data.colaborador_nome);
        if (data.colaborador_cpf) form.setValue("colaborador_cpf", data.colaborador_cpf);
        if (data.profissional_nome) form.setValue("profissional_nome", data.profissional_nome);
        if (data.profissional_registro) form.setValue("profissional_registro", data.profissional_registro);
        if (data.profissional_uf) form.setValue("profissional_uf", data.profissional_uf);
        if (data.profissional_rqe) form.setValue("profissional_rqe", data.profissional_rqe);
        if (data.profissional_telefone) form.setValue("profissional_telefone", data.profissional_telefone);
        if (data.profissional_email) form.setValue("profissional_email", data.profissional_email);
        if (data.profissional_endereco) form.setValue("profissional_endereco", data.profissional_endereco);
        
        if (data.data_emissao) {
          try {
            const parsed = parse(data.data_emissao, "yyyy-MM-dd", new Date());
            form.setValue("data_emissao", parsed);
          } catch (e) {
            console.error("Erro ao parsear data de emissão:", e);
          }
        }
        
        if (data.data_inicio_afastamento) {
          try {
            const parsed = parse(data.data_inicio_afastamento, "yyyy-MM-dd", new Date());
            form.setValue("data_inicio_afastamento", parsed);
          } catch (e) {
            console.error("Erro ao parsear data de início:", e);
          }
        }
        
        if (data.data_fim_afastamento) {
          try {
            const parsed = parse(data.data_fim_afastamento, "yyyy-MM-dd", new Date());
            form.setValue("data_fim_afastamento", parsed);
          } catch (e) {
            console.error("Erro ao parsear data de fim:", e);
          }
        }
        
        if (data.dias_afastamento) form.setValue("dias_afastamento", data.dias_afastamento);
        if (data.horas_afastamento) form.setValue("horas_afastamento", data.horas_afastamento);
        if (data.unidade_afastamento) form.setValue("unidade_afastamento", data.unidade_afastamento);
        
        if (data.contem_cid !== undefined) form.setValue("contem_cid", data.contem_cid);
        if (data.cid_codigo) form.setValue("cid_codigo", data.cid_codigo);
        if (data.cid_autorizado !== undefined) form.setValue("cid_autorizado", data.cid_autorizado);
        
        if (data.observacoes) form.setValue("observacoes", data.observacoes);

        setExtractionSuccess(true);
        toast.success("Dados extraídos com sucesso! Revise as informações.");
      } else {
        toast.error(result.message || "Não foi possível extrair os dados.");
      }
    } catch (error) {
      console.error("Erro na extração:", error);
      toast.error("Erro ao extrair dados do documento.");
    } finally {
      setExtracting(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      setExtractionSuccess(false);

      // Gerar preview se for imagem
      if (selectedFile.type.startsWith('image/')) {
        const url = URL.createObjectURL(selectedFile);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg"],
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  const handleSubmit = async (values: FormValues) => {
    // Validar se colaborador foi selecionado
    if (!colaboradorSelecionado) {
      toast.error("Selecione um colaborador cadastrado antes de continuar.");
      return;
    }

    const formData: any = {
      colaborador_nome: values.colaborador_nome,
      colaborador_cpf: values.colaborador_cpf,
      colaborador_cargo: values.colaborador_cargo,
      colaborador_departamento: values.colaborador_departamento,
      tipo: values.tipo,
      subtipo_ocupacional: values.subtipo_ocupacional,
      subtipo_assistencial: values.tipo === 'licencas' ? values.subtipo_licencas : values.subtipo_atestados,
      data_emissao: format(values.data_emissao, "yyyy-MM-dd"),
      profissional_nome: values.profissional_nome,
      profissional_registro: values.profissional_registro,
      profissional_uf: values.profissional_uf,
      profissional_rqe: values.profissional_rqe,
      profissional_telefone: values.profissional_telefone,
      profissional_email: values.profissional_email,
      profissional_endereco: values.profissional_endereco,
      profissional_tipo: values.profissional_tipo,
      data_inicio_afastamento: values.data_inicio_afastamento 
        ? format(values.data_inicio_afastamento, "yyyy-MM-dd") 
        : undefined,
      data_fim_afastamento: values.data_fim_afastamento 
        ? format(values.data_fim_afastamento, "yyyy-MM-dd") 
        : undefined,
      dias_afastamento: values.dias_afastamento,
      horas_afastamento: values.horas_afastamento,
      unidade_afastamento: values.unidade_afastamento,
      contem_cid: values.contem_cid,
      cid_codigo: values.cid_codigo,
      cid_autorizado: values.cid_autorizado,
      grupo_clinico: values.grupo_clinico as AtestadoFormData['grupo_clinico'],
      nexo_trabalho: values.nexo_trabalho as AtestadoFormData['nexo_trabalho'],
      aptidao: values.aptidao as AtestadoFormData['aptidao'],
      restricoes: values.restricoes,
      observacoes_ocupacionais: values.observacoes_ocupacionais,
      observacoes: values.observacoes,
    };

    await onSubmit({ 
      formData, 
      file: file || undefined,
      colaboradorId: colaboradorSelecionado.id 
    });
    form.reset();
    setFile(null);
    setPreviewUrl(null);
    setExtractionSuccess(false);
    setColaboradorSelecionado(null);
    onOpenChange(false);
  };

  const watchTipo = form.watch("tipo");
  const watchContemCid = form.watch("contem_cid");
  const watchUnidadeAfastamento = form.watch("unidade_afastamento");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Novo Afastamento
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Seletor de Tipo (Oculto se for página de ASO ou Afastamentos específicos) */}
            {!window.location.pathname.includes('saude-ocupacional') && !window.location.pathname.includes('atestados') && (
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Lançamento</FormLabel>
                    <Select 
                      onValueChange={(v) => {
                        field.onChange(v);
                        setTipoAfastamento(v as AfastamentoTipo);
                      }} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(AFASTAMENTO_TIPO_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* 1. Seleção de Colaborador (PRIMEIRO) */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Selecionar Colaborador *
              </h3>
              
              <div className="space-y-3">
                <Popover open={openColaboradorPopover} onOpenChange={setOpenColaboradorPopover}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openColaboradorPopover}
                      className="w-full justify-between"
                    >
                      {colaboradorSelecionado
                        ? colaboradorSelecionado.nome_completo
                        : "Buscar colaborador..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Digite o nome do colaborador..." />
                      <CommandList>
                        <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                        <CommandGroup>
                          {colaboradores.map((colaborador) => (
                            <CommandItem
                              key={colaborador.id}
                              value={colaborador.nome_completo}
                              onSelect={() => handleColaboradorSelect(colaborador)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  colaboradorSelecionado?.id === colaborador.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span>{colaborador.nome_completo}</span>
                                  <AfastadoBadge afastamento={getAfastamento({ cpf: colaborador.cpf, nome: colaborador.nome_completo })} compact />
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {colaborador.cargo} • {colaborador.cpf}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {colaboradorSelecionado && (
                  <Alert className="border-primary/30 bg-primary/5">
                    <User className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <div>
                        <strong>{colaboradorSelecionado.nome_completo}</strong>
                        <p className="text-xs text-muted-foreground">
                          CPF: {colaboradorSelecionado.cpf} • Função: {colaboradorSelecionado.cargo}
                          {colaboradorSelecionado.departamento && ` • ${colaboradorSelecionado.departamento}`}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearColaborador}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {!colaboradorSelecionado && (
                  <p className="text-xs text-muted-foreground">
                    O atestado será vinculado à pasta de documentos do colaborador selecionado.
                  </p>
                )}
              </div>
            </div>

            {/* 2. Upload com IA */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Documento
              </h3>
              
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                  isDragActive 
                    ? "border-primary bg-primary/5" 
                    : "border-muted-foreground/25 hover:border-primary/50"
                )}
              >
                <input {...getInputProps()} />
                {file ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          setPreviewUrl(null);
                          setExtractionSuccess(false);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {previewUrl && (
                      <div className="relative mt-2 mx-auto max-w-[200px] rounded-lg border overflow-hidden shadow-sm">
                        <img 
                          src={previewUrl} 
                          alt="Preview do documento" 
                          className="w-full h-auto object-contain max-h-[300px]"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Arraste o arquivo ou clique para selecionar
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Imagem (JPG/PNG) até 20MB
                    </p>
                  </div>
                )}
              </div>

              {file && !extractionSuccess && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => extractDataFromFile(file)}
                  disabled={extracting}
                >
                  {extracting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Extraindo dados com IA...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Extrair dados com IA
                    </>
                  )}
                </Button>
              )}

              {extractionSuccess && (
                <Alert className="border-primary/50 bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <AlertDescription>
                    Dados extraídos automaticamente. Revise as informações abaixo antes de salvar.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Dados do Colaborador (readonly, preenchidos automaticamente) */}
            {colaboradorSelecionado && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Dados do Colaborador (preenchidos automaticamente)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="colaborador_nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly className="bg-muted" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="colaborador_cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly className="bg-muted" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="colaborador_cargo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cargo</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly className="bg-muted" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="colaborador_departamento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departamento</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly className="bg-muted" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Tipo de Afastamento
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {!window.location.pathname.includes('saude-ocupacional') && (
                  <FormField
                    control={form.control}
                    name="tipo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo *</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            setTipoAfastamento(value as AfastamentoTipo);
                          }} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(AFASTAMENTO_TIPO_LABELS)
                              .filter(([value]) => {
                                // Se estiver na página de atestados/afastamentos, não mostrar ocupacional
                                if (window.location.pathname.includes('atestados')) {
                                  return value !== 'ocupacional';
                                }
                                return true;
                              })
                              .map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}



                {watchTipo === "licencas" && (
                  <FormField
                    control={form.control}
                    name="subtipo_licencas"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subtipo de Licença *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a licença" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(SUBTIPO_LICENCAS_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {watchTipo === "atestados" && (
                  <FormField
                    control={form.control}
                    name="subtipo_atestados"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subtipo de Atestado *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o motivo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(SUBTIPO_ATESTADOS_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {watchTipo === "ocupacional" && (
                  <FormField
                    control={form.control}
                    name="subtipo_ocupacional"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Exame/Documento *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(SUBTIPO_OCUPACIONAL_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            {/* Profissional Emissor */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Stethoscope className="h-4 w-4" />
                Profissional Emissor
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="profissional_nome"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{watchTipo === "licencas" ? "Nome do Emissor *" : "Nome do Médico *"}</FormLabel>
                      <FormControl>
                        <Input placeholder="Dr. Nome Completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="data_emissao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Emissão *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "dd/MM/yyyy")
                              ) : (
                                <span>Selecione</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="profissional_registro"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>CRM {watchTipo !== "licencas" && "*"}</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input placeholder="12345" {...field} />
                        </FormControl>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="icon"
                          onClick={handleCrmLookup}
                          disabled={searchingCrm}
                          className="shrink-0"
                          title="Validar e Buscar CRM"
                        >
                          {searchingCrm ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="profissional_uf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF do CRM</FormLabel>
                      <FormControl>
                        <Input placeholder="SP" maxLength={2} {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="profissional_rqe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RQE</FormLabel>
                      <FormControl>
                        <Input placeholder="Especialista" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>


              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="profissional_telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        Telefone
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="(11) 99999-9999" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="profissional_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        E-mail
                      </FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="medico@clinica.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="profissional_endereco"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Endereço Profissional
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Rua, número, bairro, cidade - UF" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Afastamento - for non-occupational or ASO */}
            {watchTipo !== "ocupacional" && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Período de Afastamento
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="unidade_afastamento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidade</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "dias"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="dias">Dias</SelectItem>
                            <SelectItem value="horas">Horas</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {watchUnidadeAfastamento === "horas" ? (
                    <FormField
                      control={form.control}
                      name="horas_afastamento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Horas</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="Horas" 
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={form.control}
                      name="dias_afastamento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dias</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="Dias" 
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormDescription className="text-[10px]">
                            Use 0 para prazo indeterminado.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <FormField
                    control={form.control}
                    name="data_inicio_afastamento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Início</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "dd/MM/yyyy")
                                ) : (
                                  <span>Selecione</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date("1900-01-01")}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {watchUnidadeAfastamento === 'dias' && form.watch("data_fim_afastamento") && (
                  <div className="mt-2 p-2 bg-muted/50 rounded-md border border-dashed border-muted-foreground/20">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <CalendarIcon className="h-3 w-3" />
                      Data de término calculada: <span className="font-medium text-foreground">{format(form.watch("data_fim_afastamento")!, "dd/MM/yyyy")}</span>
                    </p>
                  </div>
                )}

                {/* CID */}
                <div className="space-y-4 pt-2">
                  <FormField
                    control={form.control}
                    name="contem_cid"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Contém CID?</FormLabel>
                          <FormDescription className="text-xs">
                            Ao enviar ao RH, o colaborador autoriza o uso do CID (LGPD/CFM)
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

                  {watchContemCid && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="cid_codigo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Código CID</FormLabel>
                            <div className="flex gap-2">
                              <FormControl>
                                <Input 
                                  placeholder="F32.0" 
                                  {...field} 
                                  onChange={(e) => {
                                    const val = e.target.value.toUpperCase();
                                    field.onChange(val);
                                    if (val.length >= 3) {
                                      handleCidLookup(val);
                                    }
                                  }}
                                />
                              </FormControl>
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="icon"
                                onClick={() => handleCidLookup(field.value || "")}
                              >
                                <Search className="h-4 w-4" />
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="nexo_trabalho"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nexo com Trabalho</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Object.entries(NEXO_TRABALHO_LABELS).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ocupacional specific */}
            {watchTipo === "ocupacional" && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Resultado do Exame
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="aptidao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aptidão</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(APTIDAO_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="restricoes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Restrições</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Evitar esforço físico" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="observacoes_ocupacionais"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações do Exame</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Observações técnicas do exame ocupacional"
                          className="min-h-[80px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Observações */}
            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações Gerais</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Observações adicionais..."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salvar Atestado"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
