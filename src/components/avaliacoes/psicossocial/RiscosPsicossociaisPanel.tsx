import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, Plus, Pencil, Trash2, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { confirm } from "@/components/ui/confirm-dialog";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

interface RiscoPsicossocial {
  id: string;
  tenant_id: string;
  nome: string;
  descricao: string | null;
  padrao: boolean;
  ativo: boolean;
  created_at: string;
}

export function RiscosPsicossociaisPanel() {
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<RiscoPsicossocial | null>(null);
  const [confirmDel, setConfirmDel] = useState<RiscoPsicossocial | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  const { data: riscos = [], isLoading } = useQuery({
    queryKey: ["psicossocial_riscos", tenantId],
    queryFn: async () => {
      const { data, error } = await fromTable("psicossocial_riscos")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("padrao", { ascending: false })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data || []) as RiscoPsicossocial[];
    },
    enabled: !!tenantId,
  });

  // Semeia os 13 riscos padrão na primeira visita (se a tabela estiver vazia
  // para o tenant).
  useEffect(() => {
    if (!tenantId || isLoading) return;
    if (riscos.length === 0) {
      (async () => {
        const { error } = await (supabase as any).rpc(
          "seed_psicossocial_riscos_padrao",
          { _tenant_id: tenantId },
        );
        if (!error) qc.invalidateQueries({ queryKey: ["psicossocial_riscos", tenantId] });
      })();
    }
  }, [tenantId, isLoading, riscos.length, qc]);

  const upsert = useMutation({
    mutationFn: async () => {
      const payload: any = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
      };
      if (editing) {
        const { error } = await fromTable("psicossocial_riscos")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await fromTable("psicossocial_riscos").insert({
          ...payload,
          tenant_id: tenantId!,
          padrao: false,
          ativo: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Risco atualizado." : "Risco adicionado.");
      qc.invalidateQueries({ queryKey: ["psicossocial_riscos", tenantId] });
      setOpenForm(false);
      setEditing(null);
      setNome("");
      setDescricao("");
    },
    onError: (e: any) => toast.error("Erro: " + (e?.message || "falha ao salvar")),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("psicossocial_riscos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Risco removido.");
      qc.invalidateQueries({ queryKey: ["psicossocial_riscos", tenantId] });
      setConfirmDel(null);
    },
    onError: (e: any) => toast.error("Erro: " + (e?.message || "falha ao remover")),
  });

  const handleNew = () => {
    setEditing(null);
    setNome("");
    setDescricao("");
    setOpenForm(true);
  };

  const handleEdit = (r: RiscoPsicossocial) => {
    setEditing(r);
    setNome(r.nome);
    setDescricao(r.descricao || "");
    setOpenForm(true);
  };

  const padraoCount = useMemo(() => riscos.filter((r) => r.padrao).length, [riscos]);
  const customCount = riscos.length - padraoCount;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Riscos Psicossociais
          </h2>
          <p className="text-sm text-muted-foreground">
            Catálogo de riscos psicossociais do tenant — {padraoCount} padrão · {customCount} personalizados
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Risco
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
        </div>
      ) : riscos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum risco encontrado. Os 13 padrões serão criados automaticamente.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {riscos.map((r) => (
            <motion.div
              key={r.id}
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Card className="h-full">
                <CardContent className="p-4 flex flex-col gap-2 h-full">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm leading-snug">{r.nome}</p>
                      {r.descricao && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                          {r.descricao}
                        </p>
                      )}
                    </div>
                    {r.padrao ? (
                      <Badge variant="secondary" className="gap-1 shrink-0">
                        <Sparkles className="h-3 w-3" /> Padrão
                      </Badge>
                    ) : (
                      <Badge className="bg-purple-600 text-white shrink-0">Personalizado</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-auto pt-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(r)}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmDel(r)}
                      title="Remover"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Form */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Risco" : "Novo Risco Psicossocial"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="risco-nome">Nome *</Label>
              <Input
                id="risco-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Falta de suporte no trabalho"
                maxLength={150}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="risco-desc">Descrição (opcional)</Label>
              <Textarea
                id="risco-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Contexto ou exemplos de manifestação no ambiente de trabalho."
                rows={4}
                maxLength={1000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => upsert.mutate()}
              disabled={!nome.trim() || upsert.isPending}
            >
              {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(o) => !o && setConfirmDel(null)}
        title="Remover risco?"
        description={`Tem certeza que deseja remover "${confirmDel?.nome}"? Esta ação não pode ser desfeita.`}
        confirmText="Remover"
        variant="destructive"
        onConfirm={() => confirmDel && del.mutate(confirmDel.id)}
      />
    </div>
  );
}
