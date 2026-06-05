import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertTriangle, ShieldCheck, Building2, UserPlus, Database, GitBranch, Search, Star, Crown } from "lucide-react";
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
  email?: string | null;
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
  const [principalIdOverride, setPrincipalIdOverride] = useState<string | null>(preselectedEmpresaId || null);
  const [search, setSearch] = useState("");
  const [migrationType, setMigrationType] = useState<'new' | 'existing'>('new');
  const [targetTenantId, setTargetTenantId] = useState("");
  const [targetTenantSearch, setTargetTenantSearch] = useState("");
  
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
        .select("id, razao_social, nome_fantasia, cnpj, tipo_unidade, matriz_id, created_at, email")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true }) as { data: (Empresa & { created_at: string })[] | null; error: Error | null };
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!tenantId,
  });

  const { data: existingTenants = [], isLoading: isLoadingTenants } = useQuery({
    queryKey: ["admin-tenants-search", targetTenantSearch],
    queryFn: async () => {
      if (!targetTenantSearch || targetTenantSearch.length < 3) return [];
      const { data, error } = await supabase
        .from("tenants")
        .select("id, nome, slug")
        .or(`nome.ilike.%${targetTenantSearch}%,slug.ilike.%${targetTenantSearch}%`)
        .neq("id", tenantId)
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: open && migrationType === 'existing',
  });

  // A empresa principal/raiz do tenant é a mais antiga (primeira criada).
  // Ela NÃO pode ser promovida, pois já é a raiz do próprio tenant.
  const principalIdSource = empresasRaw[0]?.id;
  const empresas = useMemo(
    () => empresasRaw
      .filter((e) => e.id !== principalIdSource)
      .slice()
      .sort((a, b) => (a.razao_social || "").localeCompare(b.razao_social || "")),
    [empresasRaw, principalIdSource],
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

  // Calcula a principal automática do lote
  const principalAutomaticaId = useMemo(() => {
    if (selecionadas.length === 0) return null;

    const matriz = selecionadas.find(e => e.tipo_unidade === 'matriz');
    if (matriz) return matriz.id;
    
    return [...selecionadas].sort((a, b) => {
      const ca = empresasRaw.find(r => r.id === a.id)?.created_at || '';
      const cb = empresasRaw.find(r => r.id === b.id)?.created_at || '';
      return ca.localeCompare(cb);
    })[0]?.id;
  }, [selecionadas, empresasRaw]);

  const finalPrincipalId = principalIdOverride || principalAutomaticaId;

  // Atualiza os dados do novo tenant e do proprietário baseado na principal escolhida
  useEffect(() => {
    const updateTenantAndOwner = async () => {
      if (finalPrincipalId && migrationType === 'new') {
        const pLocal = empresasRaw.find(e => e.id === finalPrincipalId);
        if (pLocal) {
          const nomeEmpresa = pLocal.nome_fantasia || pLocal.razao_social;
          
          setNovoTenant(prev => ({
            ...prev,
            nome: nomeEmpresa || "",
            slug: slugify(nomeEmpresa || "")
          }));

          // Busca dados adicionais como o e-mail da empresa para o proprietário
          const { data, error } = await supabase
            .from("empresa_cadastro")
            .select("email")
            .eq("id", finalPrincipalId)
            .maybeSingle();
          
          if (!error && data?.email) {
            setOwner(prev => ({
              ...prev,
              email: data.email || prev.email
            }));
          }
        }
      }
    };

    updateTenantAndOwner();
  }, [finalPrincipalId, migrationType, empresasRaw]);

  const palavraConfirmacao = selecionadas.length === 1
    ? selecionadas[0].razao_social
    : `MIGRAR ${selecionadas.length} EMPRESAS`;

  const reset = () => {
    setStep(1);
    setSelectedIds(new Set(preselectedEmpresaId ? [preselectedEmpresaId] : []));
    setPrincipalIdOverride(preselectedEmpresaId || null);
    setSearch("");
    setMigrationType('new');
    setTargetTenantId("");
    setTargetTenantSearch("");
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
      if (next.has(id)) {
        next.delete(id);
        if (principalIdOverride === id) setPrincipalIdOverride(null);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredEmpresas.length) {
      setSelectedIds(new Set());
      setPrincipalIdOverride(null);
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
      // Reordena os IDs para que a principal seja a primeira (retrocompatibilidade opcional, 
      // mas garante consistência se o RPC usar a primeira como base)
      const sortedIds = [
        finalPrincipalId,
        ...Array.from(selectedIds).filter(id => id !== finalPrincipalId)
      ].filter(Boolean) as string[];

      const body: any = {
        mode: "execute",
        empresaIds: sortedIds,
      };

      if (migrationType === 'existing') {
        body.targetTenantId = targetTenantId;
      } else {
        body.novoTenant = novoTenant;
        body.owner = {
          email: owner.email.trim(),
          nome: owner.nome.trim(),
          password: owner.inviteMode ? undefined : owner.password,
          inviteMode: owner.inviteMode,
        };
      }

      const { data, error } = await supabase.functions.invoke("tenant-spinoff", {
        body
      });
      if (error) {
        let realMsg = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) {
            const b = await ctx.json();
            if (b?.error) realMsg = b.error;
          }
        } catch { /* ignore */ }
        throw new Error(realMsg);
      }
      if (data?.error) throw new Error(data.error);
      const n = data?.empresasMigradas || selectedIds.size;
      toast.success(
        data?.owner?.inviteSent
          ? `Conta-Raiz criada com ${n} empresa(s)! Convite enviado ao novo dono.`
          : `${n} empresa(s) promovida(s) com sucesso!`,
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
    if (migrationType === 'new' && !novoTenant.nome) {
      const principal = empresasRaw.find(e => e.id === finalPrincipalId);
      if (principal) {
        const nome = principal.nome_fantasia || principal.razao_social;
        setNovoTenant((s) => ({ ...s, nome: nome || "", slug: slugify(nome || "") }));
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
            Tenant de origem: <strong>{tenantNome}</strong> · Passo {step} de 3
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
                filteredEmpresas.map((e) => {
                  const checked = selectedIds.has(e.id);
                  const matrizDoLote = e.matriz_id && selectedIds.has(e.matriz_id);
                  const isPrincipal = e.id === finalPrincipalId;

                  return (
                    <div
                      key={e.id}
                      className={`flex items-start gap-2 p-2 border-b last:border-0 hover:bg-muted/30 ${checked ? "bg-primary/5" : ""}`}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleEmpresa(e.id)} className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">{e.razao_social}</span>
                          {e.tipo_unidade === "matriz" && (
                            <Badge variant="default" className="text-[10px] h-4 px-1">Matriz</Badge>
                          )}
                          {e.tipo_unidade === "filial" && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1">Filial</Badge>
                          )}
                          {isPrincipal && checked && (
                            <Badge className="bg-amber-500 text-white text-[10px] h-4 px-1 border-0">
                              <Crown className="w-2.5 h-2.5 mr-0.5" /> Principal
                            </Badge>
                          )}
                          {checked && e.tipo_unidade === "filial" && matrizDoLote && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1 gap-0.5">
                              <GitBranch className="w-2.5 h-2.5" /> vínculo preservado
                            </Badge>
                          )}
                        </div>
                        {e.cnpj && (
                          <p className="text-xs text-muted-foreground">{e.cnpj}</p>
                        )}
                      </div>
                      
                      {checked && (
                        <Button
                          variant={isPrincipal ? "default" : "ghost"}
                          size="icon"
                          className={`h-7 w-7 ${isPrincipal ? "bg-amber-500 hover:bg-amber-600" : "text-muted-foreground"}`}
                          onClick={() => setPrincipalIdOverride(e.id)}
                          title={isPrincipal ? "Empresa Principal" : "Tornar Principal"}
                        >
                          <Star className={`w-4 h-4 ${isPrincipal ? "fill-white" : ""}`} />
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {selectedIds.size > 1 && (
              <Alert className="border-amber-500/50 bg-amber-500/5">
                <Building2 className="w-4 h-4 text-amber-600" />
                <AlertDescription className="text-sm">
                  <strong>Atenção:</strong> As {selectedIds.size} empresas selecionadas serão migradas em lote.
                  Use o ícone de estrela (<Star className="w-3 h-3 inline" />) para definir qual será a <strong>empresa principal</strong> do novo grupo.
                  <br /><br />
                  {matrizesSelecionadas > 0 && filiaisSelecionadas > 0 && (
                    <p className="mt-1 text-xs">• O vínculo matriz→filial será preservado para as empresas deste lote.</p>
                  )}
                  {filiaisSemMatriz > 0 && (
                    <p className="mt-1 text-xs text-destructive">• {filiaisSemMatriz} filial(is) estão sendo migradas sem suas matrizes.</p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-sm">
                Todos os dados das empresas selecionadas (colaboradores, documentos, ponto, etc.) serão transferidos. 
                <strong>{tenantNome}</strong> perderá acesso após a operação.
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

        {/* STEP 2 — Destino (Novo ou Existente) */}
        {step === 2 && (
          <div className="space-y-4">
            <Tabs value={migrationType} onValueChange={(v: any) => setMigrationType(v)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="new">Criar Nova Conta-Raiz</TabsTrigger>
                <TabsTrigger value="existing">Migrar para Existente</TabsTrigger>
              </TabsList>

              <TabsContent value="new" className="space-y-4 pt-4">
                <div className="space-y-3 p-3 rounded-md border">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><Building2 className="w-4 h-4" /> Dados do Novo Tenant</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Nome</Label>
                      <Input value={novoTenant.nome} onChange={(e) => setNovoTenant({ ...novoTenant, nome: e.target.value })} />
                    </div>
                    <div>
                      <Label>Slug (URL)</Label>
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
                        <SelectItem value="early_adopter">Early Adopter</SelectItem>
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
                    <label htmlFor="invite" className="text-sm">Enviar convite por e-mail</label>
                  </div>
                  {!owner.inviteMode && (
                    <div>
                      <Label>Senha provisória</Label>
                      <Input type="password" value={owner.password} onChange={(e) => setOwner({ ...owner, password: e.target.value })} />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="existing" className="space-y-4 pt-4">
                <div className="space-y-3 p-3 rounded-md border">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><Building2 className="w-4 h-4" /> Selecionar Conta-Raiz Destino</h4>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou slug do tenant..."
                      className="pl-9"
                      value={targetTenantSearch}
                      onChange={(e) => setTargetTenantSearch(e.target.value)}
                    />
                  </div>
                  
                  <div className="border rounded-md max-h-48 overflow-y-auto">
                    {isLoadingTenants && (
                      <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
                    )}
                    {!isLoadingTenants && existingTenants.length === 0 && targetTenantSearch.length >= 3 && (
                      <p className="p-4 text-xs text-center text-muted-foreground">Nenhum tenant encontrado.</p>
                    )}
                    {!isLoadingTenants && existingTenants.length === 0 && targetTenantSearch.length < 3 && (
                      <p className="p-4 text-xs text-center text-muted-foreground">Digite ao menos 3 caracteres para buscar.</p>
                    )}
                    {existingTenants.map((t) => (
                      <div
                        key={t.id}
                        className={`p-2 border-b last:border-0 cursor-pointer hover:bg-muted/50 flex justify-between items-center ${targetTenantId === t.id ? "bg-primary/5 border-primary/20" : ""}`}
                        onClick={() => setTargetTenantId(t.id)}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t.nome}</p>
                          <p className="text-[10px] text-muted-foreground">{t.slug}</p>
                        </div>
                        {targetTenantId === t.id && <Badge className="bg-primary text-white">Selecionado</Badge>}
                      </div>
                    ))}
                  </div>
                  
                  {targetTenantId && (
                    <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      <AlertDescription className="text-xs">
                        As empresas serão migradas para <strong>{existingTenants.find(t => t.id === targetTenantId)?.nome}</strong>. 
                        O administrador desse tenant terá controle total sobre elas.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button
                disabled={
                  migrationType === 'new' 
                    ? (!novoTenant.nome || !novoTenant.slug || !owner.email || !owner.nome || (!owner.inviteMode && !owner.password))
                    : !targetTenantId
                }
                onClick={carregarDryRun}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Próximo (Validar)
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
                Foram encontrados <strong>{dryRun.total_registros}</strong> registros vinculados às {selectedIds.size} empresas.
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
                  Ciente de que esta operação é irreversível.
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
                Confirmar e Migrar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
