import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Loader2, CheckCircle2, PenLine, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Sugestao {
  titulo: string;
  descricao: string;
  como: string;
  porque: string;
  onde: string;
  prioridade: "baixa" | "media" | "alta" | "critica";
}

const mapPrioridade = (p: string): "baixo" | "medio" | "urgente" | "imediato" => {
  if (p === "critica") return "imediato";
  if (p === "alta") return "urgente";
  if (p === "media") return "medio";
  return "baixo";
};

interface GerarAcaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerta: {
    id: string;
    tipo: string;
    titulo: string;
    descricao: string;
    colaborador_nome: string;
  } | null;
}

const SUGESTOES_MOCK: Record<string, Sugestao[]> = {
  aso_retorno: [
    {
      titulo: "Agendar ASO de Retorno ao Trabalho",
      descricao: "Agendar exame médico ocupacional de retorno ao trabalho antes do colaborador reassumir suas atividades.",
      como: "1. Contatar clínica ocupacional parceira\n2. Agendar exame com médico do trabalho\n3. Encaminhar colaborador com documentação do afastamento\n4. Registrar resultado no sistema",
      porque: "Exigência legal NR-7 — afastamento ≥30 dias requer ASO de retorno antes de reassumir atividades.",
      onde: "Clínica de Medicina Ocupacional",
      prioridade: "alta",
    },
    {
      titulo: "Notificar Gestor sobre Retorno do Colaborador",
      descricao: "Comunicar o gestor imediato sobre o retorno do colaborador e necessidade do ASO antes da volta ao trabalho.",
      como: "1. Enviar comunicado ao gestor imediato\n2. Orientar sobre restrições médicas temporárias\n3. Planejar readaptação gradual se necessário",
      porque: "O gestor precisa estar ciente do retorno para planejar a reintegração com segurança.",
      onde: "Setor/Departamento do colaborador",
      prioridade: "media",
    },
  ],
  encaminhamento_inss: [
    {
      titulo: "Encaminhar Colaborador ao INSS",
      descricao: "Preparar documentação e encaminhar colaborador para perícia médica do INSS devido a afastamento acumulado superior a 15 dias.",
      como: "1. Reunir atestados e documentos médicos\n2. Preencher requerimento de benefício (B31 ou B91)\n3. Agendar perícia médica no INSS\n4. Acompanhar resultado e registrar no sistema",
      porque: "Afastamento acumulado >15 dias pelo mesmo grupo clínico exige encaminhamento ao INSS.",
      onde: "Agência do INSS / Portal Meu INSS",
      prioridade: "alta",
    },
    {
      titulo: "Orientar Colaborador sobre Benefícios INSS",
      descricao: "Realizar reunião com o colaborador para orientá-lo sobre seus direitos e o processo de solicitação de benefício junto ao INSS.",
      como: "1. Agendar reunião com colaborador e RH\n2. Explicar processo e documentos necessários\n3. Auxiliar no preenchimento do requerimento\n4. Acompanhar até conclusão",
      porque: "O colaborador precisa estar ciente de seus direitos e do processo para garantir seu benefício.",
      onde: "RH / Departamento Pessoal",
      prioridade: "media",
    },
  ],
};

const DEFAULT_SUGESTOES: Sugestao[] = [
  {
    titulo: "Monitorar Situação do Colaborador",
    descricao: "Acompanhar de perto a situação de saúde e afastamento do colaborador para adotar as medidas necessárias.",
    como: "1. Agendar reunião com colaborador\n2. Verificar situação atual\n3. Definir plano de acompanhamento\n4. Registrar ações tomadas",
    porque: "Monitoramento contínuo permite identificar riscos e adotar medidas preventivas a tempo.",
    onde: "RH / Medicina do Trabalho",
    prioridade: "media",
  },
];

export function GerarAcaoModal({ open, onOpenChange, alerta }: GerarAcaoModalProps) {
  const navigate = useNavigate();
  const { tenantId, user, profile } = useAuth();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [criando, setCriando] = useState(false);

  const sugestoes = alerta
    ? (SUGESTOES_MOCK[alerta.tipo] || DEFAULT_SUGESTOES)
    : [];

  const handleCriarAcao = async (sugestao: Sugestao) => {
    if (!tenantId || !user || !alerta) return;
    setCriando(true);
    try {
      const prazo = new Date();
      prazo.setDate(prazo.getDate() + 7);

      const prioridadeMapeada = mapPrioridade(sugestao.prioridade);

      // Build payload without responsavel_id to avoid UUID issues
      const payload: Record<string, unknown> = {
        tenant_id: tenantId,
        titulo: sugestao.titulo,
        descricao: sugestao.descricao,
        porque: sugestao.porque,
        onde: sugestao.onde,
        prazo: prazo.toISOString().split("T")[0],
        como: sugestao.como,
        responsavel_nome: profile?.nome_completo || user.email || "Não definido",
        prioridade: prioridadeMapeada,
        status: "pendente",
        origem_modulo: "atestados",
        origem_descricao: `Alerta: ${alerta.descricao}`,
        criado_por: user.id,
        criado_por_nome: profile?.nome_completo || user.email,
      };

      const { error } = await supabase
        .from("plano_acoes")
        .insert(payload as any);

      if (error) throw error;

      // Mark DB alert with action if applicable
      if (alerta.id && !alerta.id.startsWith("aso-") && !alerta.id.startsWith("15dias-") && !alerta.id.startsWith("b91-")) {
        await fromTable("alertas_saude")
          .update({ resolvido: true, resolvido_em: new Date().toISOString() } as any)
          .eq("id", alerta.id);
      }

      toast.success("Ação criada com sucesso!", {
        action: {
          label: "Ver no Plano de Ação",
          onClick: () => navigate("/plano-acao"),
        },
      });
      onOpenChange(false);
      setSelectedIndex(null);
    } catch (err: any) {
      toast.error("Erro ao criar ação: " + err.message);
    } finally {
      setCriando(false);
    }
  };

  const prioridadeColor = {
    baixa: "bg-green-100 text-green-700 border-green-300",
    media: "bg-blue-100 text-blue-700 border-blue-300",
    alta: "bg-amber-100 text-amber-700 border-amber-300",
    critica: "bg-red-100 text-red-700 border-red-300",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Sugestões de Ação — IA
          </DialogTitle>
          <DialogDescription>
            Selecione uma sugestão baseada no alerta ou crie uma ação manualmente no módulo Plano de Ação.
          </DialogDescription>
        </DialogHeader>

        {alerta && (
          <div className="p-3 rounded-lg bg-muted/50 border text-sm mb-2">
            <p className="font-medium">{alerta.titulo}</p>
            <p className="text-muted-foreground mt-0.5">{alerta.descricao}</p>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Sugestões geradas pela IA
          </p>
          {sugestoes.map((s, i) => (
            <div
              key={i}
              onClick={() => setSelectedIndex(i === selectedIndex ? null : i)}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                selectedIndex === i
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-medium text-sm">{s.titulo}</p>
                    <Badge variant="outline" className={`text-[10px] ${prioridadeColor[s.prioridade]}`}>
                      {s.prioridade}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.descricao}</p>
                  {selectedIndex === i && (
                    <div className="mt-3 space-y-2 text-xs">
                      <div><span className="font-medium text-foreground">Por quê:</span> <span className="text-muted-foreground">{s.porque}</span></div>
                      <div><span className="font-medium text-foreground">Onde:</span> <span className="text-muted-foreground">{s.onde}</span></div>
                      <div>
                        <span className="font-medium text-foreground">Como:</span>
                        <pre className="text-muted-foreground whitespace-pre-wrap font-sans mt-0.5">{s.como}</pre>
                      </div>
                    </div>
                  )}
                </div>
                {selectedIndex === i && (
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => { onOpenChange(false); navigate("/plano-acao"); }}
          >
            <PenLine className="h-4 w-4" />
            Criar manualmente
          </Button>
          <Button
            className="flex-1 gap-2"
            disabled={selectedIndex === null || criando}
            onClick={() => selectedIndex !== null && handleCriarAcao(sugestoes[selectedIndex])}
          >
            {criando ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Criando...</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" /> Criar ação selecionada</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
