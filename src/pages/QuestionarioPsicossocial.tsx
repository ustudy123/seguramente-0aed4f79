import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Brain, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Clock,
  Shield,
  AlertCircle,
  Loader2,
  UserCheck,
  UserX,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { usePsicossocial } from "@/hooks/usePsicossocial";
import { 
  ESCALA_RESPOSTAS, 
  obterTodosBlocos, 
  obterTodasPerguntas,
  type ConvitePsicossocial,
  type CampanhaPsicossocial,
} from "@/types/psicossocial";
import { toast } from "sonner";
import logoSeguramente from "@/assets/logo-seguramente.png";

type EtapaQuestionario = 'consentimento' | 'identificacao' | 'questionario' | 'concluido';

export default function QuestionarioPsicossocial() {
  const { token } = useParams<{ token: string }>();
  const startTime = useRef(Date.now());
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [convite, setConvite] = useState<ConvitePsicossocial | null>(null);
  const [campanha, setCampanha] = useState<CampanhaPsicossocial | null>(null);
  const [etapa, setEtapa] = useState<EtapaQuestionario>('consentimento');
  const [identificacaoVoluntaria, setIdentificacaoVoluntaria] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const { buscarConvitePorToken, atualizarConvitePublico, salvarRespostaPublica } = usePsicossocial();

  // Carregar convite
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

        // Verificar se campanha está ativa
        if (data.campanha.status !== 'ativa') {
          setError("Esta campanha não está mais ativa");
          setLoading(false);
          return;
        }

        setConvite(data);
        setCampanha(data.campanha);

        // Marcar como iniciado se ainda está pendente
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

  // Obter perguntas baseado na campanha
  const perguntas = campanha 
    ? obterTodasPerguntas(campanha.blocos_dinamicos || [])
    : [];

  const blocos = campanha 
    ? obterTodosBlocos(campanha.blocos_dinamicos || [])
    : [];

  const totalPerguntas = perguntas.length;
  const progresso = ((currentIndex + 1) / totalPerguntas) * 100;
  const perguntaAtual = perguntas[currentIndex];

  // Encontrar o bloco da pergunta atual
  const blocoAtual = blocos.find(b => b.id === perguntaAtual?.blocoId);

  // Tempo estimado restante
  const perguntasRestantes = totalPerguntas - Object.keys(respostas).length;
  const tempoEstimado = Math.ceil(perguntasRestantes * 0.3);

  const handleResposta = (valor: number) => {
    if (!perguntaAtual) return;
    
    setRespostas(prev => ({
      ...prev,
      [perguntaAtual.id]: valor
    }));

    // Avançar automaticamente após pequeno delay
    setTimeout(() => {
      if (currentIndex < totalPerguntas - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    }, 300);
  };

  const handleAnterior = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleProximo = () => {
    if (currentIndex < totalPerguntas - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleSubmit = async () => {
    if (!convite || !campanha || Object.keys(respostas).length < totalPerguntas) {
      toast.error("Por favor, responda todas as perguntas");
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
    // Se campanha permite identificação voluntária e é anônima, mostrar tela de escolha
    if (campanha?.anonimo && campanha?.permite_identificacao_voluntaria) {
      setEtapa('identificacao');
    } else {
      // Caso contrário, ir direto para o questionário
      setIdentificacaoVoluntaria(!campanha?.anonimo);
      setEtapa('questionario');
    }
  };

  const handleEscolhaIdentificacao = (identificar: boolean) => {
    setIdentificacaoVoluntaria(identificar);
    setEtapa('questionario');
  };

  // Tela de loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando questionário...</p>
        </div>
      </div>
    );
  }

  // Tela de erro
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Erro</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de consentimento (LGPD)
  if (etapa === 'consentimento') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Brain className="h-12 w-12 text-purple-600" />
            </div>
            <CardTitle className="text-2xl">Avaliação Psicossocial</CardTitle>
            <CardDescription>
              {campanha?.nome}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Política de uso dos dados */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-gray-600" />
                <h3 className="font-medium">Política de Uso dos Dados</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {campanha?.politica_uso_dados || 
                  "Suas respostas serão utilizadas exclusivamente para fins de diagnóstico organizacional e melhoria das condições de trabalho. Os dados são tratados de acordo com a LGPD."}
              </p>
            </div>

            {/* Indicador de anonimato */}
            {campanha?.anonimo && (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <Shield className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-emerald-800">Questionário Anônimo</p>
                  <p className="text-sm text-emerald-700">
                    Seu nome e CPF não serão vinculados às respostas.
                  </p>
                </div>
              </div>
            )}

            {/* Tempo estimado */}
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Tempo estimado: ~{Math.ceil(totalPerguntas * 0.3)} minutos</span>
            </div>

            <Button 
              onClick={handleConsentimento} 
              className="w-full bg-purple-600 hover:bg-purple-700"
              size="lg"
            >
              Iniciar Questionário
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Ao continuar, você concorda com a política de uso dos dados.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de escolha de identificação
  if (etapa === 'identificacao') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Shield className="h-12 w-12 text-purple-600" />
            </div>
            <CardTitle className="text-xl">Como deseja responder?</CardTitle>
            <CardDescription>
              Você pode escolher se quer se identificar ou permanecer anônimo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mensagem institucional */}
            {campanha?.mensagem_institucional && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-blue-800 leading-relaxed">
                  {campanha.mensagem_institucional}
                </p>
              </div>
            )}

            {/* Opção Anônimo */}
            <button
              onClick={() => handleEscolhaIdentificacao(false)}
              className="w-full p-4 rounded-lg border-2 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 transition-colors text-left"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <UserX className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-medium text-emerald-800">Responder Anonimamente</h3>
                  <p className="text-sm text-emerald-700 mt-1">
                    Suas respostas não serão vinculadas ao seu nome. Recomendado para maior liberdade de expressão.
                  </p>
                </div>
              </div>
            </button>

            {/* Opção Identificado */}
            <button
              onClick={() => handleEscolhaIdentificacao(true)}
              className="w-full p-4 rounded-lg border-2 border-blue-200 bg-blue-50/50 hover:bg-blue-100 transition-colors text-left"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <UserCheck className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-blue-800">Me Identificar Voluntariamente</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Permite que o RH/Saúde entre em contato para acompanhamento individual, se necessário.
                  </p>
                </div>
              </div>
            </button>

            <p className="text-xs text-center text-muted-foreground pt-2">
              {convite?.colaborador_nome && (
                <span>Respondendo como: <strong>{convite.colaborador_nome}</strong></span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de conclusão
  if (etapa === 'concluido') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Obrigado!</h2>
            <p className="text-muted-foreground mb-6">
              Suas respostas foram registradas com sucesso.
              {campanha?.anonimo && !identificacaoVoluntaria && (
                <span className="block mt-2 text-sm">
                  <Shield className="inline h-4 w-4 mr-1" />
                  Suas respostas são anônimas.
                </span>
              )}
              {identificacaoVoluntaria && (
                <span className="block mt-2 text-sm">
                  <UserCheck className="inline h-4 w-4 mr-1" />
                  Você optou por se identificar para acompanhamento.
                </span>
              )}
            </p>
            <img 
              src={logoSeguramente} 
              alt="Seguramente" 
              className="h-8 mx-auto opacity-60"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Questionário
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex flex-col">
      {/* Header fixo */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-sm border-b z-10 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-600" />
            <span className="font-semibold text-sm">Seguramente</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>~{tempoEstimado} min</span>
          </div>
        </div>
      </header>

      {/* Progresso */}
      <div className="px-4 py-2 bg-white/50">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Pergunta {currentIndex + 1} de {totalPerguntas}</span>
            <span className="font-medium">{Math.round(progresso)}%</span>
          </div>
          <Progress value={progresso} className="h-2" />
        </div>
      </div>

      {/* Conteúdo principal */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.2 }}
            >
              {/* Bloco/Categoria */}
              {blocoAtual && (
                <div className="text-center mb-4">
                  <span className="text-xs font-medium text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
                    {blocoAtual.titulo}
                  </span>
                </div>
              )}

              {/* Pergunta */}
              <Card className="shadow-lg">
                <CardContent className="pt-6 pb-8">
                  <p className="text-lg font-medium text-center mb-8 leading-relaxed">
                    {perguntaAtual?.texto}
                  </p>

                  {/* Opções de resposta */}
                  <div className="grid grid-cols-5 gap-2">
                    {ESCALA_RESPOSTAS.map((opcao) => (
                      <button
                        key={opcao.valor}
                        onClick={() => handleResposta(opcao.valor)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                          respostas[perguntaAtual?.id] === opcao.valor
                            ? 'border-purple-500 bg-purple-50 scale-105'
                            : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                        }`}
                      >
                        <span className="text-2xl mb-1">{opcao.emoji}</span>
                        <span className="text-xs text-center leading-tight">
                          {opcao.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer com navegação */}
      <footer className="sticky bottom-0 bg-white/80 backdrop-blur-sm border-t px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleAnterior}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>

          {currentIndex === totalPerguntas - 1 ? (
            <Button 
              onClick={handleSubmit}
              disabled={submitting || Object.keys(respostas).length < totalPerguntas}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  Enviar Respostas
                  <CheckCircle2 className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={handleProximo}
              disabled={respostas[perguntaAtual?.id] === undefined}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </footer>

      {/* Indicador de anonimato */}
      {campanha?.anonimo && !identificacaoVoluntaria && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2">
          <span className="text-xs text-muted-foreground flex items-center gap-1 bg-white/80 px-3 py-1 rounded-full shadow-sm">
            <Shield className="h-3 w-3" />
            Respostas anônimas
          </span>
        </div>
      )}
      {identificacaoVoluntaria && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2">
          <span className="text-xs text-blue-600 flex items-center gap-1 bg-blue-50 px-3 py-1 rounded-full shadow-sm border border-blue-200">
            <UserCheck className="h-3 w-3" />
            Identificado voluntariamente
          </span>
        </div>
      )}
    </div>
  );
}
