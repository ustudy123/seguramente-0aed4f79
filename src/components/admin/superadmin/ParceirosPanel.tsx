import { useEffect, useMemo, useState } from "react";
import {
  useParceiros, useParceiroDetalhe, linkDoParceiro,
  PARCEIRO_TIPO_LABEL, PARCEIRO_STATUS_LABEL,
  type Parceiro, type ParceiroTipo, type ParceiroStatus, type ParceiroNivel, type ParceiroEventoRemuneracao,
} from "@/hooks/useParceiros";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { confirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Handshake, Plus, Search, CheckCircle, PauseCircle, XCircle, Link2, Copy, Users, Building2,
  Target, Settings2, Save, Loader2, MapPin, RotateCcw,
} from "lucide-react";

const STATUS_VARIANT: Record<ParceiroStatus, "default" | "secondary" | "destructive" | "outline"> = {
  ativo: "default", pendente: "secondary", suspenso: "outline", encerrado: "destructive",
};
const TIPOS = Object.keys(PARCEIRO_TIPO_LABEL) as ParceiroTipo[];
const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function centsToReais(c: number) { return (Number(c || 0) / 100).toFixed(2).replace(".", ","); }
function reaisToCents(s: string) {
  const n = parseFloat((s || "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.max(Math.round(n * 100), 0) : 0;
}
function dataBr(d?: string | null) { return d ? format(new Date(d), "dd/MM/yyyy", { locale: ptBR }) : "—"; }

// ─────────────────────────────────────────────────────────────────────────────
export function ParceirosPanel() {
  const { parceiros, isLoading, isError, mudarStatus } = useParceiros();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [editando, setEditando] = useState<Parceiro | null | undefined>(undefined); // undefined = fechado; null = novo
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return parceiros.filter((p) =>
      (filtroStatus === "todos" || p.status === filtroStatus) &&
      (!q || p.nome.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q) ||
        (p.cidade || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q)));
  }, [parceiros, busca, filtroStatus]);

  const pendentes = parceiros.filter((p) => p.status === "pendente").length;

  const aprovar = (p: Parceiro) => mudarStatus.mutate({ id: p.id, status: "ativo" });
  const suspender = async (p: Parceiro) => {
    if (await confirm({ title: `Suspender ${p.nome}?`, description: "O parceiro deixa de ser sugerido e de gerar comissão nova. A carteira dele fica preservada." }))
      mudarStatus.mutate({ id: p.id, status: "suspenso", motivo: "Suspenso pelo SuperAdmin" });
  };
  const encerrar = async (p: Parceiro) => {
    if (await confirm({ title: `Encerrar ${p.nome}?`, description: "Encerramento é definitivo para o programa. Os clientes que ele originou continuam existindo normalmente." }))
      mudarStatus.mutate({ id: p.id, status: "encerrado", motivo: "Encerrado pelo SuperAdmin" });
  };
  const reativar = (p: Parceiro) => mudarStatus.mutate({ id: p.id, status: "ativo" });

  return (
    <div className="space-y-6" data-testid="parceiros-panel">
      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista"><Handshake className="w-4 h-4 mr-2" />Parceiros{pendentes > 0 && <Badge variant="secondary" className="ml-2">{pendentes} pendente{pendentes > 1 ? "s" : ""}</Badge>}</TabsTrigger>
          <TabsTrigger value="empresas"><Building2 className="w-4 h-4 mr-2" />Origem das empresas</TabsTrigger>
          <TabsTrigger value="config"><Settings2 className="w-4 h-4 mr-2" />Níveis e remuneração</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <CardTitle>Programa de Parceiros</CardTitle>
                  <CardDescription>Indicadores, representantes, implantadores, clínicas e contabilidades que trazem e atendem clientes.</CardDescription>
                </div>
                <Button onClick={() => setEditando(null)}><Plus className="w-4 h-4 mr-2" />Novo parceiro</Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Buscar por nome, código, cidade ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
                </div>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    {(Object.keys(PARCEIRO_STATUS_LABEL) as ParceiroStatus[]).map((s) => <SelectItem key={s} value={s}>{PARCEIRO_STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : isError ? (
                <p className="text-sm text-destructive">Não foi possível carregar os parceiros. A estrutura do programa já foi aplicada neste ambiente?</p>
              ) : filtrados.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum parceiro {parceiros.length ? "com esse filtro" : "cadastrado ainda"}.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parceiro</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Região</TableHead>
                        <TableHead>Nível</TableHead>
                        <TableHead className="text-right">Clientes</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtrados.map((p) => (
                        <TableRow key={p.id} className="cursor-pointer" onClick={() => setDetalheId(p.id)} data-testid="parceiro-linha">
                          <TableCell>
                            <div className="font-medium">{p.nome}</div>
                            <div className="text-xs text-muted-foreground font-mono">{p.codigo}{p.usuarios ? ` · ${p.usuarios}` : ""}</div>
                          </TableCell>
                          <TableCell>{PARCEIRO_TIPO_LABEL[p.tipo_parceiro]}</TableCell>
                          <TableCell className="text-sm">{[p.cidade, p.uf].filter(Boolean).join(" / ") || "—"}</TableCell>
                          <TableCell className="text-sm">{p.nivel_nome || "—"}</TableCell>
                          <TableCell className="text-right">{p.total_clientes}{p.total_implantacoes ? <span className="text-xs text-muted-foreground"> +{p.total_implantacoes} impl.</span> : null}</TableCell>
                          <TableCell className="text-right">{p.total_leads}</TableCell>
                          <TableCell><Badge variant={STATUS_VARIANT[p.status]}>{PARCEIRO_STATUS_LABEL[p.status]}</Badge></TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              {p.status === "pendente" && <Button size="sm" onClick={() => aprovar(p)} data-testid="parceiro-aprovar"><CheckCircle className="w-4 h-4 mr-1" />Aprovar</Button>}
                              {p.status === "ativo" && <Button size="sm" variant="ghost" title="Suspender" onClick={() => suspender(p)}><PauseCircle className="w-4 h-4" /></Button>}
                              {(p.status === "suspenso") && <Button size="sm" variant="ghost" title="Reativar" onClick={() => reativar(p)}><RotateCcw className="w-4 h-4" /></Button>}
                              {p.status !== "encerrado" && <Button size="sm" variant="ghost" title="Encerrar" onClick={() => encerrar(p)}><XCircle className="w-4 h-4 text-destructive" /></Button>}
                              <Button size="sm" variant="outline" onClick={() => setEditando(p)}>Editar</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="empresas" className="mt-4"><OrigemEmpresas /></TabsContent>
        <TabsContent value="config" className="mt-4"><ConfiguracaoPrograma /></TabsContent>
      </Tabs>

      <ParceiroFormDialog open={editando !== undefined} parceiro={editando ?? null} onClose={() => setEditando(undefined)} />
      <ParceiroDetalheSheet parceiro={parceiros.find((p) => p.id === detalheId) ?? null} onClose={() => setDetalheId(null)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ParceiroFormDialog({ open, parceiro, onClose }: { open: boolean; parceiro: Parceiro | null; onClose: () => void }) {
  const { salvar, niveis } = useParceiros();
  const [form, setForm] = useState<Partial<Parceiro>>({});
  useEffect(() => {
    if (open) setForm(parceiro ? { ...parceiro } : { tipo_parceiro: "indicador", tipo_pessoa: "pj", trilha: "operador", raio_atuacao_km: 50 });
  }, [open, parceiro]);
  const set = <K extends keyof Parceiro>(k: K, v: Parceiro[K]) => setForm((f) => ({ ...f, [k]: v }));
  const trilhas = Array.from(new Set(niveis.map((n) => n.trilha)));
  const novoIndicador = !parceiro && form.tipo_parceiro === "indicador";

  const submit = async () => {
    if (!form.nome?.trim()) return toast.error("Informe o nome");
    await salvar.mutateAsync(form);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{parceiro ? "Editar parceiro" : "Novo parceiro"}</DialogTitle>
          <DialogDescription>
            {novoIndicador
              ? "Indicador entra ativo automaticamente. Os demais tipos nascem pendentes e esperam a sua aprovação."
              : "Representante, implantador, clínica e contabilidade nascem pendentes e esperam aprovação."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Nome*</Label><Input data-testid="parceiro-nome" value={form.nome || ""} onChange={(e) => set("nome", e.target.value)} /></div>
          <div><Label>Tipo de parceiro</Label>
            <Select value={form.tipo_parceiro} onValueChange={(v) => set("tipo_parceiro", v as ParceiroTipo)}>
              <SelectTrigger data-testid="parceiro-tipo"><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{PARCEIRO_TIPO_LABEL[t]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Código do link {parceiro ? "" : "(opcional, gerado do nome)"}</Label>
            <Input className="font-mono uppercase" disabled={!!parceiro} value={form.codigo || ""} onChange={(e) => set("codigo", e.target.value.toUpperCase())} placeholder="CLINICAVIDA" /></div>
          <div><Label>Pessoa</Label>
            <Select value={form.tipo_pessoa} onValueChange={(v) => set("tipo_pessoa", v as "pf" | "pj")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="pj">Jurídica (CNPJ)</SelectItem><SelectItem value="pf">Física (CPF)</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>{form.tipo_pessoa === "pf" ? "CPF" : "CNPJ"}</Label><Input value={form.documento || ""} onChange={(e) => set("documento", e.target.value)} /></div>
          <div><Label>E-mail</Label><Input type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} /></div>
          <div><Label>Telefone</Label><Input value={form.telefone || ""} onChange={(e) => set("telefone", e.target.value)} /></div>
          <div><Label>Cidade</Label><Input value={form.cidade || ""} onChange={(e) => set("cidade", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>UF</Label>
              <Select value={form.uf || ""} onValueChange={(v) => set("uf", v)}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>CEP</Label><Input value={form.cep || ""} onChange={(e) => set("cep", e.target.value)} /></div>
          </div>
          <div><Label>Raio de atuação (km)</Label><Input type="number" min={0} value={form.raio_atuacao_km ?? 50} onChange={(e) => set("raio_atuacao_km", Number(e.target.value))} /></div>
          <div><Label>Trilha</Label>
            <Select value={form.trilha || "operador"} onValueChange={(v) => set("trilha", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(trilhas.length ? trilhas : ["operador"]).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {parceiro && (
            <div><Label>Nível</Label>
              <Select value={form.nivel_id || ""} onValueChange={(v) => set("nivel_id", v)}>
                <SelectTrigger><SelectValue placeholder="Automático" /></SelectTrigger>
                <SelectContent>{niveis.filter((n) => n.trilha === (form.trilha || "operador")).map((n) => <SelectItem key={n.id} value={n.id!}>{n.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div><Label>% de comissão (override, opcional)</Label><Input type="number" step="0.01" value={form.percentual_comissao ?? ""} onChange={(e) => set("percentual_comissao", e.target.value === "" ? null : Number(e.target.value))} placeholder="usa o do nível" /></div>
          <div><Label>Chave PIX (pagamento)</Label><Input value={form.pix_chave || ""} onChange={(e) => set("pix_chave", e.target.value)} /></div>
          <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={form.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={salvar.isPending} data-testid="parceiro-salvar">{salvar.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ParceiroDetalheSheet({ parceiro, onClose }: { parceiro: Parceiro | null; onClose: () => void }) {
  const { data, isLoading } = useParceiroDetalhe(parceiro?.id ?? null);
  const { vincularUsuario, desvincularUsuario, criarLink, alternarLink, vincularTenant, tenants } = useParceiros();
  const [email, setEmail] = useState("");
  const [campanha, setCampanha] = useState("");
  const [tenantId, setTenantId] = useState("");
  useEffect(() => { setEmail(""); setCampanha(""); setTenantId(""); }, [parceiro?.id]);

  const copiar = (codigo: string) => {
    navigator.clipboard?.writeText(linkDoParceiro(codigo));
    toast.success("Link copiado");
  };
  const semParceiro = tenants.filter((t) => !t.parceiro_id);

  return (
    <Sheet open={!!parceiro} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {parceiro && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">{parceiro.nome} <Badge variant={STATUS_VARIANT[parceiro.status]}>{PARCEIRO_STATUS_LABEL[parceiro.status]}</Badge></SheetTitle>
              <SheetDescription>
                {PARCEIRO_TIPO_LABEL[parceiro.tipo_parceiro]} · trilha {parceiro.trilha} · nível {parceiro.nivel_nome || "—"} · parceiro desde {dataBr(parceiro.parceiro_desde)}
                {parceiro.cidade && <span className="inline-flex items-center gap-1 ml-2"><MapPin className="w-3 h-3" />{parceiro.cidade}/{parceiro.uf} · {parceiro.raio_atuacao_km} km</span>}
                <span className="block mt-1">Contrato de Parceria: {parceiro.contrato?.pendente ? <Badge variant="outline" className="text-amber-600 border-amber-400">aceite pendente (v{parceiro.contrato?.versao_vigente ?? "?"})</Badge> : <Badge variant="secondary">v{parceiro.contrato?.versao_aceita ?? "?"} aceito em {dataBr(parceiro.contrato?.aceito_em)}</Badge>}</span>
              </SheetDescription>
            </SheetHeader>

            {isLoading || !data ? <Skeleton className="h-40 w-full mt-4" /> : (
              <div className="space-y-6 mt-4">
                <section>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-2"><Link2 className="w-4 h-4" />Links de indicação</h3>
                  <div className="space-y-1">
                    {data.links.map((l) => (
                      <div key={l.id} className="flex items-center justify-between gap-2 border rounded-md px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">?ref={l.codigo}</code>
                          <span className="text-muted-foreground ml-2">{l.campanha}</span>
                          <div className="text-xs text-muted-foreground">{l.cliques} cliques · {l.leads} leads</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="sm" variant="ghost" onClick={() => copiar(l.codigo)} title="Copiar link"><Copy className="w-4 h-4" /></Button>
                          {l.campanha !== "principal" && <Switch checked={l.ativo} onCheckedChange={(v) => alternarLink.mutate({ linkId: l.id, ativo: v })} />}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input placeholder="Nova campanha (ex.: PGR)" value={campanha} onChange={(e) => setCampanha(e.target.value)} />
                    <Button variant="outline" disabled={!campanha.trim() || criarLink.isPending} onClick={() => { criarLink.mutate({ id: parceiro.id, campanha }); setCampanha(""); }}>Gerar link</Button>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-2"><Users className="w-4 h-4" />Acesso à Área do Parceiro</h3>
                  {data.usuarios.length === 0 && <p className="text-xs text-muted-foreground mb-2">Nenhum usuário vinculado. Vincule o e-mail de uma conta existente; a autocadastro pelo site chega na próxima etapa.</p>}
                  <div className="space-y-1">
                    {data.usuarios.map((u) => (
                      <div key={u.user_id} className="flex items-center justify-between border rounded-md px-3 py-1.5 text-sm">
                        <span>{u.email} <span className="text-xs text-muted-foreground">({u.papel})</span></span>
                        <Button size="sm" variant="ghost" onClick={() => desvincularUsuario.mutate(u.user_id)}><XCircle className="w-4 h-4" /></Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input type="email" placeholder="e-mail de uma conta já existente" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <Button variant="outline" disabled={!email.trim() || vincularUsuario.isPending} onClick={() => { vincularUsuario.mutate({ id: parceiro.id, email }); setEmail(""); }}>Vincular</Button>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-2"><Building2 className="w-4 h-4" />Carteira ({data.clientes.length})</h3>
                  {data.clientes.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma empresa vinculada ainda.</p> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Plano</TableHead><TableHead>Assinatura</TableHead><TableHead>Papel</TableHead><TableHead>Desde</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.clientes.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.nome}</TableCell>
                            <TableCell>{c.plano || "—"}</TableCell>
                            <TableCell>{c.status_assinatura || "—"}</TableCell>
                            <TableCell className="text-xs">{c.papel === "origem" ? "Indicou" : c.papel === "implantacao" ? "Implanta" : "Indicou e implanta"}</TableCell>
                            <TableCell className="text-xs">{dataBr(c.originado_em)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Select value={tenantId} onValueChange={setTenantId}>
                      <SelectTrigger data-testid="parceiro-vincular-empresa"><SelectValue placeholder="Vincular empresa sem parceiro de origem…" /></SelectTrigger>
                      <SelectContent>{semParceiro.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="outline" disabled={!tenantId || vincularTenant.isPending}
                      onClick={() => { vincularTenant.mutate({ tenantId, parceiroId: parceiro.id, implantadorId: tenants.find((t) => t.id === tenantId)?.implantador_parceiro_id ?? null }); setTenantId(""); }}>
                      Vincular
                    </Button>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-2"><Target className="w-4 h-4" />Leads ({data.leads.length})</h3>
                  {data.leads.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum lead atribuído. Atribua pelo Kanban de Leads (campo Parceiro).</p> : (
                    <ul className="text-sm space-y-1">
                      {data.leads.map((l) => <li key={l.id} className="flex justify-between border-b py-1"><span>{l.nome}{l.empresa ? ` · ${l.empresa}` : ""}</span><span className="text-xs text-muted-foreground">{l.status} · {l.atribuicao || "—"}</span></li>)}
                    </ul>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function OrigemEmpresas() {
  const { tenants, parceiros, vincularTenant } = useParceiros();
  const [busca, setBusca] = useState("");
  const ativos = parceiros.filter((p) => p.status === "ativo" || p.status === "pendente");
  const implantadores = ativos.filter((p) => ["implantador", "clinica", "contabilidade", "representante"].includes(p.tipo_parceiro));
  const lista = tenants.filter((t) => !busca || t.nome.toLowerCase().includes(busca.toLowerCase()));
  const NENHUM = "__nenhum__";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Origem e implantação de cada empresa</CardTitle>
        <CardDescription>Quem indicou (origem) e quem implanta cada cliente. A origem também é preenchida sozinha quando o cliente chega por link (próximas etapas).</CardDescription>
        <Input className="mt-2 max-w-sm" placeholder="Buscar empresa" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Parceiro de origem</TableHead><TableHead>Implantador</TableHead><TableHead>Desde</TableHead></TableRow></TableHeader>
          <TableBody>
            {lista.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.nome}{!t.ativo && <Badge variant="outline" className="ml-2">inativa</Badge>}</TableCell>
                <TableCell>
                  <Select value={t.parceiro_id ?? NENHUM} onValueChange={(v) => vincularTenant.mutate({ tenantId: t.id, parceiroId: v === NENHUM ? null : v, implantadorId: t.implantador_parceiro_id })}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NENHUM}>— sem parceiro —</SelectItem>
                      {ativos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={t.implantador_parceiro_id ?? NENHUM} onValueChange={(v) => vincularTenant.mutate({ tenantId: t.id, parceiroId: t.parceiro_id, implantadorId: v === NENHUM ? null : v })}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NENHUM}>— a própria casa —</SelectItem>
                      {implantadores.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-xs">{dataBr(t.originado_em)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ConfiguracaoPrograma() {
  const { niveis, eventos, salvarNiveis, salvarEventos } = useParceiros();
  const [nv, setNv] = useState<ParceiroNivel[]>([]);
  const [ev, setEv] = useState<ParceiroEventoRemuneracao[]>([]);
  useEffect(() => setNv(niveis.map((n) => ({ ...n }))), [niveis]);
  useEffect(() => setEv(eventos.map((e) => ({ ...e }))), [eventos]);

  const setNivel = <K extends keyof ParceiroNivel>(i: number, k: K, v: ParceiroNivel[K]) => setNv((a) => a.map((n, j) => (j === i ? { ...n, [k]: v } : n)));
  const setEvento = <K extends keyof ParceiroEventoRemuneracao>(i: number, k: K, v: ParceiroEventoRemuneracao[K]) => setEv((a) => a.map((e, j) => (j === i ? { ...e, [k]: v } : e)));
  const EVENTO_LABEL = { setup_concluido: "Setup concluído (onboarding do cliente)", go_live: "Go-live", renovacao: "Renovação de ciclo" };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Níveis por trilha</CardTitle>
          <CardDescription>Faixa de MRR sob atendimento para alcançar o nível e o percentual de comissão recorrente. O parceiro sobe de nível quando fecha a competência acima da faixa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {nv.map((n, i) => (
            <div key={`${n.trilha}-${n.nome}`} className="border rounded-md p-3 grid grid-cols-2 gap-2 text-sm">
              <div className="col-span-2 flex items-center justify-between">
                <span className="font-medium">{n.trilha} · {n.nome} <span className="text-xs text-muted-foreground">(ordem {n.ordem})</span></span>
                <Switch checked={n.ativo} onCheckedChange={(v) => setNivel(i, "ativo", v)} />
              </div>
              <div><Label className="text-xs">MRR mínimo (R$)</Label><Input value={centsToReais(n.mrr_minimo_cents)} onChange={(e) => setNivel(i, "mrr_minimo_cents", reaisToCents(e.target.value))} /></div>
              <div><Label className="text-xs">Bônus renovação (×)</Label><Input type="number" step="0.5" value={n.bonus_renovacao_multiplicador} onChange={(e) => setNivel(i, "bonus_renovacao_multiplicador", Number(e.target.value))} /></div>
              <div><Label className="text-xs">% cliente por link</Label><Input type="number" step="0.5" value={n.percentual_link} onChange={(e) => setNivel(i, "percentual_link", Number(e.target.value))} /></div>
              <div><Label className="text-xs">% cliente encaminhado pela casa</Label><Input type="number" step="0.5" value={n.percentual_casa} onChange={(e) => setNivel(i, "percentual_casa", Number(e.target.value))} /></div>
            </div>
          ))}
          <Button variant="outline" onClick={() => setNv((a) => [...a, { trilha: a[0]?.trilha || "operador", nome: `Nível ${a.length + 1}`, ordem: a.length + 1, mrr_minimo_cents: 0, percentual_link: 25, percentual_casa: 25, bonus_renovacao_multiplicador: 2, ativo: true }])}><Plus className="w-4 h-4 mr-1" />Adicionar nível</Button>
          <div className="flex justify-end"><Button onClick={() => salvarNiveis.mutate(nv)} disabled={salvarNiveis.isPending}><Save className="w-4 h-4 mr-2" />Salvar níveis</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Remuneração por evento</CardTitle>
          <CardDescription>Ganho único por acontecimento, além da comissão recorrente. O setup do implantador vive aqui: valor fixo, percentual da primeira mensalidade, ou os dois.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {ev.map((e, i) => (
            <div key={`${e.trilha}-${e.tipo_parceiro}-${e.evento}`} className="border rounded-md p-3 grid grid-cols-2 gap-2 text-sm">
              <div className="col-span-2 flex items-center justify-between">
                <span className="font-medium">{PARCEIRO_TIPO_LABEL[e.tipo_parceiro]} · {EVENTO_LABEL[e.evento]}</span>
                <Switch checked={e.ativo} onCheckedChange={(v) => setEvento(i, "ativo", v)} />
              </div>
              <div><Label className="text-xs">Valor fixo (R$)</Label><Input value={centsToReais(e.valor_fixo_cents)} onChange={(ev2) => setEvento(i, "valor_fixo_cents", reaisToCents(ev2.target.value))} /></div>
              <div><Label className="text-xs">% da 1ª mensalidade</Label><Input type="number" step="1" value={e.percentual_primeira_mensalidade} onChange={(ev2) => setEvento(i, "percentual_primeira_mensalidade", Number(ev2.target.value))} /></div>
            </div>
          ))}
          <NovoEvento existentes={ev} onAdd={(x) => setEv((a) => [...a, x])} />
          <div className="flex justify-end"><Button onClick={() => salvarEventos.mutate(ev)} disabled={salvarEventos.isPending}><Save className="w-4 h-4 mr-2" />Salvar remuneração</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}

function NovoEvento({ existentes, onAdd }: { existentes: ParceiroEventoRemuneracao[]; onAdd: (e: ParceiroEventoRemuneracao) => void }) {
  const [tipo, setTipo] = useState<ParceiroTipo>("implantador");
  const [evento, setEvento] = useState<ParceiroEventoRemuneracao["evento"]>("setup_concluido");
  const existe = existentes.some((e) => e.tipo_parceiro === tipo && e.evento === evento && e.trilha === (existentes[0]?.trilha || "operador"));
  return (
    <div className="flex flex-wrap gap-2 items-end">
      <div><Label className="text-xs">Tipo</Label>
        <Select value={tipo} onValueChange={(v) => setTipo(v as ParceiroTipo)}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{PARCEIRO_TIPO_LABEL[t]}</SelectItem>)}</SelectContent></Select></div>
      <div><Label className="text-xs">Evento</Label>
        <Select value={evento} onValueChange={(v) => setEvento(v as ParceiroEventoRemuneracao["evento"])}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="setup_concluido">Setup concluído</SelectItem><SelectItem value="go_live">Go-live</SelectItem><SelectItem value="renovacao">Renovação</SelectItem></SelectContent></Select></div>
      <Button variant="outline" disabled={existe} onClick={() => onAdd({ trilha: existentes[0]?.trilha || "operador", tipo_parceiro: tipo, evento, valor_fixo_cents: 0, percentual_primeira_mensalidade: 0, ativo: true })}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
    </div>
  );
}
