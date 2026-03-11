import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface AcademiaCategoria {
  id: string;
  tenant_id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  icone: string;
  ordem: number;
  ativo: boolean;
}

export interface AcademiaTreinamento {
  id: string;
  tenant_id: string;
  categoria_id: string | null;
  titulo: string;
  subtitulo: string | null;
  descricao_curta: string | null;
  descricao_completa: string | null;
  imagem_capa: string | null;
  banner: string | null;
  slug: string;
  nivel: string;
  instrutor: string | null;
  duracao_estimada: string | null;
  tags: string[] | null;
  status: string;
  destaque: boolean;
  ordem: number;
  created_at: string;
  categoria?: AcademiaCategoria | null;
  total_modulos?: number;
  total_aulas?: number;
  progresso?: number;
  favoritado?: boolean;
}

export interface AcademiaModulo {
  id: string;
  tenant_id: string;
  treinamento_id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  aulas?: AcademiaAula[];
}

export interface AcademiaAula {
  id: string;
  tenant_id: string;
  modulo_id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  video_url: string | null;
  thumbnail: string | null;
  conteudo_texto: string | null;
  link_externo: string | null;
  duracao: string | null;
  material_complementar: any[];
  ordem: number;
  obrigatoria: boolean;
  concluida?: boolean;
}

export interface AcademiaBadge {
  id: string;
  nome: string;
  descricao: string | null;
  icone: string;
  created_at: string;
}

export function useAcademia() {
  const queryClient = useQueryClient();
  const { user, tenantId } = useAuthContext();

  // Categories
  const { data: categorias = [], isLoading: loadingCategorias } = useQuery({
    queryKey: ['academia', 'categorias', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academia_categorias')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('ordem');
      if (error) throw error;
      return data as AcademiaCategoria[];
    },
    enabled: !!tenantId,
  });

  // Trainings with stats
  const { data: treinamentos = [], isLoading: loadingTreinamentos } = useQuery({
    queryKey: ['academia', 'treinamentos', tenantId],
    queryFn: async () => {
      const { data: treinos, error } = await supabase
        .from('academia_treinamentos')
        .select('*, academia_categorias(*)')
        .eq('tenant_id', tenantId!)
        .order('ordem');
      if (error) throw error;

      // Get module/lesson counts
      const { data: modulos } = await supabase
        .from('academia_modulos')
        .select('id, treinamento_id')
        .eq('tenant_id', tenantId!);

      const { data: aulas } = await supabase
        .from('academia_aulas')
        .select('id, modulo_id')
        .eq('tenant_id', tenantId!);

      // Get user progress
      const { data: progresso } = user ? await supabase
        .from('academia_progresso')
        .select('aula_id, treinamento_id, concluida')
        .eq('user_id', user.id)
        .eq('concluida', true) : { data: [] };

      // Get favorites
      const { data: favs } = user ? await supabase
        .from('academia_favoritos')
        .select('treinamento_id')
        .eq('user_id', user.id) : { data: [] };

      const favSet = new Set((favs || []).map(f => f.treinamento_id));
      const modulosByTreino: Record<string, string[]> = {};
      (modulos || []).forEach(m => {
        if (!modulosByTreino[m.treinamento_id]) modulosByTreino[m.treinamento_id] = [];
        modulosByTreino[m.treinamento_id].push(m.id);
      });

      const aulasByModulo: Record<string, number> = {};
      (aulas || []).forEach(a => {
        aulasByModulo[a.modulo_id] = (aulasByModulo[a.modulo_id] || 0) + 1;
      });

      const progressoByTreino: Record<string, number> = {};
      (progresso || []).forEach(p => {
        progressoByTreino[p.treinamento_id] = (progressoByTreino[p.treinamento_id] || 0) + 1;
      });

      return (treinos || []).map(t => {
        const mods = modulosByTreino[t.id] || [];
        const totalAulas = mods.reduce((acc, mId) => acc + (aulasByModulo[mId] || 0), 0);
        const concluidas = progressoByTreino[t.id] || 0;
        return {
          ...t,
          categoria: (t as any).academia_categorias || null,
          total_modulos: mods.length,
          total_aulas: totalAulas,
          progresso: totalAulas > 0 ? Math.round((concluidas / totalAulas) * 100) : 0,
          favoritado: favSet.has(t.id),
        } as AcademiaTreinamento;
      });
    },
    enabled: !!tenantId,
  });

  // Get training detail with modules and lessons
  const getTreinamentoDetail = (treinamentoId: string) => useQuery({
    queryKey: ['academia', 'treinamento', treinamentoId],
    queryFn: async () => {
      const { data: treino, error } = await supabase
        .from('academia_treinamentos')
        .select('*, academia_categorias(*)')
        .eq('id', treinamentoId)
        .single();
      if (error) throw error;

      const { data: modulos } = await supabase
        .from('academia_modulos')
        .select('*')
        .eq('treinamento_id', treinamentoId)
        .order('ordem');

      const moduloIds = (modulos || []).map(m => m.id);
      let aulas: any[] = [];
      if (moduloIds.length > 0) {
        const { data } = await supabase
          .from('academia_aulas')
          .select('*')
          .in('modulo_id', moduloIds)
          .order('ordem');
        aulas = data || [];
      }

      // Get user progress
      let progressoSet = new Set<string>();
      if (user) {
        const { data: prog } = await supabase
          .from('academia_progresso')
          .select('aula_id')
          .eq('user_id', user.id)
          .eq('treinamento_id', treinamentoId)
          .eq('concluida', true);
        progressoSet = new Set((prog || []).map(p => p.aula_id));
      }

      const modulosComAulas = (modulos || []).map(m => ({
        ...m,
        aulas: aulas
          .filter(a => a.modulo_id === m.id)
          .map(a => ({ ...a, concluida: progressoSet.has(a.id) })),
      }));

      const totalAulas = aulas.length;
      const concluidas = progressoSet.size;

      // Check favorite
      let favoritado = false;
      if (user) {
        const { data: fav } = await supabase
          .from('academia_favoritos')
          .select('id')
          .eq('user_id', user.id)
          .eq('treinamento_id', treinamentoId)
          .maybeSingle();
        favoritado = !!fav;
      }

      return {
        ...treino,
        categoria: (treino as any).academia_categorias || null,
        modulos: modulosComAulas as AcademiaModulo[],
        total_modulos: modulosComAulas.length,
        total_aulas: totalAulas,
        progresso: totalAulas > 0 ? Math.round((concluidas / totalAulas) * 100) : 0,
        favoritado,
      };
    },
    enabled: !!treinamentoId,
  });

  // Mark lesson as complete
  const completarAula = useMutation({
    mutationFn: async ({ aulaId, treinamentoId }: { aulaId: string; treinamentoId: string }) => {
      if (!user || !tenantId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('academia_progresso')
        .upsert({
          tenant_id: tenantId,
          user_id: user.id,
          aula_id: aulaId,
          treinamento_id: treinamentoId,
          concluida: true,
          concluida_em: new Date().toISOString(),
        }, { onConflict: 'user_id,aula_id' });
      if (error) throw error;

      // Award XP
      await supabase.from('academia_xp').insert({
        tenant_id: tenantId,
        user_id: user.id,
        pontos: 10,
        tipo: 'aula_concluida',
        referencia_id: aulaId,
        descricao: 'Aula concluída',
      });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['academia'] });
      toast.success('Aula concluída! +10 XP');
    },
  });

  // Toggle favorite
  const toggleFavorito = useMutation({
    mutationFn: async ({ treinamentoId, favoritado }: { treinamentoId: string; favoritado: boolean }) => {
      if (!user || !tenantId) throw new Error('Not authenticated');
      if (favoritado) {
        await supabase.from('academia_favoritos').delete().eq('user_id', user.id).eq('treinamento_id', treinamentoId);
      } else {
        await supabase.from('academia_favoritos').insert({ tenant_id: tenantId, user_id: user.id, treinamento_id: treinamentoId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academia'] });
    },
  });

  // User XP total
  const { data: userXp = 0 } = useQuery({
    queryKey: ['academia', 'xp', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academia_xp')
        .select('pontos')
        .eq('user_id', user!.id);
      if (error) throw error;
      return (data || []).reduce((acc, r) => acc + r.pontos, 0);
    },
    enabled: !!user,
  });

  // User badges
  const { data: userBadges = [] } = useQuery({
    queryKey: ['academia', 'badges', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academia_badges')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AcademiaBadge[];
    },
    enabled: !!user,
  });

  // Award badge when training is complete
  const checkAndAwardBadge = async (treinamentoId: string, treinamentoTitulo: string) => {
    if (!user || !tenantId) return;

    // Check if all lessons are complete
    const { data: modulos } = await supabase
      .from('academia_modulos')
      .select('id')
      .eq('treinamento_id', treinamentoId);

    if (!modulos?.length) return;

    const { data: aulas } = await supabase
      .from('academia_aulas')
      .select('id')
      .in('modulo_id', modulos.map(m => m.id));

    const { data: prog } = await supabase
      .from('academia_progresso')
      .select('aula_id')
      .eq('user_id', user.id)
      .eq('treinamento_id', treinamentoId)
      .eq('concluida', true);

    if (aulas?.length && prog?.length === aulas.length) {
      // Award badge
      await supabase.from('academia_badges').upsert({
        tenant_id: tenantId,
        user_id: user.id,
        nome: `Concluiu: ${treinamentoTitulo}`,
        descricao: `Completou o treinamento "${treinamentoTitulo}"`,
        icone: '🏆',
        treinamento_id: treinamentoId,
      }, { onConflict: 'user_id,nome,treinamento_id' });

      // Award bonus XP
      await supabase.from('academia_xp').insert({
        tenant_id: tenantId,
        user_id: user.id,
        pontos: 50,
        tipo: 'treinamento_concluido',
        referencia_id: treinamentoId,
        descricao: `Treinamento "${treinamentoTitulo}" concluído`,
      });

      queryClient.invalidateQueries({ queryKey: ['academia'] });
      toast.success(`🏆 Badge conquistado! Você concluiu "${treinamentoTitulo}" +50 XP`);
    }
  };

  // ADMIN mutations
  const salvarCategoria = useMutation({
    mutationFn: async (data: Partial<AcademiaCategoria> & { nome: string; slug: string }) => {
      if (!tenantId) throw new Error('No tenant');
      if (data.id) {
        const { id, ...rest } = data;
        const { error } = await supabase.from('academia_categorias').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('academia_categorias').insert({ ...data, tenant_id: tenantId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academia', 'categorias'] });
      toast.success('Categoria salva!');
    },
  });

  const salvarTreinamento = useMutation({
    mutationFn: async (data: any) => {
      if (!tenantId) throw new Error('No tenant');
      if (data.id) {
        const { id, academia_categorias, ...rest } = data;
        const { error } = await supabase.from('academia_treinamentos').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { academia_categorias, ...rest } = data;
        const { error } = await supabase.from('academia_treinamentos').insert({ ...rest, tenant_id: tenantId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academia'] });
      toast.success('Treinamento salvo!');
    },
  });

  const salvarModulo = useMutation({
    mutationFn: async (data: any) => {
      if (!tenantId) throw new Error('No tenant');
      if (data.id) {
        const { id, ...rest } = data;
        const { error } = await supabase.from('academia_modulos').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('academia_modulos').insert({ ...data, tenant_id: tenantId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academia'] });
      toast.success('Módulo salvo!');
    },
  });

  const salvarAula = useMutation({
    mutationFn: async (data: any) => {
      if (!tenantId) throw new Error('No tenant');
      if (data.id) {
        const { id, concluida, ...rest } = data;
        const { error } = await supabase.from('academia_aulas').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { concluida, ...rest } = data;
        const { error } = await supabase.from('academia_aulas').insert({ ...rest, tenant_id: tenantId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academia'] });
      toast.success('Aula salva!');
    },
  });

  const deletarItem = useMutation({
    mutationFn: async ({ tabela, id }: { tabela: string; id: string }) => {
      const { error } = await supabase.from(tabela as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academia'] });
      toast.success('Item removido!');
    },
  });

  return {
    categorias,
    treinamentos,
    loadingCategorias,
    loadingTreinamentos,
    getTreinamentoDetail,
    completarAula,
    toggleFavorito,
    userXp,
    userBadges,
    checkAndAwardBadge,
    salvarCategoria,
    salvarTreinamento,
    salvarModulo,
    salvarAula,
    deletarItem,
  };
}
