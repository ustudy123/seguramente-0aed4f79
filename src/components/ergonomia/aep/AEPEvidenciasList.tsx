import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Image, 
  Video, 
  Mic, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Building2,
  Briefcase,
  User,
  FileText
} from "lucide-react";
import { EvidenciaAEP } from "@/types/aep-multi";

interface AEPEvidenciasListProps {
  evidencias: EvidenciaAEP[];
  onRemoveEvidencia: (id: string) => void;
}

export function AEPEvidenciasList({
  evidencias,
  onRemoveEvidencia
}: AEPEvidenciasListProps) {
  // Group by setor/função
  const grouped = new Map<string, EvidenciaAEP[]>();
  evidencias.forEach(ev => {
    const key = `${ev.setorNome}|${ev.funcaoNome}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(ev);
  });

  const getTipoIcon = (tipo: 'foto' | 'video' | 'audio') => {
    switch (tipo) {
      case 'foto': return <Image className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'audio': return <Mic className="h-4 w-4" />;
    }
  };

  const getTipoLabel = (tipo: 'foto' | 'video' | 'audio') => {
    switch (tipo) {
      case 'foto': return 'Foto';
      case 'video': return 'Vídeo';
      case 'audio': return 'Áudio';
    }
  };

  if (evidencias.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">Nenhuma evidência coletada</p>
          <p className="text-sm mt-1">Adicione fotos, vídeos ou áudios do posto de trabalho</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>Evidências Coletadas</span>
          <Badge variant="secondary">{evidencias.length} evidência(s)</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([key, evs]) => {
              const [setorNome, funcaoNome] = key.split('|');
              const analisadas = evs.filter(e => e.analisadaPorIA).length;
              
              return (
                <div key={key} className="space-y-2">
                  {/* Group header */}
                  <div className="flex items-center gap-2 py-2 border-b">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{setorNome}</span>
                    <span className="text-muted-foreground">/</span>
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{funcaoNome}</span>
                    <Badge variant="outline" className="ml-auto">
                      {evs.length} evidência(s)
                    </Badge>
                    {analisadas > 0 && (
                      <Badge variant="default" className="bg-success">
                        {analisadas} analisada(s)
                      </Badge>
                    )}
                  </div>
                  
                  {/* Evidencias list */}
                  <div className="grid gap-2">
                    {evs.map(ev => (
                      <div 
                        key={ev.id}
                        className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                      >
                        {/* Preview */}
                        <div className="flex-shrink-0 w-16 h-16 rounded overflow-hidden bg-muted">
                          {ev.tipo === 'foto' && ev.arquivoBase64 ? (
                            <img 
                              src={ev.arquivoBase64} 
                              alt="Evidência" 
                              className="w-full h-full object-cover"
                            />
                          ) : ev.tipo === 'video' && ev.videoFrames?.[0] ? (
                            <img 
                              src={ev.videoFrames[0]} 
                              alt="Frame do vídeo" 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {getTipoIcon(ev.tipo)}
                            </div>
                          )}
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="gap-1">
                              {getTipoIcon(ev.tipo)}
                              {getTipoLabel(ev.tipo)}
                            </Badge>
                            
                            {ev.analisadaPorIA ? (
                              <Badge variant="default" className="gap-1 bg-success">
                                <CheckCircle2 className="h-3 w-3" />
                                Analisada
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <Clock className="h-3 w-3" />
                                Pendente
                              </Badge>
                            )}
                          </div>
                          
                          {ev.colaboradorNome && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                              <User className="h-3 w-3" />
                              {ev.colaboradorNome}
                            </div>
                          )}
                          
                          {ev.contextoTexto && (
                            <p className="text-sm text-muted-foreground truncate">
                              {ev.contextoTexto}
                            </p>
                          )}
                          
                          {ev.transcricaoAudio && (
                            <p className="text-sm text-muted-foreground truncate mt-1 italic">
                              🎙️ {ev.transcricaoAudio}
                            </p>
                          )}
                          
                          {ev.resultadoIA && (
                            <div className="flex items-center gap-2 mt-2">
                              <Badge 
                                variant={
                                  ev.resultadoIA.conformidadeEstimada >= 70 ? "default" :
                                  ev.resultadoIA.conformidadeEstimada >= 50 ? "secondary" :
                                  "destructive"
                                }
                              >
                                {ev.resultadoIA.conformidadeEstimada}% conformidade
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {ev.resultadoIA.riscosIdentificados.length} risco(s)
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* Actions */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => onRemoveEvidencia(ev.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
