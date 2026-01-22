import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type TipoReacao = 'curtir' | 'amei' | 'parabens' | 'apoio' | 'inspirador';
export type TipoPost = 'post' | 'anuncio' | 'aniversario' | 'tempo_casa';

export interface FeedPost {
  id: string;
  tenant_id: string;
  autor_id: string;
  autor_nome: string;
  autor_avatar: string | null;
  tipo: TipoPost;
  conteudo: string;
  imagem_url: string | null;
  fixado: boolean;
  created_at: string;
  updated_at: string;
  reacoes: FeedReacao[];
  comentarios: FeedComentario[];
}

export interface FeedReacao {
  id: string;
  post_id: string;
  user_id: string;
  user_nome: string;
  tipo: TipoReacao;
  created_at: string;
}

export interface FeedComentario {
  id: string;
  post_id: string;
  autor_id: string;
  autor_nome: string;
  autor_avatar: string | null;
  conteudo: string;
  created_at: string;
}

export interface Aniversariante {
  nome_completo: string;
  data_nascimento: string;
  cargo?: string;
}

export interface TempoEmpresa {
  nome_completo: string;
  data_admissao: string;
  anos_empresa: number;
  cargo?: string;
}

export const REACOES_CONFIG: Record<TipoReacao, { emoji: string; label: string }> = {
  curtir: { emoji: '👍', label: 'Curtir' },
  amei: { emoji: '❤️', label: 'Amei' },
  parabens: { emoji: '🎉', label: 'Parabéns' },
  apoio: { emoji: '💪', label: 'Apoio' },
  inspirador: { emoji: '🚀', label: 'Inspirador' },
};

// Helper to access new tables not in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const feedPostsTable = () => (supabase as any).from('feed_posts');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const feedReacoesTable = () => (supabase as any).from('feed_reacoes');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const feedComentariosTable = () => (supabase as any).from('feed_comentarios');

export function useFeed() {
  const { user, profile, tenantId } = useAuthContext();
  const queryClient = useQueryClient();

  // Buscar posts do feed
  const {
    data: posts = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['feed-posts', tenantId],
    queryFn: async (): Promise<FeedPost[]> => {
      if (!tenantId) return [];

      const { data: postsData, error: postsError } = await feedPostsTable()
        .select('*')
        .eq('tenant_id', tenantId)
        .order('fixado', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (postsError) throw postsError;
      
      const posts = (postsData || []) as unknown as FeedPost[];

      if (posts.length === 0) return [];

      const postIds = posts.map(p => p.id);
      
      // Buscar reações
      const { data: reacoesData } = await feedReacoesTable()
        .select('*')
        .in('post_id', postIds);
      
      // Buscar comentários
      const { data: comentariosData } = await feedComentariosTable()
        .select('*')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });

      const reacoes = (reacoesData || []) as unknown as FeedReacao[];
      const comentarios = (comentariosData || []) as unknown as FeedComentario[];

      const reacoesMap = new Map<string, FeedReacao[]>();
      const comentariosMap = new Map<string, FeedComentario[]>();

      reacoes.forEach((r) => {
        const existing = reacoesMap.get(r.post_id) || [];
        reacoesMap.set(r.post_id, [...existing, r]);
      });

      comentarios.forEach((c) => {
        const existing = comentariosMap.get(c.post_id) || [];
        comentariosMap.set(c.post_id, [...existing, c]);
      });

      return posts.map((p) => ({
        ...p,
        reacoes: reacoesMap.get(p.id) || [],
        comentarios: comentariosMap.get(p.id) || [],
      }));
    },
    enabled: !!tenantId,
  });

  // Criar post
  const criarPost = useMutation({
    mutationFn: async ({ 
      conteudo, 
      tipo = 'post',
      imagem_url 
    }: { 
      conteudo: string; 
      tipo?: TipoPost;
      imagem_url?: string;
    }) => {
      if (!tenantId || !user || !profile) {
        throw new Error('Usuário não autenticado');
      }

      const insertData = {
        tenant_id: tenantId,
        autor_id: user.id,
        autor_nome: profile.nome_completo,
        autor_avatar: profile.avatar_url,
        tipo,
        conteudo,
        imagem_url,
      };

      const { data, error } = await feedPostsTable()
        .insert(insertData as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
      toast.success('Post publicado!');
    },
    onError: (error) => {
      console.error('Erro ao criar post:', error);
      toast.error('Erro ao publicar post');
    },
  });

  // Toggle reação
  const toggleReacao = useMutation({
    mutationFn: async ({ postId, tipo }: { postId: string; tipo: TipoReacao }) => {
      if (!tenantId || !user || !profile) {
        throw new Error('Usuário não autenticado');
      }

      // Verificar se já existe reação
      const { data: existing } = await feedReacoesTable()
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Remover reação existente
        await feedReacoesTable()
          .delete()
          .eq('id', (existing as { id: string }).id);
      } else {
        // Adicionar nova reação
        const insertData = {
          tenant_id: tenantId,
          post_id: postId,
          user_id: user.id,
          user_nome: profile.nome_completo,
          tipo,
        };
        await feedReacoesTable().insert(insertData as never);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
    },
    onError: (error) => {
      console.error('Erro ao reagir:', error);
      toast.error('Erro ao reagir');
    },
  });

  // Adicionar comentário
  const adicionarComentario = useMutation({
    mutationFn: async ({ postId, conteudo }: { postId: string; conteudo: string }) => {
      if (!tenantId || !user || !profile) {
        throw new Error('Usuário não autenticado');
      }

      const insertData = {
        tenant_id: tenantId,
        post_id: postId,
        autor_id: user.id,
        autor_nome: profile.nome_completo,
        autor_avatar: profile.avatar_url,
        conteudo,
      };

      const { data, error } = await feedComentariosTable()
        .insert(insertData as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
    },
    onError: (error) => {
      console.error('Erro ao comentar:', error);
      toast.error('Erro ao adicionar comentário');
    },
  });

  // Deletar post
  const deletarPost = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await feedPostsTable()
        .delete()
        .eq('id', postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
      toast.success('Post excluído');
    },
    onError: (error) => {
      console.error('Erro ao deletar post:', error);
      toast.error('Erro ao excluir post');
    },
  });

  // Deletar comentário
  const deletarComentario = useMutation({
    mutationFn: async (comentarioId: string) => {
      const { error } = await feedComentariosTable()
        .delete()
        .eq('id', comentarioId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
    },
    onError: (error) => {
      console.error('Erro ao deletar comentário:', error);
      toast.error('Erro ao excluir comentário');
    },
  });

  // Fixar/desfixar post (apenas managers+)
  const toggleFixar = useMutation({
    mutationFn: async ({ postId, fixado }: { postId: string; fixado: boolean }) => {
      const { error } = await feedPostsTable()
        .update({ fixado } as never)
        .eq('id', postId);

      if (error) throw error;
    },
    onSuccess: (_, { fixado }) => {
      queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
      toast.success(fixado ? 'Post fixado' : 'Post desfixado');
    },
    onError: (error) => {
      console.error('Erro ao fixar post:', error);
      toast.error('Erro ao fixar post');
    },
  });

  // Upload de imagem
  const uploadImagem = async (file: File): Promise<string> => {
    if (!user) throw new Error('Usuário não autenticado');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('feed-imagens')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('feed-imagens')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  return {
    posts,
    isLoading,
    error,
    refetch,
    criarPost,
    toggleReacao,
    adicionarComentario,
    deletarPost,
    deletarComentario,
    toggleFixar,
    uploadImagem,
    isPending: criarPost.isPending || toggleReacao.isPending || adicionarComentario.isPending,
  };
}

// Hook separado para aniversariantes
export function useAniversariantes() {
  const { tenantId } = useAuthContext();

  return useQuery({
    queryKey: ['aniversariantes', tenantId],
    queryFn: async (): Promise<Aniversariante[]> => {
      if (!tenantId) return [];

      const currentMonth = new Date().getMonth() + 1;

      const { data, error } = await supabase
        .from('admissoes')
        .select('nome_completo, data_nascimento, cargo')
        .eq('tenant_id', tenantId)
        .eq('status', 'concluido')
        .not('data_nascimento', 'is', null);

      if (error) throw error;

      // Filtrar aniversariantes do mês atual
      return (data || [])
        .filter((a) => {
          if (!a.data_nascimento) return false;
          const birthMonth = new Date(a.data_nascimento).getMonth() + 1;
          return birthMonth === currentMonth;
        })
        .sort((a, b) => {
          const dayA = new Date(a.data_nascimento!).getDate();
          const dayB = new Date(b.data_nascimento!).getDate();
          return dayA - dayB;
        }) as Aniversariante[];
    },
    enabled: !!tenantId,
  });
}

// Hook separado para tempo de empresa
export function useTempoEmpresa() {
  const { tenantId } = useAuthContext();

  return useQuery({
    queryKey: ['tempo-empresa', tenantId],
    queryFn: async (): Promise<TempoEmpresa[]> => {
      if (!tenantId) return [];

      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      const { data, error } = await supabase
        .from('admissoes')
        .select('nome_completo, data_admissao, cargo')
        .eq('tenant_id', tenantId)
        .eq('status', 'concluido')
        .not('data_admissao', 'is', null);

      if (error) throw error;

      // Filtrar colaboradores com aniversário de empresa no mês atual
      return (data || [])
        .filter((a) => {
          if (!a.data_admissao) return false;
          const admMonth = new Date(a.data_admissao).getMonth() + 1;
          const admYear = new Date(a.data_admissao).getFullYear();
          return admMonth === currentMonth && admYear < currentYear;
        })
        .map((a) => ({
          ...a,
          anos_empresa: currentYear - new Date(a.data_admissao!).getFullYear(),
        }))
        .sort((a, b) => {
          const dayA = new Date(a.data_admissao!).getDate();
          const dayB = new Date(b.data_admissao!).getDate();
          return dayA - dayB;
        }) as TempoEmpresa[];
    },
    enabled: !!tenantId,
  });
}
