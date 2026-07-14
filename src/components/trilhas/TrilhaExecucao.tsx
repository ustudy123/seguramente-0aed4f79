import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getEmbedUrl } from "@/lib/embedVideo";
import { ConteudoView } from "./ConteudoView";
import { QuizPlayer } from "./QuizPlayer";
import { EvidenciaUpload } from "./EvidenciaUpload";
import { CulturaValoresModule } from "./CulturaValoresModule";
import { PercepcaoCulturalQuiz } from "./PercepcaoCulturalQuiz";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Star,
  CheckCircle2,
  Circle,
  PlayCircle,
  Video,
  FileText,
  Link2,
  Presentation,
  HelpCircle,
  Wrench,
  CheckSquare,
  Brain,
  Lightbulb,
  Zap,
  ExternalLink,
  Send,
  Trophy,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTrilhaModulos } from "@/hooks/useTrilhas";
import { useTrilhaProgresso } from "@/hooks/useTrilhaProgresso";
import type { TrilhaComProgresso, TrilhaModulo, TrilhaModuloTipo, TrilhaProgressoStatus } from "@/types/trilha";
import { MODULO_TIPO_LABELS } from "@/types/trilha";

const moduloIcons: Record<TrilhaModuloTipo, React.ElementType> = {
  video: Video,
  pdf: FileText,
  link: Link2,
  apresentacao: Presentation,
  conteudo_interno: BookOpen,
  quiz: HelpCircle,
  atividade_pratica: Wrench,
  checklist: CheckSquare,
  reflexao: Brain,
  estudo_caso: Lightbulb,
  microdesafio: Zap,
};

const CULTURA_KEYWORDS = ["cultura", "valores", "missão", "visão", "propósito", "missao", "visao"];

function isCulturaModule(modulo: TrilhaModulo): boolean {
  const title = (modulo.titulo || "").toLowerCase();
  return (modulo.tipo === "conteudo_interno" || modulo.tipo === "reflexao") &&
    CULTURA_KEYWORDS.some(k => title.includes(k));
}

interface TrilhaExecucaoProps {
  trilha: TrilhaComProgresso;
  onBack: () => void;
}

export function TrilhaExecucao({ trilha, onBack }: TrilhaExecucaoProps) {
  const isOnboarding = trilha.tipo === "onboarding";
  const { modulos, isLoading: loadingModulos } = useTrilhaModulos(trilha.id);
  const { useModuloProgresso, iniciarModulo, concluirModulo, concluindo } = useTrilhaProgresso();
  const { data: progresso = [] } = useModuloProgresso(trilha.id);

  const [activeModuloId, setActiveModuloId] = useState<string | null>(null);
  const [evidenciaTexto, setEvidenciaTexto] = useState("");
  const [evidenciaFile, setEvidenciaFile] = useState<File | null>(null);

  const getModuloStatus = (moduloId: string): TrilhaProgressoStatus => {
    const p = progresso.find((pr) => pr.modulo_id === moduloId);
    return p?.status || "nao_iniciado";
  };

  const totalConcluidos = progresso.filter((p) => p.status === "concluido").length;
  const percentual = modulos.length > 0 ? Math.round((totalConcluidos / modulos.length) * 100) : 0;
  const pontosObtidos = progresso.reduce((s, p) => s + (p.pontos_obtidos || 0), 0);
  const pontosTotal = modulos.reduce((s, m) => s + (m.pontuacao || 0), 0);

  const activeModulo = modulos.find((m) => m.id === activeModuloId);
  const activeStatus = activeModuloId ? getModuloStatus(activeModuloId) : "nao_iniciado";

  const handleOpenModulo = async (modulo: TrilhaModulo) => {
    setActiveModuloId(modulo.id);
    setEvidenciaTexto("");
    setEvidenciaFile(null);
    const status = getModuloStatus(modulo.id);
    if (status === "nao_iniciado") {
      await iniciarModulo({ trilhaId: trilha.id, moduloId: modulo.id });
    }
  };

  const handleConcluir = async () => {
    if (!activeModulo) return;
    await concluirModulo({
      trilhaId: trilha.id,
      moduloId: activeModulo.id,
      evidenciaTexto: evidenciaTexto || undefined,
      evidenciaFile: evidenciaFile || undefined,
      pontosObtidos: activeModulo.pontuacao || 0,
    });
    setActiveModuloId(null);
    setEvidenciaTexto("");
    setEvidenciaFile(null);
  };

  const statusIcon = (status: TrilhaProgressoStatus) => {
    switch (status) {
      case "concluido":
        return <CheckCircle2 className="w-5 h-5 text-success" />;
      case "em_andamento":
        return <PlayCircle className="w-5 h-5 text-info" />;
      default:
        return <Circle className="w-5 h-5 text-muted-foreground/40" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">{trilha.nome}</h2>
          {trilha.objetivo && (
            <p className="text-sm text-muted-foreground mt-1">{trilha.objetivo}</p>
          )}
        </div>
      </div>

      {/* Progress overview */}
      <Card className="border-border">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <BookOpen className="w-4 h-4 text-primary" strokeWidth={1.75} />
                <span className="text-foreground font-medium">
                  {totalConcluidos}/{modulos.length} módulos
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Star className="w-4 h-4 text-warning" strokeWidth={1.75} />
                <span className="text-foreground font-medium">
                  {pontosObtidos}/{pontosTotal} pts
                </span>
              </div>
            </div>
            <span className="text-sm font-bold text-primary">{percentual}%</span>
          </div>
          <Progress value={percentual} className="h-2.5" />
          {percentual >= 100 && (
            <div className="flex items-center gap-2 text-success text-sm font-medium pt-1">
              <Trophy className="w-5 h-5" />
              <span>Parabéns! Você concluiu esta trilha! 🎉</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Module list sidebar */}
        <div className="lg:col-span-1 space-y-2">
          <h3 className="text-sm font-semibold text-foreground mb-3">Módulos</h3>
          {loadingModulos ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            modulos.map((modulo, i) => {
              const Icon = moduloIcons[modulo.tipo] || BookOpen;
              const status = getModuloStatus(modulo.id);
              const isActive = activeModuloId === modulo.id;
              return (
                <motion.div
                  key={modulo.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <button
                    onClick={() => handleOpenModulo(modulo)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3",
                      isActive
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/20 hover:bg-accent/50"
                    )}
                  >
                    {statusIcon(status)}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium truncate",
                          status === "concluido" ? "text-muted-foreground line-through" : "text-foreground"
                        )}
                      >
                        {modulo.titulo}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                        <Icon className="w-3 h-3" />
                        <span>{MODULO_TIPO_LABELS[modulo.tipo]}</span>
                        <span>•</span>
                        <span>{modulo.tempo_estimado_min}min</span>
                      </div>
                    </div>
                    {modulo.pontuacao > 0 && (
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">
                        {modulo.pontuacao}pts
                      </Badge>
                    )}
                  </button>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Module content area */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {activeModulo ? (
              <motion.div
                key={activeModulo.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <Card className="border-border">
                  <CardContent className="p-6 space-y-5">
                    {/* Module header */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {MODULO_TIPO_LABELS[activeModulo.tipo]}
                        </Badge>
                        {activeModulo.evidencia_obrigatoria && (
                          <Badge className="bg-warning/10 text-warning text-[10px]">Evidência obrigatória</Badge>
                        )}
                        {activeStatus === "concluido" && (
                          <Badge className="bg-success/10 text-success text-[10px]">Concluído</Badge>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">{activeModulo.titulo}</h3>
                      {activeModulo.objetivo && (
                        <p className="text-sm text-muted-foreground mt-1">{activeModulo.objetivo}</p>
                      )}
                    </div>

                    {/* Content */}
                    {activeModulo.tipo === "quiz" ? (
                      <QuizPlayer
                        moduloId={activeModulo.id}
                        pontuacaoModulo={activeModulo.pontuacao || 0}
                        onComplete={async (nota, pontosObtidos) => {
                          await concluirModulo({
                            trilhaId: trilha.id,
                            moduloId: activeModulo.id,
                            nota,
                            pontosObtidos,
                          });
                          setActiveModuloId(null);
                        }}
                      />
                    ) : (
                      <>
                        {/* Auto-render cultura perception quiz for cultura modules in onboarding */}
                        {isCulturaModule(activeModulo) && isOnboarding && (
                          <PercepcaoCulturalQuiz trilhaId={trilha.id} />
                        )}
                        {isCulturaModule(activeModulo) && !isOnboarding && (
                          <CulturaValoresModule />
                        )}

                        {activeModulo.conteudo_url && (
                          <div className="space-y-2">
                            {activeModulo.tipo === "video" ? (
                              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                                <iframe
                                  src={getEmbedUrl(activeModulo.conteudo_url)}
                                  className="w-full h-full"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                            ) : (activeModulo.tipo === "pdf" || activeModulo.tipo === "apresentacao") ? (
                              <div className="space-y-2">
                                <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden">
                                  <iframe src={getEmbedUrl(activeModulo.conteudo_url)} className="w-full h-full" />
                                </div>
                                <a href={activeModulo.conteudo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  Abrir em nova aba
                                </a>
                              </div>
                            ) : (
                              <Button variant="outline" asChild>
                                <a href={activeModulo.conteudo_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  Acessar conteúdo
                                </a>
                              </Button>
                            )}
                          </div>
                        )}

                        {Array.isArray(activeModulo.conteudos) && activeModulo.conteudos.length > 0 && (
                          <div className="space-y-4">
                            {activeModulo.conteudos.map((c) => (
                              <ConteudoView key={c.id} item={c} surface="muted" />
                            ))}
                          </div>
                        )}

                        {activeModulo.conteudo_texto && (
                          <div className="prose prose-sm max-w-none text-foreground bg-muted/30 rounded-lg p-4 border border-border">
                            <div className="whitespace-pre-wrap">{activeModulo.conteudo_texto}</div>
                          </div>
                        )}

                        {activeModulo.descricao && !activeModulo.conteudo_texto && (
                          <div className="bg-muted/30 rounded-lg p-4 border border-border">
                            <p className="text-sm text-foreground">{activeModulo.descricao}</p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Evidence submission (non-quiz) */}
                    {activeModulo.tipo !== "quiz" && activeStatus !== "concluido" && (
                      <div className="space-y-3 pt-2 border-t border-border">
                        {/* File upload for evidence */}
                        {(activeModulo.evidencia_obrigatoria ||
                          activeModulo.tipo === "atividade_pratica" ||
                          activeModulo.tipo === "reflexao" ||
                          activeModulo.tipo === "microdesafio" ||
                          activeModulo.tipo === "estudo_caso") && (
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">
                              Anexar evidência (foto, PDF, documento)
                            </label>
                            <EvidenciaUpload
                              file={evidenciaFile}
                              onFileChange={setEvidenciaFile}
                              disabled={concluindo}
                            />
                          </div>
                        )}

                        {activeModulo.evidencia_obrigatoria && (
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">
                              Descrição da evidência
                            </label>
                            <Textarea
                              placeholder="Descreva como você aplicou este conhecimento no trabalho..."
                              value={evidenciaTexto}
                              onChange={(e) => setEvidenciaTexto(e.target.value)}
                              rows={3}
                            />
                          </div>
                        )}

                        {(activeModulo.tipo === "atividade_pratica" ||
                          activeModulo.tipo === "reflexao" ||
                          activeModulo.tipo === "microdesafio" ||
                          activeModulo.tipo === "estudo_caso") &&
                          !activeModulo.evidencia_obrigatoria && (
                            <div>
                              <label className="text-sm font-medium text-foreground mb-1.5 block">
                                Sua resposta / reflexão (opcional)
                              </label>
                              <Textarea
                                placeholder="Compartilhe o que aprendeu ou como aplicou..."
                                value={evidenciaTexto}
                                onChange={(e) => setEvidenciaTexto(e.target.value)}
                                rows={3}
                              />
                            </div>
                          )}

                        <Button
                          onClick={handleConcluir}
                          disabled={
                            concluindo ||
                            (activeModulo.evidencia_obrigatoria && !evidenciaTexto.trim() && !evidenciaFile)
                          }
                          className="w-full"
                        >
                          {concluindo ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                          )}
                          Concluir módulo
                        </Button>
                      </div>
                    )}

                    {activeStatus === "concluido" && (
                      <div className="flex items-center gap-2 text-success bg-success/5 rounded-lg p-3 border border-success/20">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="text-sm font-medium">Módulo concluído!</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20 bg-card rounded-xl border border-border"
              >
                <BookOpen className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" strokeWidth={1.5} />
                <p className="text-muted-foreground text-sm">
                  Selecione um módulo ao lado para começar
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
