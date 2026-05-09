import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { useSSTDocumentos } from "@/hooks/useSSTDocumentos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  ClipboardCheck, Loader2, FileText, Sparkles, Send, Eye, Trash2,
  AlertCircle, CheckCircle2, AlertTriangle, Copy, Search,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const PROD_URL = "https://YourEyes.app.br";

interface ColaboradorRow {
  id: string;
  nome_completo: string;
  cpf: string | null;
  cargo: string | null;
  departamento: string | null;
  status: string;
  empresa_id: string | null;
}

export function SSTOrdemServicoTab() {
  const { tenantId, profile } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const { documentos } = useSSTDocumentos();
  const { ordens, isLoading, gerar, salvar, enviarParaAssinatura, excluir } = useOrdensServico();

  const [search, setSearch] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [colabSelecionado, setColabSelecionado] = useState<ColaboradorRow | null>(null);
  const storageKey = `sst-os-resp:${tenantId || "_"}:${empresaAtivaId || "_"}`;
  const [respTecnico, setRespTecnico] = useState("");
  const [respRegistro, setRespRegistro] = useState("");

  // Persistência local por tenant/empresa — sobrevive a troca de abas
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const v = JSON.parse(raw);
        setRespTecnico(v.nome || "");
        setRespRegistro(v.registro || "");
      } else {
        setRespTecnico("");
        setRespRegistro("");
      }
    } catch {/* noop */}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!tenantId) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ nome: respTecnico, registro: respRegistro }));
    } catch {/* noop */}
  }, [respTecnico, respRegistro, storageKey, tenantId]);

  const pgrVigente = useMemo(
    () => documentos.find(d => d.tipo === "PGR" && d.status === "vigente" && d.analise_ia_status === "concluida"),
    [documentos]
  );

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["admissoes-os", tenantId, empresaAtivaId],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase
        .from("admissoes")
        .select("id, nome_completo, cpf, cargo, departamento, status, empresa_id")
        .eq("tenant_id", tenantId)
        .order("nome_completo");
      if (empresaAtivaId) q = q.eq("empresa_id", empresaAtivaId);
      const { data, error } = await q;
      if (error) throw error;
      return ((data || []) as ColaboradorRow[]).filter(c => c.status !== "desligado");
    },
    enabled: !!tenantId,
  });

  const filtrados = colaboradores.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.nome_completo?.toLowerCase().includes(s) ||
      c.cargo?.toLowerCase().includes(s) ||
      c.departamento?.toLowerCase().includes(s);
  });

  function statusOSDoColab(colabId: string) {
    const list = ordens.filter(o => o.colaborador_id === colabId);
    if (list.length === 0) return { label: "Pendente", variant: "destructive" as const, os: null };
    const os = list[0]; // mais recente
    const map: Record<string, { label: string; variant: any }> = {
      assinada: { label: "Vigente", variant: "default" },
      aguardando_assinatura: { label: "Aguardando", variant: "secondary" },
      rascunho: { label: "Rascunho", variant: "outline" },
      desatualizada: { label: "Desatualizada", variant: "destructive" },
      vencida: { label: "Vencida", variant: "destructive" },
      cancelada: { label: "Cancelada", variant: "outline" },
    };
    return { ...map[os.status], os };
  }

  async function handleGerar(c: ColaboradorRow) {
    if (!pgrVigente) {
      toast.error("Importe o PGR vigente antes de gerar a OS.");
      return;
    }
    setColabSelecionado(c);
    try {
      const data = await gerar.mutateAsync({
        colaborador_id: c.id,
        pgr_id: pgrVigente.id,
        responsavel_emissao_nome: profile?.nome_completo || undefined,
        responsavel_tecnico_nome: respTecnico || undefined,
        responsavel_tecnico_registro: respRegistro || undefined,
      });
      setPreviewData(data);
      setPreviewOpen(true);
    } catch (e: any) {
      toast.error("Erro ao gerar: " + e.message);
    }
  }

  async function handleSalvarRascunho() {
    if (!previewData || !colabSelecionado) return;
    await salvar.mutateAsync({
      colaborador_id: colabSelecionado.id,
      empresa_id: colabSelecionado.empresa_id,
      cargo_id: previewData.cargo_id,
      cargo_nome: previewData.cargo_nome,
      setor_nome: previewData.setor_nome,
      pgr_id: previewData.pgr_id,
      conteudo_html: previewData.conteudo_html,
      conteudo_json: previewData.conteudo_json,
      data_vigencia: previewData.data_vigencia,
      ano: previewData.ano,
      responsavel_emissao_nome: profile?.nome_completo || undefined,
      responsavel_tecnico_nome: respTecnico || undefined,
      responsavel_tecnico_registro: respRegistro || undefined,
      status: "rascunho",
    });
    setPreviewOpen(false);
  }

  async function handleSalvarEEnviar() {
    if (!previewData || !colabSelecionado) return;
    const novaOs = await salvar.mutateAsync({
      colaborador_id: colabSelecionado.id,
      empresa_id: colabSelecionado.empresa_id,
      cargo_id: previewData.cargo_id,
      cargo_nome: previewData.cargo_nome,
      setor_nome: previewData.setor_nome,
      pgr_id: previewData.pgr_id,
      conteudo_html: previewData.conteudo_html,
      conteudo_json: previewData.conteudo_json,
      data_vigencia: previewData.data_vigencia,
      ano: previewData.ano,
      responsavel_emissao_nome: profile?.nome_completo || undefined,
      responsavel_tecnico_nome: respTecnico || undefined,
      responsavel_tecnico_registro: respRegistro || undefined,
      status: "rascunho",
    });
    if (novaOs?.id) {
      const link = await enviarParaAssinatura.mutateAsync(novaOs.id);
      const url = `${PROD_URL}/os/${link.token}`;
      navigator.clipboard.writeText(url);
      toast.success("Link copiado! Envie ao colaborador.");
    }
    setPreviewOpen(false);
  }

  async function handleEnviarExistente(osId: string) {
    const link = await enviarParaAssinatura.mutateAsync(osId);
    const url = `${PROD_URL}/os/${link.token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado! Envie ao colaborador.");
  }

  return (
    <div className="space-y-4">
      {/* Aviso PGR */}
      {!pgrVigente && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
            <p className="text-sm">
              <b>PGR não disponível.</b> Para gerar Ordens de Serviço, importe o PGR vigente da empresa na aba <b>Importação IA</b> e aguarde a análise concluir.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            Ordem de Serviço — NR-1
          </h2>
          <p className="text-xs text-muted-foreground">
            Documento individual obrigatório, gerado a partir do PGR vigente. Item 1.4.1 "b" da NR-1 / art. 157 CLT.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{ordens.filter(o => o.status === "assinada").length} assinadas</Badge>
          <Badge variant="secondary">{colaboradores.length} colaboradores ativos</Badge>
        </div>
      </div>

      {/* Configuração responsável técnico */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Responsável Técnico (SESMT)</CardTitle>
          <CardDescription className="text-xs">Estes dados serão injetados em todas as OS geradas.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3 pt-0">
          <div>
            <Label className="text-xs">Nome do responsável técnico</Label>
            <Input value={respTecnico} onChange={e => setRespTecnico(e.target.value)} placeholder="Ex.: João Silva" />
          </div>
          <div>
            <Label className="text-xs">Registro profissional</Label>
            <Input value={respRegistro} onChange={e => setRespRegistro(e.target.value)} placeholder="Ex.: CREA SP-12345 / TST 56789" />
          </div>
        </CardContent>
      </Card>

      {/* Busca */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome, cargo ou setor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Lista */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Cargo / Setor</TableHead>
                <TableHead>Status OS</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin inline" /></TableCell></TableRow>
              ) : filtrados.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">Nenhum colaborador encontrado.</TableCell></TableRow>
              ) : filtrados.map(c => {
                const st = statusOSDoColab(c.id);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{c.nome_completo}</p>
                        <p className="text-xs text-muted-foreground">{c.cpf}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.cargo || "—"}<br/>
                      <span className="text-muted-foreground">{c.departamento || "—"}</span>
                    </TableCell>
                    <TableCell><Badge variant={st.variant} className="text-xs">{st.label}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {st.os?.data_vigencia ? format(new Date(st.os.data_vigencia), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {st.os && (
                          <Button size="sm" variant="ghost" onClick={() => { setPreviewData({ conteudo_html: st.os!.conteudo_html }); setPreviewOpen(true); }} title="Visualizar">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {st.os && st.os.status === "rascunho" && (
                          <Button size="sm" variant="ghost" onClick={() => handleEnviarExistente(st.os!.id)} title="Enviar para assinatura">
                            <Send className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {st.os && st.os.status === "aguardando_assinatura" && (
                          <Button size="sm" variant="ghost" onClick={() => handleEnviarExistente(st.os!.id)} title="Reenviar link">
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={st.os ? "outline" : "default"}
                          disabled={!pgrVigente || gerar.isPending}
                          onClick={() => handleGerar(c)}
                          title={st.os ? "Reemitir" : "Gerar OS"}
                        >
                          {gerar.isPending && colabSelecionado?.id === c.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <><Sparkles className="w-3.5 h-3.5 mr-1" /> {st.os ? "Reemitir" : "Gerar"}</>}
                        </Button>
                        {st.os && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Excluir"
                            onClick={async () => {
                              const ok = await confirm({
                                title: "Excluir Ordem de Serviço?",
                                description: "Esta ação não pode ser desfeita.",
                                confirmLabel: "Excluir",
                                variant: "destructive",
                              });
                              if (ok) await excluir.mutateAsync(st.os!.id);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pré-visualização da Ordem de Serviço</DialogTitle>
          </DialogHeader>
          <div
            className="prose prose-sm max-w-none border rounded p-4 bg-background"
            dangerouslySetInnerHTML={{ __html: previewData?.conteudo_html || "" }}
          />
          {colabSelecionado && previewData?.conteudo_json && (
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleSalvarRascunho} disabled={salvar.isPending}>
                {salvar.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                Salvar como rascunho
              </Button>
              <Button onClick={handleSalvarEEnviar} disabled={salvar.isPending}>
                <Send className="w-4 h-4 mr-2" />
                Salvar e enviar para assinatura
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
