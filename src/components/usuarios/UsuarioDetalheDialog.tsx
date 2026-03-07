import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  User, Building2, Link2, History, AlertTriangle, CheckCircle2,
  Plus, Trash2, Shield, Ban, RotateCcw, Loader2, Pencil, Save, X,
  Mail, Send, XCircle,
} from "lucide-react";
import {
  UsuarioBase, UsuarioVinculo, TIPO_USUARIO_LABELS, VINCULO_STATUS_LABELS,
  STATUS_LABELS, useUsuarios, calcularQualidade,
} from "@/hooks/useUsuarios";
import { UsuarioStatusBadge } from "./UsuarioStatusBadge";
import { QualidadeScoreIndicator } from "./QualidadeScoreIndicator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CpfInput } from "@/components/ui/cpf-input";
import { cleanCpf, formatCpf } from "@/lib/cpf";

interface Props {
  usuario: UsuarioBase;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Tab = "dados" | "vinculos" | "logs";

export function UsuarioDetalheDialog({ usuario, open, onOpenChange }: Props) {
  const { tenantId } = useAuth();
  const { updateStatus, updateUsuario, createVinculo, encerrarVinculo } = useUsuarios();
  const [tab, setTab] = useState<Tab>("dados");

  // Edição
  const [editando, setEditando] = useState(false);
  const [editForm, setEditForm] = useState({
    nome_completo: usuario.nome_completo,
    nome_social: usuario.nome_social || "",
    telefone_principal: usuario.telefone_principal || "",
    cargo_funcao: usuario.cargo_funcao || "",
    matricula: usuario.matricula || "",
    data_nascimento: usuario.data_nascimento || "",
    observacoes: usuario.observacoes || "",
  });

  // Bloqueio
  const [motivoBloqueio, setMotivoBloqueio] = useState("");
  const [showBloqueioForm, setShowBloqueioForm] = useState(false);

  // Novo vínculo
  const [addingVinculo, setAddingVinculo] = useState(false);
  const [novaEmpresaId, setNovaEmpresaId] = useState("");
  const [novoTipo, setNovoTipo] = useState("gestor");
  const [novoContexto, setNovoContexto] = useState("");

  const vinculos: UsuarioVinculo[] = (usuario as any).vinculos || [];
  const vinculosAtivos = vinculos.filter(v => v.status === "ativo");
  const { score, pct } = calcularQualidade(usuario, vinculos);

  const convitePendente = ["pendente_convite", "convite_enviado", "aguardando_ativacao"].includes(usuario.status);

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

  const { data: logs = [] } = useQuery({
    queryKey: ["usuario-audit", usuario.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("usuario_audit_log")
        .select("*")
        .eq("usuario_id", usuario.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: open && tab === "logs",
  });

  function fmt(d?: string) {
    if (!d) return "—";
    try { return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR }); }
    catch { return d; }
  }

  function fmtDate(d?: string) {
    if (!d) return "—";
    try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); }
    catch { return d; }
  }

  async function handleSalvarEdicao() {
    await updateUsuario.mutateAsync({ id: usuario.id, ...editForm });
    setEditando(false);
  }

  async function handleBloqueio() {
    await updateStatus.mutateAsync({ id: usuario.id, status: "bloqueado", justificativa: motivoBloqueio });
    setShowBloqueioForm(false);
    setMotivoBloqueio("");
  }

  async function handleReativar() {
    await updateStatus.mutateAsync({ id: usuario.id, status: "ativo" });
  }

  async function handleEnviarConvite() {
    await updateStatus.mutateAsync({ id: usuario.id, status: "convite_enviado" });
    toast.success("Convite marcado como enviado!");
  }

  async function handleCancelarConvite() {
    await updateStatus.mutateAsync({ id: usuario.id, status: "rascunho" });
    toast.success("Convite cancelado.");
  }

  async function handleAddVinculo() {
    if (!novaEmpresaId) { toast.error("Selecione a empresa"); return; }
    await createVinculo.mutateAsync({
      usuario_id: usuario.id,
      empresa_id: novaEmpresaId,
      tipo_vinculo: novoTipo as any,
      contexto_operacional: novoContexto,
      status: "ativo",
      data_inicio: new Date().toISOString().split("T")[0],
    });
    setAddingVinculo(false);
    setNovaEmpresaId(""); setNovoTipo("gestor"); setNovoContexto("");
  }

  const isBloqueado = usuario.status === "bloqueado" || usuario.status === "suspenso";

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "dados", label: "Dados", icon: User },
    { key: "vinculos", label: `Vínculos (${vinculos.length})`, icon: Link2 },
    { key: "logs", label: "Histórico", icon: History },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 shrink-0 border-b">
          <DialogHeader className="sr-only">
            <DialogTitle>Detalhes do Usuário</DialogTitle>
            <DialogDescription>Gerencie os dados, vínculos e histórico do usuário</DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              {usuario.foto_url
                ? <img src={usuario.foto_url} className="w-12 h-12 rounded-full object-cover" alt="" />
                : <User className="w-6 h-6 text-primary" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-semibold text-lg truncate">{usuario.nome_completo}</h2>
                {usuario.nome_social && (
                  <span className="text-sm text-muted-foreground">({usuario.nome_social})</span>
                )}
                <UsuarioStatusBadge status={usuario.status} />
              </div>
              <p className="text-sm text-muted-foreground">{usuario.email_principal}</p>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {TIPO_USUARIO_LABELS[usuario.tipo_usuario] || usuario.tipo_usuario}
                </span>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-xs text-muted-foreground">{vinculosAtivos.length} vínculo(s) ativo(s)</span>
                <span className="text-muted-foreground/40">•</span>
                <QualidadeScoreIndicator score={score} pct={pct} />
              </div>
            </div>

            {/* Ações de status */}
            <div className="flex gap-2 shrink-0">
              {convitePendente && (
                <>
                  <Button size="sm" variant="outline" className="text-blue-600 border-blue-300 hover:bg-blue-50"
                    onClick={handleEnviarConvite} disabled={updateStatus.isPending}>
                    <Send className="w-3 h-3 mr-1" />
                    {usuario.status === "convite_enviado" ? "Reenviar" : "Enviar convite"}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-muted-foreground"
                    onClick={handleCancelarConvite} disabled={updateStatus.isPending}>
                    <XCircle className="w-3 h-3 mr-1" /> Cancelar
                  </Button>
                </>
              )}
              {!convitePendente && (
                isBloqueado ? (
                  <Button size="sm" variant="outline" onClick={handleReativar} disabled={updateStatus.isPending}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Reativar
                  </Button>
                ) : (
                  <Button size="sm" variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => setShowBloqueioForm(true)}>
                    <Ban className="w-3 h-3 mr-1" /> Bloquear
                  </Button>
                )
              )}
            </div>
          </div>

          {/* Bloqueio form */}
          {showBloqueioForm && (
            <div className="mt-3 p-3 border border-destructive/20 rounded-lg bg-destructive/5 space-y-2">
              <p className="text-sm font-medium text-destructive">Justificativa do bloqueio (opcional)</p>
              <Textarea rows={2} value={motivoBloqueio} onChange={e => setMotivoBloqueio(e.target.value)}
                placeholder="Informe o motivo…" className="text-sm" />
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={handleBloqueio} disabled={updateStatus.isPending}>
                  {updateStatus.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Confirmar bloqueio
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowBloqueioForm(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          {/* Alerta convite pendente */}
          {usuario.status === "pendente_convite" && (
            <div className="mt-3 flex gap-2 items-center p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <Mail className="w-4 h-4 shrink-0" />
              <span>Este usuário ainda não recebeu o convite de ativação.</span>
            </div>
          )}

          {/* Alerta duplicidade */}
          {usuario.alerta_duplicidade && (
            <div className="mt-3 flex gap-2 items-center p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Possível duplicidade detectada: <strong>{usuario.duplicidade_nivel}</strong></span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  tab === t.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4">

            {/* ── Tab: Dados ── */}
            {tab === "dados" && (
              <div className="space-y-4">

                {/* Cabeçalho com botão editar */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Informações</p>
                  {!editando ? (
                    <Button size="sm" variant="outline" onClick={() => {
                      setEditForm({
                        nome_completo: usuario.nome_completo,
                        nome_social: usuario.nome_social || "",
                        telefone_principal: usuario.telefone_principal || "",
                        cargo_funcao: usuario.cargo_funcao || "",
                        matricula: usuario.matricula || "",
                        data_nascimento: usuario.data_nascimento || "",
                        observacoes: usuario.observacoes || "",
                      });
                      setEditando(true);
                    }}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSalvarEdicao} disabled={updateUsuario.isPending}>
                        {updateUsuario.isPending
                          ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          : <Save className="w-3.5 h-3.5 mr-1" />
                        } Salvar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditando(false)}>
                        <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                      </Button>
                    </div>
                  )}
                </div>

                {editando ? (
                  /* Form de edição */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label>Nome Completo *</Label>
                      <Input value={editForm.nome_completo}
                        onChange={e => setEditForm(f => ({ ...f, nome_completo: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nome Social</Label>
                      <Input value={editForm.nome_social} placeholder="Como prefere ser chamado(a)"
                        onChange={e => setEditForm(f => ({ ...f, nome_social: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Matrícula / Código Interno</Label>
                      <Input value={editForm.matricula} placeholder="EMP-0042"
                        onChange={e => setEditForm(f => ({ ...f, matricula: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Telefone / WhatsApp</Label>
                      <Input value={editForm.telefone_principal} placeholder="(11) 99000-0000"
                        onChange={e => setEditForm(f => ({ ...f, telefone_principal: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Cargo / Função</Label>
                      <Input value={editForm.cargo_funcao} placeholder="Analista de RH"
                        onChange={e => setEditForm(f => ({ ...f, cargo_funcao: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Data de Nascimento</Label>
                      <Input type="date" value={editForm.data_nascimento}
                        onChange={e => setEditForm(f => ({ ...f, data_nascimento: e.target.value }))} />
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label>Observações</Label>
                      <Textarea rows={2} value={editForm.observacoes} placeholder="Informações internas…"
                        onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))} />
                    </div>
                  </div>
                ) : (
                  /* Visualização */
                  <>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      {[
                        ["CPF", usuario.cpf ? formatCpf(usuario.cpf) : "—"],
                        ["Telefone", usuario.telefone_principal || "—"],
                        ["Nascimento", usuario.data_nascimento ? fmtDate(usuario.data_nascimento) : "—"],
                        ["Cargo/Função", usuario.cargo_funcao || "—"],
                        ["Nome Social", usuario.nome_social || "—"],
                        ["Matrícula", usuario.matricula || "—"],
                        ["E-mail validado", usuario.email_validado ? "✅ Sim" : "⚠️ Não"],
                        ["Telefone validado", usuario.telefone_validado ? "✅ Sim" : "⚠️ Não"],
                        ["2FA", usuario.autenticacao_2fa ? "✅ Ativo" : "Não ativado"],
                        ["Último acesso", fmt(usuario.ultimo_acesso_em)],
                        ["Primeiro acesso", fmt(usuario.primeiro_acesso_em)],
                        ["Cadastrado em", fmt(usuario.created_at)],
                        ["Cadastrado por", usuario.criado_por_nome || "—"],
                        ["Convite enviado", fmt(usuario.convite_enviado_em)],
                        ["Convite expira", usuario.convite_expira_em ? fmtDate(usuario.convite_expira_em) : "—"],
                      ].map(([label, val]) => (
                        <div key={label as string}>
                          <span className="text-muted-foreground text-xs">{label}</span>
                          <p className="font-medium mt-0.5">{val}</p>
                        </div>
                      ))}
                    </div>

                    {usuario.observacoes && (
                      <div className="p-3 bg-muted/40 rounded-lg text-sm">
                        <span className="text-muted-foreground block mb-1 text-xs">Observações</span>
                        {usuario.observacoes}
                      </div>
                    )}

                    {usuario.sugestao_tipo_ia && (
                      <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm text-primary">
                        <Shield className="w-4 h-4 shrink-0" />
                        Sugestão IA: tipo <strong>{TIPO_USUARIO_LABELS[usuario.sugestao_tipo_ia]}</strong>
                      </div>
                    )}
                  </>
                )}

                <Separator />

                {/* Score de Qualidade */}
                <div>
                  <p className="text-sm font-medium mb-2">Score de Qualidade Cadastral</p>
                  <QualidadeScoreIndicator score={score} pct={pct} />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      { ok: !!usuario.nome_completo, label: "Nome" },
                      { ok: !!usuario.email_principal, label: "E-mail" },
                      { ok: !!usuario.cpf, label: "CPF" },
                      { ok: !!usuario.telefone_principal, label: "Telefone" },
                      { ok: !!usuario.data_nascimento, label: "Nascimento" },
                      { ok: !!usuario.cargo_funcao, label: "Cargo" },
                      { ok: !!usuario.foto_url, label: "Foto" },
                      { ok: vinculosAtivos.length > 0, label: "Vínculo ativo" },
                    ].map(({ ok, label }) => (
                      <span key={label} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${
                        ok ? "bg-primary/10 text-primary border-primary/30" : "bg-muted text-muted-foreground border-muted"
                      }`}>
                        {ok ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-3 h-3 text-center">○</span>}
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Vínculos ── */}
            {tab === "vinculos" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium">Empresas vinculadas</p>
                  <Button size="sm" variant="outline" onClick={() => setAddingVinculo(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar vínculo
                  </Button>
                </div>

                {addingVinculo && (
                  <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
                    <p className="text-sm font-medium">Novo vínculo</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Empresa *</Label>
                        <Select onValueChange={setNovaEmpresaId}>
                          <SelectTrigger className="h-8"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                          <SelectContent>
                            {empresas.map((e: any) => (
                              <SelectItem key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Papel na empresa</Label>
                        <Select defaultValue="gestor" onValueChange={setNovoTipo}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(TIPO_USUARIO_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Contexto</Label>
                        <Input className="h-8" value={novoContexto}
                          onChange={e => setNovoContexto(e.target.value)} placeholder="Ex: SST, RH…" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddVinculo} disabled={createVinculo.isPending}>
                        {createVinculo.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Salvar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAddingVinculo(false)}>Cancelar</Button>
                    </div>
                  </div>
                )}

                {vinculos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum vínculo cadastrado</p>
                ) : (
                  <>
                    {/* Ativos primeiro, depois encerrados */}
                    {["ativo", "pendente", "suspenso", "revogado", "encerrado", "expirado"].map(statusGrupo => {
                      const grupo = vinculos.filter(v => v.status === statusGrupo);
                      if (grupo.length === 0) return null;
                      return (
                        <div key={statusGrupo}>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                            {VINCULO_STATUS_LABELS[statusGrupo as any]} ({grupo.length})
                          </p>
                          {grupo.map(v => {
                            const emp = (v as any).empresa;
                            return (
                              <div key={v.id} className="flex items-start gap-3 p-3 border rounded-lg mb-2">
                                <Building2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm">
                                      {emp?.nome_fantasia || emp?.razao_social || "Empresa"}
                                    </span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                                      v.status === "ativo"
                                        ? "bg-primary/10 text-primary border-primary/30"
                                        : "bg-muted text-muted-foreground border-muted"
                                    }`}>
                                      {VINCULO_STATUS_LABELS[v.status]}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {TIPO_USUARIO_LABELS[v.tipo_vinculo]}
                                    {v.contexto_operacional && ` · ${v.contexto_operacional}`}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Início: {fmtDate(v.data_inicio)}
                                    {v.data_fim && ` · Fim: ${fmtDate(v.data_fim)}`}
                                    {v.aprovado_por_nome && ` · Aprovado por: ${v.aprovado_por_nome}`}
                                  </p>
                                  {v.observacoes && (
                                    <p className="text-xs text-muted-foreground italic mt-0.5">{v.observacoes}</p>
                                  )}
                                </div>
                                {v.status === "ativo" && (
                                  <Button size="sm" variant="ghost"
                                    className="text-destructive hover:bg-destructive/10 shrink-0"
                                    onClick={() => encerrarVinculo.mutateAsync({ id: v.id, usuario_id: usuario.id })}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {/* ── Tab: Logs ── */}
            {tab === "logs" && (
              <div className="space-y-2">
                {logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro de auditoria</p>
                ) : (
                  logs.map((log: any) => (
                    <div key={log.id} className="flex gap-3 text-sm border-l-2 border-muted pl-3 py-1.5">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium capitalize">{log.acao.replace(/_/g, " ")}</span>
                          <Badge variant="outline" className="text-xs">{log.objeto}</Badge>
                        </div>
                        {log.executor_nome && (
                          <p className="text-xs text-muted-foreground">por {log.executor_nome}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{fmt(log.created_at)}</p>
                        {log.valor_novo && typeof log.valor_novo === "object" && log.valor_novo.justificativa && (
                          <p className="text-xs text-muted-foreground italic mt-0.5">
                            "{log.valor_novo.justificativa}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
