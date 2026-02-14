import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDropzone } from "react-dropzone";
import {
  ArrowLeft,
  AlertTriangle,
  Shield,
  FileText,
  Upload,
  Download,
  Plus,
  Calendar,
  MapPin,
  User,
  Clock,
} from "lucide-react";
import type { EventoSST, EventoSSTAnexo } from "@/types/eventoSST";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEventosSST } from "@/hooks/useEventosSST";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  evento: EventoSST;
  onBack: () => void;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  em_aberto: { label: "Em Aberto", variant: "destructive" },
  em_analise: { label: "Em Análise", variant: "secondary" },
  acoes_andamento: { label: "Ações em Andamento", variant: "default" },
  concluido: { label: "Concluído", variant: "outline" },
};

const lesaoLabels: Record<string, string> = {
  sem_lesao: "Sem lesão aparente",
  leve: "Lesão leve",
  moderada: "Lesão moderada",
  grave: "Lesão grave",
};
const afastLabels: Record<string, string> = {
  sem_afastamento: "Sem afastamento",
  ate_15_dias: "Até 15 dias",
  mais_15_dias: "Mais de 15 dias",
};
const atendLabels: Record<string, string> = {
  nao_necessario: "Não necessário",
  ambulatorial: "Ambulatorial",
  hospitalar: "Hospitalar",
};

export const EventoSSTDetail = ({ evento, onBack }: Props) => {
  const { uploadAnexo, getAnexos, uploadCAT, criarAcaoVinculada, updateEvento } = useEventosSST();
  const [anexos, setAnexos] = useState<EventoSSTAnexo[]>([]);
  const [loadingAnexos, setLoadingAnexos] = useState(false);
  const [catFile, setCatFile] = useState<File | null>(null);

  const st = statusMap[evento.status] || statusMap.em_aberto;

  // Load anexos
  const loadAnexos = useCallback(async () => {
    setLoadingAnexos(true);
    try {
      const data = await getAnexos(evento.id);
      setAnexos(data);
    } catch {
      // ignore
    }
    setLoadingAnexos(false);
  }, [evento.id, getAnexos]);

  useState(() => { loadAnexos(); });

  const onDrop = useCallback(
    async (files: File[]) => {
      for (const f of files) {
        await uploadAnexo(evento.id, f, "outro");
      }
      loadAnexos();
    },
    [evento.id, uploadAnexo, loadAnexos]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleUploadCAT = async () => {
    if (!catFile) return;
    await uploadCAT(evento.id, catFile);
    setCatFile(null);
  };

  const handleDownloadAnexo = async (anexo: EventoSSTAnexo) => {
    try {
      const { data } = await supabase.storage
        .from("eventos-sst")
        .download(anexo.arquivo_url);
      if (data) {
        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = anexo.arquivo_nome;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      toast.error("Erro ao baixar arquivo");
    }
  };

  const handleCriarAcao = async () => {
    await criarAcaoVinculada(evento.id, evento);
  };

  const handleConcluir = async () => {
    await updateEvento.mutateAsync({ id: evento.id, status: "concluido" } as any);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">{evento.codigo}</h2>
            {evento.tipo === "acidente" ? (
              <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" /> Acidente</Badge>
            ) : (
              <Badge variant="secondary"><Shield className="w-3 h-3 mr-1" /> Incidente</Badge>
            )}
            <Badge variant={st.variant}>{st.label}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {evento.status !== "concluido" && (
            <Button variant="outline" size="sm" onClick={handleConcluir}>
              Concluir Evento
            </Button>
          )}
          <Button size="sm" onClick={handleCriarAcao}>
            <Plus className="w-4 h-4 mr-1" /> Criar Ação Vinculada
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Details */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Dados do Evento</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p>{format(new Date(evento.data_evento), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Hora</p>
                  <p>{evento.hora_evento || "-"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Unidade / Setor</p>
                  <p>{[evento.unidade, evento.setor].filter(Boolean).join(" / ") || "-"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Colaborador</p>
                  <p>{evento.colaborador_nome || "-"}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Função</p>
                <p>{evento.colaborador_funcao || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Turno</p>
                <p>{evento.turno || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Categoria</p>
                <p>{evento.categoria_principal || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Origem</p>
                <p>{evento.origem_predominante || "-"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Descrição</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-3">
              <p className="whitespace-pre-wrap">{evento.descricao || "Sem descrição"}</p>
              {evento.percepcao_causa && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Percepção Inicial da Causa</p>
                  <p className="whitespace-pre-wrap">{evento.percepcao_causa}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Accident-specific */}
          {evento.tipo === "acidente" && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Detalhamento do Acidente</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Lesão</p>
                  <p>{evento.gravidade_lesao ? lesaoLabels[evento.gravidade_lesao] : "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Afastamento</p>
                  <p>{evento.afastamento ? afastLabels[evento.afastamento] : "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Atendimento</p>
                  <p>{evento.atendimento ? atendLabels[evento.atendimento] : "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Óbito</p>
                  <p>{evento.obito ? "Sim" : "Não"}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* CAT section */}
          {evento.tipo === "acidente" && (
            <Card>
              <CardHeader><CardTitle className="text-sm">CAT – Comunicação de Acidente de Trabalho</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {evento.cat_emitida ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div><p className="text-xs text-muted-foreground">Número</p><p>{evento.cat_numero || "-"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Data Emissão</p><p>{evento.cat_data_emissao || "-"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Tipo</p><p>{evento.cat_tipo || "-"}</p></div>
                    {evento.cat_arquivo_nome && (
                      <div>
                        <p className="text-xs text-muted-foreground">Arquivo</p>
                        <p className="text-primary cursor-pointer">{evento.cat_arquivo_nome}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-muted-foreground">CAT ainda não emitida.</p>
                    <div className="flex items-center gap-2">
                      <Input type="file" onChange={(e) => setCatFile(e.target.files?.[0] || null)} />
                      <Button size="sm" disabled={!catFile} onClick={handleUploadCAT}>
                        <Upload className="w-4 h-4 mr-1" /> Anexar CAT
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Fatores */}
          {evento.fatores_ergonomicos && evento.fatores_ergonomicos.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Fatores Ergonômicos e Psicossociais</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {evento.fatores_ergonomicos.map((f) => (
                    <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Attachments */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Anexos</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/30"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  {isDragActive ? "Solte aqui..." : "Arraste ou clique para enviar"}
                </p>
              </div>
              {anexos.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center">Nenhum anexo</p>
              ) : (
                <div className="space-y-2">
                  {anexos.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-xs p-2 bg-muted rounded">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 truncate">{a.arquivo_nome}</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleDownloadAnexo(a)}>
                        <Download className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Informações</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-2 text-muted-foreground">
              <p>Criado por: {evento.criado_por_nome || "-"}</p>
              <p>Em: {format(new Date(evento.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
              <p>Atualizado: {format(new Date(evento.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
