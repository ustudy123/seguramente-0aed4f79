import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useColaboradores } from "@/hooks/useColaboradores";
import { differenceInMonths, differenceInYears, parseISO } from "date-fns";
import {
  CATEGORIAS_PRINCIPAIS,
  ORIGENS_PREDOMINANTES,
  FATORES_ERGONOMICOS,
  TURNOS,
  type EventoSST,
  type EventoSSTTipo,
} from "@/types/eventoSST";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: EventoSST | null;
  onSubmit: (data: Partial<EventoSST>) => Promise<void>;
  isPending: boolean;
}

export const EventoSSTForm = ({ open, onOpenChange, initial, onSubmit, isPending }: Props) => {
  const { colaboradores } = useColaboradores();
  const [tipo, setTipo] = useState<EventoSSTTipo>(initial?.tipo || "incidente");
  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => {
    setTipo(initial?.tipo || "incidente");
    setForm({
      data_evento: initial?.data_evento || new Date().toISOString().split("T")[0],
      hora_evento: initial?.hora_evento || "",
      unidade: initial?.unidade || "",
      setor: initial?.setor || "",
      local_especifico: initial?.local_especifico || "",
      turno: initial?.turno || "",
      colaborador_id: initial?.colaborador_id || "",
      colaborador_nome: initial?.colaborador_nome || "",
      colaborador_funcao: initial?.colaborador_funcao || "",
      colaborador_tempo_empresa: initial?.colaborador_tempo_empresa || "",
      outros_envolvidos: initial?.outros_envolvidos || "",
      categoria_principal: initial?.categoria_principal || "",
      origem_predominante: initial?.origem_predominante || "",
      descricao: initial?.descricao || "",
      percepcao_causa: initial?.percepcao_causa || "",
      gravidade_lesao: initial?.gravidade_lesao || "",
      afastamento: initial?.afastamento || "",
      obito: initial?.obito || false,
      atendimento: initial?.atendimento || "",
      cat_emitida: initial?.cat_emitida || false,
      cat_numero: initial?.cat_numero || "",
      cat_data_emissao: initial?.cat_data_emissao || "",
      cat_tipo: initial?.cat_tipo || "",
      cat_observacoes: initial?.cat_observacoes || "",
      fatores_ergonomicos: initial?.fatores_ergonomicos || [],
    });
  }, [initial, open]);

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const handleSelectColaborador = (colaboradorId: string) => {
    const col = colaboradores.find((c) => c.id === colaboradorId);
    if (!col) return;

    // Calculate tempo de empresa based on admissao
    let tempoEmpresa = "";
    // We use current date as reference
    // Note: admissoes.created_at is the closest proxy for hire date
    // The actual data_admissao field could be used if available

    set("colaborador_id", col.id);
    set("colaborador_nome", col.nome_completo);
    set("colaborador_funcao", col.cargo);
    set("colaborador_tempo_empresa", tempoEmpresa);
  };

  const toggleFator = (f: string) => {
    const arr = form.fatores_ergonomicos as string[];
    set(
      "fatores_ergonomicos",
      arr.includes(f) ? arr.filter((x: string) => x !== f) : [...arr, f]
    );
  };

  const handleSubmit = async () => {
    await onSubmit({ ...form, tipo });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar Evento" : "Registrar Novo Evento SST"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6 pb-4">
            {/* Block 1: Basic data */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Dados Básicos</h3>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={tipo === "incidente" ? "default" : "outline"}
                  onClick={() => setTipo("incidente")}
                  className="flex-1"
                >
                  🛡️ Incidente
                </Button>
                <Button
                  type="button"
                  variant={tipo === "acidente" ? "destructive" : "outline"}
                  onClick={() => setTipo("acidente")}
                  className="flex-1"
                >
                  ⚠️ Acidente
                </Button>
              </div>
              {tipo === "incidente" && (
                <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  Situação em que poderia ter ocorrido um acidente, mas não houve lesão ou dano significativo.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data *</Label>
                  <Input type="date" value={form.data_evento} onChange={(e) => set("data_evento", e.target.value)} />
                </div>
                <div>
                  <Label>Hora</Label>
                  <Input type="time" value={form.hora_evento} onChange={(e) => set("hora_evento", e.target.value)} />
                </div>
                <div>
                  <Label>Unidade</Label>
                  <Input value={form.unidade} onChange={(e) => set("unidade", e.target.value)} placeholder="Ex: Matriz" />
                </div>
                <div>
                  <Label>Setor / Área</Label>
                  <Input value={form.setor} onChange={(e) => set("setor", e.target.value)} placeholder="Ex: Produção" />
                </div>
                <div>
                  <Label>Local Específico</Label>
                  <Input value={form.local_especifico} onChange={(e) => set("local_especifico", e.target.value)} />
                </div>
                <div>
                  <Label>Turno</Label>
                  <Select value={form.turno} onValueChange={(v) => set("turno", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {TURNOS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Block 2: Envolvidos */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Envolvidos</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Colaborador Envolvido</Label>
                  <Select
                    value={form.colaborador_id || "manual"}
                    onValueChange={(v) => {
                      if (v === "manual") {
                        set("colaborador_id", "");
                      } else {
                        handleSelectColaborador(v);
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione do cadastro ou digite manualmente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">✏️ Digitar manualmente</SelectItem>
                      {colaboradores.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome_completo} — {c.cargo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!form.colaborador_id && (
                  <>
                    <div>
                      <Label>Nome do Colaborador</Label>
                      <Input value={form.colaborador_nome} onChange={(e) => set("colaborador_nome", e.target.value)} placeholder="Nome do colaborador" />
                    </div>
                    <div>
                      <Label>Função</Label>
                      <Input value={form.colaborador_funcao} onChange={(e) => set("colaborador_funcao", e.target.value)} />
                    </div>
                  </>
                )}
                {form.colaborador_id && (
                  <div className="col-span-2 bg-muted p-3 rounded text-sm space-y-1">
                    <p><strong>Nome:</strong> {form.colaborador_nome}</p>
                    <p><strong>Função:</strong> {form.colaborador_funcao}</p>
                    {form.colaborador_tempo_empresa && (
                      <p><strong>Tempo de empresa:</strong> {form.colaborador_tempo_empresa}</p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <Label>Outros Envolvidos / Testemunhas</Label>
                <Textarea value={form.outros_envolvidos} onChange={(e) => set("outros_envolvidos", e.target.value)} rows={2} />
              </div>
            </div>

            <Separator />

            {/* Block 3: Category */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Tipo e Natureza</h3>
              <div>
                <Label>Categoria Principal</Label>
                <Select value={form.categoria_principal} onValueChange={(v) => set("categoria_principal", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_PRINCIPAIS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Origem Predominante</Label>
                <Select value={form.origem_predominante} onValueChange={(v) => set("origem_predominante", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {ORIGENS_PREDOMINANTES.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Block 4: Accident-specific */}
            {tipo === "acidente" && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Detalhamento de Gravidade</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Lesão</Label>
                      <Select value={form.gravidade_lesao} onValueChange={(v) => set("gravidade_lesao", v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sem_lesao">Sem lesão aparente</SelectItem>
                          <SelectItem value="leve">Lesão leve</SelectItem>
                          <SelectItem value="moderada">Lesão moderada</SelectItem>
                          <SelectItem value="grave">Lesão grave</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Afastamento</Label>
                      <Select value={form.afastamento} onValueChange={(v) => set("afastamento", v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sem_afastamento">Não houve afastamento</SelectItem>
                          <SelectItem value="ate_15_dias">Sim, até 15 dias</SelectItem>
                          <SelectItem value="mais_15_dias">Sim, mais de 15 dias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Atendimento Médico</Label>
                      <Select value={form.atendimento} onValueChange={(v) => set("atendimento", v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nao_necessario">Não foi necessário</SelectItem>
                          <SelectItem value="ambulatorial">Ambulatorial</SelectItem>
                          <SelectItem value="hospitalar">Hospitalar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <Checkbox checked={form.obito} onCheckedChange={(v) => set("obito", v)} id="obito" />
                      <Label htmlFor="obito">Óbito</Label>
                    </div>
                  </div>

                  <Separator className="my-3" />
                  <h4 className="font-medium text-sm">CAT – Comunicação de Acidente de Trabalho</h4>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={form.cat_emitida} onCheckedChange={(v) => set("cat_emitida", v)} id="cat_emitida" />
                    <Label htmlFor="cat_emitida">Houve emissão de CAT?</Label>
                  </div>
                  {form.cat_emitida && (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <Label>Número da CAT</Label>
                        <Input value={form.cat_numero} onChange={(e) => set("cat_numero", e.target.value)} />
                      </div>
                      <div>
                        <Label>Data de Emissão</Label>
                        <Input type="date" value={form.cat_data_emissao} onChange={(e) => set("cat_data_emissao", e.target.value)} />
                      </div>
                      <div>
                        <Label>Tipo de CAT</Label>
                        <Select value={form.cat_tipo} onValueChange={(v) => set("cat_tipo", v)}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inicial">Inicial</SelectItem>
                            <SelectItem value="reabertura">Reabertura</SelectItem>
                            <SelectItem value="comunicacao_obito">Comunicação de Óbito</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label>Observações sobre a CAT</Label>
                        <Textarea value={form.cat_observacoes} onChange={(e) => set("cat_observacoes", e.target.value)} rows={2} />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <Separator />

            {/* Block 5: Description */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Descrição do Evento</h3>
              <div>
                <Label>Descrição do Ocorrido *</Label>
                <Textarea
                  value={form.descricao}
                  onChange={(e) => set("descricao", e.target.value)}
                  rows={4}
                  placeholder="Descreva o que aconteceu, em ordem cronológica, incluindo atividade realizada, local exato, condições do ambiente..."
                />
              </div>
              <div>
                <Label>Percepção Inicial da Causa</Label>
                <Textarea value={form.percepcao_causa} onChange={(e) => set("percepcao_causa", e.target.value)} rows={2} />
              </div>
            </div>

            <Separator />

            {/* Block 6: Ergonomic factors */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Fatores Ergonômicos e Psicossociais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {FATORES_ERGONOMICOS.map((f) => (
                  <div key={f} className="flex items-start gap-2">
                    <Checkbox
                      checked={(form.fatores_ergonomicos as string[] || []).includes(f)}
                      onCheckedChange={() => toggleFator(f)}
                      id={`fator-${f}`}
                    />
                    <Label htmlFor={`fator-${f}`} className="text-sm leading-snug cursor-pointer">{f}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.data_evento}>
            {isPending ? "Salvando..." : initial ? "Salvar Alterações" : "Registrar Evento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};