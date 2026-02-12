import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2, XCircle, Eye, FileText, Image, Clock,
  Shield, MapPin, User, ExternalLink, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProfissionalPendente {
  id: string;
  nome_completo: string;
  email: string;
  telefone: string | null;
  cpf_cnpj: string | null;
  foto_url: string | null;
  bio: string | null;
  formacao_academica: string | null;
  registro_profissional: string;
  conselho: string;
  uf_registro: string | null;
  registro_validade: string | null;
  especialidades: string[] | null;
  areas_atuacao: string[] | null;
  cidade: string | null;
  estado: string | null;
  created_at: string;
  tem_atestado_capacidade: boolean;
}

interface Documento {
  id: string;
  categoria: string;
  nome_arquivo: string;
  arquivo_url: string;
  tamanho_bytes: number | null;
  mime_type: string | null;
  created_at: string;
}

const categoriaLabels: Record<string, string> = {
  documento_pessoal: "Documento Pessoal",
  cpf_comprovante: "CPF / CNPJ",
  registro_conselho: "Registro do Conselho",
  formacao: "Diploma / Formação",
  certificacao: "Certificação Complementar",
  comprovante_endereco: "Comprovante de Endereço",
  atestado_capacidade_tecnica: "Atestado de Capacidade Técnica",
  selfie_verificacao: "Selfie de Verificação",
};

export function ValidacaoProfissionais() {
  const queryClient = useQueryClient();
  const [selectedProf, setSelectedProf] = useState<ProfissionalPendente | null>(null);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const [showRejeitar, setShowRejeitar] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const { data: pendentes = [], isLoading } = useQuery({
    queryKey: ["marketplace-profissionais-pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_profissionais")
        .select("*")
        .eq("status", "pendente")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ProfissionalPendente[];
    },
  });

  const openProfile = async (prof: ProfissionalPendente) => {
    setSelectedProf(prof);
    setLoadingDocs(true);
    try {
      const { data, error } = await supabase
        .from("marketplace_profissional_documentos")
        .select("*")
        .eq("profissional_id", prof.id)
        .order("created_at");
      if (error) throw error;
      setDocs(data as Documento[]);
    } catch {
      setDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleAprovar = async () => {
    if (!selectedProf) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("marketplace_profissionais")
        .update({ status: "ativo" as "ativo" })
        .eq("id", selectedProf.id);
      if (error) throw error;

      await supabase.from("marketplace_audit_log").insert({
        tenant_id: selectedProf.id,
        profissional_id: selectedProf.id,
        acao: "profissional_aprovado",
        descricao: `Profissional ${selectedProf.nome_completo} aprovado`,
        dados: { aprovado_em: new Date().toISOString() },
      });

      toast.success(`${selectedProf.nome_completo} aprovado com sucesso!`);
      setSelectedProf(null);
      queryClient.invalidateQueries({ queryKey: ["marketplace-profissionais-pendentes"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-profissionais"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejeitar = async () => {
    if (!selectedProf || !motivoRejeicao.trim()) {
      toast.error("Informe o motivo da rejeição");
      return;
    }
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("marketplace_profissionais")
        .update({ status: "rejeitado" as any })
        .eq("id", selectedProf.id);
      if (error) throw error;

      await supabase.from("marketplace_audit_log").insert({
        tenant_id: selectedProf.id,
        profissional_id: selectedProf.id,
        acao: "profissional_rejeitado",
        descricao: `Profissional ${selectedProf.nome_completo} rejeitado: ${motivoRejeicao}`,
        dados: { motivo: motivoRejeicao, rejeitado_em: new Date().toISOString() },
      });

      toast.success("Profissional rejeitado");
      setSelectedProf(null);
      setShowRejeitar(false);
      setMotivoRejeicao("");
      queryClient.invalidateQueries({ queryKey: ["marketplace-profissionais-pendentes"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Carregando pendentes...</div>;
  }

  if (pendentes.length === 0) {
    return (
      <div className="text-center py-16">
        <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-400 mb-3" />
        <p className="text-muted-foreground font-medium">Nenhum profissional pendente de validação</p>
        <p className="text-xs text-muted-foreground mt-1">Todos os cadastros foram processados.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Profissionais Pendentes de Validação</h3>
          <Badge variant="secondary" className="text-xs">{pendentes.length} pendente(s)</Badge>
        </div>

        <div className="space-y-2">
          {pendentes.map((prof) => (
            <div
              key={prof.id}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-colors"
            >
              {prof.foto_url ? (
                <img src={prof.foto_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                  <User className="h-5 w-5" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{prof.nome_completo}</p>
                <p className="text-xs text-muted-foreground">
                  {prof.conselho} - {prof.registro_profissional}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Cadastrado em {format(new Date(prof.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  {prof.cidade && (
                    <>
                      <span>•</span>
                      <MapPin className="h-3 w-3" />
                      {prof.cidade}, {prof.estado}
                    </>
                  )}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => openProfile(prof)} className="gap-1.5">
                <Eye className="h-3.5 w-3.5" /> Analisar
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedProf} onOpenChange={() => { setSelectedProf(null); setShowRejeitar(false); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Validação de Profissional
            </DialogTitle>
          </DialogHeader>

          {selectedProf && (
            <div className="space-y-5">
              {/* Profile header */}
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                {selectedProf.foto_url ? (
                  <img src={selectedProf.foto_url} alt="" className="w-16 h-16 rounded-xl object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-lg">{selectedProf.nome_completo}</h3>
                  <p className="text-sm text-muted-foreground">{selectedProf.email}</p>
                  {selectedProf.telefone && <p className="text-sm text-muted-foreground">{selectedProf.telefone}</p>}
                </div>
              </div>

              {/* Professional info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-card border rounded-lg">
                  <p className="text-xs text-muted-foreground">Conselho / Registro</p>
                  <p className="font-medium">{selectedProf.conselho} - {selectedProf.registro_profissional}</p>
                  {selectedProf.uf_registro && <p className="text-xs text-muted-foreground">UF: {selectedProf.uf_registro}</p>}
                </div>
                <div className="p-3 bg-card border rounded-lg">
                  <p className="text-xs text-muted-foreground">Validade do Registro</p>
                  <p className="font-medium">
                    {selectedProf.registro_validade
                      ? format(new Date(selectedProf.registro_validade), "dd/MM/yyyy")
                      : "Não informada"}
                  </p>
                  {selectedProf.registro_validade && new Date(selectedProf.registro_validade) < new Date() && (
                    <Badge variant="destructive" className="text-[10px] mt-1">Vencido!</Badge>
                  )}
                </div>
                <div className="p-3 bg-card border rounded-lg">
                  <p className="text-xs text-muted-foreground">CPF/CNPJ</p>
                  <p className="font-medium">{selectedProf.cpf_cnpj || "Não informado"}</p>
                </div>
                <div className="p-3 bg-card border rounded-lg">
                  <p className="text-xs text-muted-foreground">Localização</p>
                  <p className="font-medium">{[selectedProf.cidade, selectedProf.estado].filter(Boolean).join(", ") || "Não informada"}</p>
                </div>
              </div>

              {selectedProf.formacao_academica && (
                <div className="p-3 bg-card border rounded-lg text-sm">
                  <p className="text-xs text-muted-foreground">Formação Acadêmica</p>
                  <p className="font-medium">{selectedProf.formacao_academica}</p>
                </div>
              )}

              {selectedProf.bio && (
                <div className="p-3 bg-card border rounded-lg text-sm">
                  <p className="text-xs text-muted-foreground">Bio</p>
                  <p>{selectedProf.bio}</p>
                </div>
              )}

              {selectedProf.especialidades && selectedProf.especialidades.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedProf.especialidades.map((e, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{e}</Badge>
                  ))}
                </div>
              )}

              {/* Documents */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Documentos Enviados
                </h4>
                {loadingDocs ? (
                  <p className="text-xs text-muted-foreground">Carregando documentos...</p>
                ) : docs.length === 0 ? (
                  <div className="p-3 bg-destructive/10 rounded-lg flex items-center gap-2 text-xs text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Nenhum documento encontrado — cadastro pode estar incompleto
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {docs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          {doc.mime_type?.startsWith("image/") ? (
                            <Image className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">
                              {categoriaLabels[doc.categoria] || doc.categoria}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">{doc.nome_arquivo}</p>
                          </div>
                        </div>
                        <a
                          href={doc.arquivo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-xs flex items-center gap-1 shrink-0"
                        >
                          <ExternalLink className="h-3 w-3" /> Ver
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              {!showRejeitar ? (
                <div className="flex gap-2">
                  <Button
                    onClick={handleAprovar}
                    disabled={actionLoading}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    {actionLoading ? "Aprovando..." : "Aprovar Profissional"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowRejeitar(true)}
                    disabled={actionLoading}
                    className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <XCircle className="h-4 w-4 mr-1.5" />
                    Rejeitar
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 p-3 bg-destructive/5 border border-destructive/20 rounded-xl">
                  <Label className="text-destructive text-sm font-medium">Motivo da rejeição *</Label>
                  <Textarea
                    value={motivoRejeicao}
                    onChange={(e) => setMotivoRejeicao(e.target.value)}
                    rows={3}
                    placeholder="Explique o motivo da rejeição (ex: documento ilegível, registro não confere...)"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleRejeitar}
                      disabled={actionLoading || !motivoRejeicao.trim()}
                      variant="destructive"
                      className="flex-1"
                    >
                      {actionLoading ? "Rejeitando..." : "Confirmar Rejeição"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setShowRejeitar(false); setMotivoRejeicao(""); }}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
