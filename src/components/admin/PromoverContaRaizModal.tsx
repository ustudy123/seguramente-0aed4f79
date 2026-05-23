import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, ShieldCheck, Building2, UserPlus, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface Empresa {
  id: string;
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantNome: string;
  /** Quando informado, pula o passo 1 de seleção */
  preselectedEmpresaId?: string;
  preselectedEmpresaNome?: string;
  onSuccess?: () => void;
}

type Step = 1 | 2 | 3 | 4;

export function PromoverContaRaizModal({ open, onOpenChange, tenantId, tenantNome, preselectedEmpresaId, preselectedEmpresaNome, onSuccess }: Props) {
  const [step, setStep] = useState<Step>(preselectedEmpresaId ? 2 : 1);
  const [empresaId, setEmpresaId] = useState<string>(preselectedEmpresaId || "");
  const [novoTenant, setNovoTenant] = useState({
    nome: preselectedEmpresaNome || "",
    slug: preselectedEmpresaNome
      ? preselectedEmpresaNome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)
      : "",
    plano: "starter",
  });
  const [owner, setOwner] = useState({ email: "", nome: "", password: "", inviteMode: true });
  const [confirmText, setConfirmText] = useState("");
  const [confirmCheck, setConfirmCheck] = useState(false);
  const [dryRun, setDryRun] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Empresas do tenant (só carrega quando precisar do seletor)
  const { data: empresas = [] } = useQuery({
    queryKey: ["spinoff-empresas", tenantId],
    queryFn: async () => {
      const { data, error } = await fromTable("empresa_cadastro")
        .select("id, razao_social, nome_fantasia, cnpj")
        .eq("tenant_id", tenantId)
        .order("razao_social") as { data: Empresa[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!tenantId && !preselectedEmpresaId,
  });

  const empresaSelecionada: Empresa | undefined = preselectedEmpresaId
    ? { id: preselectedEmpresaId, razao_social: preselectedEmpresaNome || "Empresa", nome_fantasia: preselectedEmpresaNome, cnpj: null }
    : empresas.find((e) => e.id === empresaId);

  const reset = () => {
    setStep(1);
    setEmpresaId("");
    setNovoTenant({ nome: "", slug: "", plano: "starter" });
    setOwner({ email: "", nome: "", password: "", inviteMode: true });
    setConfirmText("");
    setConfirmCheck(false);
    setDryRun(null);
  };

  const handleClose = (v: boolean) => {
    if (!executing) {
      if (!v) reset();
      onOpenChange(v);
    }
  };

  const carregarDryRun = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("tenant-spinoff", {
        body: { mode: "dry_run", empresaId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDryRun(data.dryRun);
      setStep(3);
    } catch (e: any) {
      toast.error(e.message || "Erro ao calcular pré-visualização");
    } finally {
      setLoading(false);
    }
  };

  const executar = async () => {
    setExecuting(true);
    try {
      const { data, error } = await supabase.functions.invoke("tenant-spinoff", {
        body: {
          mode: "execute",
          empresaId,
          novoTenant,
          owner: {
            email: owner.email.trim(),
            nome: owner.nome.trim(),
            password: owner.inviteMode ? undefined : owner.password,
            inviteMode: owner.inviteMode,
          },
        },
      });
      // Tenta extrair a mensagem real do corpo de erro do edge function
      if (error) {
        let realMsg = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) {
            const body = await ctx.json();
            if (body?.error) realMsg = body.error;
          }
        } catch { /* ignore */ }
        throw new Error(realMsg);
      }
      if (data?.error) throw new Error(data.error);
      toast.success(
        data?.owner?.inviteSent
          ? "Conta-Raiz criada! Convite enviado por e-mail ao novo dono."
          : "Empresa promovida a Conta-Raiz com sucesso!",
      );
      onSuccess?.();
      handleClose(false);
    } catch (e: any) {
      toast.error(e.message || "Erro na promoção");
    } finally {
      setExecuting(false);
    }
  };

  const slugify = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Promover Empresa a Conta-Raiz
          </DialogTitle>
          <DialogDescription>
            Tenant de origem: <strong>{tenantNome}</strong> · Passo {step} de 4
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1 — Empresa */}
        {step === 1 && (
          <div className="space-y-4">
            <Label>Empresa a promover</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger><SelectValue placeholder="Selecione a empresa..." /></SelectTrigger>
              <SelectContent>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5" />
                      {e.razao_social} {e.cnpj && <span className="text-xs text-muted-foreground">· {e.cnpj}</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-sm">
                Todos os dados desta empresa (colaboradores, documentos, OS, GRO, EPI, ponto, férias, etc.) serão transferidos
                para o novo tenant. <strong>{tenantNome}</strong> perderá acesso total à empresa após a operação.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button disabled={!empresaId} onClick={() => {
                if (empresaSelecionada) setNovoTenant((s) => ({
                  ...s,
                  nome: empresaSelecionada.nome_fantasia || empresaSelecionada.razao_social,
                  slug: slugify(empresaSelecionada.nome_fantasia || empresaSelecionada.razao_social),
                }));
                setStep(2);
              }}>Próximo</Button>
            </div>
          </div>
        )}

        {/* STEP 2 — Owner e tenant */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-3 p-3 rounded-md border">
              <h4 className="text-sm font-semibold flex items-center gap-2"><Building2 className="w-4 h-4" /> Novo Tenant</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={novoTenant.nome} onChange={(e) => setNovoTenant({ ...novoTenant, nome: e.target.value })} />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input value={novoTenant.slug} onChange={(e) => setNovoTenant({ ...novoTenant, slug: slugify(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>Plano</Label>
                <Select value={novoTenant.plano} onValueChange={(v) => setNovoTenant({ ...novoTenant, plano: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    <SelectItem value="early_adopter">Early Adopter (Gratuito)</SelectItem>
                    <SelectItem value="tester">Tester (Interno)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 p-3 rounded-md border">
              <h4 className="text-sm font-semibold flex items-center gap-2"><UserPlus className="w-4 h-4" /> Dono do Novo Tenant</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nome completo</Label>
                  <Input value={owner.nome} onChange={(e) => setOwner({ ...owner, nome: e.target.value })} />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" value={owner.email} onChange={(e) => setOwner({ ...owner, email: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="invite" checked={owner.inviteMode} onCheckedChange={(c) => setOwner({ ...owner, inviteMode: !!c })} />
                <label htmlFor="invite" className="text-sm">Enviar convite por e-mail (recomendado)</label>
              </div>
              {!owner.inviteMode && (
                <div>
                  <Label>Senha provisória</Label>
                  <Input type="password" value={owner.password} onChange={(e) => setOwner({ ...owner, password: e.target.value })} />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Se já existir uma conta com este e-mail em outro tenant, ela será reaproveitada e vinculada ao novo tenant.
              </p>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => preselectedEmpresaId ? handleClose(false) : setStep(1)}>
                {preselectedEmpresaId ? "Cancelar" : "Voltar"}
              </Button>
              <Button
                disabled={!novoTenant.nome || !novoTenant.slug || !owner.email || !owner.nome || (!owner.inviteMode && !owner.password)}
                onClick={carregarDryRun}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Calcular pré-visualização
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3 — Dry run */}
        {step === 3 && dryRun && (
          <div className="space-y-4">
            <Alert>
              <Database className="w-4 h-4" />
              <AlertDescription className="text-sm">
                Serão migrados <strong>{dryRun.total_registros}</strong> registros distribuídos em{" "}
                <strong>{Object.keys(dryRun.por_tabela || {}).length}</strong> tabelas.
              </AlertDescription>
            </Alert>
            <div className="max-h-72 overflow-y-auto border rounded-md p-3">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(dryRun.por_tabela || {}).map(([tabela, n]) => (
                  <div key={tabela} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                    <code className="text-muted-foreground">{tabela}</code>
                    <Badge variant="secondary">{n as number}</Badge>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
              <Button onClick={() => setStep(4)}>Próximo</Button>
            </div>
          </div>
        )}

        {/* STEP 4 — Confirmação */}
        {step === 4 && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-sm">
                Esta operação é <strong>definitiva e irreversível</strong>. {tenantNome} perderá acesso completo a{" "}
                {empresaSelecionada?.razao_social}. Acesso futuro só será possível se a nova Conta-Raiz conceder.
              </AlertDescription>
            </Alert>
            <div>
              <Label>Para confirmar, digite o nome da empresa: <strong>{empresaSelecionada?.razao_social}</strong></Label>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox id="conf" checked={confirmCheck} onCheckedChange={(c) => setConfirmCheck(!!c)} />
              <label htmlFor="conf" className="text-sm">
                Entendo que esta operação é definitiva, sem rollback, e o tenant de origem perderá acesso permanentemente.
              </label>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)} disabled={executing}>Voltar</Button>
              <Button
                variant="destructive"
                disabled={
                  executing ||
                  confirmText.trim() !== empresaSelecionada?.razao_social ||
                  !confirmCheck
                }
                onClick={executar}
              >
                {executing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                Promover a Conta-Raiz
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
