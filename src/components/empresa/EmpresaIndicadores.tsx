import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertTriangle, TrendingUp, FileWarning, Plus, Trash2, Edit, Archive, ArchiveRestore } from 'lucide-react';
import { confirm } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import type { EmpresaCadastro, TacDetalhe } from '@/types/empresa';

const ORGAOS_EMISSORES = [
  {
    category: "Ministério Público",
    options: ["Ministério Público Federal (MPF)", "Ministério Público Estadual (MPE)", "Ministério Público do Trabalho (MPT)"]
  },
  {
    category: "Defensoria Pública",
    options: ["Defensoria Pública da União", "Defensorias Públicas dos Estados"]
  },
  {
    category: "Entes Federativos",
    options: ["União", "Estados", "Distrito Federal", "Municípios"]
  },
  {
    category: "Administração Direta",
    options: ["Órgãos vinculados à União", "Órgãos vinculados aos Estados", "Órgãos vinculados ao Distrito Federal", "Órgãos vinculados aos Municípios"]
  },
  {
    category: "Administração Indireta",
    options: ["Autarquias (ex: IBAMA)", "Fundações Públicas", "Empresas Públicas", "Sociedades de Economia Mista"]
  },
  {
    category: "Órgãos de Proteção e Defesa",
    options: ["Órgãos Ambientais", "Órgãos de Defesa do Consumidor (ex: PROCON)", "Órgãos de Fiscalização do Patrimônio Público"]
  }
];

interface Props {
  data: Partial<EmpresaCadastro>;
  onChange: (updates: Partial<EmpresaCadastro>) => void;
}

export function EmpresaIndicadores({ data, onChange }: Props) {
  const fapValor = data.fap_atual ?? 0;
  const tacList = data.tac_detalhes || [];
  const ativos = tacList.filter((t) => !t.arquivado);
  const arquivados = tacList.filter((t) => t.arquivado);

  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<TacDetalhe | null>(null);

  const openEditor = (idx: number) => {
    const item = tacList[idx];
    if (!item) return;
    setEditIdx(idx);
    setDraft({ ...item });
  };

  const openNew = () => {
    setEditIdx(-1);
    setDraft({
      numero: '',
      orgao_emissor: '',
      data_assinatura: '',
      obrigacoes: '',
      prazo: '',
      penalidades: '',
      status: 'Em cumprimento',
    });
  };

  const closeEditor = () => {
    setEditIdx(null);
    setDraft(null);
  };

  const saveDraft = () => {
    if (editIdx === null || !draft) return;
    if (!draft.numero?.trim()) {
      toast.error('Informe o Nº / Identificador do TAC.');
      return;
    }
    if (editIdx === -1) {
      onChange({ tac_detalhes: [...tacList, draft] });
      toast.success('TAC adicionado.');
    } else {
      const next = tacList.map((t, i) => (i === editIdx ? draft : t));
      onChange({ tac_detalhes: next });
      toast.success('TAC atualizado.');
    }
    closeEditor();
  };

  const handleExcluirAtivo = async (idx: number) => {
    const item = tacList[idx];
    if (!item) return;
    const ok = await confirm({
      title: '⚠️ Excluir este TAC?',
      description: `Tem certeza que quer excluir o TAC "${item.numero || 'sem identificador'}"? Ele será removido da lista de ativos. Use "Arquivar" se quiser preservar o histórico.`,
      confirmLabel: 'Sim, excluir',
      cancelLabel: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;
    onChange({ tac_detalhes: tacList.filter((_, i) => i !== idx) });
    toast.success('TAC excluído.');
  };

  const handleArquivar = async (idx: number) => {
    const item = tacList[idx];
    if (!item) return;
    const ok = await confirm({
      title: 'Arquivar este TAC?',
      description: `O TAC "${item.numero || 'sem identificador'}" será movido para a aba "Arquivados". Você poderá restaurá-lo depois.`,
      confirmLabel: 'Arquivar',
      variant: 'destructive',
    });
    if (!ok) return;
    const next = tacList.map((t, i) =>
      i === idx
        ? { ...t, arquivado: true, arquivado_em: new Date().toISOString(), status: 'Arquivado' }
        : t
    );
    onChange({ tac_detalhes: next });
    toast.success('TAC arquivado.');
  };

  const handleRestaurar = (idx: number) => {
    const next = tacList.map((t, i) =>
      i === idx
        ? { ...t, arquivado: false, arquivado_em: undefined, status: 'Em cumprimento' }
        : t
    );
    onChange({ tac_detalhes: next });
    toast.success('TAC restaurado para "Ativos".');
  };

  const handleExcluirDefinitivo = async (idx: number) => {
    const item = tacList[idx];
    if (!item) return;
    const ok = await confirm({
      title: '⚠️ Excluir definitivamente?',
      description: `Esta ação é IRREVERSÍVEL. O TAC "${item.numero || 'sem identificador'}" será removido permanentemente do histórico. Tem certeza que quer excluir?`,
      confirmLabel: 'Sim, excluir definitivamente',
      cancelLabel: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;
    onChange({ tac_detalhes: tacList.filter((_, i) => i !== idx) });
    toast.success('TAC excluído definitivamente.');
  };

  const renderTacRow = (tac: TacDetalhe, globalIdx: number, archived: boolean) => {
    const resumo = [tac.orgao_emissor, tac.status].filter(Boolean).join(' • ');
    return (
      <div
        key={globalIdx}
        className="flex items-center justify-between gap-2 border rounded-md bg-background px-3 py-2.5"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge variant="outline" className="font-mono shrink-0">
            TAC #{globalIdx + 1}
          </Badge>
          <span className="text-sm font-medium truncate">
            {tac.numero || 'Sem identificador'}
          </span>
          {resumo && (
            <span className="text-xs text-muted-foreground truncate hidden md:inline">
              • {resumo}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!archived ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => openEditor(globalIdx)}
                className="h-8 gap-1"
              >
                <Edit className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Editar</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleArquivar(globalIdx)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                title="Arquivar"
              >
                <Archive className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleExcluirAtivo(globalIdx)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                title="Excluir"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRestaurar(globalIdx)}
                className="h-8 gap-1"
              >
                <ArchiveRestore className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Restaurar</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleExcluirDefinitivo(globalIdx)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                title="Excluir definitivamente"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* FAP */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">FAP — Fator Acidentário de Prevenção</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>FAP Atual</Label>
            <Input
              type="number"
              step="0.0001"
              min="0.5"
              max="2"
              placeholder="Ex: 1.0000 (varia de 0,5000 a 2,0000)"
              value={data.fap_atual ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') return onChange({ fap_atual: null, fap_classificacao: null });
                const n = parseFloat(v);
                if (isNaN(n)) return onChange({ fap_atual: null, fap_classificacao: null });
                const classificacao = n === 1 ? 'Neutro' : n < 1 ? 'Bônus' : 'Malus';
                onChange({ fap_atual: n, fap_classificacao: classificacao });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Faixa legal: 0,5000 a 2,0000 (Lei nº 10.666/2003)
            </p>
          </div>
          <div className="flex items-end">
            {fapValor > 0 && (
              <Badge
                variant={fapValor > 1 ? 'destructive' : fapValor < 1 ? 'default' : 'secondary'}
              >
                {fapValor > 1
                  ? `FAP Malus (${fapValor.toFixed(4)}) — RAT majorado`
                  : fapValor < 1
                  ? `FAP Bônus (${fapValor.toFixed(4)}) — RAT reduzido`
                  : 'FAP Neutro (1,0000) — RAT original'}
              </Badge>
            )}
          </div>
        </div>

        {fapValor > 1 && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-sm text-destructive font-medium">
              FAP em faixa Malus (&gt; 1,0000) — RAT majorado. Avalie plano de redução de acidentalidade.
            </span>
          </div>
        )}
      </section>

      {/* TAC */}
      <section className="space-y-4 border-t pt-6">
        <div className="flex items-center gap-2">
          <FileWarning className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">TAC — Termo de Ajustamento de Conduta</h3>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={data.tac_possui || false}
              onCheckedChange={(v) => onChange({ tac_possui: v })}
            />
            <Label>Possui TAC ativo?</Label>
          </div>
        </div>

        {data.tac_possui && (
          <div className="space-y-4 p-4 border rounded-lg bg-destructive/5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                TAC ativo — obrigações devem ser monitoradas com rigor
              </span>
            </div>

            <Tabs defaultValue="ativos" className="w-full">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <TabsList>
                  <TabsTrigger value="ativos" className="gap-2">
                    Ativos
                    <Badge variant="secondary" className="h-5 px-1.5">{ativos.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="arquivados" className="gap-2">
                    <Archive className="w-3.5 h-3.5" />
                    Arquivados
                    <Badge variant="secondary" className="h-5 px-1.5">{arquivados.length}</Badge>
                  </TabsTrigger>
                </TabsList>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openNew}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar TAC
                </Button>
              </div>

              <TabsContent value="ativos" className="space-y-2 mt-3">
                {ativos.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">
                    Nenhum TAC ativo. Clique em "Adicionar TAC" para incluir um identificador.
                  </p>
                ) : (
                  ativos.map((tac) =>
                    renderTacRow(tac, tacList.indexOf(tac), false)
                  )
                )}
              </TabsContent>

              <TabsContent value="arquivados" className="space-y-2 mt-3">
                {arquivados.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">
                    Nenhum TAC arquivado.
                  </p>
                ) : (
                  arquivados.map((tac) =>
                    renderTacRow(tac, tacList.indexOf(tac), true)
                  )
                )}
              </TabsContent>
            </Tabs>


            <p className="text-xs text-muted-foreground">
              Use a aba "Obrigações" para registrar as cláusulas de cada TAC e gerar ações de cumprimento.
            </p>
          </div>
        )}
      </section>

      {/* Dialog de edição do TAC */}
      <Dialog open={editIdx !== null} onOpenChange={(o) => !o && closeEditor()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-4 h-4 text-primary" />
              {editIdx !== null && tacList[editIdx]?.numero
                ? `Editar TAC — ${tacList[editIdx]?.numero}`
                : 'Novo TAC'}
            </DialogTitle>
            <DialogDescription>
              As alterações só serão aplicadas ao clicar em <strong>Salvar</strong>.
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Nº / Identificador *</Label>
                <Input
                  placeholder="Ex.: TAC 123/2024"
                  value={draft.numero || ''}
                  onChange={(e) => setDraft({ ...draft, numero: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Órgão Emissor</Label>
                <Select
                  value={draft.orgao_emissor || ''}
                  onValueChange={(v) => setDraft({ ...draft, orgao_emissor: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o órgão" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORGAOS_EMISSORES.map((cat) => (
                      <SelectGroup key={cat.category}>
                        <SelectLabel>{cat.category}</SelectLabel>
                        {cat.options.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data de Assinatura</Label>
                <Input
                  type="date"
                  value={draft.data_assinatura || ''}
                  onChange={(e) => setDraft({ ...draft, data_assinatura: e.target.value })}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Obrigações / Cláusulas</Label>
                <Textarea
                  placeholder="Resumo das obrigações..."
                  rows={3}
                  value={draft.obrigacoes || ''}
                  onChange={(e) => setDraft({ ...draft, obrigacoes: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prazo</Label>
                <Input
                  placeholder="Ex.: 12 meses"
                  value={draft.prazo || ''}
                  onChange={(e) => setDraft({ ...draft, prazo: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={draft.status || ''}
                  onValueChange={(v) => setDraft({ ...draft, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Em cumprimento">Em cumprimento</SelectItem>
                    <SelectItem value="Em negociação">Em negociação</SelectItem>
                    <SelectItem value="Pendente de assinatura">Pendente de assinatura</SelectItem>
                    <SelectItem value="Em atraso">Em atraso</SelectItem>
                    <SelectItem value="Descumprido">Descumprido</SelectItem>
                    <SelectItem value="Suspenso">Suspenso</SelectItem>
                    <SelectItem value="Cumprido / Encerrado">Cumprido / Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Penalidades em caso de descumprimento</Label>
                <Input
                  placeholder="Ex.: Multa de R$ 50.000 por cláusula"
                  value={draft.penalidades || ''}
                  onChange={(e) => setDraft({ ...draft, penalidades: e.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeEditor}>
              Cancelar
            </Button>
            <Button type="button" onClick={saveDraft}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
