import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { confirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Globe, Mail, User, Brain, AlertTriangle, CheckCircle, Clock, Edit, Trash2, Eye, Phone, Copy, Flame, Target, TrendingUp, ShieldAlert, Lightbulb, MessageCircle, DollarSign, Zap } from "lucide-react";
import { computeLeadIntel, formatBRL, whatsappLink, mailtoLink } from "./leadIntelligence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface LeadEditForm {
  nome: string;
  email: string;
  telefone: string | null;
  empresa: string | null;
  cargo: string | null;
  setor: string | null;
  num_funcionarios: string | null;
}

export function LandingLeadsTable() {
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useSuperAdmin();
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<LeadEditForm | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);

  const { data: leads, isLoading } = useQuery({
    queryKey: ["landing-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: LeadEditForm }) => {
      const { error } = await supabase.from("landing_leads").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead atualizado");
      queryClient.invalidateQueries({ queryKey: ["landing-leads"] });
      setEditing(null);
      setForm(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("landing_leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead excluído");
      queryClient.invalidateQueries({ queryKey: ["landing-leads"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir"),
  });

  const openEdit = (lead: any) => {
    setEditing(lead);
    setForm({
      nome: lead.nome || "",
      email: lead.email || "",
      telefone: lead.telefone || "",
      empresa: lead.empresa || "",
      cargo: lead.cargo || "",
      setor: lead.setor || "",
      num_funcionarios: lead.num_funcionarios || "",
    });
  };

  const handleDelete = async (lead: any) => {
    const ok = await confirm({
      title: "Excluir lead",
      description: `Excluir permanentemente o lead "${lead.nome}"?\nEsta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (ok) deleteMutation.mutate(lead.id);
  };

  const total = leads?.length || 0;
  const comDiagnostico = leads?.filter((l: any) => l.pontuacao_diagnostico != null).length || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Leads da Landing Page</CardTitle>
          <Badge variant="outline" className="ml-2">{total} leads</Badge>
          {comDiagnostico > 0 && (
            <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20 ml-1">
              <Brain className="w-3 h-3 mr-1" />
              {comDiagnostico} com diagnóstico
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : total === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Nenhum lead capturado ainda</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Empresa / Setor</TableHead>
                <TableHead>Funcionários</TableHead>
                <TableHead>Origem LP</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Urgência</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads?.map((lead: any) => {
                const perfil = lead.perfil_diagnostico || lead.diagnostico_resultado?.perfil;
                const origem = lead.landing_page_origem || lead.diagnostico_resultado?.origem_landing || "—";
                const dor = lead.diagnostico_resultado?.respostas?.dor_principal;
                const perfilCfg: Record<string, { l: string; cls: string }> = {
                  critico:     { l: "Crítico",     cls: "bg-destructive/10 text-destructive border-destructive/20" },
                  quente:      { l: "Prioritário", cls: "bg-warning/10 text-warning border-warning/20" },
                  qualificado: { l: "Qualificado", cls: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
                  explorador:  { l: "Explorador",  cls: "bg-success/10 text-success border-success/20" },
                };
                return (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <div>{lead.nome}</div>
                          {lead.cargo && <div className="text-xs text-muted-foreground">{lead.cargo}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{lead.empresa || "—"}</div>
                      {lead.setor && <div className="text-xs text-muted-foreground">{lead.setor}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{lead.num_funcionarios || "—"}</TableCell>
                    <TableCell>
                      <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                        <Globe className="w-3 h-3 mr-1" />{origem}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {perfil && perfilCfg[perfil] ? (
                        <Badge className={perfilCfg[perfil].cls}>
                          {perfil === "critico" && <AlertTriangle className="w-3 h-3 mr-1" />}
                          {perfil === "quente" && <Clock className="w-3 h-3 mr-1" />}
                          {perfil === "explorador" && <CheckCircle className="w-3 h-3 mr-1" />}
                          {perfilCfg[perfil].l}
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {lead.pontuacao_diagnostico != null ? (
                        <span className="text-sm font-mono font-bold">{lead.pontuacao_diagnostico}</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{lead.urgencia || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 text-xs">
                        <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</div>
                        {lead.telefone && <div className="text-muted-foreground">{lead.telefone}</div>}
                        {dor && <div className="text-muted-foreground italic">Dor: {dor}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {format(new Date(lead.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-primary hover:bg-primary/10"
                          title="Ver diagnóstico"
                          onClick={() => setViewing(lead)}
                          disabled={!lead.diagnostico_resultado && lead.pontuacao_diagnostico == null}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Editar"
                          onClick={() => openEdit(lead)}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        {isSuperAdmin && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Excluir (Super Admin)"
                            onClick={() => handleDelete(lead)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setForm(null); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar Lead</DialogTitle>
            <DialogDescription>Atualize os dados de contato deste lead.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome*</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>E-mail*</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.telefone || ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </div>
              <div>
                <Label>Cargo</Label>
                <Input value={form.cargo || ""} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
              </div>
              <div>
                <Label>Empresa</Label>
                <Input value={form.empresa || ""} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
              </div>
              <div>
                <Label>Setor</Label>
                <Input value={form.setor || ""} onChange={(e) => setForm({ ...form, setor: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Nº de funcionários</Label>
                <Input value={form.num_funcionarios || ""} onChange={(e) => setForm({ ...form, num_funcionarios: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setForm(null); }}>Cancelar</Button>
            <Button
              onClick={() => editing && form && updateMutation.mutate({ id: editing.id, data: form })}
              disabled={!form?.nome || !form?.email || updateMutation.isPending}
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Inteligência Comercial — {viewing?.nome}
            </DialogTitle>
            <DialogDescription>
              {viewing?.empresa || "—"} · {viewing?.cargo || "—"} · {viewing?.setor || "—"} · {viewing?.num_funcionarios || "—"} func.
            </DialogDescription>
          </DialogHeader>
          {viewing && (() => {
            const diag = viewing.diagnostico_resultado || {};
            const dims = diag.dimensoes || {};
            const resp = diag.respostas || {};
            const score = viewing.pontuacao_diagnostico ?? diag.score;
            const intel = computeLeadIntel(viewing);

            const copyToClipboard = (text: string, label: string) => {
              navigator.clipboard.writeText(text);
              toast.success(`${label} copiado!`);
            };

            const icpClass = {
              ideal: "bg-success/10 text-success border-success/20",
              bom: "bg-blue-500/10 text-blue-600 border-blue-500/20",
              fora: "bg-destructive/10 text-destructive border-destructive/20",
              indefinido: "bg-muted text-muted-foreground",
            }[intel.icp];

            const wppLink = whatsappLink(viewing.telefone, intel.ganchoAbordagem);
            const mailLink = mailtoLink(
              viewing.email,
              `${viewing.empresa || ""} — Diagnóstico SST Seguramente`,
              intel.ganchoAbordagem
            );

            return (
              <div className="space-y-4">
                {/* HERO: Temperatura + ICP + Ticket */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className={`border-2 rounded-lg p-3 ${intel.temperaturaClass}`}>
                    <div className="flex items-center gap-1 text-xs font-medium">
                      <Flame className="w-3 h-3" /> Temperatura
                    </div>
                    <div className="text-2xl font-bold mt-1">{intel.temperatura}</div>
                    <div className="text-xs font-semibold">{intel.temperaturaLabel}</div>
                  </div>
                  <div className={`border-2 rounded-lg p-3 ${icpClass}`}>
                    <div className="flex items-center gap-1 text-xs font-medium">
                      <Target className="w-3 h-3" /> ICP
                    </div>
                    <div className="text-sm font-bold mt-1">{intel.icpLabel}</div>
                    <div className="text-[10px] mt-0.5 opacity-80">{intel.icpReason}</div>
                  </div>
                  <div className="border rounded-lg p-3 bg-primary/5">
                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <DollarSign className="w-3 h-3" /> Ticket estimado/mês
                    </div>
                    <div className="text-sm font-bold mt-1">
                      {formatBRL(intel.ticketMin)} – {formatBRL(intel.ticketMax)}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      ARR potencial: {formatBRL(intel.arrPotencial)}
                    </div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <TrendingUp className="w-3 h-3" /> Score / Perfil
                    </div>
                    <div className="text-2xl font-bold mt-1">{score ?? "—"}</div>
                    <div className="text-xs capitalize text-muted-foreground">
                      {viewing.perfil_diagnostico || diag.perfil || "—"} · {viewing.urgencia || "sem urgência"}
                    </div>
                  </div>
                </div>

                {/* PRÓXIMA AÇÃO */}
                <div className="border-l-4 border-primary bg-primary/5 rounded p-3 flex items-start gap-2">
                  <Zap className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-primary uppercase tracking-wide">
                      Próxima ação recomendada
                    </div>
                    <div className="text-sm font-medium mt-0.5">{intel.proximaAcao}</div>
                  </div>
                </div>

                {/* AÇÕES RÁPIDAS */}
                <div className="flex flex-wrap gap-2">
                  {wppLink && (
                    <Button size="sm" variant="outline" asChild className="bg-success/10 hover:bg-success/20 border-success/20 text-success">
                      <a href={wppLink} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp
                      </a>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" asChild>
                    <a href={mailLink}>
                      <Mail className="w-3.5 h-3.5 mr-1" /> E-mail
                    </a>
                  </Button>
                  {viewing.telefone && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={`tel:${viewing.telefone}`}>
                        <Phone className="w-3.5 h-3.5 mr-1" /> Ligar
                      </a>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(viewing.email, "E-mail")}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copiar e-mail
                  </Button>
                  {viewing.telefone && (
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(viewing.telefone, "Telefone")}>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copiar telefone
                    </Button>
                  )}
                </div>

                {/* GANCHO DE ABORDAGEM */}
                <div className="border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase">
                      <Lightbulb className="w-3 h-3" /> Script de abordagem (pronto p/ enviar)
                    </div>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => copyToClipboard(intel.ganchoAbordagem, "Script")}>
                      <Copy className="w-3 h-3 mr-1" /> Copiar
                    </Button>
                  </div>
                  <p className="text-sm italic text-foreground/90 leading-relaxed">"{intel.ganchoAbordagem}"</p>
                </div>

                {/* MÓDULOS RECOMENDADOS + RISCOS (grid) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {intel.modulosRecomendados.length > 0 && (
                    <div className="border rounded-lg p-3">
                      <div className="flex items-center gap-1 text-xs font-semibold mb-2 text-primary uppercase">
                        <Target className="w-3 h-3" /> Módulos a ofertar
                      </div>
                      <ol className="space-y-2">
                        {intel.modulosRecomendados.map((m) => (
                          <li key={m.nome} className="flex items-start gap-2">
                            <Badge variant="outline" className="bg-primary/10 text-primary text-[10px] mt-0.5">
                              #{m.prioridade}
                            </Badge>
                            <div className="flex-1">
                              <div className="text-sm font-medium">{m.nome}</div>
                              <div className="text-[11px] text-muted-foreground">{m.motivo}</div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {intel.riscoTrabalhista.length > 0 && (
                    <div className="border border-destructive/30 rounded-lg p-3 bg-destructive/5">
                      <div className="flex items-center gap-1 text-xs font-semibold mb-2 text-destructive uppercase">
                        <ShieldAlert className="w-3 h-3" /> Riscos trabalhistas detectados
                      </div>
                      <ul className="space-y-1">
                        {intel.riscoTrabalhista.map((r, i) => (
                          <li key={i} className="text-xs flex items-start gap-1">
                            <AlertTriangle className="w-3 h-3 text-destructive mt-0.5 flex-shrink-0" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* PONTOS FORTES (negociação) */}
                {intel.pontosFortes.length > 0 && (
                  <div className="border rounded-lg p-3 bg-success/5">
                    <div className="flex items-center gap-1 text-xs font-semibold mb-2 text-success uppercase">
                      <CheckCircle className="w-3 h-3" /> Pontos fortes (use como elogio)
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {intel.pontosFortes.map((p) => (
                        <Badge key={p.dim} className="bg-success/10 text-success border-success/20 capitalize">
                          {p.dim}: {p.pct}%
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* DIMENSÕES */}
                {Object.keys(dims).length > 0 && (
                  <details className="border rounded-lg p-3" open>
                    <summary className="text-sm font-semibold cursor-pointer">Dimensões do diagnóstico</summary>
                    <div className="space-y-2 mt-3">
                      {Object.entries(dims).map(([k, v]: [string, any]) => {
                        const pct = v.max ? Math.round((v.soma / v.max) * 100) : 0;
                        return (
                          <div key={k}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="capitalize font-medium">{k}</span>
                              <span className="font-mono text-muted-foreground">{v.soma}/{v.max} ({pct}%)</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full ${pct >= 70 ? "bg-success" : pct >= 40 ? "bg-warning" : "bg-destructive"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}

                {/* RESPOSTAS */}
                {Object.keys(resp).length > 0 && (
                  <details className="border rounded-lg p-3">
                    <summary className="text-sm font-semibold cursor-pointer">Respostas brutas do questionário ({Object.keys(resp).length})</summary>
                    <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                      {Object.entries(resp).map(([k, v]: [string, any]) => (
                        <div key={k} className="flex justify-between border rounded px-2 py-1">
                          <span className="text-muted-foreground">{k.replace(/^q_/, "")}</span>
                          <Badge
                            variant="outline"
                            className={
                              v === "sim" ? "bg-success/10 text-success border-success/20"
                              : v === "nao" ? "bg-destructive/10 text-destructive border-destructive/20"
                              : "bg-warning/10 text-warning border-warning/20"
                            }
                          >
                            {String(v)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <div className="text-xs text-muted-foreground border-t pt-2">
                  Capturado em: {diag.capturado_em ? format(new Date(diag.capturado_em), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                  {diag.origem_landing && <> · Origem: {diag.origem_landing}</>}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
