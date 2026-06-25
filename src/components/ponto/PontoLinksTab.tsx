import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link2, Copy, Send, ToggleLeft, ToggleRight, Loader2, ExternalLink, RefreshCw, ShieldCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { useToast } from "@/hooks/use-toast";
import { confirm } from "@/components/ui/confirm-dialog";

const SENTINELA_COLAB_ID = "00000000-0000-0000-0000-000000000000";

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "").substring(0, 16);
}

function getPontoExternoUrl(token: string): string {
  const customDomain = "https://youreyes.com.br";
  const baseUrl =
    window.location.hostname.includes("lovable.app") || window.location.hostname === "localhost"
      ? window.location.origin
      : customDomain;
  return `${baseUrl}/ponto-externo/${token}`;
}

export function PontoLinksTab() {
  const { tenantId } = useAuth();
  const { empresaAtivaId, empresaAtiva } = useEmpresaAtiva();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const empresaNome = empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social || "";

  // Link compartilhado (um por empresa do seletor)
  const { data: link, isLoading } = useQuery({
    queryKey: ["ponto-link-compartilhado", tenantId, empresaAtivaId],
    queryFn: async () => {
      if (!tenantId || !empresaAtivaId) return null;
      const { data, error } = await supabase
        .from("ponto_links" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("empresa_id", empresaAtivaId)
        .eq("tipo", "compartilhado")
        .maybeSingle();
      if (error) throw error;
      return (data || null) as any;
    },
    enabled: !!tenantId && !!empresaAtivaId,
  });

  const gerarLink = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      if (!empresaAtivaId) throw new Error("Selecione uma empresa no seletor.");
      const { error } = await supabase.from("ponto_links" as any).insert({
        tenant_id: tenantId,
        empresa_id: empresaAtivaId,
        tipo: "compartilhado",
        colaborador_id: SENTINELA_COLAB_ID,
        colaborador_nome: "Link compartilhado",
        colaborador_cpf: "",
        token: generateToken(),
        ativo: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-link-compartilhado"] });
      toast({ title: "Link compartilhado gerado!" });
    },
    onError: (e: any) => toast({ title: "Erro ao gerar link", description: e.message, variant: "destructive" }),
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("ponto_links" as any).update({ ativo } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-link-compartilhado"] });
      toast({ title: "Status atualizado!" });
    },
  });

  const regerar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ponto_links" as any)
        .update({ token: generateToken(), ativo: true } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-link-compartilhado"] });
      toast({ title: "Novo link gerado!", description: "O link anterior deixou de funcionar." });
    },
    onError: (e: any) => toast({ title: "Erro ao regerar", description: e.message, variant: "destructive" }),
  });

  const url = link ? getPontoExternoUrl(link.token) : "";

  const copyLink = () => {
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!" });
  };

  const sendWhatsApp = () => {
    const msg = encodeURIComponent(
      `Olá! 👋\n\nRegistre seu ponto pelo link da empresa:\n${url}\n\nBasta informar o seu CPF e tirar a selfie para registrar entrada e saída.`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const handleRegerar = async (id: string) => {
    const ok = await confirm({
      title: "Gerar um novo link?",
      description:
        "O link atual deixará de funcionar e os atalhos (PWA) já instalados precisarão ser reinstalados com o novo link. Use isto se o link vazou.",
      confirmLabel: "Gerar novo link",
      variant: "destructive",
    });
    if (ok) {
      setBusy(true);
      try {
        await regerar.mutateAsync(id);
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" /> Link de ponto compartilhado
        </h3>
        <p className="text-sm text-muted-foreground">
          Um link por empresa{empresaNome ? <> — <strong>{empresaNome}</strong></> : ""}. O colaborador informa o <strong>CPF</strong> e tira a <strong>selfie</strong> para registrar.
        </p>
      </div>

      {!empresaAtivaId ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <Link2 className="w-10 h-10 text-muted-foreground/50 mx-auto" />
            <p className="font-medium">Selecione uma empresa</p>
            <p className="text-sm text-muted-foreground">Escolha a empresa no seletor do topo para gerar/ver o link de ponto dela.</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card><CardContent className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></CardContent></Card>
      ) : !link ? (
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <Link2 className="w-10 h-10 text-muted-foreground/50 mx-auto" />
            <div>
              <p className="font-medium">Nenhum link compartilhado ainda</p>
              <p className="text-sm text-muted-foreground">Gere um link único para distribuir a todos os colaboradores.</p>
            </div>
            <Button onClick={() => gerarLink.mutate()} disabled={gerarLink.isPending}>
              {gerarLink.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Gerar link compartilhado
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between gap-2">
              <span className="truncate">Link de {empresaNome || "empresa"}</span>
              <Badge variant={link.ativo ? "default" : "secondary"}>{link.ativo ? "Ativo" : "Inativo"}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2.5">
              <code className="text-xs sm:text-sm break-all flex-1">{url}</code>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copyLink}><Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar</Button>
              <Button variant="outline" size="sm" onClick={sendWhatsApp}><Send className="w-3.5 h-3.5 mr-1.5" /> WhatsApp</Button>
              <Button variant="outline" size="sm" onClick={() => window.open(url, "_blank")}><ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir</Button>
              <Button variant="outline" size="sm" onClick={() => toggleAtivo.mutate({ id: link.id, ativo: !link.ativo })}>
                {link.ativo ? <ToggleRight className="w-4 h-4 mr-1.5 text-emerald-500" /> : <ToggleLeft className="w-4 h-4 mr-1.5" />}
                {link.ativo ? "Desativar" : "Ativar"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleRegerar(link.id)} disabled={busy}>
                {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                Gerar novo link
              </Button>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-sky-500/30 bg-sky-500/5 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <span>
                A identificação é por CPF e a <strong>selfie é obrigatória</strong> no registro — a foto é a prova de quem bateu o ponto.
                Geolocalização e horário são capturados automaticamente. Se o link vazar, use “Gerar novo link”.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Links antigos por colaborador (se existirem) continuam funcionando normalmente.
      </p>
    </motion.div>
  );
}
