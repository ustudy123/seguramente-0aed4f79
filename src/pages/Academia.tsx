import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, BookOpen, Heart, Play, Star, Trophy, Zap, ChevronRight, Clock, Users, BarChart3, GraduationCap, Sparkles, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAcademia, AcademiaTreinamento } from '@/hooks/useAcademia';
import { useAuthContext } from '@/contexts/AuthContext';
import { AcademiaTrainingCard } from '@/components/academia/AcademiaTrainingCard';
import { AcademiaTrainingDetail } from '@/components/academia/AcademiaTrainingDetail';
import { AcademiaLessonView } from '@/components/academia/AcademiaLessonView';
import { AcademiaAdmin } from '@/components/academia/AcademiaAdmin';
import { Loader2 } from 'lucide-react';

type View = 'home' | 'explorar' | 'meus-cursos' | 'favoritos' | 'treinamento' | 'aula' | 'admin';

export default function Academia() {
  const { hasMinimumRole } = useAuthContext();
  const { treinamentos, categorias, loadingTreinamentos, userXp, userBadges } = useAcademia();
  const [view, setView] = useState<View>('home');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [nivelFilter, setNivelFilter] = useState('all');
  const [selectedTreinamento, setSelectedTreinamento] = useState<string | null>(null);
  const [selectedAula, setSelectedAula] = useState<{ aulaId: string; treinamentoId: string } | null>(null);

  const isAdmin = hasMinimumRole('admin');

  const publicados = useMemo(() =>
    treinamentos.filter(t => t.status === 'publicado' || isAdmin),
    [treinamentos, isAdmin]
  );

  const filtered = useMemo(() => {
    let result = publicados;
    if (search) result = result.filter(t =>
      t.titulo.toLowerCase().includes(search.toLowerCase()) ||
      t.descricao_curta?.toLowerCase().includes(search.toLowerCase())
    );
    if (catFilter !== 'all') result = result.filter(t => t.categoria_id === catFilter);
    if (nivelFilter !== 'all') result = result.filter(t => t.nivel === nivelFilter);
    return result;
  }, [publicados, search, catFilter, nivelFilter]);

  const meusCursos = useMemo(() => publicados.filter(t => (t.progresso || 0) > 0), [publicados]);
  const favoritos = useMemo(() => publicados.filter(t => t.favoritado), [publicados]);
  const destaques = useMemo(() => publicados.filter(t => t.destaque), [publicados]);
  const emAndamento = useMemo(() => publicados.filter(t => (t.progresso || 0) > 0 && (t.progresso || 0) < 100), [publicados]);
  const recentes = useMemo(() => [...publicados].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6), [publicados]);

  const openTreinamento = (id: string) => {
    setSelectedTreinamento(id);
    setView('treinamento');
  };

  const openAula = (aulaId: string, treinamentoId: string) => {
    setSelectedAula({ aulaId, treinamentoId });
    setView('aula');
  };

  const goBack = () => {
    if (view === 'aula') {
      setView('treinamento');
      setSelectedAula(null);
    } else if (view === 'treinamento') {
      setView('home');
      setSelectedTreinamento(null);
    } else {
      setView('home');
    }
  };

  if (view === 'treinamento' && selectedTreinamento) {
    return <AcademiaTrainingDetail treinamentoId={selectedTreinamento} onBack={goBack} onOpenAula={openAula} />;
  }

  if (view === 'aula' && selectedAula) {
    return <AcademiaLessonView aulaId={selectedAula.aulaId} treinamentoId={selectedAula.treinamentoId} onBack={goBack} />;
  }

  if (view === 'admin' && isAdmin) {
    return <AcademiaAdmin onBack={() => setView('home')} />;
  }

  const renderTrainingGrid = (items: AcademiaTreinamento[], emptyMsg: string) => (
    items.length === 0 ? (
      <div className="text-center py-16">
        <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">{emptyMsg}</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map(t => (
          <AcademiaTrainingCard key={t.id} treinamento={t} onClick={() => openTreinamento(t.id)} />
        ))}
      </div>
    )
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-primary" />
            Academia
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Central de treinamentos e desenvolvimento</p>
        </div>
        <div className="flex items-center gap-3">
          {/* XP indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary">{userXp} XP</span>
          </div>
          {userBadges.length > 0 && (
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-500">{userBadges.length}</span>
            </div>
          )}
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setView('admin')}>
              <BarChart3 className="w-4 h-4 mr-1.5" />
              Painel Admin
            </Button>
          )}
        </div>
      </div>

      {/* Quick Nav Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Explorar Cursos', icon: BookOpen, desc: `${publicados.length} treinamentos disponíveis`, tab: 'explorar' as View, color: 'text-primary' },
          { label: 'Meus Cursos', icon: Play, desc: `${meusCursos.length} em andamento`, tab: 'meus-cursos' as View, color: 'text-emerald-500' },
          { label: 'Favoritos', icon: Heart, desc: `${favoritos.length} salvos`, tab: 'favoritos' as View, color: 'text-rose-500' },
        ].map(card => (
          <motion.button
            key={card.label}
            whileHover={{ y: -2 }}
            onClick={() => setView(card.tab)}
            className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all text-left"
          >
            <div className={`p-2.5 rounded-lg bg-muted ${card.color}`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground">{card.label}</p>
              <p className="text-xs text-muted-foreground">{card.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
          </motion.button>
        ))}
      </div>

      {/* Main Content Area */}
      <Tabs value={view === 'home' ? 'home' : view} onValueChange={v => setView(v as View)}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="home">Início</TabsTrigger>
          <TabsTrigger value="explorar">Explorar</TabsTrigger>
          <TabsTrigger value="meus-cursos">Meus Cursos</TabsTrigger>
          <TabsTrigger value="favoritos">Favoritos</TabsTrigger>
        </TabsList>

        {/* HOME */}
        <TabsContent value="home" className="space-y-8 mt-6">
          {/* Continue where you left off */}
          {emAndamento.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Play className="w-5 h-5 text-primary" />
                Continuar de onde parei
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {emAndamento.slice(0, 3).map(t => (
                  <AcademiaTrainingCard key={t.id} treinamento={t} onClick={() => openTreinamento(t.id)} />
                ))}
              </div>
            </section>
          )}

          {/* Featured */}
          {destaques.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Treinamentos em destaque
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {destaques.slice(0, 6).map(t => (
                  <AcademiaTrainingCard key={t.id} treinamento={t} onClick={() => openTreinamento(t.id)} />
                ))}
              </div>
            </section>
          )}

          {/* Recent */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              Conteúdos recentes
            </h2>
            {loadingTreinamentos ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : renderTrainingGrid(recentes, 'Nenhum treinamento disponível ainda.')}
          </section>
        </TabsContent>

        {/* EXPLORE */}
        <TabsContent value="explorar" className="space-y-5 mt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar treinamentos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categorias.filter(c => c.ativo).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={nivelFilter} onValueChange={setNivelFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Nível" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos níveis</SelectItem>
                <SelectItem value="iniciante">Iniciante</SelectItem>
                <SelectItem value="intermediario">Intermediário</SelectItem>
                <SelectItem value="avancado">Avançado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {renderTrainingGrid(filtered, 'Nenhum treinamento encontrado.')}
        </TabsContent>

        {/* MY COURSES */}
        <TabsContent value="meus-cursos" className="space-y-5 mt-6">
          {renderTrainingGrid(meusCursos, 'Você ainda não iniciou nenhum treinamento.')}
        </TabsContent>

        {/* FAVORITES */}
        <TabsContent value="favoritos" className="space-y-5 mt-6">
          {renderTrainingGrid(favoritos, 'Nenhum favorito ainda. Explore os treinamentos e marque seus preferidos!')}
        </TabsContent>
      </Tabs>
    </div>
  );
}
