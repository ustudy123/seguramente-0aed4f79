import { useState } from "react";
import { Search, Briefcase, ClipboardList, Brain, Shield, FileText, BookOpen, Loader2, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { ManualFuncaoModal } from "./ManualFuncaoModal";
import { toast } from "sonner";
import { arquivarDocumento } from "@/utils/arquivarDocumento";

interface Cargo {
  id: string;
  nome: string;
  nivel: string | null;
  departamento_id: string | null;
  descricao: string | null;
  departamento?: { id: string; nome: string } | null;
}

interface FuncaoListProps {
  cargos: Cargo[];
  isLoading: boolean;
  onSelect: (id: string) => void;
}

export function FuncaoList({ cargos, isLoading, onSelect }: FuncaoListProps) {
  const [search, setSearch] = useState("");
  const { tenantId, user, profile } = useAuth();
  const { empresaAtivaId } = useEmpresaAtiva();
  const [manualHtml, setManualHtml] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTitulo, setManualTitulo] = useState("");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [currentManualRef, setCurrentManualRef] = useState<string | null>(null);

  // Load cached manuals
  const { data: cachedManuais = [], refetch: refetchManuais } = useQuery({
    queryKey: ["manuais_gerados", tenantId, "funcao"],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await fromTable("manuais_gerados")
        .select("id, tipo, referencia_id, titulo, html, created_at")
        .eq("tenant_id", tenantId)
        .in("tipo", ["funcao", "funcao_global"])
        .order("created_at", { ascending: false }) as { data: any[] | null };
      return data || [];
    },
    enabled: !!tenantId,
  });

  const getCachedManual = (tipo: string, refId?: string) => {
    return cachedManuais.find(
      (m: any) => m.tipo === tipo && (refId ? m.referencia_id === refId : !m.referencia_id)
    );
  };

  // Count activities and competencies per cargo
  const { data: atividadeCounts = {} } = useQuery({
    queryKey: ["funcao_atividades_count", tenantId],
    queryFn: async () => {
      if (!tenantId) return {};
      const { data, error } = await fromTable("funcao_atividades")
        .select("cargo_id")
        .eq("tenant_id", tenantId) as { data: { cargo_id: string }[] | null; error: Error | null };
      if (error) return {};
      const counts: Record<string, number> = {};
      (data || []).forEach((d) => { counts[d.cargo_id] = (counts[d.cargo_id] || 0) + 1; });
      return counts;
    },
    enabled: !!tenantId,
  });

  const { data: competenciaCounts = {} } = useQuery({
    queryKey: ["funcao_competencias_count", tenantId],
    queryFn: async () => {
      if (!tenantId) return {};
      const { data, error } = await fromTable("funcao_competencias")
        .select("cargo_id")
        .eq("tenant_id", tenantId) as { data: { cargo_id: string }[] | null; error: Error | null };
      if (error) return {};
      const counts: Record<string, number> = {};
      (data || []).forEach((d) => { counts[d.cargo_id] = (counts[d.cargo_id] || 0) + 1; });
      return counts;
    },
    enabled: !!tenantId,
  });

  const { data: epiCounts = {} } = useQuery({
    queryKey: ["funcao_epi_count", tenantId],
    queryFn: async () => {
      if (!tenantId) return {};
      const { data, error } = await fromTable("funcao_epi_vinculacoes")
        .select("cargo_id")
        .eq("tenant_id", tenantId) as { data: { cargo_id: string }[] | null; error: Error | null };
      if (error) return {};
      const counts: Record<string, number> = {};
      (data || []).forEach((d) => { counts[d.cargo_id] = (counts[d.cargo_id] || 0) + 1; });
      return counts;
    },
    enabled: !!tenantId,
  });

  const filtered = cargos.filter(
    (c) =>
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      (c.nivel || "").toLowerCase().includes(search.toLowerCase())
  );

  const nivelLabel: Record<string, string> = {
    operacional: "Operacional",
    tatico: "Tático",
    estrategico: "Estratégico",
  };

  const nivelColor: Record<string, string> = {
    operacional: "bg-blue-100 text-blue-800",
    tatico: "bg-amber-100 text-amber-800",
    estrategico: "bg-purple-100 text-purple-800",
  };

  const saveManualCache = async (tipo: string, refId: string | null, titulo: string, html: string) => {
    if (!tenantId || !user) return;
    try {
      // Upsert: delete old and insert new
      await fromTable("manuais_gerados")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("tipo", tipo)
        .eq("referencia_id", refId || "");

      await fromTable("manuais_gerados").insert({
        tenant_id: tenantId,
        empresa_id: empresaAtivaId || null,
        tipo,
        referencia_id: refId || null,
        titulo,
        html,
        gerado_por: user.id,
        gerado_por_nome: profile?.nome_completo || "",
      } as any);

      refetchManuais();
    } catch (err) {
      console.error("Erro ao salvar cache do manual:", err);
    }
  };

  const archiveManual = async (html: string, titulo: string) => {
    if (!tenantId || !user) return;
    try {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const safeTitulo = titulo.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").substring(0, 50);
      const fileName = `${safeTitulo}-${Date.now()}.html`;

      await arquivarDocumento({
        tenantId,
        empresaId: empresaAtivaId,
        userId: user.id,
        userNome: profile?.nome_completo || "",
        file: blob,
        fileName,
        mimeType: "text/html",
        tipo: "Manual de Função",
        observacoes: `Manual gerado por IA: ${titulo}`,
        pastaCategoria: null,
      });
    } catch (err) {
      console.error("Erro ao arquivar manual:", err);
    }
  };

  const gerarManual = async (cargoIds: string[] | null, titulo: string) => {
    try {
      setManualHtml("");
      setManualLoading(true);
      setManualOpen(true);
      setManualTitulo(titulo);

      const { data, error } = await supabase.functions.invoke("ai-manual-funcao", {
        body: { cargo_ids: cargoIds, tenantId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const html = data.html || "";
      setManualHtml(html);

      // Save to cache and archive
      const tipo = cargoIds ? "funcao" : "funcao_global";
      const refId = cargoIds ? cargoIds[0] : null;
      setCurrentManualRef(refId);

      await saveManualCache(tipo, refId, titulo, html);
      await archiveManual(html, titulo);

      toast.success("Manual gerado e arquivado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar manual");
      setManualOpen(false);
    } finally {
      setManualLoading(false);
      setGeneratingId(null);
    }
  };

  const handleGerarPorFuncao = (e: React.MouseEvent, cargo: Cargo) => {
    e.stopPropagation();
    setGeneratingId(cargo.id);
    gerarManual([cargo.id], `Manual: ${cargo.nome}`);
  };

  const handleGerarGlobal = () => {
    setGeneratingId("global");
    gerarManual(null, "Manual Global de Funções");
  };

  const handleVisualizarCached = (e: React.MouseEvent, cached: any) => {
    e.stopPropagation();
    setManualHtml(cached.html);
    setManualTitulo(cached.titulo);
    setManualOpen(true);
    setCurrentManualRef(cached.referencia_id);
  };

  const handlePdfArchive = async (blob: Blob, filename: string) => {
    if (!tenantId || !user) return;
    try {
      await arquivarDocumento({
        tenantId,
        empresaId: empresaAtivaId,
        userId: user.id,
        userNome: profile?.nome_completo || "",
        file: blob,
        fileName: filename,
        mimeType: "application/pdf",
        tipo: "Manual de Função (PDF)",
        observacoes: `PDF do manual: ${manualTitulo}`,
        pastaCategoria: null,
      });
      toast.success("PDF arquivado no módulo Documentos!");
    } catch (err) {
      console.error("Erro ao arquivar PDF:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    );
  }

  const globalCached = getCachedManual("funcao_global");

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar funções..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {globalCached && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => handleVisualizarCached(e, globalCached)}
              className="whitespace-nowrap gap-1.5 w-full sm:w-auto"
            >
              <Eye className="w-4 h-4" />
              Ver Manual Global
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleGerarGlobal}
            disabled={!!generatingId || cargos.length === 0}
            className="whitespace-nowrap gap-1.5 w-full sm:w-auto"
          >
            {generatingId === "global" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <BookOpen className="w-4 h-4" />
            )}
            {globalCached ? "Regerar Manual Global" : "Gerar Manual Global"}
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma função cadastrada.</p>
          <p className="text-sm">Cadastre funções em Cadastros → Funções para começar.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((cargo) => {
            const cached = getCachedManual("funcao", cargo.id);
            return (
              <Card
                key={cargo.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => onSelect(cargo.id)}
              >
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{cargo.nome}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {cargo.departamento?.nome && (
                          <span className="text-xs text-muted-foreground font-normal">
                            {cargo.departamento.nome}
                          </span>
                        )}
                        {cargo.departamento?.nome && cargo.nivel && (
                          <span className="text-xs text-muted-foreground/40">•</span>
                        )}
                        {cargo.nivel && (
                          <Badge variant="secondary" className={`text-xs ${nivelColor[cargo.nivel] || ""}`}>
                            {nivelLabel[cargo.nivel] || cargo.nivel}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground w-full sm:w-auto justify-between sm:justify-end">
                    <span className="flex items-center gap-1" title="Atividades">
                      <ClipboardList className="w-3.5 h-3.5" />
                      {atividadeCounts[cargo.id] || 0}
                    </span>
                    <span className="flex items-center gap-1" title="Competências">
                      <Brain className="w-3.5 h-3.5" />
                      {competenciaCounts[cargo.id] || 0}
                    </span>
                    <span className="flex items-center gap-1" title="EPIs">
                      <Shield className="w-3.5 h-3.5" />
                      {epiCounts[cargo.id] || 0}
                    </span>
                    {cached && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 w-full sm:w-auto"
                        onClick={(e) => handleVisualizarCached(e, cached)}
                      >
                        <Eye className="w-4 h-4" />
                        Ver Manual
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 w-full sm:w-auto"
                      disabled={!!generatingId}
                      onClick={(e) => handleGerarPorFuncao(e, cargo)}
                    >
                      {generatingId === cargo.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                      {cached ? "Regerar" : "Gerar Manual"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ManualFuncaoModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        html={manualHtml}
        loading={manualLoading}
        titulo={manualTitulo}
        onPdfGenerated={handlePdfArchive}
      />
    </div>
  );
}
