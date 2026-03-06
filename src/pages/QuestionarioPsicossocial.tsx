import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  CheckCircle2,
  Clock,
  Shield,
  AlertCircle,
  Loader2,
  UserCheck,
  UserX,
  FileText,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { usePsicossocial } from "@/hooks/usePsicossocial";
import { QuestionarioResponder } from "@/components/avaliacoes/psicossocial/QuestionarioResponder";
import {
  type ConvitePsicossocial,
  type CampanhaPsicossocial,
  type InstrumentoPsicossocial,
} from "@/types/psicossocial";
import { toast } from "sonner";
import logoSeguramente from "@/assets/logo-seguramente.png";
import { getDimensoesByInstrumento } from "@/data/instrumentos";

type EtapaQuestionario = 'consentimento' | 'identificacao' | 'questionario' | 'concluido';

function getInstrumentoLabel(instrumento?: string) {
  switch (instrumento) {
    case 'copsoq': return 'COPSOQ III — 13 dimensões psicossociais';
    case 'hse': return 'HSE Management Standards — 7 padrões';
    case 'proart': return 'PROART — Protocolo de Avaliação de Riscos';
    default: return 'Questionário Psicossocial';
  }
}

function getTotalPerguntas(instrumento?: string) {
  const dims = getDimensoesByInstrumento(
    (instrumento as 'copsoq' | 'hse' | 'ambos') || 'copsoq'
  );
  return dims.reduce((acc, d) => acc + d.perguntas.length, 0);
}

export default function QuestionarioPsicossocial() {
  const { token } = useParams<{ token: string }>();
  const startTime = useRef(Date.now());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [convite, setConvite] = useState<ConvitePsicossocial | null>(null);
  const [campanha, setCampanha] = useState<CampanhaPsicossocial | null>(null);
  const [etapa, setEtapa] = useState<EtapaQuestionario>('consentimento');
  const [identificacaoVoluntaria, setIdentificacaoVoluntaria] = useState(false);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const { buscarConvitePorToken, atualizarConvitePublico, salvarRespostaPublica } = usePsicossocial();

  useEffect(() => {
    const loadConvite = async () => {
      if (!token) {
        setError("Token não fornecido");
        setLoading(false);
        return;
      }

      try {
        const data = await buscarConvitePorToken(token);

        if (!data) {
          setError("Link inválido ou expirado");
          setLoading(false);
          return;
        }

        if (data.status === 'concluido') {
          setEtapa('concluido');
          setLoading(false);
          return;
        }

        if (data.status === 'expirado') {
          setError("Este questionário expirou");
          setLoading(false);
          return;
        }

        if (data.campanha.status !== 'ativa') {
          setError("Esta campanha não está mais ativa");
          setLoading(false);
          return;
        }

        setConvite(data);
        setCampanha(data.campanha);

        if (data.status === 'pendente') {
          await atualizarConvitePublico(token, 'iniciado');
        }

        setLoading(false);
      } catch (err) {
        console.error("Erro ao carregar questionário:", err);
        setError("Erro ao carregar o questionário");
        setLoading(false);
      }
    };

    loadConvite();
  }, [token]);

  const instrumento = (campanha?.instrumento || 'copsoq') as InstrumentoPsicossocial;
  const totalPerguntas = getTotalPerguntas(instrumento);
  const tempoEstimado = Math.ceil(totalPerguntas * 0.4); // ~24s por pergunta

  const handleRespostaChange = (perguntaId: string, valor: number) => {
    setRespostas(prev => ({ ...prev, [perguntaId]: valor }));
  };

  const handleSubmit = async () => {
    if (!convite || !campanha) {
      toast.error("Erro interno. Tente recarregar a página.");
      return;
    }

    setSubmitting(true);
    try {
      const tempoSegundos = Math.floor((Date.now() - startTime.current) / 1000);
      const conviteCompleto = { ...convite, campanha };
      await salvarRespostaPublica(conviteCompleto, respostas, tempoSegundos, identificacaoVoluntaria);
      setEtapa('concluido');
      toast.success("Respostas enviadas com sucesso!");
    } catch (err) {
      console.error("Erro ao enviar respostas:", err);
      const anyErr = err as { message?: string; details?: string; hint?: string; code?: string };
      const message = anyErr?.message || "Erro ao enviar respostas. Tente novamente.";
      const extra = [anyErr?.code, anyErr?.details, anyErr?.hint].filter(Boolean).join(" • ");
      toast.error(extra ? `${message} (${extra})` : message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConsentimento = () => {
    if (campanha?.anonimo && campanha?.permite_identificacao_voluntaria) {
      setEtapa('identificacao');
    } else {
      setIdentificacaoVoluntaria(!campanha?.anonimo);
      setEtapa('questionario');
    }
  };

  const handleEscolhaIdentificacao = (identificar: boolean) => {
    setIdentificacaoVoluntaria(identificar);
    setEtapa('questionario');
  };

  // ─── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <Brain className="h-16 w-16 text-violet-400" />
            <Loader2 className="h-5 w-5 animate-spin text-violet-600 absolute -bottom-1 -right-1" />
          </div>
          <p className="text-muted-foreground text-sm">Carregando questionário...</p>
        </div>
      </div>
    );
  }

  // ─── Erro ──────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <div>
              <h2 className="text-xl font-semibold mb-1">Não foi possível carregar</h2>
              <p className="text-muted-foreground text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Consentimento (LGPD) ──────────────────────────────────
  if (etapa === 'consentimento') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 flex items-center justify-center p-4">
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg w-full"
          >
            <Card className="shadow-xl border-0 ring-1 ring-black/5">
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <Brain className="h-8 w-8 text-white" />
                  </div>
                </div>
                <CardTitle className="text-2xl">Avaliação Psicossocial</CardTitle>
                <CardDescription className="text-base font-medium">{campanha?.nome}</CardDescription>
                <p className="text-xs text-muted-foreground mt-1">{getInstrumentoLabel(instrumento)}</p>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Política LGPD */}
                <div className="bg-muted/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Política de Dados (LGPD)</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {campanha?.politica_uso_dados ||
                      "Suas respostas serão utilizadas exclusivamente para fins de diagnóstico organizacional e melhoria das condições de trabalho, conforme a LGPD."}
                  </p>
                </div>

                {/* Anonimato */}
                {campanha?.anonimo && (
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <Shield className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-emerald-800 text-sm">Questionário Anônimo</p>
                      <p className="text-xs text-emerald-700">Seu nome e CPF não serão vinculados às respostas.</p>
                    </div>
                  </div>
                )}

                {/* Detalhes */}
                <div className="flex items-center justify-center gap-6 py-2">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>~{tempoEstimado} min</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Sparkles className="h-4 w-4" />
                    <span>{totalPerguntas} questões</span>
                  </div>
                </div>

                <Button
                  onClick={handleConsentimento}
                  className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-md"
                  size="lg"
                >
                  Iniciar Questionário
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Ao continuar, você concorda com a política de uso dos dados acima.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // ─── Escolha de identificação ──────────────────────────────
  if (etapa === 'identificacao') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg w-full"
        >
          <Card className="shadow-xl border-0 ring-1 ring-black/5">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <Shield className="h-8 w-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-xl">Como deseja responder?</CardTitle>
              <CardDescription>Você escolhe o nível de privacidade</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {campanha?.mensagem_institucional && (
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <p className="text-sm text-blue-800 leading-relaxed">{campanha.mensagem_institucional}</p>
                </div>
              )}

              <button
                onClick={() => handleEscolhaIdentificacao(false)}
                className="w-full p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 transition-all text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
                    <UserX className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-emerald-800 text-sm">Responder Anonimamente</h3>
                    <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                      Suas respostas não serão vinculadas ao seu nome. Recomendado para maior liberdade de expressão.
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleEscolhaIdentificacao(true)}
                className="w-full p-4 rounded-xl border-2 border-blue-200 bg-blue-50/50 hover:bg-blue-100 transition-all text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                    <UserCheck className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-800 text-sm">Me Identificar Voluntariamente</h3>
                    <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                      Permite acompanhamento individual pelo RH, se necessário.
                    </p>
                  </div>
                </div>
              </button>

              {convite?.colaborador_nome && (
                <p className="text-xs text-center text-muted-foreground pt-1">
                  Respondendo como: <strong>{convite.colaborador_nome}</strong>
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ─── Conclusão ─────────────────────────────────────────────
  if (etapa === 'concluido') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="max-w-md w-full"
        >
          <Card className="shadow-xl border-0 ring-1 ring-black/5">
            <CardContent className="pt-10 pb-10 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Obrigado!</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Suas respostas foram registradas com sucesso e contribuirão para um ambiente de trabalho mais saudável.
                </p>
              </div>

              {campanha?.anonimo && !identificacaoVoluntaria && (
                <div className="flex items-center justify-center gap-2 text-emerald-600 text-sm bg-emerald-50 rounded-lg p-3">
                  <Shield className="h-4 w-4" />
                  <span>Respostas anônimas registradas</span>
                </div>
              )}
              {identificacaoVoluntaria && (
                <div className="flex items-center justify-center gap-2 text-blue-600 text-sm bg-blue-50 rounded-lg p-3">
                  <UserCheck className="h-4 w-4" />
                  <span>Você optou por se identificar</span>
                </div>
              )}

              <img
                src={logoSeguramente}
                alt="Seguramente"
                className="h-7 mx-auto opacity-50 mt-4"
              />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ─── Questionário (etapa principal) ────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50">
      {/* Header */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b z-20 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-sm">Seguramente</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {getInstrumentoLabel(instrumento)}
          </span>
        </div>
      </header>

      {/* Questionário */}
      <main className="max-w-2xl mx-auto p-4 py-6">
        <QuestionarioResponder
          instrumento={instrumento}
          respostas={respostas}
          onRespostaChange={handleRespostaChange}
          onConcluir={handleSubmit}
          nomeCampanha={campanha?.nome}
        />

        {submitting && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <Card className="p-6 flex flex-col items-center gap-3 shadow-2xl">
              <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
              <p className="text-sm font-medium">Enviando respostas...</p>
            </Card>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-muted-foreground">
        <img src={logoSeguramente} alt="Seguramente" className="h-5 mx-auto opacity-40 mb-2" />
        Seus dados estão protegidos pela LGPD
      </footer>
    </div>
  );
}
