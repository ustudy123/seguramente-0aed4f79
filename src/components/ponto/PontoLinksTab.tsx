import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link2, Copy, Send, ToggleLeft, ToggleRight, Search, Plus, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { useColaboradores } from "@/hooks/useColaboradores";
import { useToast } from "@/hooks/use-toast";

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "").substring(0, 16);
}

function getPontoExternoUrl(token: string): string {
  const customDomain = "https://youreyes.com.br";
  // Se estiver em desenvolvimento/preview, mantém o origin atual, senão usa o novo domínio
  const baseUrl = window.location.hostname.includes("lovable.app") || window.location.hostname === "localhost"
    ? window.location.origin 
    : customDomain;
    
  return `${baseUrl}/ponto-externo/${token}`;
}

export function PontoLinksTab() {
  const { tenantId } = useAuth();
  const { colaboradores } = useColaboradores();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  // Fetch existing links
  const { data: links = [], isLoading } = useQuery({
    queryKey: ["ponto-links", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("ponto_links" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!tenantId,
  });

  // Map of CPF -> link
  const linksByCpf = useMemo(() => {
    const map: Record<string, any> = {};
    links.forEach((l: any) => { map[l.colaborador_cpf] = l; });
    return map;
  }, [links]);

  // Filtered collaborators
  const filtered = useMemo(() => {
    if (!search) return colaboradores;
    const s = search.toLowerCase();
    return colaboradores.filter(c =>
      c.nome_completo.toLowerCase().includes(s) ||
      c.cpf.includes(s) ||
      (c.cargo && c.cargo.toLowerCase().includes(s))
    );
  }, [colaboradores, search]);

  // Generate link mutation
  const gerarLink = useMutation({
    mutationFn: async (colab: { id: string; nome_completo: string; cpf: string }) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const token = generateToken();
      const { error } = await supabase.from("ponto_links" as any).insert({
        tenant_id: tenantId,
        colaborador_id: colab.id,
        colaborador_nome: colab.nome_completo,
        colaborador_cpf: colab.cpf,
        token,
        ativo: true,
      } as any);
      if (error) throw error;
      return token;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-links"] });
      toast({ title: "Link gerado com sucesso!" });
    },
    onError: (e: any) => toast({ title: "Erro ao gerar link", description: e.message, variant: "destructive" }),
  });

  // Toggle active mutation
  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("ponto_links" as any).update({ ativo } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-links"] });
      toast({ title: "Status atualizado!" });
    },
  });

  // Batch generate
  const gerarEmLote = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const semLink = colaboradores.filter(c => !linksByCpf[c.cpf]);
      if (semLink.length === 0) throw new Error("Todos os colaboradores já possuem link");
      const inserts = semLink.map(c => ({
        tenant_id: tenantId,
        colaborador_id: c.id,
        colaborador_nome: c.nome_completo,
        colaborador_cpf: c.cpf,
        token: generateToken(),
        ativo: true,
      }));
      const { error } = await supabase.from("ponto_links" as any).insert(inserts as any);
      if (error) throw error;
      return semLink.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["ponto-links"] });
      toast({ title: `${count} links gerados com sucesso!` });
    },
    onError: (e: any) => toast({ title: "Erro ao gerar links", description: e.message, variant: "destructive" }),
  });

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(getPontoExternoUrl(token));
    toast({ title: "Link copiado!" });
  };

  const sendWhatsApp = (telefone: string | null, nome: string, token: string) => {
    const url = getPontoExternoUrl(token);
    const msg = encodeURIComponent(`Olá ${nome}! 👋\n\nAcesse seu link de registro de ponto:\n${url}\n\nUse este link para registrar entrada, saída e intervalos.`);
    const phone = telefone?.replace(/\D/g, "") || "";
    window.open(`https://wa.me/${phone.startsWith("55") ? phone : "55" + phone}?text=${msg}`, "_blank");
  };

  const semLink = colaboradores.filter(c => !linksByCpf[c.cpf]).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total de Links</p>
                <p className="text-2xl font-bold">{links.length}</p>
              </div>
              <Link2 className="w-8 h-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Links Ativos</p>
                <p className="text-2xl font-bold text-emerald-600">{links.filter((l: any) => l.ativo).length}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Sem Link</p>
                <p className="text-2xl font-bold text-amber-600">{semLink}</p>
              </div>
              <Plus className="w-8 h-8 text-amber-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar colaborador..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => gerarEmLote.mutate()} disabled={gerarEmLote.isPending || semLink === 0} variant="outline">
          {gerarEmLote.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          Gerar Links em Lote ({semLink})
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Colaborador</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum colaborador encontrado.</TableCell></TableRow>
              ) : filtered.map(colab => {
                const link = linksByCpf[colab.cpf];
                return (
                  <TableRow key={colab.id}>
                    <TableCell className="font-medium">{colab.nome_completo}</TableCell>
                    <TableCell className="font-mono text-xs">{colab.cpf}</TableCell>
                    <TableCell className="text-sm">{colab.cargo || "-"}</TableCell>
                    <TableCell className="text-center">
                      {link ? (
                        <Badge variant={link.ativo ? "default" : "secondary"}>
                          {link.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Sem link</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        {link ? (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Copiar link" onClick={() => copyLink(link.token)}>
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Enviar via WhatsApp"
                              onClick={() => sendWhatsApp(colab.celular, colab.nome_completo, link.token)}>
                              <Send className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Abrir link"
                              onClick={() => window.open(getPontoExternoUrl(link.token), "_blank")}>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8"
                              title={link.ativo ? "Desativar" : "Ativar"}
                              onClick={() => toggleAtivo.mutate({ id: link.id, ativo: !link.ativo })}>
                              {link.ativo ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" className="text-xs h-7"
                            disabled={gerarLink.isPending}
                            onClick={() => gerarLink.mutate({ id: colab.id, nome_completo: colab.nome_completo, cpf: colab.cpf })}>
                            {gerarLink.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
                            Gerar Link
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
    </motion.div>
  );
}
