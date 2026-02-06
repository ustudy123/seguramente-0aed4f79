import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { useDropzone } from "react-dropzone";
import { 
  FileText, 
  Upload, 
  X, 
  CalendarIcon,
  User,
  Stethoscope,
  Building2
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { AtestadoFormData, AtestadoTipo } from "@/types/atestado";
import { 
  SUBTIPO_ASSISTENCIAL_LABELS,
  SUBTIPO_OCUPACIONAL_LABELS,
  GRUPO_CLINICO_LABELS,
  NEXO_TRABALHO_LABELS,
  APTIDAO_LABELS,
} from "@/types/atestado";

const formSchema = z.object({
  colaborador_nome: z.string().min(1, "Nome do colaborador é obrigatório"),
  colaborador_cpf: z.string().optional(),
  colaborador_cargo: z.string().optional(),
  colaborador_departamento: z.string().optional(),
  
  tipo: z.enum(["assistencial", "ocupacional"]),
  subtipo_assistencial: z.string().optional(),
  subtipo_ocupacional: z.string().optional(),
  
  data_emissao: z.date({ required_error: "Data de emissão é obrigatória" }),
  profissional_nome: z.string().min(1, "Nome do profissional é obrigatório"),
  profissional_registro: z.string().min(1, "Registro profissional é obrigatório"),
  profissional_tipo: z.string().optional(),
  
  data_inicio_afastamento: z.date().optional(),
  data_fim_afastamento: z.date().optional(),
  dias_afastamento: z.number().optional(),
  
  contem_cid: z.boolean().optional(),
  cid_codigo: z.string().optional(),
  grupo_clinico: z.string().optional(),
  nexo_trabalho: z.string().optional(),
  
  aptidao: z.string().optional(),
  restricoes: z.string().optional(),
  observacoes_ocupacionais: z.string().optional(),
  
  observacoes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AtestadoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { formData: AtestadoFormData; file?: File }) => Promise<void>;
  loading?: boolean;
}

export function AtestadoForm({ open, onOpenChange, onSubmit, loading }: AtestadoFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [tipoAtestado, setTipoAtestado] = useState<AtestadoTipo>("assistencial");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo: "assistencial",
      contem_cid: false,
      nexo_trabalho: "nao",
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg"],
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024, // 20MB
  });

  const handleSubmit = async (values: FormValues) => {
    const formData: AtestadoFormData = {
      colaborador_nome: values.colaborador_nome,
      colaborador_cpf: values.colaborador_cpf,
      colaborador_cargo: values.colaborador_cargo,
      colaborador_departamento: values.colaborador_departamento,
      tipo: values.tipo,
      subtipo_assistencial: values.subtipo_assistencial as AtestadoFormData['subtipo_assistencial'],
      subtipo_ocupacional: values.subtipo_ocupacional as AtestadoFormData['subtipo_ocupacional'],
      data_emissao: format(values.data_emissao, "yyyy-MM-dd"),
      profissional_nome: values.profissional_nome,
      profissional_registro: values.profissional_registro,
      profissional_tipo: values.profissional_tipo,
      data_inicio_afastamento: values.data_inicio_afastamento 
        ? format(values.data_inicio_afastamento, "yyyy-MM-dd") 
        : undefined,
      data_fim_afastamento: values.data_fim_afastamento 
        ? format(values.data_fim_afastamento, "yyyy-MM-dd") 
        : undefined,
      dias_afastamento: values.dias_afastamento,
      contem_cid: values.contem_cid,
      cid_codigo: values.cid_codigo,
      grupo_clinico: values.grupo_clinico as AtestadoFormData['grupo_clinico'],
      nexo_trabalho: values.nexo_trabalho as AtestadoFormData['nexo_trabalho'],
      aptidao: values.aptidao as AtestadoFormData['aptidao'],
      restricoes: values.restricoes,
      observacoes_ocupacionais: values.observacoes_ocupacionais,
      observacoes: values.observacoes,
    };

    await onSubmit({ formData, file: file || undefined });
    form.reset();
    setFile(null);
    onOpenChange(false);
  };

  const watchTipo = form.watch("tipo");
  const watchContemCid = form.watch("contem_cid");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Novo Atestado
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Colaborador */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Dados do Colaborador
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="colaborador_nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do colaborador" {...field} />
                      </FormControl>
                      <FormMessage />
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
                        <Input placeholder="000.000.000-00" {...field} />
                      </FormControl>
                      <FormMessage />
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
                        <Input placeholder="Cargo" {...field} />
                      </FormControl>
                      <FormMessage />
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
                        <Input placeholder="Departamento" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Tipo de Atestado */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Tipo de Atestado
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo *</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          setTipoAtestado(value as AtestadoTipo);
                        }} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="assistencial">Assistencial</SelectItem>
                          <SelectItem value="ocupacional">Ocupacional (ASO)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {watchTipo === "assistencial" && (
                  <FormField
                    control={form.control}
                    name="subtipo_assistencial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subtipo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o subtipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(SUBTIPO_ASSISTENCIAL_LABELS).map(([value, label]) => (
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
                        <FormLabel>Tipo de Exame *</FormLabel>
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

            {/* Profissional */}
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
                    <FormItem>
                      <FormLabel>Nome *</FormLabel>
                      <FormControl>
                        <Input placeholder="Dr. Nome" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="profissional_registro"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registro *</FormLabel>
                      <FormControl>
                        <Input placeholder="CRM 12345" {...field} />
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
            </div>

            {/* Afastamento - only for assistencial */}
            {watchTipo === "assistencial" && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Período de Afastamento
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="data_fim_afastamento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Fim</FormLabel>
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
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                            O CID é tratado como dado sensível (LGPD)
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="cid_codigo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Código CID</FormLabel>
                            <FormControl>
                              <Input placeholder="F32.0" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="grupo_clinico"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Grupo Clínico</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Object.entries(GRUPO_CLINICO_LABELS).map(([value, label]) => (
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

            {/* Upload */}
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
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Arraste o arquivo ou clique para selecionar
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF ou imagem até 20MB
                    </p>
                  </div>
                )}
              </div>
            </div>

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
