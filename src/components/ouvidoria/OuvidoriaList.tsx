import { useState, useMemo } from "react";
import { Search, Filter, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OuvidoriaCard } from "./OuvidoriaCard";
import type { Manifestacao, TipoManifestacao, StatusManifestacao } from "@/types/ouvidoria";

interface OuvidoriaListProps {
  manifestacoes: Manifestacao[];
  isLoading?: boolean;
  isManager?: boolean;
  onResponder?: (id: string, resposta: string) => Promise<void>;
  onAtualizarStatus?: (id: string, status: StatusManifestacao, prioridade?: any) => Promise<void>;
  onDeletar?: (id: string) => Promise<void>;
}

export function OuvidoriaList({
  manifestacoes,
  isLoading,
  isManager,
  onResponder,
  onAtualizarStatus,
  onDeletar,
}: OuvidoriaListProps) {
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("all");
  const [filtroStatus, setFiltroStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    return manifestacoes.filter((m) => {
      // Filtro de busca
      if (search) {
        const searchLower = search.toLowerCase();
        const matchAssunto = m.assunto.toLowerCase().includes(searchLower);
        const matchMensagem = m.mensagem.toLowerCase().includes(searchLower);
        const matchAutor = m.autor_nome?.toLowerCase().includes(searchLower);
        if (!matchAssunto && !matchMensagem && !matchAutor) return false;
      }

      // Filtro por tipo
      if (filtroTipo && filtroTipo !== "all" && m.tipo !== filtroTipo) return false;

      // Filtro por status
      if (filtroStatus && filtroStatus !== "all" && m.status !== filtroStatus) return false;

      return true;
    });
  }, [manifestacoes, search, filtroTipo, filtroStatus]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por assunto, mensagem ou autor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-[140px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="sugestao">💡 Sugestão</SelectItem>
              <SelectItem value="reclamacao">⚠️ Reclamação</SelectItem>
              <SelectItem value="denuncia">🚨 Denúncia</SelectItem>
              <SelectItem value="elogio">⭐ Elogio</SelectItem>
              <SelectItem value="duvida">❓ Dúvida</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_analise">Em Análise</SelectItem>
              <SelectItem value="respondido">Respondido</SelectItem>
              <SelectItem value="arquivado">Arquivado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista */}
      {manifestacoes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma manifestação encontrada</p>
          <p className="text-sm">As manifestações enviadas aparecerão aqui</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma manifestação corresponde aos filtros</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((manifestacao) => (
            <OuvidoriaCard
              key={manifestacao.id}
              manifestacao={manifestacao}
              isManager={isManager}
              onResponder={onResponder}
              onAtualizarStatus={onAtualizarStatus}
              onDeletar={onDeletar}
            />
          ))}
        </div>
      )}
    </div>
  );
}
