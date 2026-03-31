import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useColaboradores } from "@/hooks/useColaboradores";
import type { MetaParticipante } from "@/types/metas-module";

interface MetaParticipantesEditorProps {
  compartilhada: boolean;
  onCompartilhadaChange: (value: boolean) => void;
  participantes: Partial<MetaParticipante>[];
  onParticipantesChange: (participantes: Partial<MetaParticipante>[]) => void;
}

const PAPEL_OPTIONS = [
  { value: "co_responsavel", label: "Co-responsável" },
  { value: "apoio", label: "Apoio" },
  { value: "consultado", label: "Consultado" },
];

export function MetaParticipantesEditor({
  compartilhada,
  onCompartilhadaChange,
  participantes,
  onParticipantesChange,
}: MetaParticipantesEditorProps) {
  const { colaboradores, isLoading } = useColaboradores();
  const [participanteId, setParticipanteId] = useState("");
  const [papel, setPapel] = useState("co_responsavel");
  const [peso, setPeso] = useState("1");

  const colaboradoresDisponiveis = useMemo(
    () => colaboradores.filter((colaborador) => !participantes.some((item) => item.participante_id === colaborador.id)),
    [colaboradores, participantes],
  );

  const handleToggle = (checked: boolean) => {
    onCompartilhadaChange(checked);
    if (!checked) onParticipantesChange([]);
  };

  const handleAddParticipante = () => {
    if (!participanteId) return;

    const colaborador = colaboradores.find((item) => item.id === participanteId);
    if (!colaborador) return;

    onParticipantesChange([
      ...participantes,
      {
        participante_id: colaborador.id,
        participante_nome: colaborador.nome_completo,
        papel,
        peso: Number.isFinite(Number(peso)) ? Number(peso) : 1,
      },
    ]);

    setParticipanteId("");
    setPapel("co_responsavel");
    setPeso("1");
  };

  const handleUpdateParticipante = (index: number, updates: Partial<MetaParticipante>) => {
    onParticipantesChange(
      participantes.map((item, itemIndex) => (itemIndex === index ? { ...item, ...updates } : item)),
    );
  };

  const handleRemoveParticipante = (index: number) => {
    onParticipantesChange(participantes.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-primary" />
              Participantes colaborativos
            </div>
            <p className="text-sm text-muted-foreground">
              Marque a meta como compartilhada e distribua a co-responsabilidade entre colaboradores.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="meta-compartilhada">Meta compartilhada</Label>
            <Switch id="meta-compartilhada" checked={compartilhada} onCheckedChange={handleToggle} />
          </div>
        </div>

        {compartilhada && (
          <div className="space-y-4 rounded-lg border border-dashed border-border p-4">
            <div className="grid gap-3 md:grid-cols-[1.6fr_1fr_120px_auto]">
              <div className="space-y-1.5">
                <Label>Colaborador</Label>
                <Select value={participanteId} onValueChange={setParticipanteId}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        isLoading ? "Carregando colaboradores..." : "Selecione um colaborador"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {colaboradoresDisponiveis.map((colaborador) => (
                      <SelectItem key={colaborador.id} value={colaborador.id}>
                        {colaborador.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Papel</Label>
                <Select value={papel} onValueChange={setPapel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPEL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Peso</Label>
                <Input type="number" min="0" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} />
              </div>

              <div className="flex items-end">
                <Button type="button" onClick={handleAddParticipante} disabled={!participanteId || isLoading} className="w-full gap-2">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Adicionar
                </Button>
              </div>
            </div>

            {participantes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum participante adicional vinculado a esta meta.</p>
            ) : (
              <div className="space-y-3">
                {participantes.map((participante, index) => (
                  <div key={`${participante.participante_id}-${index}`} className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 md:grid-cols-[1.6fr_1fr_120px_auto]">
                    <div className="space-y-1">
                      <Label>Participante</Label>
                      <div className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                        {participante.participante_nome}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Papel</Label>
                      <Select
                        value={participante.papel || "co_responsavel"}
                        onValueChange={(value) => handleUpdateParticipante(index, { papel: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAPEL_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Peso</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={participante.peso ?? 1}
                        onChange={(e) => handleUpdateParticipante(index, { peso: parseFloat(e.target.value) || 0 })}
                      />
                    </div>

                    <div className="flex items-end">
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveParticipante(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && colaboradoresDisponiveis.length === 0 && participantes.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Todos os colaboradores disponíveis já foram adicionados como participantes.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}