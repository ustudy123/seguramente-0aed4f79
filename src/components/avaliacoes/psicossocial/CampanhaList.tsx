import { useState } from "react";
import { 
  Brain, 
  Calendar, 
  Users, 
  MoreVertical, 
  Play, 
  Pause, 
  BarChart3,
  QrCode,
  Link as LinkIcon,
  Copy,
  ExternalLink,
  CheckCircle2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePsicossocial } from "@/hooks/usePsicossocial";
import { DistribuicaoModal } from "./DistribuicaoModal";
import { ResultadosModal } from "./ResultadosModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { CampanhaPsicossocial } from "@/types/psicossocial";

interface CampanhaListProps {
  campanhas: CampanhaPsicossocial[];
  onNovaCampanha: () => void;
}

export function CampanhaList({ campanhas, onNovaCampanha }: CampanhaListProps) {
  const [selectedCampanha, setSelectedCampanha] = useState<CampanhaPsicossocial | null>(null);
  const [showDistribuicao, setShowDistribuicao] = useState(false);
  const [showResultados, setShowResultados] = useState(false);
  
  const { atualizarStatusCampanha, useEstatisticasCampanha } = usePsicossocial();

  const getStatusBadge = (status: CampanhaPsicossocial['status']) => {
    switch (status) {
      case 'rascunho':
        return <Badge variant="secondary">Rascunho</Badge>;
      case 'ativa':
        return <Badge className="bg-emerald-500">Ativa</Badge>;
      case 'encerrada':
        return <Badge variant="outline">Encerrada</Badge>;
    }
  };

  const handleAtivar = (campanha: CampanhaPsicossocial) => {
    atualizarStatusCampanha.mutate({ id: campanha.id, status: 'ativa' });
  };

  const handleEncerrar = (campanha: CampanhaPsicossocial) => {
    atualizarStatusCampanha.mutate({ id: campanha.id, status: 'encerrada' });
  };

  const handleDistribuir = (campanha: CampanhaPsicossocial) => {
    setSelectedCampanha(campanha);
    setShowDistribuicao(true);
  };

  const handleVerResultados = (campanha: CampanhaPsicossocial) => {
    setSelectedCampanha(campanha);
    setShowResultados(true);
  };

  if (campanhas.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Brain className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma campanha criada</h3>
          <p className="text-muted-foreground text-center mb-4">
            Crie sua primeira campanha de avaliação psicossocial
          </p>
          <Button onClick={onNovaCampanha}>
            Criar Campanha
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Campanhas</CardTitle>
          <CardDescription>
            Gerencie suas campanhas de avaliação psicossocial
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {campanhas.map((campanha) => (
            <CampanhaCard 
              key={campanha.id} 
              campanha={campanha}
              onAtivar={() => handleAtivar(campanha)}
              onEncerrar={() => handleEncerrar(campanha)}
              onDistribuir={() => handleDistribuir(campanha)}
              onVerResultados={() => handleVerResultados(campanha)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Modal de Distribuição */}
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
    </>
  );
}

interface CampanhaCardProps {
  campanha: CampanhaPsicossocial;
  onAtivar: () => void;
  onEncerrar: () => void;
  onDistribuir: () => void;
  onVerResultados: () => void;
}

function CampanhaCard({ campanha, onAtivar, onEncerrar, onDistribuir, onVerResultados }: CampanhaCardProps) {
  const { useEstatisticasCampanha } = usePsicossocial();
  const { data: stats } = useEstatisticasCampanha(campanha.id);

  const getStatusBadge = (status: CampanhaPsicossocial['status']) => {
    switch (status) {
      case 'rascunho':
        return <Badge variant="secondary">Rascunho</Badge>;
      case 'ativa':
        return <Badge className="bg-emerald-500">Ativa</Badge>;
      case 'encerrada':
        return <Badge variant="outline">Encerrada</Badge>;
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold">{campanha.nome}</h4>
          {getStatusBadge(campanha.status)}
          {campanha.anonimo && (
            <Badge variant="outline" className="text-xs">Anônimo</Badge>
          )}
        </div>
        
        {campanha.descricao && (
          <p className="text-sm text-muted-foreground">{campanha.descricao}</p>
        )}
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {format(new Date(campanha.data_inicio), "dd/MM/yyyy", { locale: ptBR })} - {format(new Date(campanha.data_fim), "dd/MM/yyyy", { locale: ptBR })}
          </span>
          {stats && (
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {stats.concluidos}/{stats.total_convites} respostas
            </span>
          )}
        </div>

        {stats && stats.total_convites > 0 && (
          <div className="flex items-center gap-2">
            <Progress value={stats.taxa_participacao} className="h-2 flex-1 max-w-xs" />
            <span className="text-sm font-medium">{stats.taxa_participacao.toFixed(0)}%</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {campanha.status === 'ativa' && (
          <>
            <Button variant="outline" size="sm" onClick={onDistribuir}>
              <LinkIcon className="h-4 w-4 mr-1" />
              Distribuir
            </Button>
            <Button variant="outline" size="sm" onClick={onVerResultados}>
              <BarChart3 className="h-4 w-4 mr-1" />
              Resultados
            </Button>
          </>
        )}
        
        {campanha.status === 'encerrada' && (
          <Button variant="outline" size="sm" onClick={onVerResultados}>
            <BarChart3 className="h-4 w-4 mr-1" />
            Ver Resultados
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {campanha.status === 'rascunho' && (
              <DropdownMenuItem onClick={onAtivar}>
                <Play className="h-4 w-4 mr-2" />
                Ativar Campanha
              </DropdownMenuItem>
            )}
            {campanha.status === 'ativa' && (
              <>
                <DropdownMenuItem onClick={onDistribuir}>
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Distribuir Links
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onVerResultados}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Ver Resultados
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onEncerrar} className="text-destructive">
                  <Pause className="h-4 w-4 mr-2" />
                  Encerrar Campanha
                </DropdownMenuItem>
              </>
            )}
            {campanha.status === 'encerrada' && (
              <DropdownMenuItem onClick={onVerResultados}>
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
