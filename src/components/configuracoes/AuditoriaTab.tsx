import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ClipboardList, Search, Filter, UserPlus, Pencil, Trash2, RefreshCw, Shield, FileText, Settings, Activity,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2 } from "lucide-react";

interface AuditLog {
  id: string;
  user_name: string | null;
  user_email: string | null;
  action: string;
  module: string;
  description: string | null;
  target_type: string | null;
  target_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const MODULE_LABELS: Record<string, string> = {
  equipe: "Equipe",
  admissoes: "Admissões",
  atestados: "Atestados",
  configuracoes: "Configurações",
  ponto: "Ponto",
  ferias: "Férias",
  beneficios: "Benefícios",
  sst: "SST",
  trilhas: "Trilhas",
  avaliacoes: "Avaliações",
};

const MODULE_COLORS: Record<string, string> = {
  equipe: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  admissoes: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  atestados: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  configuracoes: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

const ACTION_ICONS: Record<string, typeof UserPlus> = {
  "user.created": UserPlus,
  "user.invited": UserPlus,
  "user.role_updated": Pencil,
  "user.removed": Trash2,
  "user.invite_resent": RefreshCw,
};

export function AuditoriaTab() {
  const { tenantId } = useTenant();
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [limit, setLimit] = useState(50);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", tenantId, moduleFilter, limit],
    queryFn: async (): Promise<AuditLog[]> => {
      let query = supabase
        .from("audit_logs")
        .select("id, user_name, user_email, action, module, description, target_type, target_name, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (moduleFilter !== "all") {
        query = query.eq("module", moduleFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AuditLog[];
    },
    enabled: !!tenantId,
  });

  const filteredLogs = search.trim()
    ? logs.filter(
        (l) =>
          l.description?.toLowerCase().includes(search.toLowerCase()) ||
          l.user_name?.toLowerCase().includes(search.toLowerCase()) ||
          l.target_name?.toLowerCase().includes(search.toLowerCase()) ||
          l.action.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" /> Logs de Auditoria
        </CardTitle>
        <CardDescription>Histórico de ações realizadas no sistema</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por ação, usuário ou alvo..."
              className="pl-9"
            />
          </div>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Módulo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os módulos</SelectItem>
              {Object.entries(MODULE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Timeline */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum registro de auditoria encontrado.</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-1">
              {filteredLogs.map((log) => {
                const Icon = ACTION_ICONS[log.action] || FileText;
                const moduleColor = MODULE_COLORS[log.module] || "bg-muted text-muted-foreground";

                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                  >
                    <div className="mt-0.5 p-1.5 rounded-md bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {log.description || log.action}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {log.user_name || log.user_email || "Sistema"}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${moduleColor}`}>
                          {MODULE_LABELS[log.module] || log.module}
                        </Badge>
                      </div>
                      {log.target_name && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Alvo: {log.target_name}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {filteredLogs.length >= limit && (
          <div className="text-center">
            <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + 50)}>
              Carregar mais
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
