import { useState } from 'react';
import { ArrowLeft, Plus, Pencil, Trash2, BookOpen, FolderOpen, Play, Eye, GripVertical, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAcademia, AcademiaCategoria, AcademiaTreinamento } from '@/hooks/useAcademia';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export function AcademiaAdmin({ onBack }: Props) {
  const {
    categorias, treinamentos, loadingTreinamentos,
    salvarCategoria, salvarTreinamento, salvarModulo, salvarAula, deletarItem,
    getTreinamentoDetail,
  } = useAcademia();

  const [tab, setTab] = useState('treinamentos');
  const [catDialog, setCatDialog] = useState(false);
  const [catForm, setCatForm] = useState<Partial<AcademiaCategoria>>({});
  const [treinoDialog, setTreinoDialog] = useState(false);
  const [treinoForm, setTreinoForm] = useState<any>({});
  const [moduloDialog, setModuloDialog] = useState(false);
  const [moduloForm, setModuloForm] = useState<any>({});
  const [aulaDialog, setAulaDialog] = useState(false);
  const [aulaForm, setAulaForm] = useState<any>({});
  const [managingTreino, setManagingTreino] = useState<string | null>(null);

  // Manage content for a specific training
  const { data: treinoDetail, isLoading: loadingDetail } = managingTreino
    ? getTreinamentoDetail(managingTreino)
    : { data: null, isLoading: false };

  const handleSaveCategoria = async () => {
    if (!catForm.nome) return toast.error('Nome é obrigatório');
    const slug = catForm.slug || catForm.nome.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await salvarCategoria.mutateAsync({ ...catForm, slug } as any);
    setCatDialog(false);
    setCatForm({});
  };

  const handleSaveTreino = async () => {
    if (!treinoForm.titulo) return toast.error('Título é obrigatório');
    const slug = treinoForm.slug || treinoForm.titulo.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await salvarTreinamento.mutateAsync({ ...treinoForm, slug });
    setTreinoDialog(false);
    setTreinoForm({});
  };

  const handleSaveModulo = async () => {
    if (!moduloForm.nome || !moduloForm.treinamento_id) return toast.error('Nome é obrigatório');
    await salvarModulo.mutateAsync(moduloForm);
    setModuloDialog(false);
    setModuloForm({});
  };

  const handleSaveAula = async () => {
    if (!aulaForm.titulo || !aulaForm.modulo_id) return toast.error('Título é obrigatório');
    await salvarAula.mutateAsync(aulaForm);
    setAulaDialog(false);
    setAulaForm({});
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
        </Button>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-primary" />
          Painel Administrativo — Academia
        </h1>
      </div>

      {managingTreino && treinoDetail ? (
        /* CONTENT MANAGEMENT for a specific training */
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Button variant="ghost" size="sm" onClick={() => setManagingTreino(null)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar à lista
              </Button>
              <h2 className="text-lg font-semibold text-foreground mt-2">Gerenciar: {treinoDetail.titulo}</h2>
            </div>
            <Button size="sm" onClick={() => { setModuloForm({ treinamento_id: managingTreino }); setModuloDialog(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Novo Módulo
            </Button>
          </div>

          {loadingDetail ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-4">
              {treinoDetail.modulos?.map((modulo, mIdx) => (
                <div key={modulo.id} className="rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-3 p-4 border-b border-border">
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">{mIdx + 1}</div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{modulo.nome}</p>
                      {modulo.descricao && <p className="text-xs text-muted-foreground">{modulo.descricao}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setModuloForm(modulo); setModuloDialog(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('Remover módulo e suas aulas?')) deletarItem.mutate({ tabela: 'academia_modulos', id: modulo.id }); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setAulaForm({ modulo_id: modulo.id }); setAulaDialog(true); }}>
                      <Plus className="w-3 h-3 mr-1" /> Aula
                    </Button>
                  </div>
                  <div>
                    {modulo.aulas?.map((aula, aIdx) => (
                      <div key={aula.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-0 hover:bg-muted/20">
                        <span className="text-xs text-muted-foreground w-6 text-center">{aIdx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">{aula.titulo}</p>
                          <p className="text-[11px] text-muted-foreground">{aula.tipo} {aula.duracao && `· ${aula.duracao}`}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setAulaForm(aula); setAulaDialog(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('Remover aula?')) deletarItem.mutate({ tabela: 'academia_aulas', id: aula.id }); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                    {(!modulo.aulas || modulo.aulas.length === 0) && (
                      <p className="px-4 py-3 text-xs text-muted-foreground text-center">Nenhuma aula neste módulo.</p>
                    )}
                  </div>
                </div>
              ))}
              {(!treinoDetail.modulos || treinoDetail.modulos.length === 0) && (
                <div className="text-center py-12 border border-dashed border-border rounded-xl">
                  <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-muted-foreground text-sm">Nenhum módulo criado. Comece adicionando módulos.</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* MAIN ADMIN TABS */
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="treinamentos">Treinamentos</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
          </TabsList>

          {/* TRAININGS */}
          <TabsContent value="treinamentos" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { setTreinoForm({}); setTreinoDialog(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Novo Treinamento
              </Button>
            </div>
            {loadingTreinamentos ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-2">
                {treinamentos.map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/20 transition-colors">
                    <div className="w-16 h-10 rounded-md bg-muted overflow-hidden flex-shrink-0">
                      {t.imagem_capa ? <img src={t.imagem_capa} className="w-full h-full object-cover" /> : <GraduationCap className="w-full h-full p-2 text-muted-foreground/30" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.titulo}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        {t.categoria?.nome && <span>{t.categoria.nome}</span>}
                        <span>· {t.total_modulos} módulos · {t.total_aulas} aulas</span>
                      </div>
                    </div>
                    <Badge variant={t.status === 'publicado' ? 'default' : 'secondary'} className="text-[10px]">
                      {t.status === 'publicado' ? 'Publicado' : 'Rascunho'}
                    </Badge>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setManagingTreino(t.id)}>
                      <Eye className="w-3 h-3 mr-1" /> Conteúdo
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setTreinoForm(t); setTreinoDialog(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('Remover treinamento?')) deletarItem.mutate({ tabela: 'academia_treinamentos', id: t.id }); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {treinamentos.length === 0 && (
                  <div className="text-center py-12 border border-dashed border-border rounded-xl">
                    <BookOpen className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-muted-foreground text-sm">Nenhum treinamento cadastrado.</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* CATEGORIES */}
          <TabsContent value="categorias" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { setCatForm({}); setCatDialog(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Nova Categoria
              </Button>
            </div>
            <div className="space-y-2">
              {categorias.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{c.nome}</p>
                    {c.descricao && <p className="text-xs text-muted-foreground">{c.descricao}</p>}
                  </div>
                  <Badge variant={c.ativo ? 'default' : 'secondary'} className="text-[10px]">
                    {c.ativo ? 'Ativa' : 'Inativa'}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setCatForm(c); setCatDialog(true); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              {categorias.length === 0 && (
                <div className="text-center py-12 border border-dashed border-border rounded-xl">
                  <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-muted-foreground text-sm">Nenhuma categoria cadastrada.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* CATEGORY DIALOG */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{catForm.id ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={catForm.nome || ''} onChange={e => setCatForm(p => ({ ...p, nome: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={catForm.descricao || ''} onChange={e => setCatForm(p => ({ ...p, descricao: e.target.value }))} />
            </div>
            <div>
              <Label>Ordem</Label>
              <Input type="number" value={catForm.ordem || 0} onChange={e => setCatForm(p => ({ ...p, ordem: +e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={catForm.ativo !== false} onCheckedChange={v => setCatForm(p => ({ ...p, ativo: v }))} />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveCategoria} disabled={salvarCategoria.isPending}>
              {salvarCategoria.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TRAINING DIALOG */}
      <Dialog open={treinoDialog} onOpenChange={setTreinoDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{treinoForm.id ? 'Editar Treinamento' : 'Novo Treinamento'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Título *</Label>
              <Input value={treinoForm.titulo || ''} onChange={e => setTreinoForm((p: any) => ({ ...p, titulo: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Subtítulo</Label>
              <Input value={treinoForm.subtitulo || ''} onChange={e => setTreinoForm((p: any) => ({ ...p, subtitulo: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Descrição curta</Label>
              <Textarea rows={2} value={treinoForm.descricao_curta || ''} onChange={e => setTreinoForm((p: any) => ({ ...p, descricao_curta: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Descrição completa</Label>
              <Textarea rows={4} value={treinoForm.descricao_completa || ''} onChange={e => setTreinoForm((p: any) => ({ ...p, descricao_completa: e.target.value }))} />
            </div>
            <div>
              <Label>Imagem de capa (URL)</Label>
              <Input value={treinoForm.imagem_capa || ''} onChange={e => setTreinoForm((p: any) => ({ ...p, imagem_capa: e.target.value }))} placeholder="https://..." />
            </div>
            <div>
              <Label>Banner (URL)</Label>
              <Input value={treinoForm.banner || ''} onChange={e => setTreinoForm((p: any) => ({ ...p, banner: e.target.value }))} placeholder="https://..." />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={treinoForm.categoria_id || ''} onValueChange={v => setTreinoForm((p: any) => ({ ...p, categoria_id: v || null }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {categorias.filter(c => c.ativo).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nível</Label>
              <Select value={treinoForm.nivel || 'iniciante'} onValueChange={v => setTreinoForm((p: any) => ({ ...p, nivel: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="iniciante">Iniciante</SelectItem>
                  <SelectItem value="intermediario">Intermediário</SelectItem>
                  <SelectItem value="avancado">Avançado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Instrutor</Label>
              <Input value={treinoForm.instrutor || ''} onChange={e => setTreinoForm((p: any) => ({ ...p, instrutor: e.target.value }))} />
            </div>
            <div>
              <Label>Duração estimada</Label>
              <Input value={treinoForm.duracao_estimada || ''} onChange={e => setTreinoForm((p: any) => ({ ...p, duracao_estimada: e.target.value }))} placeholder="ex: 2h 30min" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={treinoForm.status || 'rascunho'} onValueChange={v => setTreinoForm((p: any) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="publicado">Publicado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={treinoForm.destaque || false} onCheckedChange={v => setTreinoForm((p: any) => ({ ...p, destaque: v }))} />
              <Label>Destaque</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTreinoDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveTreino} disabled={salvarTreinamento.isPending}>
              {salvarTreinamento.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODULE DIALOG */}
      <Dialog open={moduloDialog} onOpenChange={setModuloDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{moduloForm.id ? 'Editar Módulo' : 'Novo Módulo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={moduloForm.nome || ''} onChange={e => setModuloForm((p: any) => ({ ...p, nome: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={moduloForm.descricao || ''} onChange={e => setModuloForm((p: any) => ({ ...p, descricao: e.target.value }))} />
            </div>
            <div>
              <Label>Ordem</Label>
              <Input type="number" value={moduloForm.ordem || 0} onChange={e => setModuloForm((p: any) => ({ ...p, ordem: +e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuloDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveModulo} disabled={salvarModulo.isPending}>
              {salvarModulo.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LESSON DIALOG */}
      <Dialog open={aulaDialog} onOpenChange={setAulaDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{aulaForm.id ? 'Editar Aula' : 'Nova Aula'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={aulaForm.titulo || ''} onChange={e => setAulaForm((p: any) => ({ ...p, titulo: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={aulaForm.descricao || ''} onChange={e => setAulaForm((p: any) => ({ ...p, descricao: e.target.value }))} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={aulaForm.tipo || 'video'} onValueChange={v => setAulaForm((p: any) => ({ ...p, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Vídeo</SelectItem>
                  <SelectItem value="texto">Texto</SelectItem>
                  <SelectItem value="link">Link externo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(aulaForm.tipo === 'video' || !aulaForm.tipo) && (
              <div>
                <Label>URL do vídeo</Label>
                <Input value={aulaForm.video_url || ''} onChange={e => setAulaForm((p: any) => ({ ...p, video_url: e.target.value }))} placeholder="YouTube, Vimeo, Loom..." />
              </div>
            )}
            {aulaForm.tipo === 'texto' && (
              <div>
                <Label>Conteúdo</Label>
                <Textarea rows={6} value={aulaForm.conteudo_texto || ''} onChange={e => setAulaForm((p: any) => ({ ...p, conteudo_texto: e.target.value }))} />
              </div>
            )}
            {aulaForm.tipo === 'link' && (
              <div>
                <Label>Link externo</Label>
                <Input value={aulaForm.link_externo || ''} onChange={e => setAulaForm((p: any) => ({ ...p, link_externo: e.target.value }))} placeholder="https://..." />
              </div>
            )}
            <div>
              <Label>Thumbnail (URL)</Label>
              <Input value={aulaForm.thumbnail || ''} onChange={e => setAulaForm((p: any) => ({ ...p, thumbnail: e.target.value }))} placeholder="Opcional" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Duração</Label>
                <Input value={aulaForm.duracao || ''} onChange={e => setAulaForm((p: any) => ({ ...p, duracao: e.target.value }))} placeholder="ex: 15min" />
              </div>
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={aulaForm.ordem || 0} onChange={e => setAulaForm((p: any) => ({ ...p, ordem: +e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={aulaForm.obrigatoria !== false} onCheckedChange={v => setAulaForm((p: any) => ({ ...p, obrigatoria: v }))} />
              <Label>Obrigatória</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAulaDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveAula} disabled={salvarAula.isPending}>
              {salvarAula.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
