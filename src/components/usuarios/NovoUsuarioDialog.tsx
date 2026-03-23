import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, AlertTriangle, UserCheck, Search, ShieldCheck, Building2, Layers } from "lucide-react";
import { useUsuarios, TIPO_USUARIO_LABELS, UsuarioTipo, calcularQualidade } from "@/hooks/useUsuarios";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cleanCpf, formatCpf, validateCpf } from "@/lib/cpf";
import { CpfInput } from "@/components/ui/cpf-input";
import { mapTipoUsuarioToAppRole } from "@/lib/userRoleMap";
import { useGruposEconomicos } from "@/hooks/useGruposEconomicos";

const schemaEtapa1 = z.object({
  nome_completo: z.string().min(3, "Nome obrigatório"),
  nome_social: z.string().optional(),
  email_principal: z.string().email("E-mail inválido"),
  cpf: z.string().optional(),
  telefone_principal: z.string().optional(),
  cargo_funcao: z.string().optional(),
  matricula: z.string().optional(),
  data_nascimento: z.string().optional(),
  tipo_usuario: z.string(),
  perfil_acesso_id: z.string().optional(),
  empresa_id: z.string().optional(),
  tipo_vinculo: z.string(),
  contexto_operacional: z.string().optional(),
  observacoes: z.string().optional(),
});

const schemaEtapa2 = z.object({
  nome_completo: z.string().min(3, "Nome obrigatório"),
  nome_social: z.string().optional(),
  email_principal: z.string().email("E-mail inválido"),
  cpf: z.string().optional(),
  telefone_principal: z.string().optional(),
  cargo_funcao: z.string().optional(),
  matricula: z.string().optional(),
  data_nascimento: z.string().optional(),
  tipo_usuario: z.string(),
  perfil_acesso_id: z.string().optional(),
  empresa_id: z.string().min(1, "Selecione uma empresa"),
  tipo_vinculo: z.string(),
  contexto_operacional: z.string().optional(),
  observacoes: z.string().optional(),
});

// Union type for form (uses the looser schema for typing)
const schema = schemaEtapa1;

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface ColaboradorEncontrado {
  id: string;
  nome_completo: string;
  email: string;
  cpf: string;
  celular?: string;
  cargo: string;
  data_nascimento?: string;
  empresa_id?: string;
}

export function NovoUsuarioDialog({ open, onOpenChange }: Props) {
  const { tenantId } = useAuth();
  const { createUsuario, createVinculo, usuarios } = useUsuarios();
  const { grupos } = useGruposEconomicos();
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [alertaDuplicidade, setAlertaDuplicidade] = useState<string | null>(null);
  const [novoUsuarioId, setNovoUsuarioId] = useState<string | null>(null);
  const [buscandoCpf, setBuscandoCpf] = useState(false);
  const [colaboradorEncontrado, setColaboradorEncontrado] = useState<ColaboradorEncontrado | null>(null);
  const [dadosReaproveitados, setDadosReaproveitados] = useState(false);
  // Modo de vínculo: empresa individual ou grupo econômico
  const [modoVinculo, setModoVinculo] = useState<"empresa" | "grupo">("empresa");
  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState<string>("");

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-lista", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await (supabase as any)
        .from("empresa_cadastro")
        .select("id, razao_social, nome_fantasia, cnpj")
        .eq("tenant_id", tenantId)
        .order("razao_social");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Perfis de acesso do tenant
  const { data: perfisAcesso = [] } = useQuery({
    queryKey: ["perfis-acesso-select", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await (supabase as any)
        .from("perfis_acesso")
        .select("id, nome, cor, tipo_usuario_sugerido, descricao")
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .order("nome");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { register, handleSubmit, watch, setValue, reset, trigger, getValues, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schemaEtapa1),
    defaultValues: { tipo_usuario: "gestor", tipo_vinculo: "gestor" },
  });

  const watchedValues = watch();

  function verificarDuplicidade(email: string, cpf?: string) {
    const duplicado = usuarios.find(u =>
      u.email_principal.toLowerCase() === email.toLowerCase() ||
      (cpf && u.cpf && cleanCpf(u.cpf) === cleanCpf(cpf))
    );
    if (duplicado) {
      setAlertaDuplicidade(`Possível duplicidade: "${duplicado.nome_completo}" já cadastrado com este e-mail/CPF.`);
    } else {
      setAlertaDuplicidade(null);
    }
  }

  async function buscarColaboradorPorCpf(cpf: string) {
    const cleaned = cleanCpf(cpf);
    if (!tenantId || cleaned.length !== 11 || !validateCpf(cleaned)) return;

    // Primeiro verifica se já existe como usuário
    const usuarioExistente = usuarios.find(u => u.cpf && cleanCpf(u.cpf) === cleaned);
    if (usuarioExistente) {
      setAlertaDuplicidade(`Usuário "${usuarioExistente.nome_completo}" já está cadastrado com este CPF.`);
      return;
    }

    setBuscandoCpf(true);
    try {
      const { data } = await supabase
        .from("admissoes")
        .select("id, nome_completo, email, cpf, celular, cargo, data_nascimento, empresa_id")
        .eq("tenant_id", tenantId)
        .eq("cpf", cleaned)
        .maybeSingle();

      if (data) {
        setColaboradorEncontrado(data as ColaboradorEncontrado);
      } else {
        setColaboradorEncontrado(null);
        setDadosReaproveitados(false);
      }
    } catch (e) {
      // silencioso
    } finally {
      setBuscandoCpf(false);
    }
  }

  function aplicarDadosColaborador() {
    if (!colaboradorEncontrado) return;
    setValue("nome_completo", colaboradorEncontrado.nome_completo);
    setValue("email_principal", colaboradorEncontrado.email || "");
    setValue("telefone_principal", colaboradorEncontrado.celular || "");
    setValue("cargo_funcao", colaboradorEncontrado.cargo || "");
    if (colaboradorEncontrado.data_nascimento) {
      setValue("data_nascimento", colaboradorEncontrado.data_nascimento);
    }
    if (colaboradorEncontrado.empresa_id) {
      setValue("empresa_id", colaboradorEncontrado.empresa_id);
    }
    setDadosReaproveitados(true);
    toast.success("Dados do colaborador aplicados ao cadastro!");
  }

  async function handleProximo() {
    // Validate only etapa 1 fields
    const valid = await trigger(["nome_completo", "email_principal"]);
    if (!valid) return;
    const data = getValues();
    verificarDuplicidade(data.email_principal, data.cpf);
    setEtapa(2);
  }

  async function handleCriarUsuario() {
    const data = getValues();
    // Validate etapa 2 (empresa_id required)
    const parsed = schemaEtapa2.safeParse(data);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      toast.error(firstError?.message || "Preencha todos os campos obrigatórios");
      return;
    }
    try {
      const appRole = mapTipoUsuarioToAppRole(data.tipo_usuario);
      const { data: authData, error: authError } = await supabase.functions.invoke("invite-tenant-user", {
        body: {
          email: data.email_principal,
          nomeCompleto: data.nome_completo,
          role: appRole,
          method: "invite",
        },
      });

      if (authError) throw new Error(authError.message);
      if ((authData as any)?.error) throw new Error((authData as any).error);

      const authUserId = (authData as any)?.userId as string | undefined;
      if (!authUserId) throw new Error("Não foi possível provisionar o acesso no sistema.");

      const usuario = await createUsuario.mutateAsync({
        nome_completo: data.nome_completo,
        nome_social: data.nome_social || undefined,
        email_principal: data.email_principal,
        cpf: data.cpf ? cleanCpf(data.cpf) : undefined,
        telefone_principal: data.telefone_principal,
        cargo_funcao: data.cargo_funcao,
        matricula: data.matricula || undefined,
        data_nascimento: data.data_nascimento || undefined,
        tipo_usuario: data.tipo_usuario as UsuarioTipo,
        observacoes: data.observacoes,
        auth_user_id: authUserId,
        status: "convite_enviado",
        convite_enviado_em: new Date().toISOString(),
        qualidade_score: "incompleto",
        qualidade_pct: 0,
      });

      await createVinculo.mutateAsync({
        usuario_id: usuario.id,
        empresa_id: data.empresa_id!,
        tipo_vinculo: data.tipo_vinculo as UsuarioTipo,
        contexto_operacional: data.contexto_operacional,
        status: "ativo",
        data_inicio: new Date().toISOString().split("T")[0],
      });

      // Vincular perfil de acesso se selecionado
      if (data.perfil_acesso_id) {
        await (supabase as any)
          .from("usuario_perfil_vinculos")
          .insert({
            tenant_id: tenantId,
            usuario_id: usuario.id,
            perfil_id: data.perfil_acesso_id,
            ativo: true,
            is_principal: true,
            atribuido_por_nome: "Sistema (cadastro)",
          });
      }

      setNovoUsuarioId(usuario.id);
      setEtapa(3);
    } catch (e: any) {
      toast.error("Erro ao cadastrar: " + (e?.message || "falha inesperada"));
    }
  }

  function handleFechar() {
    reset();
    setEtapa(1);
    setNovoUsuarioId(null);
    setAlertaDuplicidade(null);
    setColaboradorEncontrado(null);
    setDadosReaproveitados(false);
    onOpenChange(false);
  }

  function handleClose() {
    reset();
    setEtapa(1);
    setNovoUsuarioId(null);
    setAlertaDuplicidade(null);
    setColaboradorEncontrado(null);
    setDadosReaproveitados(false);
    onOpenChange(false);
  }

  const isLoading = createUsuario.isPending || createVinculo.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {etapa === 1 && "Novo Usuário — Dados Básicos"}
            {etapa === 2 && "Novo Usuário — Vínculo & Revisão"}
            {etapa === 3 && "Usuário cadastrado!"}
          </DialogTitle>
          <DialogDescription>
            {etapa === 1 && "Preencha os dados de identidade do usuário"}
            {etapa === 2 && "Defina o vínculo com a empresa e revise os dados"}
            {etapa === 3 && "O usuário foi criado com sucesso"}
          </DialogDescription>
          {/* Progress */}
          <div className="flex gap-1 mt-2">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= etapa ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        </DialogHeader>

        <form onSubmit={e => e.preventDefault()} className="flex-1 overflow-y-auto min-h-0">
          <div className="p-1 space-y-4">

            {/* ── ETAPA 1 ── */}
            {etapa === 1 && (
              <>
                {alertaDuplicidade && (
                  <div className="flex gap-2 items-start p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    {alertaDuplicidade}
                  </div>
                )}

                {/* Banner: colaborador encontrado */}
                {colaboradorEncontrado && !dadosReaproveitados && (
                  <div className="flex flex-col gap-2 p-3 bg-primary/8 border border-primary/20 rounded-lg text-sm">
                    <div className="flex items-start gap-2">
                      <UserCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-primary">Colaborador encontrado na base!</p>
                        <p className="text-muted-foreground text-xs mt-0.5">
                          {colaboradorEncontrado.nome_completo} — {colaboradorEncontrado.cargo}
                        </p>
                        {colaboradorEncontrado.email && (
                          <p className="text-muted-foreground text-xs">{colaboradorEncontrado.email}</p>
                        )}
                      </div>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={aplicarDadosColaborador}
                      className="self-start text-primary border-primary/30 hover:bg-primary/10">
                      Reaproveitar dados do colaborador
                    </Button>
                  </div>
                )}

                {dadosReaproveitados && (
                  <div className="flex gap-2 items-center p-2.5 bg-primary/5 border border-primary/20 rounded-lg text-xs text-primary">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    Dados do colaborador aplicados. Complete os campos restantes se necessário.
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                  {/* Linha 1: CPF (full width) — dispara lookup ao preencher */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      CPF
                      {buscandoCpf && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      {colaboradorEncontrado && !buscandoCpf && <UserCheck className="w-3 h-3 text-primary" />}
                    </Label>
                    <CpfInput
                      value={watchedValues.cpf || ""}
                      onChange={(v) => {
                        setValue("cpf", v);
                        buscarColaboradorPorCpf(v);
                      }}
                      onBlur={() => verificarDuplicidade(watchedValues.email_principal, watchedValues.cpf)}
                      placeholder="000.000.000-00"
                    />
                  </div>

                  {/* Linha 2: Nome Completo (full width) */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>Nome Completo *</Label>
                    <Input {...register("nome_completo")} placeholder="Maria da Silva Santos" />
                    {errors.nome_completo && <p className="text-xs text-destructive">{errors.nome_completo.message}</p>}
                  </div>

                  {/* Linha 3: Nome Social + Matrícula */}
                  <div className="space-y-1.5">
                    <Label>Nome Social <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                    <Input {...register("nome_social")} placeholder="Como prefere ser chamado(a)" />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Matrícula / Código Interno</Label>
                    <Input {...register("matricula")} placeholder="EMP-0042" />
                  </div>

                  {/* Linha 4: E-mail (full width) */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>E-mail *</Label>
                    <Input {...register("email_principal")} type="email" placeholder="maria@empresa.com"
                      onBlur={e => verificarDuplicidade(e.target.value, watchedValues.cpf)} />
                    {errors.email_principal && <p className="text-xs text-destructive">{errors.email_principal.message}</p>}
                  </div>

                  {/* Linha 4: Data de Nascimento + Cargo/Função */}
                  <div className="space-y-1.5">
                    <Label>Data de Nascimento</Label>
                    <Input {...register("data_nascimento")} type="date" />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Cargo / Função</Label>
                    <Input {...register("cargo_funcao")} placeholder="Analista de RH" />
                  </div>

                  {/* Linha 5: Telefone */}
                  <div className="space-y-1.5">
                    <Label>Telefone / WhatsApp</Label>
                    <Input {...register("telefone_principal")} placeholder="(11) 99000-0000" />
                  </div>

                  {/* Perfil de Acesso (full width) */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Perfil de Acesso
                    </Label>
                    <Select
                      value={watchedValues.perfil_acesso_id || ""}
                      onValueChange={perfilId => {
                        setValue("perfil_acesso_id", perfilId);
                        const perfil = perfisAcesso.find((p: any) => p.id === perfilId);
                        if (perfil?.tipo_usuario_sugerido) {
                          // Map perfil tipo_usuario_sugerido to valid DB enum values
                          const tipoMap: Record<string, string> = {
                            admin: "administrador",
                            sst: "tecnico_seguranca",
                            financeiro: "gestor",
                            consultor: "consultor_externo",
                          };
                          const tipoMapped = tipoMap[perfil.tipo_usuario_sugerido] || perfil.tipo_usuario_sugerido;
                          setValue("tipo_usuario", tipoMapped);
                          setValue("tipo_vinculo", tipoMapped);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um perfil de acesso" />
                      </SelectTrigger>
                      <SelectContent>
                        {perfisAcesso.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.cor || 'hsl(var(--muted))' }} />
                              {p.nome}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Define o nível de acesso e permissões deste usuário no sistema.
                    </p>
                  </div>

                  {/* Linha 6: Observações (full width) */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>Observações</Label>
                    <Textarea {...register("observacoes")} rows={2} placeholder="Informações internas…" />
                  </div>
                </div>
              </>
            )}

            {/* ── ETAPA 2 ── */}
            {etapa === 2 && (
              <div className="space-y-4">
                {alertaDuplicidade && (
                  <div className="flex gap-2 items-start p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    {alertaDuplicidade}
                    <span className="font-medium">Deseja continuar mesmo assim?</span>
                  </div>
                )}

                {/* Resumo */}
                <div className="p-3 bg-muted/40 rounded-lg text-sm space-y-1">
                  <p><span className="text-muted-foreground">Nome:</span> {watchedValues.nome_completo}</p>
                  <p><span className="text-muted-foreground">E-mail:</span> {watchedValues.email_principal}</p>
                  {watchedValues.cpf && (
                    <p><span className="text-muted-foreground">CPF:</span> {formatCpf(watchedValues.cpf)}</p>
                  )}
                  <p><span className="text-muted-foreground">Tipo:</span> {TIPO_USUARIO_LABELS[watchedValues.tipo_usuario as UsuarioTipo] || watchedValues.tipo_usuario}</p>
                  {dadosReaproveitados && (
                    <p className="flex items-center gap-1 text-primary text-xs mt-1">
                      <UserCheck className="w-3 h-3" /> Dados reaproveitados do cadastro de colaborador
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>Empresa para vincular *</Label>
                    <Select
                      value={watchedValues.empresa_id || ""}
                      onValueChange={v => setValue("empresa_id", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {empresas.map((e: any) => (
                          <SelectItem key={e.id} value={e.id}>
                            <div className="flex flex-col gap-0.5 py-0.5">
                              <span className="font-medium leading-tight">{e.nome_fantasia || e.razao_social}</span>
                              {e.cnpj && (
                                <span className="text-xs text-muted-foreground font-normal leading-tight">
                                  CNPJ: {e.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.empresa_id && <p className="text-xs text-destructive">{errors.empresa_id.message}</p>}
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="flex items-center justify-between">
                      <span>Papel nesta Empresa</span>
                      {watchedValues.tipo_vinculo === watchedValues.tipo_usuario && (
                        <span className="text-xs text-muted-foreground font-normal">
                          herdado do tipo de usuário
                        </span>
                      )}
                    </Label>
                    <Select
                      value={watchedValues.tipo_vinculo || "gestor"}
                      onValueChange={v => setValue("tipo_vinculo", v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIPO_USUARIO_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Como esta pessoa atua especificamente nesta empresa. Pode ser diferente do perfil global.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contexto Operacional</Label>
                    <Input {...register("contexto_operacional")} placeholder="Ex: SST, RH, Clínica…" />
                  </div>
                </div>
              </div>
            )}

            {/* ── ETAPA 3 ── */}
            {etapa === 3 && (
              <div className="py-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{watchedValues.nome_completo}</h3>
                  <p className="text-sm text-muted-foreground">{watchedValues.email_principal}</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Badge variant="secondary">Usuário criado</Badge>
                  <Badge variant="secondary">Vínculo ativo</Badge>
                  <Badge variant="secondary">Acesso no Auth criado</Badge>
                  {dadosReaproveitados && <Badge variant="outline" className="text-primary border-primary/30">Dados reaproveitados</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  O convite de acesso já foi enviado automaticamente para o e-mail informado.
                </p>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="shrink-0 border-t pt-4 flex justify-between gap-3">
          {etapa < 3 && (
            <Button type="button" variant="outline" onClick={() => etapa > 1 ? setEtapa(etapa === 2 ? 1 : 2) : handleClose()}>
              {etapa === 1 ? "Cancelar" : "Voltar"}
            </Button>
          )}
          <Button
            type="button"
            className={etapa === 3 ? "w-full" : "ml-auto"}
            disabled={isLoading}
            onClick={etapa === 1 ? handleProximo : etapa === 2 ? handleCriarUsuario : handleFechar}
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {etapa === 1 && "Próximo"}
            {etapa === 2 && "Criar Usuário"}
            {etapa === 3 && "Fechar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
