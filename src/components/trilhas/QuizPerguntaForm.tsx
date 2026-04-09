import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useTrilhaQuiz } from "@/hooks/useTrilhaQuiz";
import type { TrilhaQuizPergunta } from "@/types/trilha";

interface QuizPerguntaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduloId: string;
  pergunta?: TrilhaQuizPergunta | null;
  nextOrdem?: number;
}

export function QuizPerguntaForm({
  open,
  onOpenChange,
  moduloId,
  pergunta,
  nextOrdem = 0,
}: QuizPerguntaFormProps) {
  const { criarPergunta, atualizarPergunta, criando } = useTrilhaQuiz(moduloId);
  const [texto, setTexto] = useState("");
  const [opcoes, setOpcoes] = useState<string[]>(["", "", "", ""]);
  const [respostaCorreta, setRespostaCorreta] = useState(0);

  useEffect(() => {
    if (pergunta) {
      setTexto(pergunta.pergunta);
      setOpcoes(pergunta.opcoes.length >= 2 ? [...pergunta.opcoes] : ["", "", "", ""]);
      setRespostaCorreta(pergunta.resposta_correta);
    } else {
      setTexto("");
      setOpcoes(["", "", "", ""]);
      setRespostaCorreta(0);
    }
  }, [pergunta, open]);

  const handleOpcaoChange = (index: number, value: string) => {
    setOpcoes((prev) => prev.map((o, i) => (i === index ? value : o)));
  };

  const addOpcao = () => {
    if (opcoes.length < 6) setOpcoes((prev) => [...prev, ""]);
  };

  const removeOpcao = (index: number) => {
    if (opcoes.length <= 2) return;
    setOpcoes((prev) => prev.filter((_, i) => i !== index));
    if (respostaCorreta >= opcoes.length - 1) setRespostaCorreta(0);
  };

  const handleSubmit = async () => {
    const validOpcoes = opcoes.filter((o) => o.trim());
    if (!texto.trim() || validOpcoes.length < 2) return;

    if (pergunta) {
      await atualizarPergunta({
        id: pergunta.id,
        pergunta: texto,
        opcoes: validOpcoes,
        resposta_correta: respostaCorreta,
      } as any);
    } else {
      await criarPergunta({
        modulo_id: moduloId,
        pergunta: texto,
        opcoes: validOpcoes,
        resposta_correta: respostaCorreta,
        ordem: nextOrdem,
      });
    }
    onOpenChange(false);
  };

  const validOpcoes = opcoes.filter((o) => o.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pergunta ? "Editar Pergunta" : "Nova Pergunta"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Pergunta *</Label>
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ex: Qual é o principal objetivo da ergonomia?"
            />
          </div>

          <div className="space-y-3">
            <Label>Opções de resposta (mín. 2)</Label>
            {opcoes.map((opcao, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground w-5">
                  {String.fromCharCode(65 + i)})
                </span>
                <Input
                  value={opcao}
                  onChange={(e) => handleOpcaoChange(i, e.target.value)}
                  placeholder={`Opção ${String.fromCharCode(65 + i)}`}
                  className="flex-1"
                />
                {opcoes.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeOpcao(i)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {opcoes.length < 6 && (
              <Button variant="outline" size="sm" onClick={addOpcao}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar opção
              </Button>
            )}
          </div>

          {validOpcoes.length >= 2 && (
            <div>
              <Label>Resposta correta *</Label>
              <RadioGroup
                value={String(respostaCorreta)}
                onValueChange={(v) => setRespostaCorreta(Number(v))}
                className="mt-2"
              >
                {opcoes.map((opcao, i) =>
                  opcao.trim() ? (
                    <div key={i} className="flex items-center gap-2">
                      <RadioGroupItem value={String(i)} id={`resp-${i}`} />
                      <label
                        htmlFor={`resp-${i}`}
                        className="text-sm text-foreground cursor-pointer"
                      >
                        {String.fromCharCode(65 + i)}) {opcao}
                      </label>
                    </div>
                  ) : null
                )}
              </RadioGroup>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!texto.trim() || validOpcoes.length < 2 || criando}
            >
              {criando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {pergunta ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
