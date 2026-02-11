import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Lock } from "lucide-react";
import { useState } from "react";
import type { Ocorrencia } from "@/types/feedback";
import { TIPO_LABELS, TIPO_COLORS } from "@/types/feedback";

interface OcorrenciaListProps {
  ocorrencias: Ocorrencia[];
  isLoading: boolean;
}

export function OcorrenciaList({ ocorrencias, isLoading }: OcorrenciaListProps) {
  const [search, setSearch] = useState("");
  const filtered = ocorrencias.filter(
    (o) =>
      o.colaborador_nome.toLowerCase().includes(search.toLowerCase()) ||
      o.descricao.toLowerCase().includes(search.toLowerCase())
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
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ocorrência encontrada.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((oc, i) => (
            <motion.div
              key={oc.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`bg-card border rounded-xl p-4 space-y-2 ${oc.is_advertencia ? "border-destructive/40" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold flex items-center gap-2">
                    {oc.colaborador_nome}
                    {oc.bloqueado && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {oc.colaborador_cargo} · {oc.colaborador_departamento || "—"} · {oc.colaborador_filial || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {oc.is_advertencia && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="w-3 h-3" /> Advertência
                    </Badge>
                  )}
                  <Badge className={TIPO_COLORS[oc.tipo]}>{TIPO_LABELS[oc.tipo]}</Badge>
                </div>
              </div>
              <p className="text-sm">{oc.descricao}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Por: {oc.registrado_por_nome}</span>
                <span>{format(new Date(oc.data_ocorrencia), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
