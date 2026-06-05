import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, ShieldCheck, Building2, UserPlus, Database, GitBranch, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface Empresa {
  id: string;
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  tipo_unidade?: string | null;
  matriz_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantNome: string;
  /** Quando informado, pré-seleciona apenas essa empresa */
  preselectedEmpresaId?: string;
  preselectedEmpresaNome?: string;
  onSuccess?: () => void;
}

type Step = 1 | 2 | 3 | 4;

export function PromoverContaRaizModal({ open, onOpenChange, tenantId, tenantNome, preselectedEmpresaId, preselectedEmpresaNome, onSuccess }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(preselectedEmpresaId ? [preselectedEmpresaId] : []),
  );
  const [search, setSearch] = useState("");
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

  const { data: empresasRaw = [] } = useQuery({
    queryKey: ["spinoff-empresas", tenantId],
    queryFn: async () => {
      const { data, error } = await fromTable("empresa_cadastro")
        .select("id, razao_social, nome_fantasia, cnpj, tipo_unidade, matriz_id, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true }) as { data: (Empresa & { created_at: string })[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!tenantId,
  });

  // A empresa principal/raiz do tenant é a mais antiga (primeira criada).
  // Ela NÃO pode ser promovida, pois já é a raiz do próprio tenant.
  const principalId = empresasRaw[0]?.id;
  const empresas = useMemo(
    () => empresasRaw
      .filter((e) => e.id !== principalId)
      .slice()
      .sort((a, b) => (a.razao_social || "").localeCompare(b.razao_social || "")),
    [empresasRaw, principalId],
  );


  const filteredEmpresas = useMemo(() => {
    if (!search.trim()) return empresas;
    const q = search.toLowerCase();
    return empresas.filter(
      (e) =>
        e.razao_social?.toLowerCase().includes(q) ||
        e.nome_fantasia?.toLowerCase().includes(q) ||
        e.cnpj?.includes(q),
    );
  }, [empresas, search]);


  const selecionadas = useMemo(
    () => empresas.filter((e) => selectedIds.has(e.id)),
    [empresas, selectedIds],
  );

  const palavraConfirmacao = selecionadas.length === 1
    ? selecionadas[0].razao_social
    : `MIGRAR ${selecionadas.length} EMPRESAS`;

  const reset = () => {
    setStep(1);
    setSelectedIds(new Set(preselectedEmpresaId ? [preselectedEmpresaId] : []));
    setSearch("");
    setNovoTenant({
      nome: preselectedEmpresaNome || "",
      slug: preselectedEmpresaNome
        ? preselectedEmpresaNome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)
        : "",
      plano: "starter"
    });
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

  const toggleEmpresa = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredEmpresas.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEmpresas.map((e) => e.id)));
    }
  };

  const carregarDryRun = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("tenant-spinoff", {
        body: { mode: "dry_run", empresaIds: Array.from(selectedIds) },
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
          empresaIds: Array.from(selectedIds),
          novoTenant,
          owner: {
            email: owner.email.trim(),
            nome: owner.nome.trim(),
            password: owner.inviteMode ? undefined : owner.password,
            inviteMode: owner.inviteMode,
          },
        },
      });
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
      const n = data?.empresasMigradas || selectedIds.size;
      toast.success(
        data?.owner?.inviteSent
          ? `Conta-Raiz criada com ${n} empresa(s)! Convite enviado ao novo dono.`
          : `${n} empresa(s) promovida(s) a Conta-Raiz com sucesso!`,
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

  // Heurística de nome do novo tenant: se 1 empresa, usa o nome dela; se múltiplas, sugere matriz ou genérico
  const handleAdvanceStep1 = () => {
    if (selecionadas.length === 1) {
      const e = selecionadas[0];
      const nome = e.nome_fantasia || e.razao_social;
      setNovoTenant((s) => ({ ...s, nome, slug: slugify(nome) }));
    } else if (selecionadas.length > 1 && !novoTenant.nome) {
      // sugere o nome da matriz se houver
      const matriz = selecionadas.find((e) => e.tipo_unidade === "matriz");
      if (matriz) {
        const nome = matriz.nome_fantasia || matriz.razao_social;
        setNovoTenant((s) => ({ ...s, nome, slug: slugify(nome) }));
      }
    }
    setStep(2);
  };

  const matrizesSelecionadas = selecionadas.filter((e) => e.tipo_unidade === "matriz").length;
  const filiaisSelecionadas = selecionadas.filter((e) => e.tipo_unidade === "filial").length;
  const filiaisSemMatriz = selecionadas.filter(
    (e) => e.tipo_unidade === "filial" && e.matriz_id && !selectedIds.has(e.matriz_id),
  ).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Promover Empresas a Conta-Raiz
          </DialogTitle>
          <DialogDescription>
            Tenant de origem: <strong>{tenantNome}</strong> · Passo {step} de 4
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1 — Seleção múltipla de empresas */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Empresas a migrar (selecione uma ou mais)</Label>
              <Badge variant="secondary">
                {selectedIds.size} de {empresas.length} selecionada(s)
              </Badge>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por razão social, fantasia, CNPJ..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="border rounded-md max-h-72 overflow-y-auto">
              <div
                className="flex items-center gap-2 p-2 border-b bg-muted/40 cursor-pointer hover:bg-muted/60"
                onClick={toggleAll}
              >
                <Checkbox
                  checked={filteredEmpresas.length > 0 && selectedIds.size === filteredEmpresas.length}
                  onCheckedChange={toggleAll}
                />
                <span className="text-sm font-medium">
                  {selectedIds.size === filteredEmpresas.length && filteredEmpresas.length > 0
                    ? "Desmarcar todas"
                    : "Selecionar todas filtradas"}
                </span>
              </div>
              {filteredEmpresas.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  {empresasRaw.length <= 1
                    ? "Este tenant possui apenas a empresa principal (raiz) — não há empresas derivadas para promover."
                    : "Nenhuma empresa encontrada"}
                </p>
              ) : (
                (() => {
                  // Identifica qual seria a "principal" do novo grupo (Matriz ou a mais antiga)
                  const matriz = selecionadas.find(e => e.tipo_unidade === 'matriz');
                  const oldest = [...selecionadas].sort((a, b) => {
                    const ca = empresasRaw.find(r => r.id === a.id)?.created_at || '';
                    const cb = empresasRaw.find(r => r.id === b.id)?.created_at || '';
                    return ca.localeCompare(cb);
                  })[0];
                  const principalProvavelId = matriz?.id || oldest?.id;

                  return filteredEmpresas.map((e) => {
                    const checked = selectedIds.has(e.id);
                    const matrizDoLote = e.matriz_id && selectedIds.has(e.matriz_id);
                    const isPrincipalProvavel = checked && e.id === principalProvavelId && selectedIds.size > 1;

                    return (
                      <label
                        key={e.id}
                        className={`flex items-start gap-2 p-2 border-b last:border-0 cursor-pointer hover:bg-muted/30 ${checked ? "bg-primary/5" : ""}`}
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggleEmpresa(e.id)} className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate">{e.razao_social}</span>
                            {e.tipo_unidade === "matriz" && (
                              <Badge variant="default" className="text-[10px] h-4 px-1">Matriz</Badge>
                            )}
                            {e.tipo_unidade === "filial" && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1">Filial</Badge>
                            )}
                            {isPrincipalProvavel && (
                              <Badge className="bg-amber-500 text-white text-[10px] h-4 px-1 border-0">Principal do Novo Grupo</Badge>
                            )}
                            {checked && e.tipo_unidade === "filial" && matrizDoLote && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1 gap-0.5">
                                <GitBranch className="w-2.5 h-2.5" /> vínculo preservado
                              </Badge>
                            )}
                            {checked && e.tipo_unidade === "filial" && e.matriz_id && !matrizDoLote && (
                              <Badge variant="destructive" className="text-[10px] h-4 px-1">
                                matriz ficará no tenant antigo
                              </Badge>
                            )}
                          </div>
                          {e.cnpj && (
                            <p className="text-xs text-muted-foreground">{e.cnpj}</p>
                          )}
                        </div>
                      </label>
                    );
                  });
                })()
              )}
            </div>

            {selectedIds.size > 1 && (
              <Alert className="border-amber-500/50 bg-amber-500/5">
                <Building2 className="w-4 h-4 text-amber-600" />
                <AlertDescription className="text-sm">
                  <strong>Atenção:</strong> As {selectedIds.size} empresas selecionadas serão migradas para o <strong>mesmo</strong> novo tenant (grupo).
                  Elas continuarão juntas sob uma única conta-raiz independente e sob a responsabilidade do mesmo dono.
                  <br /><br />
                  {matrizesSelecionadas > 0 && filiaisSelecionadas > 0 && (
                    <p className="mt-1 text-xs">• O vínculo matriz→filial será preservado para as empresas deste lote.</p>
                  )}
                  {filiaisSemMatriz > 0 && (
                    <p className="mt-1 text-xs text-destructive">• {filiaisSemMatriz} filial(is) estão sendo migradas sem suas matrizes e ficarão "soltas" no novo grupo.</p>
                  )}
                  <p className="mt-2 font-medium text-xs text-amber-700">Se deseja que cada empresa tenha sua própria conta-raiz independente, realize o processo individualmente para cada uma.</p>
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-sm">
                Todos os dados das empresas selecionadas (colaboradores, documentos, OS, GRO, EPI, ponto, férias...) serão transferidos
                para o novo tenant. <strong>{tenantNome}</strong> perderá acesso total a elas após a operação.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button disabled={selectedIds.size === 0} onClick={handleAdvanceStep1}>
                Próximo
              </Button>
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
                Esse dono será vinculado como administrador de <strong>todas</strong> as {selectedIds.size} empresa(s) selecionada(s).
                Se já existir uma conta com este e-mail em outro tenant, ela será reaproveitada.
              </p>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
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

        {/* STEP 3 — Dry Run Results */}
        {step === 3 && dryRun && (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-md border border-emerald-200">
              <h4 className="font-semibold flex items-center gap-2"><Database className="w-4 h-4" /> Resumo da Migração</h4>
              <p className="text-sm mt-1">
                Foram encontrados <strong>{dryRun.total_registros}</strong> registros operacionais vinculados às {selectedIds.size} empresas.
              </p>
            </div>

            <div className="border rounded-md overflow-hidden">
              <div className="bg-muted p-2 text-xs font-semibold grid grid-cols-2 border-b">
                <span>Tabela</span>
                <span className="text-right">Registros</span>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {Object.entries(dryRun.por_tabela || {}).map(([table, count]) => (
                  <div key={table} className="p-2 text-xs grid grid-cols-2 border-b last:border-0 hover:bg-muted/30">
                    <span className="font-mono">{table}</span>
                    <span className="text-right">{count as number}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Para confirmar a migração definitiva, digite <strong>{palavraConfirmacao}</strong>:</Label>
              <Input
                placeholder="Digite a palavra de confirmação"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
              <div className="flex items-center gap-2 pt-1">
                <Checkbox id="conf" checked={confirmCheck} onCheckedChange={(v) => setConfirmCheck(!!v)} />
                <label htmlFor="conf" className="text-sm text-destructive font-medium cursor-pointer">
                  Estou ciente de que esta operação é irreversível e o acesso atual será perdido.
                </label>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
              <Button
                variant="destructive"
                disabled={confirmText !== palavraConfirmacao || !confirmCheck || executing}
                onClick={executar}
              >
                {executing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirmar e Promover
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
