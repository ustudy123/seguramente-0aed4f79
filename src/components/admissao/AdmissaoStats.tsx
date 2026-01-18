import { motion } from 'framer-motion';
import { UserPlus, Clock, CheckCircle, XCircle, FileText, AlertTriangle } from 'lucide-react';
import { Admissao } from '@/types/admissao';

interface AdmissaoStatsProps {
  admissoes: Admissao[];
}

export function AdmissaoStats({ admissoes }: AdmissaoStatsProps) {
  const stats = {
    total: admissoes.length,
    aguardandoDocumentos: admissoes.filter(a => a.status === 'aguardando_documentos').length,
    emAnalise: admissoes.filter(a => a.status === 'em_analise').length,
    aprovados: admissoes.filter(a => a.status === 'aprovado' || a.status === 'concluido').length,
    reprovados: admissoes.filter(a => a.status === 'reprovado').length,
    rascunhos: admissoes.filter(a => a.status === 'rascunho').length,
  };

  const statsConfig = [
    { label: 'Total de Admissões', value: stats.total, icon: UserPlus, color: 'text-primary', bgColor: 'bg-primary/10' },
    { label: 'Aguardando Docs', value: stats.aguardandoDocumentos, icon: FileText, color: 'text-warning', bgColor: 'bg-warning/10' },
    { label: 'Em Análise', value: stats.emAnalise, icon: Clock, color: 'text-info', bgColor: 'bg-info/10' },
    { label: 'Aprovados', value: stats.aprovados, icon: CheckCircle, color: 'text-success', bgColor: 'bg-success/10' },
    { label: 'Reprovados', value: stats.reprovados, icon: XCircle, color: 'text-destructive', bgColor: 'bg-destructive/10' },
    { label: 'Rascunhos', value: stats.rascunhos, icon: AlertTriangle, color: 'text-muted-foreground', bgColor: 'bg-muted' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {statsConfig.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="bg-card rounded-xl p-4 border border-border shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
