import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Brain, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Clock,
  Shield,
  AlertCircle,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { usePsicossocial } from "@/hooks/usePsicossocial";
import { 
  ESCALA_RESPOSTAS, 
  obterTodosBlocos, 
  obterTodasPerguntas,
  type ConvitePsicossocial,
  type CampanhaPsicossocial,
  type PerguntaPsicossocial
} from "@/types/psicossocial";
import { toast } from "sonner";
import logoSeguramente from "@/assets/logo-seguramente.png";

export default function QuestionarioPsicossocial() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const startTime = useRef(Date.now());
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [convite, setConvite] = useState<ConvitePsicossocial | null>(null);
  const [campanha, setCampanha] = useState<CampanhaPsicossocial | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

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
          setCompleted(true);
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
  const tempoEstimado = Math.ceil(perguntasRestantes * 0.3); // ~18 segundos por pergunta

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
    if (!convite || Object.keys(respostas).length < totalPerguntas) {
      toast.error("Por favor, responda todas as perguntas");
      return;
    }

    setSubmitting(true);
    try {
      const tempoSegundos = Math.floor((Date.now() - startTime.current) / 1000);
      await salvarRespostaPublica(convite, respostas, tempoSegundos);
      setCompleted(true);
      toast.success("Respostas enviadas com sucesso!");
    } catch (err) {
      console.error("Erro ao enviar respostas:", err);
      toast.error("Erro ao enviar respostas. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
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

  // Tela de conclusão
  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Obrigado!</h2>
            <p className="text-muted-foreground mb-6">
              Suas respostas foram registradas com sucesso.
              {campanha?.anonimo && (
                <span className="block mt-2 text-sm">
                  <Shield className="inline h-4 w-4 mr-1" />
                  Suas respostas são anônimas.
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
              disabled={!respostas[perguntaAtual?.id]}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </footer>

      {/* Indicador de anonimato */}
      {campanha?.anonimo && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2">
          <span className="text-xs text-muted-foreground flex items-center gap-1 bg-white/80 px-3 py-1 rounded-full shadow-sm">
            <Shield className="h-3 w-3" />
            Respostas anônimas
          </span>
        </div>
      )}
    </div>
  );
}
