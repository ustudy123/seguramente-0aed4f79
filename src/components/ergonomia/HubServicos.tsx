import { useState } from "react";
import { motion } from "framer-motion";
import { 
  BookOpen, 
  Users, 
  Video, 
  FileText, 
  Presentation, 
  ExternalLink,
  Star,
  Clock,
  CheckCircle2,
  Search
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Tipos para o Hub de Serviços
interface ConteudoEducativo {
  id: string;
  titulo: string;
  tipo: 'texto' | 'video' | 'guia' | 'apresentacao' | 'trilha';
  categoria: string;
  duracao?: string;
  descricao: string;
  url?: string;
  tags: string[];
}

interface ProfissionalServico {
  id: string;
  nome: string;
  especialidade: string;
  tipo: 'ergonomista' | 'engenheiro_sst' | 'psicologo' | 'medico_trabalho' | 'consultor';
  avaliacao: number;
  atendimentos: number;
  disponivel: boolean;
  descricao: string;
}

// Dados de exemplo para demonstração
const CONTEUDOS_EXEMPLO: ConteudoEducativo[] = [
  {
    id: '1',
    titulo: 'Introdução à NR-17: Ergonomia no Trabalho',
    tipo: 'video',
    categoria: 'NR-17',
    duracao: '15 min',
    descricao: 'Entenda os conceitos fundamentais da norma regulamentadora de ergonomia.',
    tags: ['ergonomia', 'nr-17', 'introdução'],
  },
  {
    id: '2',
    titulo: 'Guia Prático: Postura no Trabalho Remoto',
    tipo: 'guia',
    categoria: 'Mobiliário',
    descricao: 'Dicas práticas para configurar seu espaço de trabalho em casa.',
    tags: ['home office', 'postura', 'mobiliário'],
  },
  {
    id: '3',
    titulo: 'Prevenção de LER/DORT',
    tipo: 'trilha',
    categoria: 'Saúde',
    duracao: '2h',
    descricao: 'Trilha completa sobre prevenção de lesões por esforço repetitivo.',
    tags: ['ler', 'dort', 'prevenção'],
  },
  {
    id: '4',
    titulo: 'Análise Ergonômica: Como Fazer',
    tipo: 'apresentacao',
    categoria: 'AET',
    duracao: '45 min',
    descricao: 'Passo a passo para realizar uma análise ergonômica do trabalho.',
    tags: ['aet', 'análise', 'metodologia'],
  },
  {
    id: '5',
    titulo: 'Riscos Psicossociais no Ambiente de Trabalho',
    tipo: 'texto',
    categoria: 'Saúde Mental',
    descricao: 'Artigo sobre identificação e mitigação de riscos psicossociais.',
    tags: ['psicossocial', 'saúde mental', 'burnout'],
  },
];

const PROFISSIONAIS_EXEMPLO: ProfissionalServico[] = [
  {
    id: '1',
    nome: 'Dr. Carlos Ergonomista',
    especialidade: 'Ergonomia Física e Cognitiva',
    tipo: 'ergonomista',
    avaliacao: 4.9,
    atendimentos: 150,
    disponivel: true,
    descricao: 'Especialista em AET com 15 anos de experiência.',
  },
  {
    id: '2',
    nome: 'Eng. Maria SST',
    especialidade: 'Segurança do Trabalho',
    tipo: 'engenheiro_sst',
    avaliacao: 4.8,
    atendimentos: 200,
    disponivel: true,
    descricao: 'Engenheira de segurança com foco em indústrias.',
  },
  {
    id: '3',
    nome: 'Dra. Ana Psicologia',
    especialidade: 'Psicologia Organizacional',
    tipo: 'psicologo',
    avaliacao: 5.0,
    atendimentos: 80,
    disponivel: false,
    descricao: 'Especialista em saúde mental e clima organizacional.',
  },
  {
    id: '4',
    nome: 'Dr. Pedro Ocupacional',
    especialidade: 'Medicina do Trabalho',
    tipo: 'medico_trabalho',
    avaliacao: 4.7,
    atendimentos: 300,
    disponivel: true,
    descricao: 'Médico do trabalho com expertise em ergonomia.',
  },
];

const TIPO_ICONS = {
  texto: FileText,
  video: Video,
  guia: BookOpen,
  apresentacao: Presentation,
  trilha: BookOpen,
};

const TIPO_COLORS = {
  ergonomista: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  engenheiro_sst: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  psicologo: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  medico_trabalho: 'bg-green-500/10 text-green-600 border-green-500/30',
  consultor: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
};

const TIPO_LABELS = {
  ergonomista: 'Ergonomista',
  engenheiro_sst: 'Eng. SST',
  psicologo: 'Psicólogo',
  medico_trabalho: 'Médico',
  consultor: 'Consultor',
};

export function HubServicos() {
  const [searchConteudo, setSearchConteudo] = useState("");
  const [searchProfissional, setSearchProfissional] = useState("");

  const conteudosFiltrados = CONTEUDOS_EXEMPLO.filter(c =>
    c.titulo.toLowerCase().includes(searchConteudo.toLowerCase()) ||
    c.categoria.toLowerCase().includes(searchConteudo.toLowerCase()) ||
    c.tags.some(t => t.toLowerCase().includes(searchConteudo.toLowerCase()))
  );

  const profissionaisFiltrados = PROFISSIONAIS_EXEMPLO.filter(p =>
    p.nome.toLowerCase().includes(searchProfissional.toLowerCase()) ||
    p.especialidade.toLowerCase().includes(searchProfissional.toLowerCase())
  );

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Hub de Serviços
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="conhecimento" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="conhecimento" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Conhecimento
            </TabsTrigger>
            <TabsTrigger value="profissionais" className="gap-2">
              <Users className="h-4 w-4" />
              Profissionais
            </TabsTrigger>
          </TabsList>

          {/* Hub de Conhecimento */}
          <TabsContent value="conhecimento" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conteúdos..."
                value={searchConteudo}
                onChange={(e) => setSearchConteudo(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {conteudosFiltrados.map((conteudo, index) => {
                const Icon = TIPO_ICONS[conteudo.tipo];
                return (
                  <motion.div
                    key={conteudo.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="border-border/50 hover:shadow-md transition-all cursor-pointer group">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                              {conteudo.titulo}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {conteudo.descricao}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {conteudo.categoria}
                              </Badge>
                              {conteudo.duracao && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {conteudo.duracao}
                                </span>
                              )}
                            </div>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {conteudosFiltrados.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum conteúdo encontrado</p>
              </div>
            )}
          </TabsContent>

          {/* Hub de Profissionais */}
          <TabsContent value="profissionais" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar profissionais..."
                value={searchProfissional}
                onChange={(e) => setSearchProfissional(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-3">
              {profissionaisFiltrados.map((profissional, index) => (
                <motion.div
                  key={profissional.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className={cn(
                    "border-border/50 hover:shadow-md transition-all",
                    !profissional.disponivel && "opacity-60"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <Users className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-foreground">
                              {profissional.nome}
                            </h4>
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", TIPO_COLORS[profissional.tipo])}
                            >
                              {TIPO_LABELS[profissional.tipo]}
                            </Badge>
                            {profissional.disponivel ? (
                              <Badge className="bg-success/10 text-success border-success/30 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Disponível
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Indisponível
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {profissional.especialidade}
                          </p>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="flex items-center gap-1 text-xs">
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                              {profissional.avaliacao}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {profissional.atendimentos} atendimentos
                            </span>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          disabled={!profissional.disponivel}
                          variant={profissional.disponivel ? "default" : "secondary"}
                        >
                          Solicitar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {profissionaisFiltrados.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum profissional encontrado</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
