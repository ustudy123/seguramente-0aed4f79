import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useHubProcessoDetalhe, HubProcesso } from "@/hooks/useHubProcessos";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  FileText, MessageSquare, History, CheckSquare, Send,
  PenLine, User, Calendar, Building2, Clock, AlertTriangle,
  Upload, Download, Check, X
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  processoId: string | null;
  onClose: () => void;
  onStatusChange: () => void;
}

const STATUS_OPCOES = [
  { value: "rascunho", label: "Rascunho" },
  { value: "aguardando_documentos", label: "Aguardando Documentos" },
  { value: "pronto_para_envio", label: "Pronto para Envio" },
  { value: "enviado_contabilidade", label: "Enviado à Contabilidade" },
  { value: "recebido_contabilidade", label: "Recebido pela Contabilidade" },
  { value: "em_analise", label: "Em Análise" },
  { value: "pendente_complementacao", label: "Pendente de Complementação" },
  { value: "processado", label: "Processado" },
  { value: "documentos_devolvidos", label: "Documentos Devolvidos" },
  { value: "aguardando_assinatura", label: "Aguardando Assinatura" },
  { value: "assinado_parcialmente", label: "Assinado Parcialmente" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

const statusColors: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  aguardando_documentos: "bg-amber-100 text-amber-800",
  pronto_para_envio: "bg-blue-100 text-blue-800",
  enviado_contabilidade: "bg-indigo-100 text-indigo-800",
  recebido_contabilidade: "bg-purple-100 text-purple-800",
  em_analise: "bg-violet-100 text-violet-800",
  pendente_complementacao: "bg-orange-100 text-orange-800",
  processado: "bg-teal-100 text-teal-800",
  documentos_devolvidos: "bg-sky-100 text-sky-800",
  aguardando_assinatura: "bg-yellow-100 text-yellow-800",
  assinado_parcialmente: "bg-lime-100 text-lime-800",
  concluido: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
  erro_integracao: "bg-destructive/20 text-destructive",
};

export function HubProcessoDetalhe({ processoId, onClose, onStatusChange }: Props) {
  const { user, profile } = useAuthContext();
  const { processo, documentos, comentarios, historico, checklist, loading, refetch } =
    useHubProcessoDetalhe(processoId);
  const [novoComentario, setNovoComentario] = useState("");
  const [ehPendencia, setEhPendencia] = useState(false);
  const [salvandoComentario, setSalvandoComentario] = useState(false);
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);

  const tenantId = profile?.tenant_id;

  const handleStatusChange = async (novoStatus: string) => {
    if (!processoId) return;
    setAtualizandoStatus(true);
    try {
      const { error } = await supabase
        .from("hub_processos")
        .update({ status: novoStatus } as any)
        .eq("id", processoId);
      if (error) { toast.error(error.message); return; }
      toast.success("Status atualizado!");
      refetch();
      onStatusChange();
    } finally {
      setAtualizandoStatus(false);
    }
  };

  const handleComentario = async () => {
    if (!novoComentario.trim() || !processoId || !tenantId) return;
    setSalvandoComentario(true);
    try {
      const { error } = await supabase.from("hub_processo_comentarios").insert({
        tenant_id: tenantId,
        processo_id: processoId,
        autor_nome: profile?.nome_completo || user?.email || "Usuário",
        autor_perfil: "rh",
        conteudo: novoComentario,
        eh_interno: true,
        eh_pendencia: ehPendencia,
      } as any);
      if (error) { toast.error(error.message); return; }
      setNovoComentario("");
      setEhPendencia(false);
      refetch();
      toast.success("Comentário adicionado!");
    } finally {
      setSalvandoComentario(false);
    }
  };

  const handleChecklistToggle = async (itemId: string, concluido: boolean) => {
    const { error } = await supabase
      .from("hub_processo_checklist")
      .update({
        concluido: !concluido,
        concluido_em: !concluido ? new Date().toISOString() : null,
        concluido_por: !concluido ? (profile?.nome_completo || user?.email) : null,
      } as any)
      .eq("id", itemId);
    if (error) { toast.error(error.message); return; }
    refetch();
  };

  if (!processoId) return null;

  return (
    <Sheet open={!!processoId} onOpenChange={() => onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>
        ) : !processo ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">Processo não encontrado</div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Cabeçalho */}
            <div className="p-6 border-b space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-mono text-muted-foreground">{processo.codigo}</span>
                    <Badge className={`text-xs ${statusColors[processo.status] || ""}`}>
                      {STATUS_OPCOES.find(s => s.value === processo.status)?.label || processo.status}
                    </Badge>
                    {processo.prioridade === "urgente" && (
                      <span className="text-xs font-bold text-destructive flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> URGENTE
                      </span>
                    )}
                    {processo.gerado_automaticamente && (
                      <span className="text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5">Auto</span>
                    )}
                  </div>
                  <h2 className="font-semibold text-base leading-tight">{processo.titulo}</h2>
                </div>
              </div>

              {/* Metadados */}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {processo.colaborador_nome && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" /> {processo.colaborador_nome}
                    {processo.colaborador_cpf && ` — ${processo.colaborador_cpf}`}
                  </span>
                )}
                {processo.competencia && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {processo.competencia}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(parseISO(processo.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              </div>

              {/* Alterar status */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">Status:</span>
                <Select
                  value={processo.status}
                  onValueChange={handleStatusChange}
                  disabled={atualizandoStatus}
                >
                  <SelectTrigger className="h-8 text-xs w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPCOES.map(s => (
                      <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Abas */}
            <div className="flex-1 overflow-y-auto">
              <Tabs defaultValue="documentos" className="h-full">
                <TabsList className="grid grid-cols-4 m-4 mb-0">
                  <TabsTrigger value="documentos" className="gap-1 text-xs">
                    <FileText className="w-3 h-3" /> Documentos
                    {documentos.length > 0 && (
                      <span className="ml-1 bg-primary/20 text-primary text-xs rounded-full px-1.5">{documentos.length}</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="checklist" className="gap-1 text-xs">
                    <CheckSquare className="w-3 h-3" /> Checklist
                  </TabsTrigger>
                  <TabsTrigger value="comentarios" className="gap-1 text-xs">
                    <MessageSquare className="w-3 h-3" /> Chat
                    {comentarios.length > 0 && (
                      <span className="ml-1 bg-primary/20 text-primary text-xs rounded-full px-1.5">{comentarios.length}</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="historico" className="gap-1 text-xs">
                    <History className="w-3 h-3" /> Histórico
                  </TabsTrigger>
                </TabsList>

                {/* Documentos */}
                <TabsContent value="documentos" className="p-4 space-y-3">
                  {documentos.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p>Nenhum documento anexado</p>
                    </div>
                  ) : (
                    documentos.map(doc => (
                      <Card key={doc.id}>
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{doc.nome}</p>
                              <div className="flex gap-2 text-xs text-muted-foreground flex-wrap">
                                <span>{doc.tipo.replace(/_/g, " ")}</span>
                                <span>v{doc.versao}</span>
                                <span className={doc.status === "pendente" ? "text-amber-600" : "text-green-600"}>
                                  {doc.status}
                                </span>
                                {doc.requer_assinatura && (
                                  <span className="flex items-center gap-0.5 text-yellow-600">
                                    <PenLine className="w-3 h-3" /> Requer assinatura
                                  </span>
                                )}
                              </div>
                            </div>
                            {doc.arquivo_url && (
                              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" asChild>
                                <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer">
                                  <Download className="w-4 h-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                {/* Checklist */}
                <TabsContent value="checklist" className="p-4 space-y-2">
                  {checklist.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p>Nenhum item de checklist</p>
                    </div>
                  ) : (
                    checklist.map(item => (
                      <div key={item.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                          ${item.concluido ? "bg-green-50 border-green-200" : "hover:bg-muted/40"}`}
                        onClick={() => handleChecklistToggle(item.id, item.concluido)}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5
                          ${item.concluido ? "bg-green-500 border-green-500" : "border-muted-foreground"}`}>
                          {item.concluido && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${item.concluido ? "line-through text-muted-foreground" : "font-medium"}`}>
                            {item.item}
                            {item.obrigatorio && !item.concluido && (
                              <span className="ml-1.5 text-xs text-destructive">*obrigatório</span>
                            )}
                          </p>
                          {item.descricao && (
                            <p className="text-xs text-muted-foreground">{item.descricao}</p>
                          )}
                          {item.concluido_por && (
                            <p className="text-xs text-green-600 mt-0.5">✓ {item.concluido_por}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                {/* Comentários */}
                <TabsContent value="comentarios" className="p-4 flex flex-col gap-4">
                  <div className="space-y-3 flex-1">
                    {comentarios.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p>Nenhuma mensagem ainda</p>
                      </div>
                    ) : (
                      comentarios.map(c => (
                        <div key={c.id}
                          className={`p-3 rounded-lg text-sm ${
                            c.eh_pendencia
                              ? "bg-amber-50 border border-amber-200"
                              : c.eh_interno
                              ? "bg-muted/40 border"
                              : "bg-primary/5 border border-primary/20"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-xs">{c.autor_nome}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(c.created_at), "dd/MM HH:mm")}
                            </span>
                            {c.eh_pendencia && (
                              <span className="text-xs text-amber-600 font-medium">
                                {c.pendencia_resolvida ? "✓ Resolvida" : "⚠ Pendência"}
                              </span>
                            )}
                            {!c.eh_interno && (
                              <span className="text-xs text-primary font-medium">Visível à Contabilidade</span>
                            )}
                          </div>
                          <p className="text-sm">{c.conteudo}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Input comentário */}
                  <div className="border-t pt-3 space-y-2">
                    <Textarea
                      value={novoComentario}
                      onChange={e => setNovoComentario(e.target.value)}
                      placeholder="Escreva um comentário ou pendência..."
                      rows={3}
                      className="text-sm"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ehPendencia}
                          onChange={e => setEhPendencia(e.target.checked)}
                        />
                        Marcar como pendência
                      </label>
                      <div className="flex-1" />
                      <Button
                        size="sm"
                        onClick={handleComentario}
                        disabled={!novoComentario.trim() || salvandoComentario}
                        className="gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {salvandoComentario ? "Enviando..." : "Enviar"}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Histórico */}
                <TabsContent value="historico" className="p-4 space-y-2">
                  {historico.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p>Nenhuma ação registrada</p>
                    </div>
                  ) : (
                    <div className="relative pl-4">
                      <div className="absolute left-[7px] top-0 bottom-0 w-px bg-border" />
                      {historico.map(h => (
                        <div key={h.id} className="relative mb-4 pl-4">
                          <div className="absolute -left-1 top-1 w-2 h-2 rounded-full bg-primary" />
                          <p className="text-sm font-medium">{h.descricao || h.acao}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {h.usuario_nome && <span>{h.usuario_nome}</span>}
                            <span>{format(parseISO(h.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                          </div>
                          {h.status_anterior && h.status_novo && (
                            <div className="flex items-center gap-1 text-xs mt-1">
                              <span className="text-muted-foreground">{h.status_anterior}</span>
                              <span>→</span>
                              <span className="text-primary font-medium">{h.status_novo}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
