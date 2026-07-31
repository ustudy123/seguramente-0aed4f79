import { useEffect, useState } from 'react';
import { Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  YOUREYES_MODULOS, DIAS_SEMANA, PERIODICIDADES, Periodicidade, getSubmoduloLabel,
} from '@/lib/youreyes-modulos';
import { useYourEyes, YourEyesAgente } from '@/hooks/useYourEyes';

const EMOJIS = ['🤖', '🕵️', '🦅', '🔍', '🧪', '🛡️', '⚡', '🎯', '🧭', '🐞'];
const TODOS_MODULOS = '__todos__';

interface AgenteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agente?: YourEyesAgente | null;
}

export function AgenteFormDialog({ open, onOpenChange, agente }: AgenteFormDialogProps) {
  const { documentos, salvarAgente, isSalvandoAgente } = useYourEyes();

  const [nome, setNome] = useState('');
  const [emoji, setEmoji] = useState('🤖');
  const [descricao, setDescricao] = useState('');
  const [modulo, setModulo] = useState<string>(TODOS_MODULOS);
  const [documentoIds, setDocumentoIds] = useState<string[]>([]);
  const [ativo, setAtivo] = useState(true);
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>('diaria');
  const [diasSemana, setDiasSemana] = useState<number[]>([1]);
  const [diaMes, setDiaMes] = useState(1);
  const [horario, setHorario] = useState('06:00');

  useEffect(() => {
    if (!open) return;
    if (agente) {
      setNome(agente.nome);
      setEmoji(agente.emoji || '🤖');
      setDescricao(agente.descricao || '');
      setModulo(agente.modulo || TODOS_MODULOS);
      setDocumentoIds(agente.documento_ids || []);
      setAtivo(agente.ativo);
      setPeriodicidade(agente.periodicidade);
      setDiasSemana(agente.dias_semana?.length ? agente.dias_semana : [1]);
      setDiaMes(agente.dia_mes || 1);
      setHorario((agente.horario || '06:00').slice(0, 5));
    } else {
      setNome('');
      setEmoji('🤖');
      setDescricao('');
      setModulo(TODOS_MODULOS);
      setDocumentoIds([]);
      setAtivo(true);
      setPeriodicidade('diaria');
      setDiasSemana([1]);
      setDiaMes(1);
      setHorario('06:00');
    }
  }, [open, agente]);

  const docsFiltrados = modulo === TODOS_MODULOS
    ? documentos
    : documentos.filter((d) => d.modulo === modulo);

  const toggleDia = (dia: number) => {
    setDiasSemana((atual) =>
      atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia].sort()
    );
  };

  const toggleDocumento = (id: string) => {
    setDocumentoIds((atual) =>
      atual.includes(id) ? atual.filter((d) => d !== id) : [...atual, id]
    );
  };

  const handleSalvar = async () => {
    if (!nome.trim()) {
      toast.error('Informe o nome do agente');
      return;
    }
    if (documentoIds.length === 0) {
      toast.error('Selecione ao menos um documento de teste — ele é a base do agente');
      return;
    }
    if ((periodicidade === 'semanal' || periodicidade === 'quinzenal') && diasSemana.length === 0) {
      toast.error('Selecione ao menos um dia da semana');
      return;
    }
    try {
      await salvarAgente({
        id: agente?.id,
        nome: nome.trim(),
        emoji,
        descricao: descricao.trim() || null,
        modulo: modulo === TODOS_MODULOS ? null : modulo,
        documento_ids: documentoIds,
        ativo,
        periodicidade,
        dias_semana: diasSemana,
        dia_mes: periodicidade === 'mensal' ? diaMes : null,
        horario,
      });
      toast.success(agente ? 'Agente atualizado' : 'Agente criado e agendado!');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar agente');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{agente ? 'Editar Agente' : 'Novo Agente de Teste'}</DialogTitle>
          <DialogDescription>
            O agente executa os roteiros da documentação selecionada no agendamento configurado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Identidade */}
          <div className="flex gap-4">
            <div className="space-y-2">
              <Label>Avatar</Label>
              <div className="flex flex-wrap gap-1 max-w-[180px]">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className={`w-8 h-8 rounded-md text-lg flex items-center justify-center border transition-colors ${emoji === e ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted'}`}
                    onClick={() => setEmoji(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <Label>Nome do agente</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Agente de Colaboradores" />
              <Label className="pt-1 block">Descrição (função na equipe)</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} placeholder="Ex.: Responsável por validar diariamente o módulo de colaboradores" />
            </div>
          </div>

          {/* Módulo + Documentação */}
          <div className="space-y-2">
            <Label>Módulo de atuação</Label>
            <Select value={modulo} onValueChange={setModulo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS_MODULOS}>Todos os módulos</SelectItem>
                {YOUREYES_MODULOS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Documentação de teste (obrigatório)</Label>
              <Badge variant="secondary">{documentoIds.length} selecionado(s)</Badge>
            </div>
            {docsFiltrados.length === 0 ? (
              <p className="text-sm text-muted-foreground border rounded-md p-3">
                Nenhum documento {modulo !== TODOS_MODULOS ? 'neste módulo' : 'cadastrado'}.
                Crie a documentação na aba "Documentação" antes de montar o agente.
              </p>
            ) : (
              <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                {docsFiltrados.map((doc) => (
                  <label key={doc.id} className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={documentoIds.includes(doc.id)}
                      onCheckedChange={() => toggleDocumento(doc.id)}
                    />
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{doc.titulo}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {YOUREYES_MODULOS.find((m) => m.id === doc.modulo)?.label || doc.modulo}
                        {doc.submodulo ? ` / ${getSubmoduloLabel(doc.modulo, doc.submodulo)}` : ''}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Agendamento */}
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <p className="text-sm font-semibold">Agendamento de execução</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Periodicidade</Label>
                <Select value={periodicidade} onValueChange={(v) => setPeriodicidade(v as Periodicidade)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODICIDADES.map((p) => (
                      <SelectItem key={p.valor} value={p.valor}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
              </div>
            </div>

            {(periodicidade === 'semanal' || periodicidade === 'quinzenal') && (
              <div className="space-y-2">
                <Label>Dias da semana</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DIAS_SEMANA.map((dia) => (
                    <button
                      key={dia.valor}
                      type="button"
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${diasSemana.includes(dia.valor) ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
                      onClick={() => toggleDia(dia.valor)}
                    >
                      {dia.label}
                    </button>
                  ))}
                </div>
                {periodicidade === 'quinzenal' && (
                  <p className="text-xs text-muted-foreground">A execução se repete a cada 14 dias no(s) dia(s) marcado(s).</p>
                )}
              </div>
            )}

            {periodicidade === 'mensal' && (
              <div className="space-y-2">
                <Label>Dia do mês (1 a 28)</Label>
                <Input
                  type="number" min={1} max={28} className="w-28"
                  value={diaMes}
                  onChange={(e) => setDiaMes(Math.max(1, Math.min(28, Number(e.target.value) || 1)))}
                />
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Switch checked={ativo} onCheckedChange={setAtivo} id="agente-ativo" />
              <Label htmlFor="agente-ativo" className="cursor-pointer">
                {ativo ? 'Agente ativo (execuções agendadas habilitadas)' : 'Agente pausado'}
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={isSalvandoAgente}>
              {isSalvandoAgente && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {agente ? 'Salvar alterações' : 'Criar agente'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
