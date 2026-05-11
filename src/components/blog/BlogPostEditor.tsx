import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RichTextEditor } from './RichTextEditor';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Image as ImageIcon, Loader2, Save, Upload, X } from 'lucide-react';

interface BlogPost {
  id?: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  category: string | null;
  status: string;
  featured_image: string | null;
  published_at?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  postId?: string | null;
  onSaved: () => void;
}

const CATEGORIES = [
  'Segurança do Trabalho', 'Saúde Ocupacional', 'Ergonomia', 'Compliance',
  'Gestão de Pessoas', 'Tecnologia', 'Legislação', 'Cases', 'Geral',
];

const empty: BlogPost = {
  title: '', excerpt: '', content: '', category: 'Geral',
  status: 'draft', featured_image: null,
};

export function BlogPostEditor({ open, onClose, postId, onSaved }: Props) {
  const [post, setPost] = useState<BlogPost>(empty);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (postId) {
      setLoading(true);
      supabase.from('blog_posts').select('*').eq('id', postId).maybeSingle().then(({ data, error }) => {
        if (error) toast.error('Erro ao carregar post');
        else if (data) setPost(data as BlogPost);
        setLoading(false);
      });
    } else {
      setPost(empty);
    }
  }, [open, postId]);

  const handleCoverUpload = async (file: File) => {
    setUploadingCover(true);
    const ext = file.name.split('.').pop();
    const path = `covers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('blog-media').upload(path, file);
    if (error) {
      toast.error('Erro no upload: ' + error.message);
    } else {
      const { data } = supabase.storage.from('blog-media').getPublicUrl(path);
      setPost(p => ({ ...p, featured_image: data.publicUrl }));
      toast.success('Imagem de capa carregada');
    }
    setUploadingCover(false);
  };

  const handleSave = async (publish?: boolean) => {
    if (!post.title.trim()) { toast.error('Informe o título'); return; }
    if (!post.content || post.content === '<p></p>') { toast.error('Escreva o conteúdo do artigo'); return; }
    setSaving(true);

    const status = publish === true ? 'published' : publish === false ? 'draft' : post.status;
    const payload: any = {
      title: post.title.trim(),
      excerpt: post.excerpt?.trim() || null,
      content: post.content,
      category: post.category,
      featured_image: post.featured_image,
      status,
      published_at: status === 'published' ? (post.published_at || new Date().toISOString()) : null,
    };

    if (postId) {
      const { error } = await supabase.from('blog_posts').update(payload).eq('id', postId);
      if (error) { toast.error('Erro ao salvar: ' + error.message); setSaving(false); return; }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      payload.author_id = user?.id;
      const { error } = await supabase.from('blog_posts').insert(payload);
      if (error) { toast.error('Erro ao criar: ' + error.message); setSaving(false); return; }
    }

    toast.success(status === 'published' ? 'Artigo publicado!' : 'Rascunho salvo');
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{postId ? 'Editar artigo' : 'Novo artigo do blog'}</DialogTitle>
          <DialogDescription>
            Crie textos ricos com formatação, imagens e vídeos. Salve como rascunho ou publique.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={post.title}
                  onChange={(e) => setPost(p => ({ ...p, title: e.target.value }))}
                  placeholder="Ex: 10 boas práticas de SST em 2026"
                  className="text-lg font-semibold"
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={post.category || 'Geral'} onValueChange={(v) => setPost(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="excerpt">Resumo / Subtítulo</Label>
              <Textarea
                id="excerpt"
                value={post.excerpt || ''}
                onChange={(e) => setPost(p => ({ ...p, excerpt: e.target.value }))}
                placeholder="Um resumo curto que aparecerá na listagem e no SEO (até 200 caracteres)"
                maxLength={220}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Imagem de capa</Label>
              {post.featured_image ? (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img src={post.featured_image} alt="Capa" className="w-full max-h-64 object-cover" />
                  <Button
                    type="button" variant="destructive" size="sm"
                    onClick={() => setPost(p => ({ ...p, featured_image: null }))}
                    className="absolute top-2 right-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:bg-muted/30 transition-colors">
                  {uploadingCover ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Clique para enviar imagem de capa</span>
                    </>
                  )}
                  <input
                    type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); }}
                  />
                </label>
              )}
            </div>

            <div className="space-y-2">
              <Label>Conteúdo *</Label>
              <RichTextEditor
                value={post.content || ''}
                onChange={(html) => setPost(p => ({ ...p, content: html }))}
              />
              <p className="text-xs text-muted-foreground">
                Use a barra de ferramentas para formatar texto, inserir imagens, vídeos (upload) ou vídeos do YouTube.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Switch
                  checked={post.status === 'published'}
                  onCheckedChange={(checked) => setPost(p => ({ ...p, status: checked ? 'published' : 'draft' }))}
                />
                <Label className="cursor-pointer">
                  {post.status === 'published' ? 'Publicado' : 'Rascunho'}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
                <Button variant="secondary" onClick={() => handleSave(false)} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar rascunho
                </Button>
                <Button onClick={() => handleSave(true)} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Publicar
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
