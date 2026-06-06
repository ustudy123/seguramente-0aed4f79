import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, User, AlertTriangle, Trash2, Edit, ChevronRight } from "lucide-react";
import type { Terceiro } from "@/types/terceiros";
import { format } from "date-fns";
import { formatCnpj } from "@/lib/brasilapi";
import { formatCpf } from "@/lib/cpf";

const statusMap: Record<string, { label: string; class: string }> = {
  liberado: { label: "Liberado", class: "bg-green-100 text-green-800" },
  restrito: { label: "Restrito", class: "bg-yellow-100 text-yellow-800" },
  bloqueado: { label: "Bloqueado", class: "bg-red-100 text-red-800" },
};

const acessoMap: Record<string, string> = {
  eventual: "Eventual",
  recorrente: "Recorrente",
  continuo: "Contínuo",
};

interface Props {
  terceiros: Terceiro[];
  onSelect: (t: Terceiro) => void;
  onEdit: (t: Terceiro) => void;
  onDelete: (id: string) => void;
}

export function TerceiroList({ terceiros, onSelect, onEdit, onDelete }: Props) {
  if (terceiros.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p className="text-lg font-medium">Nenhum terceiro cadastrado</p>
        <p className="text-sm">Clique em "Novo Terceiro" para começar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {terceiros.map((t) => {
        const st = statusMap[t.status] || statusMap.liberado;
        const isCpf = t.cnpj?.length === 11;
        return (
          <Card key={t.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onSelect(t)}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-muted">
                {isCpf ? <User className="w-5 h-5 text-primary" /> : <Building2 className="w-5 h-5 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{t.razao_social}</h3>
                  <Badge className={st.class}>{st.label}</Badge>
                  {t.atividade_risco && (
                    <Badge variant="destructive" className="gap-1 text-xs">
                      <AlertTriangle className="w-3 h-3" /> Risco
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                  <span>CNPJ: {formatCnpj(t.cnpj)}</span>
                  <span>Acesso: {acessoMap[t.tipo_acesso]}</span>
                  {t.contrato_fim && (
                    <span>Contrato até {format(new Date(t.contrato_fim), "dd/MM/yyyy")}</span>
                  )}
                </div>
                {t.tipo_servico && t.tipo_servico.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {t.tipo_servico.map((s) => (
                      <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" onClick={() => onEdit(t)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(t.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
