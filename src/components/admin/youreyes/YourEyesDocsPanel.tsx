import { useMemo, useState } from 'react';
import {
  Folder, FolderOpen, FileText, Plus, Edit, Trash2, ChevronRight, ChevronDown, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { YOUREYES_MODULOS, getSubmoduloLabel } from '@/lib/youreyes-modulos';
import { useYourEyes, YourEyesDocumento } from '@/hooks/useYourEyes';

const NENHUM_SUBMODULO = '__geral__';

export function YourEyesDocsPanel() {
  const { documentos, isLoading, salvarDocumento, excluirDocumento, isSalvandoDocumento } = useYourEyes();

  const [moduloAberto, setModuloAberto] = useState<Record<string, boolean>>({});
  const [pastaSelecionada, setPastaSelecionada] = useState<{ modulo: string; submodulo: string | null } | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [docEditando, setDocEditando] = useState<YourEyesDocumento | null>(null);
  const [docExcluindo, setDocExcluindo] = useState<YourEyesDocumento | null>(null);

  const [titulo, setTitulo] = useState('');
  const [modulo, setModulo] = useState('');
  const [submodulo, setSubmodulo] = useState(NENHUM_SUBMODULO);
  const [conteudo, setConteudo] = useState('');

  const docsPorPasta = useMemo(() => {
    const map = new Map<string, YourEyesDocumento[]>();
    for (const doc of documentos) {
      const chave = `${doc.modulo}::${doc.submodulo || ''}`;
      map.set(chave, [...(map.get(chave) || []), doc]);
    }
    return map;
  }, [documentos]);

  const docsDoModulo = (moduloId: string) => documentos.filter((d) => d.modulo === moduloId);

  const docsVisiveis = useMemo(() => {
    if (!pastaSelecionada) return documentos;
    return documentos.filter(
      (d) =>
        d.modulo === pastaSelecionada.modulo &&
        (pastaSelecionada.submodulo === null || d.submodulo === pastaSelecionada.submodulo)
    );
  }, [documentos, pastaSelecionada]);

  const abrirNovoDocumento = () => {
    setDocEditando(null);
    setTitulo('');
    setModulo(pastaSelecionada?.modulo || YOUREYES_MODULOS[0].id);
    setSubmodulo(pastaSelecionada?.submodulo || NENHUM_SUBMODULO);
    setConteudo('');
    setShowEditor(true);
  };

  const abrirEdicao = (doc: YourEyesDocumento) => {
    setDocEditando(doc);
    setTitulo(doc.titulo);
    setModulo(doc.modulo);
    setSubmodulo(doc.submodulo || NENHUM_SUBMODULO);
    setConteudo(doc.conteudo);
    setShowEditor(true);
  };

  const handleSalvar = async () => {
    if (!titulo.trim() || !modulo) {
      toast.error('Informe o título e o módulo do documento');
      return;
    }
    try {
      await salvarDocumento({
        id: docEditando?.id,
        titulo: titulo.trim(),
        modulo,
        submodulo: submodulo === NENHUM_SUBMODULO ? null : submodulo,
        conteudo,
      });
      toast.success(docEditando ? 'Documento atualizado' : 'Documento criado');
      setShowEditor(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar documento');
    }
  };

  const handleExcluir = async () => {
    if (!docExcluindo) return;
    try {
      await excluirDocumento(docExcluindo.id);
      toast.success('Documento excluído');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir documento');
    } finally {
      setDocExcluindo(null);
    }
  };

  const moduloSelecionado = YOUREYES_MODULOS.find((m) => m.id === modulo);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      {/* Árvore de diretórios (espelho do menu do sistema) */}
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Diretório de Testes</CardTitle>
          <CardDescription className="text-xs">
            Pastas espelhando a estrutura de menu do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0.5 px-3 pb-3">
          <button
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors ${!pastaSelecionada ? 'bg-muted font-medium' : ''}`}
            onClick={() => setPastaSelecionada(null)}
          >
            <FolderOpen className="w-4 h-4 text-primary shrink-0" />
            Todos os documentos
            <Badge variant="secondary" className="ml-auto text-[10px]">{documentos.length}</Badge>
          </button>

          {YOUREYES_MODULOS.map((mod) => {
            const aberto = !!moduloAberto[mod.id];
            const totalModulo = docsDoModulo(mod.id).length;
            const moduloAtivo = pastaSelecionada?.modulo === mod.id && pastaSelecionada.submodulo === null;
            return (
              <div key={mod.id}>
                <div className={`flex items-center rounded-md hover:bg-muted transition-colors ${moduloAtivo ? 'bg-muted' : ''}`}>
                  <button
                    className="p-1.5 shrink-0"
                    onClick={() => setModuloAberto((s) => ({ ...s, [mod.id]: !aberto }))}
                    aria-label={aberto ? 'Recolher' : 'Expandir'}
                  >
                    {aberto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    className={`flex-1 flex items-center gap-2 py-1.5 pr-2 text-sm text-left ${moduloAtivo ? 'font-medium' : ''}`}
                    onClick={() => setPastaSelecionada({ modulo: mod.id, submodulo: null })}
                  >
                    {aberto ? <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" /> : <Folder className="w-4 h-4 text-amber-500 shrink-0" />}
                    <span className="truncate">{mod.label}</span>
                    {totalModulo > 0 && <Badge variant="secondary" className="ml-auto text-[10px]">{totalModulo}</Badge>}
                  </button>
                </div>
                {aberto && (
                  <div className="ml-6 border-l pl-2 space-y-0.5">
                    {mod.itens.map((item) => {
                      const count = (docsPorPasta.get(`${mod.id}::${item.id}`) || []).length;
                      const ativo = pastaSelecionada?.modulo === mod.id && pastaSelecionada.submodulo === item.id;
                      return (
                        <button
                          key={item.id}
                          className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs hover:bg-muted transition-colors ${ativo ? 'bg-muted font-medium' : 'text-muted-foreground'}`}
                          onClick={() => setPastaSelecionada({ modulo: mod.id, submodulo: item.id })}
                        >
                          <Folder className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{item.label}</span>
                          {count > 0 && <Badge variant="secondary" className="ml-auto text-[10px]">{count}</Badge>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Lista de documentos da pasta */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">
              {pastaSelecionada
                ? `${YOUREYES_MODULOS.find((m) => m.id === pastaSelecionada.modulo)?.label || pastaSelecionada.modulo}${pastaSelecionada.submodulo ? ` / ${getSubmoduloLabel(pastaSelecionada.modulo, pastaSelecionada.submodulo)}` : ''}`
                : 'Todos os documentos'}
            </CardTitle>
            <CardDescription className="text-xs">
              A documentação de teste é o primeiro passo antes de criar um agente
            </CardDescription>
          </div>
          <Button size="sm" onClick={abrirNovoDocumento}>
            <Plus className="w-4 h-4 mr-2" />Novo Documento
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />Carregando...
            </div>
          ) : docsVisiveis.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Nenhum documento de teste nesta pasta.
              <br />Crie o primeiro para poder montar um agente.
            </div>
          ) : (
            <div className="space-y-2">
              {docsVisiveis.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{doc.titulo}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {YOUREYES_MODULOS.find((m) => m.id === doc.modulo)?.label || doc.modulo}
                      {doc.submodulo ? ` / ${getSubmoduloLabel(doc.modulo, doc.submodulo)}` : ''}
                      {' · '}atualizado {format(new Date(doc.updated_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => abrirEdicao(doc)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDocExcluindo(doc)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor de documento */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{docEditando ? 'Editar Documento de Teste' : 'Novo Documento de Teste'}</DialogTitle>
            <DialogDescription>
              Descreva o roteiro de teste do módulo: pré-condições, passos e resultados esperados (aceita Markdown)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Roteiro de teste — Cadastro de Colaboradores" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Módulo (pasta)</Label>
                <Select value={modulo} onValueChange={(v) => { setModulo(v); setSubmodulo(NENHUM_SUBMODULO); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione o módulo" /></SelectTrigger>
                  <SelectContent>
                    {YOUREYES_MODULOS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Funcionalidade (subpasta)</Label>
                <Select value={submodulo} onValueChange={setSubmodulo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUM_SUBMODULO}>— Geral do módulo —</SelectItem>
                    {(moduloSelecionado?.itens || []).map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Tabs defaultValue="editar">
              <TabsList>
                <TabsTrigger value="editar">Editar</TabsTrigger>
                <TabsTrigger value="preview">Visualizar</TabsTrigger>
              </TabsList>
              <TabsContent value="editar">
                <Textarea
                  value={conteudo}
                  onChange={(e) => setConteudo(e.target.value)}
                  rows={14}
                  className="font-mono text-sm"
                  placeholder={'## Objetivo\n\n## Pré-condições\n\n## Passos\n1. ...\n2. ...\n\n## Resultado esperado\n'}
                />
              </TabsContent>
              <TabsContent value="preview">
                <div className="border rounded-md p-4 min-h-[200px] prose prose-sm dark:prose-invert max-w-none">
                  {conteudo ? <ReactMarkdown>{conteudo}</ReactMarkdown> : <p className="text-muted-foreground text-sm">Nada para visualizar ainda.</p>}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditor(false)}>Cancelar</Button>
              <Button onClick={handleSalvar} disabled={isSalvandoDocumento}>
                {isSalvandoDocumento && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {docEditando ? 'Salvar alterações' : 'Criar documento'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!docExcluindo} onOpenChange={(v) => !v && setDocExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              O documento "{docExcluindo?.titulo}" será removido do diretório de testes.
              Agentes vinculados a ele deixarão de usá-lo nas próximas execuções.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleExcluir}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
