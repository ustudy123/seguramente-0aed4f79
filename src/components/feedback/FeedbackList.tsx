import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Sparkles, FileCheck } from "lucide-react";
import { useState } from "react";
import type { Feedback } from "@/types/feedback";
import { CATEGORIA_LABELS, CATEGORIA_COLORS, CATEGORIA_ICONS } from "@/types/feedback";

interface FeedbackListProps {
  feedbacks: Feedback[];
  isLoading: boolean;
}

export function FeedbackList({ feedbacks, isLoading }: FeedbackListProps) {
  const [search, setSearch] = useState("");
  const filtered = feedbacks.filter(
    (f) =>
      f.colaborador_nome.toLowerCase().includes(search.toLowerCase()) ||
      f.descricao.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar por colaborador ou descrição..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum feedback encontrado.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((fb, i) => (
            <motion.div
              key={fb.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-card border rounded-xl p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{fb.colaborador_nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {fb.colaborador_cargo} · {fb.colaborador_departamento || "—"} · {fb.colaborador_filial || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {fb.ia_utilizada && <Sparkles className="w-4 h-4 text-purple-500" />}
                  <Badge className={CATEGORIA_COLORS[fb.categoria]}>
                    {CATEGORIA_ICONS[fb.categoria]} {CATEGORIA_LABELS[fb.categoria]}
                  </Badge>
                </div>
              </div>
              <p className="text-sm">{fb.descricao_ia || fb.descricao}</p>
              {fb.pdi_id && fb.pdi_titulo && (
                <div className="flex items-center gap-1.5 text-xs text-primary">
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Vinculado ao PDI: {fb.pdi_titulo}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Por: {fb.registrado_por_nome}</span>
                <span>{format(new Date(fb.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
