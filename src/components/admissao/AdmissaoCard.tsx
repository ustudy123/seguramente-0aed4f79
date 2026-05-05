import { motion } from 'framer-motion';
import { 
  User, 
  Briefcase, 
  Calendar, 
  MapPin, 
  FileText, 
  Eye, 
  MoreVertical,
  CheckCircle,
  Clock,
  XCircle,
  ClipboardCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Admissao, STATUS_LABELS, STATUS_COLORS } from '@/types/admissao';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DocumentChecklistModal } from './DocumentChecklistModal';
import { useState } from 'react';

interface AdmissaoCardProps {
  admissao: Admissao;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  
}

export function AdmissaoCard({ admissao, onView, onEdit, onDelete }: AdmissaoCardProps) {
  const [showChecklist, setShowChecklist] = useState(false);
  const { dadosPessoais, dadosProfissionais, documentos = [], status, historicoAprovacao = [], dataCriacao } = admissao;

  const documentosEnviados = documentos.filter(d => d.status !== 'pendente').length;
  const documentosTotal = documentos.length;
  const progressoDocumentos = documentosTotal > 0 ? (documentosEnviados / documentosTotal) * 100 : 0;

  const etapasAprovadas = historicoAprovacao.filter(e => e.status === 'aprovado').length;
  const etapasTotal = historicoAprovacao.length;
  const progressoAprovacao = etapasTotal > 0 ? (etapasAprovadas / etapasTotal) * 100 : 0;

  const nomeCompleto = dadosPessoais?.nomeCompleto || 'Sem nome';
  const initials = nomeCompleto
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '??';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border p-4 sm:p-5 hover:shadow-lg transition-all duration-300 group"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border-2 border-primary/20">
            <AvatarImage src={admissao.fotoUrl} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {nomeCompleto}
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Briefcase className="h-3.5 w-3.5" />
              <span>{dadosProfissionais?.cargo || 'Função não definida'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge className={STATUS_COLORS[status]}>
            {STATUS_LABELS[status]}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(admissao.id)}>
                <Eye className="h-4 w-4 mr-2" /> Visualizar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowChecklist(true)}>
                <ClipboardCheck className="h-4 w-4 mr-2" /> Checklist de Docs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(admissao.id)}>
                <FileText className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(admissao.id)}
                className="text-destructive focus:text-destructive"
              >
                <XCircle className="h-4 w-4 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{dadosProfissionais?.departamento || 'Sem departamento'}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>
            {dadosProfissionais?.dataAdmissao 
              ? format(new Date(dadosProfissionais.dataAdmissao), "dd/MM/yyyy")
              : 'Data não definida'}
          </span>
        </div>
      </div>

      <div className="space-y-3 pt-3 border-t border-border">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" /> Documentos
            </span>
            <span className="font-medium text-foreground">{documentosEnviados}/{documentosTotal}</span>
          </div>
          <Progress value={progressoDocumentos} className="h-1.5" />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Aprovação
            </span>
            <span className="font-medium text-foreground">{etapasAprovadas}/{etapasTotal}</span>
          </div>
          <Progress value={progressoAprovacao} className="h-1.5" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-border">
        <div className="flex -space-x-1">
          {historicoAprovacao.slice(0, 4).map((etapa, index) => (
            <div
              key={etapa.id}
              className={`h-6 w-6 rounded-full border-2 border-card flex items-center justify-center text-xs ${
                etapa.status === 'aprovado' 
                  ? 'bg-success text-success-foreground'
                  : etapa.status === 'rejeitado'
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {etapa.status === 'aprovado' ? (
                <CheckCircle className="h-3 w-3" />
              ) : etapa.status === 'rejeitado' ? (
                <XCircle className="h-3 w-3" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
            </div>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {dataCriacao ? `Criado em ${format(dataCriacao, "dd/MM/yyyy", { locale: ptBR })}` : ''}
        </span>
      </div>

      <DocumentChecklistModal 
        open={showChecklist} 
        onOpenChange={setShowChecklist} 
        admissao={admissao} 
      />
    </motion.div>
  );
}
