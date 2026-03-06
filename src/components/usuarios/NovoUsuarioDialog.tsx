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
import { Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { useUsuarios, TIPO_USUARIO_LABELS, UsuarioTipo, calcularQualidade } from "@/hooks/useUsuarios";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const schema = z.object({
  nome_completo: z.string().min(3, "Nome obrigatório"),
  email_principal: z.string().email("E-mail inválido"),
  cpf: z.string().optional(),
  telefone_principal: z.string().optional(),
  cargo_funcao: z.string().optional(),
  data_nascimento: z.string().optional(),
  tipo_usuario: z.string(),
  observacoes: z.string().optional(),
  empresa_id: z.string().min(1, "Selecione uma empresa"),
  tipo_vinculo: z.string(),
  contexto_operacional: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function formatCPF(v: string) {
  return v.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4").substring(0, 14);
}

export function NovoUsuarioDialog({ open, onOpenChange }: Props) {
  const { tenantId } = useAuth();
  const { createUsuario, createVinculo, usuarios } = useUsuarios();
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [alertaDuplicidade, setAlertaDuplicidade] = useState<string | null>(null);
  const [novoUsuarioId, setNovoUsuarioId] = useState<string | null>(null);

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-lista", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await (supabase as any)
        .from("empresa_cadastro")
        .select("id, razao_social, nome_fantasia")
        .eq("tenant_id", tenantId)
        .order("razao_social");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo_usuario: "gestor", tipo_vinculo: "gestor" },
  });

  const watchedValues = watch();

  function verificarDuplicidade(email: string, cpf?: string) {
    const duplicado = usuarios.find(u =>
      u.email_principal.toLowerCase() === email.toLowerCase() ||
      (cpf && u.cpf && u.cpf.replace(/\D/g, "") === cpf.replace(/\D/g, ""))
    );
    if (duplicado) {
      setAlertaDuplicidade(`Possível duplicidade: "${duplicado.nome_completo}" já cadastrado com este e-mail/CPF.`);
    } else {
      setAlertaDuplicidade(null);
    }
  }

  async function onSubmit(data: FormData) {
    if (etapa === 1) {
      verificarDuplicidade(data.email_principal, data.cpf);
      setEtapa(2);
      return;
    }

    if (etapa === 2) {
      try {
        const usuario = await createUsuario.mutateAsync({
          nome_completo: data.nome_completo,
          email_principal: data.email_principal,
          cpf: data.cpf,
          telefone_principal: data.telefone_principal,
          cargo_funcao: data.cargo_funcao,
          data_nascimento: data.data_nascimento || undefined,
          tipo_usuario: data.tipo_usuario as UsuarioTipo,
          observacoes: data.observacoes,
          status: "pendente_convite",
          qualidade_score: "incompleto",
          qualidade_pct: 0,
        });

        await createVinculo.mutateAsync({
          usuario_id: usuario.id,
          empresa_id: data.empresa_id,
          tipo_vinculo: data.tipo_vinculo as UsuarioTipo,
          contexto_operacional: data.contexto_operacional,
          status: "ativo",
          data_inicio: new Date().toISOString().split("T")[0],
        });

        setNovoUsuarioId(usuario.id);
        setEtapa(3);
      } catch (e: any) {
        toast.error("Erro ao cadastrar: " + e.message);
      }
      return;
    }

    // etapa 3: fechar
    reset();
    setEtapa(1);
    setNovoUsuarioId(null);
    setAlertaDuplicidade(null);
    onOpenChange(false);
  }

  function handleClose() {
    reset(); setEtapa(1); setNovoUsuarioId(null); setAlertaDuplicidade(null);
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

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto min-h-0">
          <div className="p-1 space-y-4">

            {/* ── ETAPA 1 ── */}
            {etapa === 1 && (
              <>
                {alertaDuplicidade && (
                  <div className="flex gap-2 items-start p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    {alertaDuplicidade}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>Nome Completo *</Label>
                    <Input {...register("nome_completo")} placeholder="Maria da Silva Santos" />
                    {errors.nome_completo && <p className="text-xs text-destructive">{errors.nome_completo.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>E-mail *</Label>
                    <Input {...register("email_principal")} type="email" placeholder="maria@empresa.com"
                      onBlur={e => verificarDuplicidade(e.target.value, watchedValues.cpf)} />
                    {errors.email_principal && <p className="text-xs text-destructive">{errors.email_principal.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>CPF</Label>
                    <Input
                      {...register("cpf")}
                      placeholder="000.000.000-00"
                      onChange={e => { const v = formatCPF(e.target.value); setValue("cpf", v); }}
                      onBlur={e => verificarDuplicidade(watchedValues.email_principal, e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone / WhatsApp</Label>
                    <Input {...register("telefone_principal")} placeholder="(11) 99000-0000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data de Nascimento</Label>
                    <Input {...register("data_nascimento")} type="date" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cargo / Função</Label>
                    <Input {...register("cargo_funcao")} placeholder="Analista de RH" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo de Usuário</Label>
                    <Select defaultValue="gestor" onValueChange={v => setValue("tipo_usuario", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIPO_USUARIO_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                  <div className="flex gap-2 items-start p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    {alertaDuplicidade}
                    <span className="font-medium">Deseja continuar mesmo assim?</span>
                  </div>
                )}

                {/* Resumo */}
                <div className="p-3 bg-muted/40 rounded-lg text-sm space-y-1">
                  <p><span className="text-muted-foreground">Nome:</span> {watchedValues.nome_completo}</p>
                  <p><span className="text-muted-foreground">E-mail:</span> {watchedValues.email_principal}</p>
                  <p><span className="text-muted-foreground">Tipo:</span> {TIPO_USUARIO_LABELS[watchedValues.tipo_usuario as UsuarioTipo] || watchedValues.tipo_usuario}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>Empresa para vincular *</Label>
                    <Select onValueChange={v => setValue("empresa_id", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {empresas.map((e: any) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.nome_fantasia || e.razao_social}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.empresa_id && <p className="text-xs text-destructive">{errors.empresa_id.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo de Vínculo</Label>
                    <Select defaultValue="gestor" onValueChange={v => setValue("tipo_vinculo", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TIPO_USUARIO_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto">
                  <Sparkles className="w-8 h-8 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{watchedValues.nome_completo}</h3>
                  <p className="text-sm text-muted-foreground">{watchedValues.email_principal}</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Badge variant="secondary">Usuário criado</Badge>
                  <Badge variant="secondary">Vínculo ativo</Badge>
                  <Badge variant="secondary">Convite pendente</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Acesse os detalhes do usuário para enviar o convite de ativação.
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
            onClick={handleSubmit(onSubmit)}
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
