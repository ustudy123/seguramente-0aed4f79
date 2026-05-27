import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Copy,
  ExternalLink,
  Plus,
  Search,
  Trash2,
  Ban,
  Loader2,
  MessageSquare,
  Mic,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { confirm } from "@/components/ui/confirm-dialog";
import {
  useEntrevistasCampanha,
  useCancelarEntrevista,
  useExcluirEntrevista,
} from "@/hooks/useEntrevistasCampanha";
import { useGerarEntrevista } from "@/hooks/useGerarEntrevista";
import { useColaboradores } from "@/hooks/useColaboradores";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useQueryClient } from "@tanstack/react-query";
import { gerarLinksEntrevistaColaboradores } from "@/utils/gerarLinksEntrevistaColaboradores";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campanhaId: string | null;
  campanhaNome?: string;
}

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  em_andamento: { label: "Em andamento", variant: "default" },
  concluida: { label: "Concluída", variant: "outline" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

export function EntrevistasManagerModal({ open, onOpenChange, campanhaId, campanhaNome }: Props) {
  const { data: entrevistas = [], isLoading } = useEntrevistasCampanha(campanhaId);
  const gerar = useGerarEntrevista();
  const cancelar = useCancelarEntrevista();
  const excluir = useExcluirEntrevista();
  const { colaboradores } = useColaboradores();
  const { empresaAtiva, empresaAtivaId } = useEmpresaAtiva();
  const { user } = useAuthContext();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [gerandoDoc, setGerandoDoc] = useState(false);

  const PROD_URL = "https://www.youreyes.com.br";
  const linkOf = (token: string) => `${PROD_URL}/entrevista/${token}`;

  const filtradas = useMemo(() => {
    return entrevistas.filter((e) => {
      if (filtroStatus !== "todos" && e.status !== filtroStatus) return false;
      if (!busca.trim()) return true;
      const q = busca.toLowerCase();
      return (
        e.token.toLowerCase().includes(q) ||
        (e.colaborador_nome || "").toLowerCase().includes(q)
      );
    });
  }, [entrevistas, busca, filtroStatus]);

  const copiar = async (token: string) => {
    try {
      await navigator.clipboard.writeText(linkOf(token));
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleGerarDocumentoColaboradores = async () => {
    if (!campanhaId) return;
    if (!user) {
      toast.error("Não autenticado");
      return;
    }
    if (!colaboradores || colaboradores.length === 0) {
      toast.error("Nenhum colaborador encontrado para a empresa ativa");
      return;
    }

    setGerandoDoc(true);
    try {
      const tenantRes = await fromTable("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();
      const tenantId = (tenantRes.data as any)?.tenant_id;
      if (!tenantId) throw new Error("Tenant não encontrado");

      // Mapa de entrevistas pendentes já existentes por colaborador
      const pendentePorColab = new Map<string, string>();
      for (const e of entrevistas) {
        if (e.status === "pendente" && (e as any).colaborador_id) {
          pendentePorColab.set((e as any).colaborador_id, e.token);
        }
      }

      const itens: Array<{ nome: string; cpf?: string | null; cargo?: string | null; link: string }> = [];
      const novas: any[] = [];

      for (const c of colaboradores) {
        const existente = pendentePorColab.get(c.id);
        if (existente) {
          itens.push({ nome: c.nome_completo, cpf: c.cpf, cargo: c.cargo, link: linkOf(existente) });
          continue;
        }
        const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        novas.push({
          tenant_id: tenantId,
          empresa_id: empresaAtivaId || null,
          campanha_id: campanhaId,
          token,
          modalidade: "texto",
          status: "pendente",
          colaborador_id: c.id,
          colaborador_nome: c.nome_completo,
        });
        itens.push({ nome: c.nome_completo, cpf: c.cpf, cargo: c.cargo, link: linkOf(token) });
      }

      if (novas.length > 0) {
        const { error } = await fromTable("psicossocial_entrevistas").insert(novas as any);
        if (error) throw error;
      }

      await gerarLinksEntrevistaColaboradores({
        empresaNome:
          (empresaAtiva as any)?.razao_social ||
          (empresaAtiva as any)?.nome_fantasia ||
          "Empresa",
        empresaCnpj: (empresaAtiva as any)?.cnpj || "",
        campanhaNome: campanhaNome || "Campanha",
        itens,
      });

      qc.invalidateQueries({ queryKey: ["psicossocial-entrevistas", campanhaId] });
      toast.success(
        `Documento gerado com ${itens.length} link(s) — ${novas.length} novo(s) criado(s).`
      );
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Falha ao gerar documento");
    } finally {
      setGerandoDoc(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Links de Entrevista Guiada</DialogTitle>
          <DialogDescription>
            {campanhaNome
              ? `Gerencie os links gerados para a campanha "${campanhaNome}".`
              : "Gerencie os links gerados para esta campanha."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por token ou nome..."
              className="pl-8"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {["todos", "pendente", "em_andamento", "concluida", "cancelada"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={filtroStatus === s ? "default" : "outline"}
                onClick={() => setFiltroStatus(s)}
              >
                {s === "todos" ? "Todos" : STATUS_META[s]?.label || s}
              </Button>
            ))}
          </div>
          <Button
            size="sm"
            disabled={!campanhaId || gerar.isPending}
            onClick={() => campanhaId && gerar.mutate({ campanhaId })}
          >
            {gerar.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-1" />
            )}
            Novo link
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto border rounded-md">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : filtradas.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum link encontrado. Clique em "Novo link" para gerar.
            </div>
          ) : (
            <div className="divide-y">
              {filtradas.map((e) => {
                const meta = STATUS_META[e.status] || { label: e.status, variant: "secondary" as const };
                const progresso =
                  e.total_riscos > 0 ? Math.round((e.riscos_cobertos / e.total_riscos) * 100) : 0;
                const podeCancelar = e.status === "pendente" || e.status === "em_andamento";
                return (
                  <div key={e.id} className="p-3 flex flex-col gap-2 hover:bg-muted/30">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                        <Badge variant="outline" className="gap-1">
                          {e.modalidade === "voz" ? (
                            <Mic className="h-3 w-3" />
                          ) : (
                            <MessageSquare className="h-3 w-3" />
                          )}
                          {e.modalidade === "voz" ? "Áudio" : "Texto"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Criado {format(parseISO(e.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                        {e.colaborador_nome && (
                          <span className="text-xs">• {e.colaborador_nome}</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => copiar(e.token)}>
                          <Copy className="h-4 w-4 mr-1" /> Copiar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(linkOf(e.token), "_blank")}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" /> Abrir
                        </Button>
                        {podeCancelar && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              const ok = await confirm({
                                title: "Cancelar link?",
                                description:
                                  "O link deixará de funcionar. Esta ação não pode ser desfeita.",
                                confirmLabel: "Cancelar link",
                                variant: "destructive",
                              });
                              if (ok) cancelar.mutate({ id: e.id, campanhaId: campanhaId! });
                            }}
                          >
                            <Ban className="h-4 w-4 mr-1" /> Cancelar
                          </Button>
                        )}
                        {(e.status === "pendente" || e.status === "cancelada") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={async () => {
                              const ok = await confirm({
                                title: "Excluir link?",
                                description:
                                  "O link e todas as suas mensagens serão removidos permanentemente.",
                                confirmLabel: "Excluir",
                                variant: "destructive",
                              });
                              if (ok) excluir.mutate({ id: e.id, campanhaId: campanhaId! });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <code className="px-2 py-1 rounded bg-muted truncate max-w-md">
                        {linkOf(e.token)}
                      </code>
                    </div>
                    {e.total_riscos > 0 && (
                      <div className="flex items-center gap-2">
                        <Progress value={progresso} className="h-1.5 flex-1 max-w-xs" />
                        <span className="text-xs text-muted-foreground">
                          {e.riscos_cobertos}/{e.total_riscos} temas
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
