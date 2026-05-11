import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { usePontoEscalas, ESCALA_TIPOS, type PontoEscala } from "@/hooks/usePontoEscalas";
import { useEscalaDetalhes, DIAS_SEMANA_LABEL, ORDINAL_MES_LABEL } from "@/hooks/useEscalaDetalhes";
import { useColaboradores } from "@/hooks/useColaboradores";
import { Plus, Calendar, Clock, Users, Settings, Sparkles, Pencil, Power, Trash2, CalendarDays, Repeat } from "lucide-react";
import { toast } from "sonner";
import { confirm } from "@/components/ui/confirm-dialog";
import { CadastroInteligenteEscala } from "./CadastroInteligenteEscala";

export function PontoEscalasTab() {
  const { escalas, loadingEscalas, atribuicoes: atribuicoesRaw, criarEscala, criandoEscala, atualizarEscala, atualizandoEscala, excluirEscala, atribuirEscala } = usePontoEscalas();
  const { colaboradores } = useColaboradores();
  // Filtra atribuições pelos colaboradores da empresa ativa (cruzamento por CPF/ID)
  const cpfsEmpresa = new Set(colaboradores.map(c => (c.cpf || "").replace(/\D/g, "")).filter(Boolean));
  const idsEmpresa = new Set(colaboradores.map(c => c.id));
  const atribuicoes = atribuicoesRaw.filter((a: any) => {
    const cpf = (a.colaborador_cpf || "").replace(/\D/g, "");
    return (cpf && cpfsEmpresa.has(cpf)) || (a.colaborador_id && idsEmpresa.has(a.colaborador_id));
  });
  const [showCriar, setShowCriar] = useState(false);
  const [editando, setEditando] = useState<PontoEscala | null>(null);
  const [showInteligente, setShowInteligente] = useState(false);
  const [showAtribuir, setShowAtribuir] = useState(false);
  const DIAS_KEYS = ["segunda","terca","quarta","quinta","sexta","sabado","domingo"] as const;
  const DIAS_LBL: Record<string,string> = { segunda:"Segunda", terca:"Terça", quarta:"Quarta", quinta:"Quinta", sexta:"Sexta", sabado:"Sábado", domingo:"Domingo" };
  type DiaConfig = { trabalha: boolean; entrada: string; saida: string; intervalo: number };
  const diasConfigPadrao = (): Record<string, DiaConfig> => ({
    segunda: { trabalha: true, entrada: "08:00", saida: "17:00", intervalo: 60 },
    terca:   { trabalha: true, entrada: "08:00", saida: "17:00", intervalo: 60 },
    quarta:  { trabalha: true, entrada: "08:00", saida: "17:00", intervalo: 60 },
    quinta:  { trabalha: true, entrada: "08:00", saida: "17:00", intervalo: 60 },
    sexta:   { trabalha: true, entrada: "08:00", saida: "17:00", intervalo: 60 },
    sabado:  { trabalha: false, entrada: "08:00", saida: "12:00", intervalo: 0 },
    domingo: { trabalha: false, entrada: "08:00", saida: "12:00", intervalo: 0 },
  });
  const [escalaForm, setEscalaForm] = useState<any>({
    nome: "",
    tipo: "5x2",
    modalidade: "fixa",
    dias_config: diasConfigPadrao(),
    ciclo_horas_trabalho: 12,
    ciclo_horas_descanso: 36,
    ciclo_inicio_data: new Date().toISOString().split("T")[0],
    ciclo_inicio_hora: "07:00",
    jornada_diaria_minutos: 480,
    jornada_semanal_minutos: 2640,
    intervalo_intrajornada_minutos: 60,
    tolerancia_minutos: 5,
    tolerancia_diaria_minutos: 10,
    hora_entrada_padrao: "08:00",
    hora_saida_padrao: "17:00",
    sabado_util: false,
    domingo_util: false,
    percentual_hora_extra_50: 50,
    percentual_hora_extra_100: 100,
    percentual_adicional_noturno: 20,
    usa_hora_ficta_noturna: true,
  });

  // Cálculo automático de jornadas a partir da configuração
  const calcularJornadasFixa = (dc: Record<string, DiaConfig>) => {
    let semanal = 0;
    let diasTrab = 0;
    DIAS_KEYS.forEach(d => {
      const c = dc[d];
      if (!c?.trabalha) return;
      const [h1,m1] = c.entrada.split(":").map(Number);
      const [h2,m2] = c.saida.split(":").map(Number);
      const min = (h2*60+m2) - (h1*60+m1) - (c.intervalo || 0);
      if (min > 0) { semanal += min; diasTrab++; }
    });
    return { semanal, diaria: diasTrab > 0 ? Math.round(semanal/diasTrab) : 0, diasTrab };
  };
  const calcularJornadasMovel = (ht: number, hd: number) => {
    // jornada diária = horas trabalho do ciclo; semanal = média (7d / ciclo) * ht
    const ciclo = ht + hd;
    const semanalMin = ciclo > 0 ? Math.round((168 / ciclo) * ht * 60) : 0;
    return { diaria: ht * 60, semanal: semanalMin };
  };
  const [atribuicaoForm, setAtribuicaoForm] = useState({
    escala_id: "",
    colaborador_id: "",
    data_inicio: new Date().toISOString().split("T")[0],
  });

  const formatMinutos = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h${m > 0 ? ` ${m}min` : ""}`;
  };

  const handleSalvar = async () => {
    if (!escalaForm.nome) { toast.error("Nome obrigatório"); return; }
    if (editando) {
      await atualizarEscala({ id: editando.id, ...escalaForm } as any);
    } else {
      await criarEscala(escalaForm as any);
    }
    setShowCriar(false);
    setEditando(null);
    setEscalaForm({ ...escalaForm, nome: "" });
  };

  const abrirNova = () => {
    setEditando(null);
    setEscalaForm({
      nome: "", tipo: "5x2", jornada_diaria_minutos: 480, jornada_semanal_minutos: 2640,
      intervalo_intrajornada_minutos: 60, tolerancia_minutos: 5, tolerancia_diaria_minutos: 10,
      hora_entrada_padrao: "08:00", hora_saida_padrao: "17:00", sabado_util: false, domingo_util: false,
      percentual_hora_extra_50: 50, percentual_hora_extra_100: 100, percentual_adicional_noturno: 20,
      usa_hora_ficta_noturna: true,
    });
    setShowCriar(true);
  };

  const abrirEditar = (e: PontoEscala) => {
    setEditando(e);
    setEscalaForm({
      nome: e.nome,
      tipo: e.tipo,
      jornada_diaria_minutos: e.jornada_diaria_minutos,
      jornada_semanal_minutos: e.jornada_semanal_minutos,
      intervalo_intrajornada_minutos: e.intervalo_intrajornada_minutos,
      tolerancia_minutos: e.tolerancia_minutos,
      tolerancia_diaria_minutos: e.tolerancia_diaria_minutos,
      hora_entrada_padrao: e.hora_entrada_padrao?.substring(0,5) || "08:00",
      hora_saida_padrao: e.hora_saida_padrao?.substring(0,5) || "17:00",
      sabado_util: e.sabado_util,
      domingo_util: e.domingo_util,
      percentual_hora_extra_50: e.percentual_hora_extra_50,
      percentual_hora_extra_100: e.percentual_hora_extra_100,
      percentual_adicional_noturno: e.percentual_adicional_noturno,
      usa_hora_ficta_noturna: e.usa_hora_ficta_noturna,
    });
    setShowCriar(true);
  };

  const handleToggleAtiva = async (e: PontoEscala) => {
    const ok = await confirm({
      title: e.ativa ? "Inativar escala?" : "Ativar escala?",
      description: e.ativa
        ? "A escala não poderá ser atribuída a novos colaboradores enquanto inativa."
        : "A escala voltará a ficar disponível para atribuição.",
      confirmLabel: e.ativa ? "Inativar" : "Ativar",
      variant: e.ativa ? "destructive" : "default",
    });
    if (!ok) return;
    await atualizarEscala({ id: e.id, ativa: !e.ativa } as any);
  };

  const handleExcluir = async (e: PontoEscala) => {
    const ok = await confirm({
      title: "Excluir escala?",
      description: `A escala "${e.nome}" será removida permanentemente. Esta ação não pode ser desfeita. (Só é possível excluir escalas sem colaboradores atribuídos.)`,
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;
    await excluirEscala(e.id);
  };

  const handleAtribuir = async () => {
    const colab = colaboradores.find(c => c.id === atribuicaoForm.colaborador_id);
    if (!colab || !atribuicaoForm.escala_id) { toast.error("Selecione escala e colaborador"); return; }
    await atribuirEscala({
      escala_id: atribuicaoForm.escala_id,
      colaborador_id: colab.id,
      colaborador_nome: colab.nome_completo,
      colaborador_cpf: colab.cpf,
      data_inicio: atribuicaoForm.data_inicio,
    });
    setShowAtribuir(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" /> Escalas & Turnos
          </h3>
          <p className="text-sm text-muted-foreground">Gerencie escalas de trabalho e atribua a colaboradores</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowAtribuir(true)}>
            <Users className="w-4 h-4 mr-2" /> Atribuir Escala
          </Button>
          <Button variant="outline" onClick={abrirNova}>
            <Plus className="w-4 h-4 mr-2" /> Nova Escala
          </Button>
          <Button onClick={() => setShowInteligente(true)} className="bg-gradient-to-r from-primary to-primary/80">
            <Sparkles className="w-4 h-4 mr-2" /> Cadastro Inteligente
          </Button>
        </div>
      </div>

      {/* Escalas Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Jornada Diária</TableHead>
                <TableHead>Jornada Semanal</TableHead>
                <TableHead>Intervalo</TableHead>
                <TableHead>Tolerância</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingEscalas ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : escalas.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma escala cadastrada.</TableCell></TableRow>
              ) : escalas.map(e => {
                const emUso = atribuicoes.some(a => a.escala_id === e.id);
                return (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.nome}</TableCell>
                  <TableCell><Badge variant="outline">{ESCALA_TIPOS.find(t => t.value === e.tipo)?.label || e.tipo}</Badge></TableCell>
                  <TableCell>{formatMinutos(e.jornada_diaria_minutos)}</TableCell>
                  <TableCell>{formatMinutos(e.jornada_semanal_minutos)}</TableCell>
                  <TableCell>{formatMinutos(e.intervalo_intrajornada_minutos)}</TableCell>
                  <TableCell>{e.tolerancia_minutos}min / {e.tolerancia_diaria_minutos}min</TableCell>
                  <TableCell className="font-mono text-sm">{e.hora_entrada_padrao?.substring(0,5)} - {e.hora_saida_padrao?.substring(0,5)}</TableCell>
                  <TableCell><Badge className={e.ativa ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>{e.ativa ? "Ativa" : "Inativa"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" title="Editar" onClick={() => abrirEditar(e)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title={e.ativa ? "Inativar" : "Ativar"} onClick={() => handleToggleAtiva(e)}>
                        <Power className={`w-4 h-4 ${e.ativa ? "text-amber-600" : "text-emerald-600"}`} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title={emUso ? "Não é possível excluir: escala em uso" : "Excluir"}
                        disabled={emUso}
                        onClick={() => handleExcluir(e)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Atribuições */}
      {atribuicoes.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Atribuições Ativas</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Escala</TableHead>
                  <TableHead>Início</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atribuicoes.map(a => (
                  <TableRow key={a.id}>
                    <TableCell>{a.colaborador_nome}</TableCell>
                    <TableCell>{escalas.find(e => e.id === a.escala_id)?.nome || "-"}</TableCell>
                    <TableCell>{a.data_inicio}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog Criar Escala */}
      <Dialog open={showCriar} onOpenChange={(o) => { setShowCriar(o); if (!o) setEditando(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editando ? "Editar Escala" : "Nova Escala de Trabalho"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Escala</Label>
                <Input value={escalaForm.nome} onChange={e => setEscalaForm({ ...escalaForm, nome: e.target.value })} placeholder="Ex: Administrativo" />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={escalaForm.tipo} onValueChange={v => {
                  const presets: Record<string, any> = {
                    "5x2": { jornada_diaria_minutos: 480, jornada_semanal_minutos: 2640, sabado_util: false },
                    "6x1": { jornada_diaria_minutos: 440, jornada_semanal_minutos: 2640, sabado_util: true },
                    "12x36": { jornada_diaria_minutos: 720, jornada_semanal_minutos: 2160 },
                  };
                  setEscalaForm({ ...escalaForm, tipo: v, ...(presets[v] || {}) });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESCALA_TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Jornada Diária (min)</Label>
                <Input type="number" value={escalaForm.jornada_diaria_minutos} onChange={e => setEscalaForm({ ...escalaForm, jornada_diaria_minutos: +e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Jornada Semanal (min)</Label>
                <Input type="number" value={escalaForm.jornada_semanal_minutos} onChange={e => setEscalaForm({ ...escalaForm, jornada_semanal_minutos: +e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Intervalo Intrajornada (min)</Label>
                <Input type="number" value={escalaForm.intervalo_intrajornada_minutos} onChange={e => setEscalaForm({ ...escalaForm, intervalo_intrajornada_minutos: +e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hora Entrada</Label>
                <Input type="time" value={escalaForm.hora_entrada_padrao} onChange={e => setEscalaForm({ ...escalaForm, hora_entrada_padrao: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Hora Saída</Label>
                <Input type="time" value={escalaForm.hora_saida_padrao} onChange={e => setEscalaForm({ ...escalaForm, hora_saida_padrao: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tolerância por marcação (min)</Label>
                <Input type="number" value={escalaForm.tolerancia_minutos} onChange={e => setEscalaForm({ ...escalaForm, tolerancia_minutos: +e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tolerância diária (min)</Label>
                <Input type="number" value={escalaForm.tolerancia_diaria_minutos} onChange={e => setEscalaForm({ ...escalaForm, tolerancia_diaria_minutos: +e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>% HE 50%</Label>
                <Input type="number" value={escalaForm.percentual_hora_extra_50} onChange={e => setEscalaForm({ ...escalaForm, percentual_hora_extra_50: +e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>% HE 100%</Label>
                <Input type="number" value={escalaForm.percentual_hora_extra_100} onChange={e => setEscalaForm({ ...escalaForm, percentual_hora_extra_100: +e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>% Adic. Noturno</Label>
                <Input type="number" value={escalaForm.percentual_adicional_noturno} onChange={e => setEscalaForm({ ...escalaForm, percentual_adicional_noturno: +e.target.value })} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 rounded-md border bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <Switch checked={escalaForm.sabado_util} onCheckedChange={v => setEscalaForm({ ...escalaForm, sabado_util: v })} />
                <Label className="cursor-pointer">Sábado útil</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={escalaForm.domingo_util} onCheckedChange={v => setEscalaForm({ ...escalaForm, domingo_util: v })} />
                <Label className="cursor-pointer">Domingo útil</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={escalaForm.usa_hora_ficta_noturna} onCheckedChange={v => setEscalaForm({ ...escalaForm, usa_hora_ficta_noturna: v })} />
                <Label className="cursor-pointer">Hora ficta noturna (52m30s)</Label>
              </div>
            </div>

            {editando && <DetalhesEscalaPanel escalaId={editando.id} />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCriar(false); setEditando(null); }}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={criandoEscala || atualizandoEscala}>
              {(criandoEscala || atualizandoEscala) ? "Salvando..." : (editando ? "Salvar Alterações" : "Criar Escala")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Atribuir */}
      <Dialog open={showAtribuir} onOpenChange={setShowAtribuir}>
        <DialogContent>
          <DialogHeader><DialogTitle>Atribuir Escala a Colaborador</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Escala</Label>
              <Select value={atribuicaoForm.escala_id} onValueChange={v => setAtribuicaoForm({ ...atribuicaoForm, escala_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a escala" /></SelectTrigger>
                <SelectContent>
                  {escalas.filter(e => e.ativa).map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={atribuicaoForm.colaborador_id} onValueChange={v => setAtribuicaoForm({ ...atribuicaoForm, colaborador_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
                <SelectContent>
                  {colaboradores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome_completo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input type="date" value={atribuicaoForm.data_inicio} onChange={e => setAtribuicaoForm({ ...atribuicaoForm, data_inicio: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAtribuir(false)}>Cancelar</Button>
            <Button onClick={handleAtribuir}>Atribuir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cadastro Inteligente */}
      <CadastroInteligenteEscala open={showInteligente} onOpenChange={setShowInteligente} />
    </div>
  );
}

function DetalhesEscalaPanel({ escalaId }: { escalaId: string }) {
  const { periodos, recorrencias, loading } = useEscalaDetalhes(escalaId);

  // Agrupa períodos por dia
  const porDia = periodos.reduce<Record<string, { hora_inicio: string; hora_fim: string }[]>>((acc, p) => {
    (acc[p.dia_semana] = acc[p.dia_semana] || []).push({
      hora_inicio: p.hora_inicio.substring(0, 5),
      hora_fim: p.hora_fim.substring(0, 5),
    });
    return acc;
  }, {});

  if (loading) {
    return <div className="text-xs text-muted-foreground py-2">Carregando blocos e recorrências…</div>;
  }

  if (periodos.length === 0 && recorrencias.length === 0) {
    return (
      <div className="text-xs text-muted-foreground border-t pt-3">
        Esta escala não possui blocos diários nem recorrências detalhadas. Use o <strong>Cadastro Inteligente</strong> para criar uma escala com horários completos.
      </div>
    );
  }

  const ORDEM = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];
  const diasOrdenados = Object.keys(porDia).sort((a, b) => ORDEM.indexOf(a) - ORDEM.indexOf(b));

  return (
    <div className="space-y-5 border-t pt-4">
      {diasOrdenados.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> Blocos diários cadastrados
          </Label>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium w-32">Dia</th>
                  <th className="text-left px-3 py-2 font-medium">Horários</th>
                  <th className="text-right px-3 py-2 font-medium w-20">Total</th>
                </tr>
              </thead>
              <tbody>
                {diasOrdenados.map((dia, idx) => {
                  const totalMin = porDia[dia].reduce((acc, b) => {
                    const [h1, m1] = b.hora_inicio.split(":").map(Number);
                    const [h2, m2] = b.hora_fim.split(":").map(Number);
                    return acc + (h2 * 60 + m2) - (h1 * 60 + m1);
                  }, 0);
                  const horas = Math.floor(totalMin / 60);
                  const mins = totalMin % 60;
                  return (
                    <tr
                      key={dia}
                      className={`border-t ${idx % 2 === 0 ? "bg-background" : "bg-muted/20"}`}
                    >
                      <td className="px-3 py-2 font-semibold">{DIAS_SEMANA_LABEL[dia] || dia}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
                          {porDia[dia].map((b, i) => (
                            <span key={i} className="inline-flex items-center gap-1.5">
                              {i > 0 && <span className="text-muted-foreground">·</span>}
                              <Clock className="w-3 h-3 text-primary" />
                              <span>{b.hora_inicio}</span>
                              <span className="text-muted-foreground">→</span>
                              <span>{b.hora_fim}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {horas}h{mins > 0 ? mins.toString().padStart(2, "0") : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recorrencias.length > 0 && (
        <div className="space-y-2.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Repeat className="w-3.5 h-3.5" /> Recorrências mensais
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recorrencias.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 flex items-start gap-2"
              >
                <div className="rounded-md bg-primary/15 p-1.5 shrink-0">
                  <Repeat className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm leading-tight">
                    {ORDINAL_MES_LABEL[r.ordinal_mes] || r.ordinal_mes}{" "}
                    {DIAS_SEMANA_LABEL[r.dia_semana] || r.dia_semana}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs font-mono">
                    <Clock className="w-3 h-3 text-primary" />
                    <span>{r.hora_inicio.substring(0, 5)}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{r.hora_fim.substring(0, 5)}</span>
                  </div>
                  {r.descricao && (
                    <div className="text-xs text-muted-foreground mt-1 italic line-clamp-2">
                      {r.descricao}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground italic border-t pt-2">
        ℹ️ Blocos diários e recorrências são gerados pelo Cadastro Inteligente. Para alterá-los, recadastre a escala via IA.
      </p>
    </div>
  );
}
