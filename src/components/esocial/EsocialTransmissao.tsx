import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Send, FileCode2, CheckCircle2, XCircle, Clock, RefreshCw,
  AlertTriangle, Eye, ChevronDown, ChevronUp, Shield
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { EventoSST } from "@/types/eventoSST";

interface Transmissao {
  id: string;
  evento_sst_id: string;
  tipo_evento: string;
  status: string;
  mensagem_retorno?: string;
  protocolo?: string;
  numero_recibo?: string;
  codigo_retorno?: string;
  tentativas: number;
  ultima_tentativa?: string;
  xml_enviado?: string;
  xml_retorno?: string;
  created_at: string;
  certificado?: { nome_empresa: string; ambiente: string };
}

interface Certificado {
  id: string;
  nome_empresa: string;
  cnpj: string;
  ambiente: string;
  ativo: boolean;
}

interface Props {
  evento: EventoSST;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { label: "Pendente", color: "secondary", icon: <Clock className="w-3 h-3" /> },
  enviando: { label: "Enviando", color: "default", icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
  enviado: { label: "Enviado", color: "default", icon: <Send className="w-3 h-3" /> },
  processado: { label: "Processado", color: "default", icon: <CheckCircle2 className="w-3 h-3" /> },
  rejeitado: { label: "Rejeitado", color: "destructive", icon: <XCircle className="w-3 h-3" /> },
  erro: { label: "Erro", color: "destructive", icon: <AlertTriangle className="w-3 h-3" /> },
  simulado: { label: "Simulado", color: "secondary", icon: <CheckCircle2 className="w-3 h-3" /> },
  pendente_assinatura: { label: "Aguard. Assinatura", color: "secondary", icon: <Clock className="w-3 h-3" /> },
};

export function EsocialTransmissao({ evento }: Props) {
  const { user, profile } = useAuth();
  const { tenant } = useTenant();
  const qc = useQueryClient();
  const tid = tenant?.id;

  const [showForm, setShowForm] = useState(false);
  const [selectedCert, setSelectedCert] = useState("");
  const [tipoEvento, setTipoEvento] = useState("S-2210");
  const [showXml, setShowXml] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: certificados = [] } = useQuery({
    queryKey: ["esocial-certificados", tid],
    queryFn: async () => {
      if (!tid) return [];
      const { data, error } = await supabase
        .from("esocial_certificados" as any)
        .select("id, nome_empresa, cnpj, ambiente, ativo")
        .eq("tenant_id", tid)
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Certificado[];
    },
    enabled: !!tid,
  });

  const { data: transmissoes = [], isLoading } = useQuery({
    queryKey: ["esocial-transmissoes", evento.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("esocial_transmissoes" as any)
        .select("*")
        .eq("evento_sst_id", evento.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Transmissao[];
    },
  });

  const transmitir = useMutation({
    mutationFn: async () => {
      if (!selectedCert) throw new Error("Selecione um certificado");

      const { data, error } = await supabase.functions.invoke("esocial-transmissao", {
        body: {
          action: "transmitir",
          certificado_id: selectedCert,
          evento_sst_id: evento.id,
          tipo_evento: tipoEvento,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["esocial-transmissoes", evento.id] });
      setShowForm(false);
      if (data.status === "simulado") {
        toast.success("✅ XML gerado e transmissão simulada (homologação)");
      } else if (data.status === "pendente_assinatura") {
        toast.info("📋 XML gerado. Configure a assinatura digital para transmissão real.");
      } else {
        toast.success("Transmissão iniciada: " + data.mensagem);
      }
    },
    onError: (err: any) => toast.error(err.message || "Erro na transmissão"),
  });

  const gerarXml = useMutation({
    mutationFn: async () => {
      if (!selectedCert) throw new Error("Selecione um certificado");
      const { data, error } = await supabase.functions.invoke("esocial-transmissao", {
        body: {
          action: "gerar_xml",
          certificado_id: selectedCert,
          evento_sst_id: evento.id,
          tipo_evento: tipoEvento,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setShowXml(data.xml);
      toast.success("XML gerado com sucesso");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao gerar XML"),
  });

  const getTipoEventoOptions = () => {
    if (evento.tipo === "acidente") {
      return [
        { value: "S-2210", label: "S-2210 — Comunicação de Acidente de Trabalho" },
        { value: "S-2220", label: "S-2220 — Monitoramento da Saúde do Trabalhador" },
      ];
    }
    return [
      { value: "S-2220", label: "S-2220 — Monitoramento da Saúde do Trabalhador" },
      { value: "S-2240", label: "S-2240 — Condições Ambientais do Trabalho" },
    ];
  };

  const statusInfo = (status: string) =>
    STATUS_MAP[status] || { label: status, color: "secondary", icon: null };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          Transmissão eSocial
        </h3>
        {certificados.length > 0 ? (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Send className="w-4 h-4 mr-1.5" /> Transmitir
          </Button>
        ) : (
          <Badge variant="secondary" className="text-xs">
            Configure um certificado em Configurações → eSocial
          </Badge>
        )}
      </div>

      {/* Histórico de transmissões */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
      ) : transmissoes.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg border-dashed">
          <FileCode2 className="w-7 h-7 mx-auto mb-2 opacity-40" />
          <p>Nenhuma transmissão ao eSocial ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transmissoes.map((trans) => {
            const si = statusInfo(trans.status);
            const expanded = expandedId === trans.id;
            return (
              <Card key={trans.id} className="border">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={si.color as any} className="text-xs gap-1">
                        {si.icon} {si.label}
                      </Badge>
                      <span className="text-xs font-medium">{trans.tipo_evento}</span>
                      {trans.protocolo && (
                        <span className="text-xs text-muted-foreground font-mono">
                          #{trans.protocolo}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(trans.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <button
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setExpandedId(expanded ? null : trans.id)}
                    >
                      {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {expanded && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      {trans.mensagem_retorno && (
                        <p className="text-xs text-muted-foreground">{trans.mensagem_retorno}</p>
                      )}
                      {trans.xml_enviado && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setShowXml(trans.xml_enviado!)}
                        >
                          <Eye className="w-3 h-3 mr-1.5" /> Ver XML
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form de transmissão */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" /> Transmitir ao eSocial
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <p className="font-medium">{evento.codigo} — {evento.tipo === "acidente" ? "Acidente" : "Incidente"}</p>
              <p className="text-muted-foreground text-xs mt-0.5">{evento.descricao?.slice(0, 100)}</p>
            </div>

            <div className="space-y-1.5">
              <Label>Evento eSocial</Label>
              <Select value={tipoEvento} onValueChange={setTipoEvento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getTipoEventoOptions().map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Certificado Digital</Label>
              <Select value={selectedCert} onValueChange={setSelectedCert}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o certificado..." />
                </SelectTrigger>
                <SelectContent>
                  {certificados.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <span>{c.nome_empresa}</span>
                        <Badge variant={c.ambiente === "producao" ? "default" : "secondary"} className="text-xs">
                          {c.ambiente === "producao" ? "Prod" : "Hom"}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {certificados.find((c) => c.id === selectedCert)?.ambiente === "producao" && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-xs">
                <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-yellow-700 dark:text-yellow-400">
                  <strong>Ambiente de Produção:</strong> Esta transmissão será enviada oficialmente ao governo federal.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => gerarXml.mutate()}
              disabled={!selectedCert || gerarXml.isPending}
            >
              {gerarXml.isPending ? (
                <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <FileCode2 className="w-4 h-4 mr-1.5" />
              )}
              Ver XML
            </Button>
            <Button
              onClick={() => transmitir.mutate()}
              disabled={!selectedCert || transmitir.isPending}
            >
              {transmitir.isPending ? (
                <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-1.5" />
              )}
              Transmitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal XML */}
      <Dialog open={!!showXml} onOpenChange={() => setShowXml(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode2 className="w-5 h-5" /> XML Gerado — {tipoEvento}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={showXml || ""}
            readOnly
            className="font-mono text-xs h-[400px] resize-none"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(showXml || "");
                toast.success("XML copiado");
              }}
            >
              Copiar XML
            </Button>
            <Button onClick={() => setShowXml(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
