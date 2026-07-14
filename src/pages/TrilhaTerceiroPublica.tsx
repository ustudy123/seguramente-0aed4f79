import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, CheckCircle2, Circle, PlayCircle, Video, FileText, Link2,
  Presentation, HelpCircle, Wrench, CheckSquare, Brain, Lightbulb, Zap,
  ExternalLink, Star, Clock, Loader2, Shield, ArrowRight, Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabasePublic } from "@/lib/supabasePublic";
import { getEmbedUrl } from "@/lib/embedVideo";
import { toast } from "sonner";
import type { TrilhaModuloTipo } from "@/types/trilha";
import { MODULO_TIPO_LABELS } from "@/types/trilha";

const moduloIcons: Record<TrilhaModuloTipo, React.ElementType> = {
  video: Video, pdf: FileText, link: Link2, apresentacao: Presentation,
  conteudo_interno: BookOpen, quiz: HelpCircle, atividade_pratica: Wrench,
  checklist: CheckSquare, reflexao: Brain, estudo_caso: Lightbulb, microdesafio: Zap,
};

interface TrilhaData {
  id: string;
  nome: string;
  descricao: string | null;
  objetivo: string | null;
  tenant_id: string;
  total_modulos: number;
}

interface ModuloData {
  id: string;
  titulo: string;
  descricao: string | null;
  objetivo: string | null;
  tipo: TrilhaModuloTipo;
  conteudo_url: string | null;
  conteudo_texto: string | null;
  tempo_estimado_min: number;
  pontuacao: number;
  ordem: number;
  evidencia_obrigatoria: boolean;
}

interface ProgressoData {
  modulo_id: string;
  status: string;
  pontos_obtidos: number;
}

export default function TrilhaTerceiroPublica() {
  const { token } = useParams<{ token: string }>();
  const [trilha, setTrilha] = useState<TrilhaData | null>(null);
  const [modulos, setModulos] = useState<ModuloData[]>([]);
  const [progresso, setProgresso] = useState<ProgressoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModuloId, setActiveModuloId] = useState<string | null>(null);
  const [evidenciaTexto, setEvidenciaTexto] = useState("");
  const [concluindo, setConcluindo] = useState(false);

  // Identification
  const [identified, setIdentified] = useState(false);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [empresa, setEmpresa] = useState("");

  useEffect(() => {
    if (!token) { setError("Token inválido"); setLoading(false); return; }
    loadTrilha();
  }, [token]);

  const loadTrilha = async () => {
    try {
      const { data: trilhaData, error: tErr } = await supabasePublic
        .from("trilhas" as any)
        .select("id, nome, descricao, objetivo, tenant_id, total_modulos")
        .eq("token_publico", token)
        .eq("publico_terceiros", true)
        .maybeSingle() as { data: TrilhaData | null; error: any };
      if (tErr) throw tErr;
      if (!trilhaData) { setError("Trilha não encontrada ou link expirado."); setLoading(false); return; }
      setTrilha(trilhaData);

      const { data: modulosData, error: mErr } = await supabasePublic
        .from("trilha_modulos" as any)
        .select("id, titulo, descricao, objetivo, tipo, conteudo_url, conteudo_texto, tempo_estimado_min, pontuacao, ordem, evidencia_obrigatoria")
        .eq("trilha_id", trilhaData.id)
        .eq("ativo", true)
        .order("ordem") as { data: ModuloData[] | null; error: any };
      if (mErr) throw mErr;
      setModulos(modulosData || []);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar trilha.");
    } finally {
      setLoading(false);
    }
  };

  const loadProgresso = async () => {
    if (!trilha || !cpf) return;
    const { data } = await supabasePublic
      .from("trilha_terceiro_progresso" as any)
      .select("modulo_id, status, pontos_obtidos")
      .eq("trilha_id", trilha.id)
      .eq("terceiro_cpf", cpf) as { data: ProgressoData[] | null; error: any };
    setProgresso(data || []);
  };

  const handleIdentify = async () => {
    if (!nome.trim() || !cpf.trim()) { toast.error("Preencha nome e CPF."); return; }
    setIdentified(true);
    // Load existing progress
    setTimeout(loadProgresso, 100);
  };

  const getModuloStatus = (moduloId: string) => {
    const p = progresso.find((pr) => pr.modulo_id === moduloId);
    return p?.status || "nao_iniciado";
  };

  const handleOpenModulo = async (modulo: ModuloData) => {
    setActiveModuloId(modulo.id);
    setEvidenciaTexto("");
    const status = getModuloStatus(modulo.id);
    if (status === "nao_iniciado" && trilha) {
      await supabasePublic.from("trilha_terceiro_progresso" as any).upsert({
        tenant_id: trilha.tenant_id,
        trilha_id: trilha.id,
        modulo_id: modulo.id,
        terceiro_nome: nome,
        terceiro_cpf: cpf,
        terceiro_empresa: empresa || null,
        status: "em_andamento",
        data_inicio: new Date().toISOString(),
      } as never, { onConflict: "tenant_id,trilha_id,modulo_id,terceiro_cpf" });
      await loadProgresso();
    }
  };

  const handleConcluir = async () => {
    if (!trilha || !activeModuloId) return;
    const modulo = modulos.find((m) => m.id === activeModuloId);
    if (!modulo) return;
    setConcluindo(true);
    try {
      const { error } = await supabasePublic.from("trilha_terceiro_progresso" as any).upsert({
        tenant_id: trilha.tenant_id,
        trilha_id: trilha.id,
        modulo_id: modulo.id,
        terceiro_nome: nome,
        terceiro_cpf: cpf,
        terceiro_empresa: empresa || null,
        status: "concluido",
        data_inicio: new Date().toISOString(),
        data_conclusao: new Date().toISOString(),
        evidencia_texto: evidenciaTexto || null,
        pontos_obtidos: modulo.pontuacao || 0,
      } as never, { onConflict: "tenant_id,trilha_id,modulo_id,terceiro_cpf" });
      if (error) throw error;
      toast.success("Módulo concluído! 🎉");
      setActiveModuloId(null);
      setEvidenciaTexto("");
      await loadProgresso();
    } catch (err: any) {
      toast.error(err.message || "Erro ao concluir módulo.");
    } finally {
      setConcluindo(false);
    }
  };

  const totalConcluidos = progresso.filter((p) => p.status === "concluido").length;
  const percentual = modulos.length > 0 ? Math.round((totalConcluidos / modulos.length) * 100) : 0;
  const pontosObtidos = progresso.reduce((s, p) => s + (p.pontos_obtidos || 0), 0);
  const pontosTotal = modulos.reduce((s, m) => s + (m.pontuacao || 0), 0);
  const activeModulo = modulos.find((m) => m.id === activeModuloId);
  const activeStatus = activeModuloId ? getModuloStatus(activeModuloId) : "nao_iniciado";

  const statusIcon = (status: string) => {
    switch (status) {
      case "concluido": return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "em_andamento": return <PlayCircle className="w-5 h-5 text-blue-500" />;
      default: return <Circle className="w-5 h-5 text-gray-300" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Link inválido</h2>
            <p className="text-gray-500">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!identified || !trilha) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="max-w-md w-full">
            <CardContent className="p-8 space-y-6">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-7 h-7 text-purple-600" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">{trilha?.nome}</h1>
                {trilha?.descricao && (
                  <p className="text-sm text-gray-500 mt-2">{trilha.descricao}</p>
                )}
                <Badge className="mt-3 bg-purple-100 text-purple-700">
                  {modulos.length} módulos
                </Badge>
              </div>

              <div className="border-t pt-5 space-y-4">
                <p className="text-sm font-medium text-gray-700">Identifique-se para começar:</p>
                <div className="space-y-3">
                  <div>
                    <Label>Nome completo *</Label>
                    <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
                  </div>
                  <div>
                    <Label>CPF *</Label>
                    <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
                  </div>
                  <div>
                    <Label>Empresa (opcional)</Label>
                    <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Nome da empresa" />
                  </div>
                </div>
                <Button className="w-full" onClick={handleIdentify}>
                  Iniciar Trilha
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{trilha.nome}</h1>
            <p className="text-xs text-gray-500">{nome} • {empresa || "Terceiro"}</p>
          </div>
          <Badge className="bg-purple-100 text-purple-700">{percentual}%</Badge>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Progress */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-600" />
                {totalConcluidos}/{modulos.length} módulos
              </span>
              <span className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />
                {pontosObtidos}/{pontosTotal} pts
              </span>
            </div>
            <Progress value={percentual} className="h-2" />
            {percentual >= 100 && (
              <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                <Trophy className="w-5 h-5" />
                Parabéns! Trilha concluída! 🎉
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Modules sidebar */}
          <div className="lg:col-span-1 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Módulos</h3>
            {modulos.map((modulo, i) => {
              const Icon = moduloIcons[modulo.tipo] || BookOpen;
              const status = getModuloStatus(modulo.id);
              const isActive = activeModuloId === modulo.id;
              return (
                <button
                  key={modulo.id}
                  onClick={() => handleOpenModulo(modulo)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3",
                    isActive ? "border-purple-500 bg-purple-50 shadow-sm" : "border-gray-200 hover:border-purple-200 hover:bg-gray-50"
                  )}
                >
                  {statusIcon(status)}
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", status === "concluido" ? "text-gray-400 line-through" : "text-gray-900")}>
                      {modulo.titulo}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                      <Icon className="w-3 h-3" />
                      <span>{MODULO_TIPO_LABELS[modulo.tipo]}</span>
                      <span>•</span>
                      <span>{modulo.tempo_estimado_min}min</span>
                    </div>
                  </div>
                  {modulo.pontuacao > 0 && (
                    <Badge variant="outline" className="text-[10px] flex-shrink-0">{modulo.pontuacao}pts</Badge>
                  )}
                </button>
              );
            })}
          </div>

          {/* Content area */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {activeModulo ? (
                <motion.div key={activeModulo.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <Card>
                    <CardContent className="p-6 space-y-5">
                      <div>
                        <Badge variant="outline" className="text-xs mb-2">{MODULO_TIPO_LABELS[activeModulo.tipo]}</Badge>
                        <h3 className="text-lg font-semibold text-gray-900">{activeModulo.titulo}</h3>
                        {activeModulo.objetivo && <p className="text-sm text-gray-500 mt-1">{activeModulo.objetivo}</p>}
                      </div>

                      {activeModulo.conteudo_url && (
                        activeModulo.tipo === "video" ? (
                          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                            <iframe src={getEmbedUrl(activeModulo.conteudo_url)} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                          </div>
                        ) : activeModulo.tipo === "pdf" ? (
                          <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                            <iframe src={activeModulo.conteudo_url} className="w-full h-full" />
                          </div>
                        ) : (
                          <Button variant="outline" asChild>
                            <a href={activeModulo.conteudo_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2" /> Acessar conteúdo
                            </a>
                          </Button>
                        )
                      )}

                      {activeModulo.conteudo_texto && (
                        <div className="bg-gray-50 rounded-lg p-4 border">
                          <div className="whitespace-pre-wrap text-sm text-gray-700">{activeModulo.conteudo_texto}</div>
                        </div>
                      )}

                      {activeModulo.descricao && !activeModulo.conteudo_texto && (
                        <div className="bg-gray-50 rounded-lg p-4 border">
                          <p className="text-sm text-gray-700">{activeModulo.descricao}</p>
                        </div>
                      )}

                      {activeStatus !== "concluido" && (
                        <div className="space-y-3 pt-2 border-t">
                          {(activeModulo.evidencia_obrigatoria || ["atividade_pratica", "reflexao", "microdesafio", "estudo_caso"].includes(activeModulo.tipo)) && (
                            <div>
                              <Label>{activeModulo.evidencia_obrigatoria ? "Descrição da evidência *" : "Sua resposta (opcional)"}</Label>
                              <Textarea placeholder="Descreva..." value={evidenciaTexto} onChange={(e) => setEvidenciaTexto(e.target.value)} rows={3} />
                            </div>
                          )}
                          <Button onClick={handleConcluir} disabled={concluindo || (activeModulo.evidencia_obrigatoria && !evidenciaTexto.trim())} className="w-full">
                            {concluindo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            Concluir módulo
                          </Button>
                        </div>
                      )}

                      {activeStatus === "concluido" && (
                        <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-lg p-3 border border-green-200">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="text-sm font-medium">Módulo concluído!</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <div className="text-center py-20 bg-white rounded-xl border">
                  <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-400 text-sm">Selecione um módulo ao lado para começar</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
