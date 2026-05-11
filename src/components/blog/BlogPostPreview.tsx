import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Calendar, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  open: boolean;
  onClose: () => void;
  postId: string | null;
}

export function BlogPostPreview({ open, onClose, postId }: Props) {
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !postId) return;
    setLoading(true);
    supabase.from('blog_posts').select('*').eq('id', postId).maybeSingle().then(({ data }) => {
      setPost(data);
      setLoading(false);
    });
  }, [open, postId]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        {loading || !post ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <article className="space-y-6">
            {post.featured_image && (
              <img src={post.featured_image} alt={post.title} className="w-full max-h-80 object-cover rounded-lg" />
            )}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Badge variant="outline" className="gap-1"><Tag className="h-3 w-3" />{post.category || 'Geral'}</Badge>
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />
                  {format(new Date(post.published_at || post.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
                <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                  {post.status === 'published' ? 'Publicado' : 'Rascunho'}
                </Badge>
              </div>
              <h1 className="text-4xl font-bold leading-tight">{post.title}</h1>
              {post.excerpt && <p className="text-lg text-muted-foreground">{post.excerpt}</p>}
            </div>
            <div
              className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-img:rounded-lg prose-a:text-primary"
              dangerouslySetInnerHTML={{ __html: post.content || '' }}
            />
          </article>
        )}
      </DialogContent>
    </Dialog>
  );
}
