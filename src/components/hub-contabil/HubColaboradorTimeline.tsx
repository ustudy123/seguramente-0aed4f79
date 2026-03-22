import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HubProcesso } from "@/hooks/useHubProcessos";
import {
  Search, User, Calendar, UserPlus, UserMinus, Umbrella, AlertOctagon,
  FileBarChart, Stethoscope, FileText, ArrowRight, Clock
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  processos: HubProcesso[];
  onVerProcesso: (id: string) => void;
}

const TIPO_CONFIG: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  admissao: { label: "Admissão", icon: UserPlus, color: "text-green-600" },
  demissao: { label: "Demissão", icon: UserMinus, color: "text-red-600" },
  ferias: { label: "Férias", icon: Umbrella, color: "text-blue-600" },
  advertencia: { label: "Advertência", icon: AlertOctagon, color: "text-orange-600" },
  ponto_folha: { label: "Folha/Ponto", icon: FileBarChart, color: "text-indigo-600" },
  atestado_afastamento: { label: "Atestado", icon: Stethoscope, color: "text-purple-600" },
  eventos_variaveis: { label: "Eventos Var.", icon: FileText, color: "text-cyan-600" },
  solicitacao_geral: { label: "Solicitação", icon: FileText, color: "text-muted-foreground" },
};

const STATUS_COLOR: Record<string, string> = {
  concluido: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
  aguardando_assinatura: "bg-yellow-100 text-yellow-800",
  enviado_contabilidade: "bg-indigo-100 text-indigo-800",
  processado: "bg-teal-100 text-teal-800",
  rascunho: "bg-muted text-muted-foreground",
};

export function HubColaboradorTimeline({ processos, onVerProcesso }: Props) {
  const [busca, setBusca] = useState("");
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState<string | null>(null);

  // Colaboradores únicos com processos
  const colaboradores = Array.from(
    new Map(
      processos
        .filter(p => p.colaborador_nome)
        .map(p => [p.colaborador_cpf || p.colaborador_nome!, {
          nome: p.colaborador_nome!,
          cpf: p.colaborador_cpf,
          total: processos.filter(x => (x.colaborador_cpf || x.colaborador_nome) === (p.colaborador_cpf || p.colaborador_nome)).length,
        }])
    ).values()
  ).filter(c =>
    !busca ||
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (c.cpf?.includes(busca) ?? false)
  );

  const processosFiltrados = colaboradorSelecionado
    ? processos
        .filter(p => p.colaborador_nome === colaboradorSelecionado || p.colaborador_cpf === colaboradorSelecionado)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Linha do Tempo por Colaborador</h2>
        <p className="text-sm text-muted-foreground">Histórico consolidado de todos os processos por pessoa</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Painel esquerdo — busca de colaboradores */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CPF..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>

          {colaboradores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <User className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Nenhum colaborador encontrado</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
              {colaboradores.map(c => (
                <button
                  key={c.cpf || c.nome}
                  onClick={() => setColaboradorSelecionado(c.cpf || c.nome)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    (colaboradorSelecionado === c.cpf || colaboradorSelecionado === c.nome)
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.nome}</p>
                        {c.cpf && <p className="text-xs text-muted-foreground">{c.cpf}</p>}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">{c.total}</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Painel direito — linha do tempo */}
        <div className="lg:col-span-2">
          {!colaboradorSelecionado ? (
            <div className="flex items-center justify-center h-full min-h-[300px] text-muted-foreground text-sm">
              <div className="text-center">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Selecione um colaborador para ver a linha do tempo</p>
              </div>
            </div>
          ) : processosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <p>Nenhum processo encontrado</p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold mb-4 flex items-center gap-2">
                <User className="w-4 h-4" />
                {processosFiltrados[0].colaborador_nome}
                <span className="text-muted-foreground font-normal">— {processosFiltrados.length} processos</span>
              </p>

              <div className="relative pl-5">
                <div className="absolute left-[9px] top-0 bottom-0 w-px bg-border" />

                {processosFiltrados.map((p, idx) => {
                  const config = TIPO_CONFIG[p.tipo] || TIPO_CONFIG.solicitacao_geral;
                  const Icon = config.icon;
                  return (
                    <div key={p.id} className="relative mb-5 pl-6">
                      {/* Bolinha colorida */}
                      <div className={`absolute -left-1 top-1 w-5 h-5 rounded-full bg-background border-2 border-border flex items-center justify-center`}>
                        <Icon className={`w-3 h-3 ${config.color}`} />
                      </div>

                      <Card
                        className="cursor-pointer hover:border-primary/40 transition-all"
                        onClick={() => onVerProcesso(p.id)}
                      >
                        <CardContent className="py-3 px-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono text-muted-foreground">{p.codigo}</span>
                                <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                              </div>
                              <p className="text-sm font-medium mt-0.5 truncate">{p.titulo}</p>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                {p.competencia && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Calendar className="w-3 h-3" /> {p.competencia}
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {format(parseISO(p.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className={`text-xs ${STATUS_COLOR[p.status] || "bg-muted text-muted-foreground"}`}>
                                {p.status.replace(/_/g, " ")}
                              </Badge>
                              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
