import { useState, useMemo } from "react";
import { 
  Brain, 
  Calendar, 
  Users, 
  MoreVertical, 
  Play, 
  Pause, 
  BarChart3,
  Link as LinkIcon,
  CheckCircle2,
  UserPlus,
  Database,
  Loader2,
  Pencil,
  Search,
  Filter,
  X,
  MessageSquare,
} from "lucide-react";
import { useGerarEntrevista } from "@/hooks/useGerarEntrevista";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePsicossocial } from "@/hooks/usePsicossocial";
import { useGRORiscos } from "@/hooks/useGRORiscos";
import { DistribuicaoModal } from "./DistribuicaoModal";
import { ResultadosModal } from "./ResultadosModal";
import { ParticipacaoManager } from "./ParticipacaoManager";
import { EntrevistasManagerModal } from "./EntrevistasManagerModal";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { type CampanhaPsicossocial, type RadarDimensao, getMinimoRespostas } from "@/types/psicossocial";

interface CampanhaListProps {
  campanhas: CampanhaPsicossocial[];
  onNovaCampanha: () => void;
  onEditarCampanha: (campanha: CampanhaPsicossocial) => void;
}

export function CampanhaList({ campanhas, onNovaCampanha, onEditarCampanha }: CampanhaListProps) {
  const [selectedCampanha, setSelectedCampanha] = useState<CampanhaPsicossocial | null>(null);
  const [showDistribuicao, setShowDistribuicao] = useState(false);
  const [showResultados, setShowResultados] = useState(false);
  const [showEntrevistas, setShowEntrevistas] = useState(false);
  const [expandedCampanha, setExpandedCampanha] = useState<string | null>(null);
  const [exportandoGRO, setExportandoGRO] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [instrumentFilter, setInstrumentFilter] = useState<string>("todos");

  const { atualizarStatusCampanha } = usePsicossocial();
  const { importarDaCampanha } = useGRORiscos();
  const { tenantId } = useAuthContext();

  const handleAtivar = (campanha: CampanhaPsicossocial) => {
    // Pegar data atual considerando o fuso horário local para comparação justa
    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    
    // Converter data_inicio (YYYY-MM-DD) para objeto Date local (meia-noite)
    const [year, month, day] = campanha.data_inicio.split('-').map(Number);
    const dataInicio = new Date(year, month - 1, day);

    if (dataInicio > hoje) {
      toast.info(`Esta campanha está agendada para iniciar em ${format(dataInicio, "dd/MM/yyyy")}. Ela será ativada automaticamente nesta data.`);
      return;
    }
    atualizarStatusCampanha.mutate({ id: campanha.id, status: 'ativa' });
  };

  // GAP 1: Encerrar campanha + exportar automaticamente ao GRO se tiver dimensões críticas
  const handleEncerrar = async (campanha: CampanhaPsicossocial) => {
    atualizarStatusCampanha.mutate(
      { id: campanha.id, status: 'encerrada' },
      {
        onSuccess: async () => {
          // Verificar se a campanha tem dados suficientes para exportar ao GRO
          const totalRespostas = campanha.total_respostas || 0;
          const radarData = campanha.radar_data as RadarDimensao[] | null;
          const situacoes = campanha.situacoes_trabalho ?? [];

          if (
            totalRespostas >= getMinimoRespostas(campanha) &&
            radarData && radarData.length > 0 &&
            situacoes.length > 0 &&
            !campanha.gro_exportado_em
          ) {
            const isSipro = campanha.instrumento === 'sipro';
            const temCriticos = radarData.some(d => {
              const risco = isSipro ? d.value : 100 - d.value;
              return risco >= 35;
            });

            if (temCriticos) {
              setExportandoGRO(campanha.id);
              try {
                const count = await importarDaCampanha.mutateAsync({
                  campanhaId: campanha.id,
                  campanhaName: campanha.nome,
                  dimensoes: radarData.map(d => ({ subject: d.subject, value: d.value })),
                  empresaId: null,
                  isSipro,
                  situacoes,
                });
                // Registrar data da exportação para evitar duplicidade
                if (tenantId) {
                  await (supabase as any)
                    .from('questionario_psicossocial_campanhas')
                    .update({ gro_exportado_em: new Date().toISOString(), gro_riscos_count: count })
                    .eq('id', campanha.id);
                }
                toast.success(`Campanha encerrada! ${count} risco(s) exportado(s) automaticamente ao GRO (NR-17).`);
              } catch {
                toast.info('Campanha encerrada. Exporte os riscos ao GRO manualmente no Inventário PGR.');
              } finally {
                setExportandoGRO(null);
              }
            }
          }
        },
      }
    );
  };

  const handleDistribuir = (campanha: CampanhaPsicossocial) => {
    setSelectedCampanha(campanha);
    setShowDistribuicao(true);
  };

  const handleVerResultados = (campanha: CampanhaPsicossocial) => {
    setSelectedCampanha(campanha);
    setShowResultados(true);
  };

  const handleGerenciarParticipacao = (campanha: CampanhaPsicossocial) => {
    setExpandedCampanha(prev => prev === campanha.id ? null : campanha.id);
  };

  const handleEditar = (campanha: CampanhaPsicossocial) => {
    onEditarCampanha(campanha);
  };

  const filteredCampanhas = useMemo(() => {
    return campanhas.filter((c) => {
      const matchesSearch = c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (c.descricao?.toLowerCase() || "").includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "todos" || c.status === statusFilter;
      const matchesInstrument = instrumentFilter === "todos" || c.instrumento === instrumentFilter;
      
      return matchesSearch && matchesStatus && matchesInstrument;
    });
  }, [campanhas, searchTerm, statusFilter, instrumentFilter]);

  if (campanhas.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Brain className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma campanha criada</h3>
          <p className="text-muted-foreground text-center mb-4">
            Crie sua primeira campanha de avaliação psicossocial
          </p>
          <Button id="btn-criar-campanha" onClick={onNovaCampanha}>
            Criar Campanha
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Campanhas</CardTitle>
              <CardDescription>
                Gerencie suas campanhas de avaliação psicossocial
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou descrição..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-7 w-7"
                    onClick={() => setSearchTerm("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="encerrada">Encerrada</SelectItem>
                </SelectContent>
              </Select>

              <Select value={instrumentFilter} onValueChange={setInstrumentFilter}>
                <SelectTrigger className="w-[140px]">
                  <Brain className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Instrumento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Instrumentos</SelectItem>
                  <SelectItem value="sipro">SIPRO</SelectItem>
                  <SelectItem value="copsoq">COPSOQ modificado</SelectItem>
                  <SelectItem value="hse">HSE</SelectItem>
                  <SelectItem value="proart">PROART</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredCampanhas.length === 0 ? (
            <div className="text-center py-12 border rounded-lg border-dashed">
              <Search className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-20" />
              <p className="text-muted-foreground">Nenhuma campanha encontrada com os filtros aplicados.</p>
              {(searchTerm !== "" || statusFilter !== "todos" || instrumentFilter !== "todos") && (
                <Button 
                  variant="link" 
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("todos");
                    setInstrumentFilter("todos");
                  }}
                  className="mt-2"
                >
                  Limpar todos os filtros
                </Button>
              )}
            </div>
          ) : (
            filteredCampanhas.map((campanha) => (
              <div key={campanha.id} className="border rounded-lg overflow-hidden">
              <CampanhaCard 
                campanha={campanha}
                onAtivar={() => handleAtivar(campanha)}
                onEncerrar={() => handleEncerrar(campanha)}
                onDistribuir={() => handleDistribuir(campanha)}
                onVerResultados={() => handleVerResultados(campanha)}
                onGerenciarParticipacao={() => handleGerenciarParticipacao(campanha)}
                onGerenciarLinks={() => { setSelectedCampanha(campanha); setShowEntrevistas(true); }}
                onEditar={() => handleEditar(campanha)}
                isExpanded={expandedCampanha === campanha.id}
                isExportandoGRO={exportandoGRO === campanha.id}
              />
              
              {/* Painel de Participação expandido */}
              {expandedCampanha === campanha.id && (
                <div className="border-t bg-muted/20 p-4">
                  <Tabs defaultValue="participacao">
                    <TabsList className="mb-4">
                      <TabsTrigger value="participacao" className="gap-1.5 text-xs">
                        <Users className="h-3.5 w-3.5" />
                        Controle de Participação
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="participacao">
                      <ParticipacaoManager campanha={campanha} />
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Modal de Distribuição (Link Público Geral) */}
      {selectedCampanha && (
        <DistribuicaoModal
          open={showDistribuicao}
          onOpenChange={setShowDistribuicao}
          campanha={selectedCampanha}
        />
      )}

      {/* Modal de Resultados */}
      {selectedCampanha && (
        <ResultadosModal
          open={showResultados}
          onOpenChange={setShowResultados}
          campanha={selectedCampanha}
        />
      )}

      {/* Modal de Gestão de Links de Entrevista */}
      <EntrevistasManagerModal
        open={showEntrevistas}
        onOpenChange={setShowEntrevistas}
        campanhaId={selectedCampanha?.id ?? null}
        campanhaNome={selectedCampanha?.nome}
      />
    </>
  );
}

interface CampanhaCardProps {
  campanha: CampanhaPsicossocial;
  onAtivar: () => void;
  onEncerrar: () => void;
  onDistribuir: () => void;
  onVerResultados: () => void;
  onGerenciarParticipacao: () => void;
  onGerenciarLinks: () => void;
  onEditar: () => void;
  isExpanded: boolean;
  isExportandoGRO?: boolean;
}

function CampanhaCard({ campanha, onAtivar, onEncerrar, onDistribuir, onVerResultados, onGerenciarParticipacao, onGerenciarLinks, onEditar, isExpanded, isExportandoGRO }: CampanhaCardProps) {
  const { useEstatisticasCampanha } = usePsicossocial();
  const { data: stats } = useEstatisticasCampanha(campanha.id);
  const gerarEntrevista = useGerarEntrevista();
  const isEntrevista = (campanha as any).tipo_instrumento === 'entrevista_guiada';

  const getStatusBadge = (status: CampanhaPsicossocial['status']) => {
    switch (status) {
      case 'rascunho':
        return <Badge variant="secondary">Rascunho</Badge>;
      case 'ativa':
        return <Badge className="bg-emerald-500 text-white">Ativa</Badge>;
      case 'encerrada':
        return <Badge variant="outline">Encerrada</Badge>;
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-semibold">{campanha.nome}</h4>
          {getStatusBadge(campanha.status)}
          {campanha.anonimo && (
            <Badge variant="outline" className="text-xs">Anônimo</Badge>
          )}
          {isEntrevista && (
            <Badge variant="outline" className="text-xs gap-1 text-purple-700 border-purple-300 bg-purple-50">
              <MessageSquare className="h-3 w-3" />
              Entrevista guiada por IA
            </Badge>
          )}
          {/* GAP 1: Badge indicando que riscos já foram exportados ao GRO */}
          {campanha.gro_exportado_em && (
            <Badge variant="outline" className="text-xs gap-1 text-emerald-700 border-emerald-300 bg-emerald-50">
              <Database className="h-3 w-3" />
              GRO exportado
            </Badge>
          )}
          {isExportandoGRO && (
            <Badge variant="outline" className="text-xs gap-1 text-blue-700 border-blue-300 bg-blue-50">
              <Loader2 className="h-3 w-3 animate-spin" />
              Exportando ao GRO...
            </Badge>
          )}
        </div>
        
        {campanha.descricao && (
          <p className="text-sm text-muted-foreground">{campanha.descricao}</p>
        )}
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {format(parseISO(campanha.data_inicio), "dd/MM/yyyy", { locale: ptBR })} - {format(parseISO(campanha.data_fim), "dd/MM/yyyy", { locale: ptBR })}
          </span>
          {stats && (
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {stats.concluidos}/{stats.total_convites > 0 ? stats.total_convites : stats.concluidos} respostas
              {stats.taxa_participacao > 0 && (
                <span className="font-medium text-foreground">
                  ({stats.taxa_participacao.toFixed(0)}%)
                </span>
              )}
            </span>
          )}
        </div>

        {stats && stats.total_convites > 0 && (
          <div className="flex items-center gap-2">
            <Progress value={stats.taxa_participacao} className="h-1.5 flex-1 max-w-xs" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {campanha.status === 'ativa' && (
          <>
            <Button
              id={`btn-participacao-${campanha.id}`}
              variant={isExpanded ? "default" : "outline"}
              size="sm"
              onClick={onGerenciarParticipacao}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Participação
            </Button>
            {isEntrevista ? (
              <>
                <Button
                  id={`btn-gerar-entrevista-${campanha.id}`}
                  variant="outline"
                  size="sm"
                  disabled={gerarEntrevista.isPending}
                  onClick={() => gerarEntrevista.mutate({ campanhaId: campanha.id })}
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  {gerarEntrevista.isPending ? "Gerando..." : "Novo Link"}
                </Button>
                <Button
                  id={`btn-gerenciar-links-${campanha.id}`}
                  variant="outline"
                  size="sm"
                  onClick={onGerenciarLinks}
                >
                  <LinkIcon className="h-4 w-4 mr-1" />
                  Gerenciar Links
                </Button>
              </>
            ) : (
              <Button id={`btn-link-geral-${campanha.id}`} variant="outline" size="sm" onClick={onDistribuir}>
                <LinkIcon className="h-4 w-4 mr-1" />
                Link Geral
              </Button>
            )}
            <Button id={`btn-resultados-${campanha.id}`} variant="outline" size="sm" onClick={onVerResultados}>
              <BarChart3 className="h-4 w-4 mr-1" />
              Resultados
            </Button>
          </>
        )}
        
        {campanha.status === 'encerrada' && (
          <>
            <Button id={`btn-participacao-enc-${campanha.id}`} variant="outline" size="sm" onClick={onGerenciarParticipacao}>
              <Users className="h-4 w-4 mr-1" />
              Participação
            </Button>
            <Button id={`btn-ver-resultados-${campanha.id}`} variant="outline" size="sm" onClick={onVerResultados}>
              <BarChart3 className="h-4 w-4 mr-1" />
              Ver Resultados
            </Button>
          </>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button id={`btn-menu-campanha-${campanha.id}`} variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {campanha.status !== 'encerrada' && (
              <DropdownMenuItem id={`menu-editar-campanha-${campanha.id}`} onClick={onEditar}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar Campanha
              </DropdownMenuItem>
            )}
            {campanha.status === 'rascunho' && (
              <DropdownMenuItem id={`menu-ativar-campanha-${campanha.id}`} onClick={onAtivar}>
                <Play className="h-4 w-4 mr-2" />
                Ativar Campanha
              </DropdownMenuItem>
            )}
            {campanha.status === 'ativa' && (
              <>
                <DropdownMenuItem id={`menu-participacao-${campanha.id}`} onClick={onGerenciarParticipacao}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Controle de Participação
                </DropdownMenuItem>
                <DropdownMenuItem id={`menu-link-geral-${campanha.id}`} onClick={onDistribuir}>
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Link Geral Anônimo
                </DropdownMenuItem>
                <DropdownMenuItem id={`menu-ver-resultados-${campanha.id}`} onClick={onVerResultados}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Ver Resultados
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem id={`menu-encerrar-campanha-${campanha.id}`} onClick={onEncerrar} className="text-destructive">
                  <Pause className="h-4 w-4 mr-2" />
                  Encerrar Campanha
                </DropdownMenuItem>
              </>
            )}
            {campanha.status === 'encerrada' && (
              <DropdownMenuItem id={`menu-ver-resultados-enc-${campanha.id}`} onClick={onVerResultados}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Ver Resultados
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
