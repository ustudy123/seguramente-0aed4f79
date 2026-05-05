import { motion } from 'framer-motion';
import { 
  User, 
  MapPin, 
  Briefcase, 
  CreditCard, 
  Mail, 
  Phone, 
  Calendar,
  Building,
  DollarSign,
  ArrowLeft,
  Edit,
  Trash2,
  ClipboardCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DocumentUpload } from './DocumentUpload';
import { WorkflowTimeline } from './WorkflowTimeline';
import { DocumentChecklistModal } from './DocumentChecklistModal';
import { useState } from 'react';
import { Admissao, STATUS_LABELS, STATUS_COLORS } from '@/types/admissao';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useStorageImageUrl } from '@/hooks/useStorageImageUrl';

interface AdmissaoDetailProps {
  admissao: Admissao;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDocumentUpload: (documentoId: string, file: File) => void;
  onDocumentRemove: (documentoId: string) => void;
  onDocumentApprove?: (documentoId: string) => void;
  onDocumentReject?: (documentoId: string, motivo: string) => void;
  onAprovarEtapa?: (etapaId: string, observacao?: string) => void;
  onRejeitarEtapa?: (etapaId: string, observacao: string) => void;
  isAdmin?: boolean;
}

function InfoCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value || '-'}</p>
      </div>
    </div>
  );
}

export function AdmissaoDetail({ 
  admissao, 
  onBack, 
  onEdit, 
  onDelete,
  onDocumentUpload,
  onDocumentRemove,
  onDocumentApprove,
  onDocumentReject,
  onAprovarEtapa,
  onRejeitarEtapa,
  isAdmin = false
}: AdmissaoDetailProps) {
  const [showChecklist, setShowChecklist] = useState(false);
  const resolvedPhotoUrl = useStorageImageUrl(admissao.fotoUrl, 'documentos');
  const { dadosPessoais, dadosContato, dadosProfissionais, dadosBancarios, documentos, status, historicoAprovacao, dataCriacao } = admissao;

  const initials = dadosPessoais.nomeCompleto
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-16 w-16 border-2 border-primary/20">
            <AvatarImage src={resolvedPhotoUrl || ''} />
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">
                {dadosPessoais.nomeCompleto}
              </h1>
              <Badge className={STATUS_COLORS[status]}>
                {STATUS_LABELS[status]}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {dadosProfissionais.cargo} • {dadosProfissionais.departamento}
            </p>
            <p className="text-sm text-muted-foreground">
              Criado em {format(dataCriacao, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowChecklist(true)} className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Checklist
          </Button>
          <Button variant="outline" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </Button>
        </div>
      </div>

      {/* Content */}
      <Tabs defaultValue="dados" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="workflow">Aprovação</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="space-y-6 mt-6">
          {/* Dados Pessoais */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Dados Pessoais
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoCard icon={User} label="Nome Completo" value={dadosPessoais.nomeCompleto} />
              <InfoCard icon={User} label="CPF" value={dadosPessoais.cpf} />
              <InfoCard icon={User} label="RG" value={dadosPessoais.rg} />
              <InfoCard icon={Calendar} label="Data de Nascimento" value={format(parseISO(dadosPessoais.dataNascimento), 'dd/MM/yyyy')} />
              <InfoCard icon={User} label="Gênero" value={dadosPessoais.genero} />
              <InfoCard icon={User} label="Estado Civil" value={dadosPessoais.estadoCivil} />
              <InfoCard icon={User} label="Nacionalidade" value={dadosPessoais.nacionalidade} />
              <InfoCard icon={User} label="Naturalidade" value={dadosPessoais.naturalidade} />
              <InfoCard icon={User} label="Nome da Mãe" value={dadosPessoais.nomeMae} />
              {dadosPessoais.nomePai && (
                <InfoCard icon={User} label="Nome do Pai" value={dadosPessoais.nomePai} />
              )}
            </div>
          </div>

          {/* Dados de Contato */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Dados de Contato
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoCard icon={Mail} label="E-mail" value={dadosContato.email} />
              <InfoCard icon={Phone} label="Celular" value={dadosContato.celular} />
              {dadosContato.telefone && (
                <InfoCard icon={Phone} label="Telefone" value={dadosContato.telefone} />
              )}
              <InfoCard icon={MapPin} label="CEP" value={dadosContato.cep} />
              <InfoCard icon={MapPin} label="Endereço" value={`${dadosContato.endereco}, ${dadosContato.numero}${dadosContato.complemento ? ` - ${dadosContato.complemento}` : ''}`} />
              <InfoCard icon={MapPin} label="Bairro" value={dadosContato.bairro} />
              <InfoCard icon={MapPin} label="Cidade/Estado" value={`${dadosContato.cidade} - ${dadosContato.estado}`} />
            </div>
          </div>

          {/* Dados Profissionais */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Dados Profissionais
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoCard icon={Briefcase} label="Função" value={dadosProfissionais.cargo} />
              <InfoCard icon={Building} label="Departamento" value={dadosProfissionais.departamento} />
              <InfoCard icon={Building} label="Filial" value={dadosProfissionais.filial} />
              <InfoCard icon={Calendar} label="Data de Admissão" value={format(new Date(dadosProfissionais.dataAdmissao), 'dd/MM/yyyy')} />
              <InfoCard icon={Briefcase} label="Tipo de Contrato" value={dadosProfissionais.tipoContrato} />
              <InfoCard icon={Briefcase} label="Jornada" value={dadosProfissionais.jornadaTrabalho} />
              <InfoCard icon={DollarSign} label="Salário" value={dadosProfissionais.salario} />
              <InfoCard icon={User} label="Gestor Imediato" value={dadosProfissionais.gestorImediato} />
              <InfoCard icon={Building} label="Centro de Custo" value={dadosProfissionais.centroCusto} />
            </div>
          </div>

          {/* Dados Bancários */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Dados Bancários
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoCard icon={CreditCard} label="Banco" value={dadosBancarios.banco} />
              <InfoCard icon={CreditCard} label="Tipo de Conta" value={dadosBancarios.tipoConta} />
              <InfoCard icon={CreditCard} label="Agência" value={dadosBancarios.agencia} />
              <InfoCard icon={CreditCard} label="Conta" value={dadosBancarios.conta} />
              {dadosBancarios.chavePix && (
                <InfoCard icon={CreditCard} label="Chave PIX" value={dadosBancarios.chavePix} />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documentos" className="mt-6">
          <div className="bg-card rounded-xl border border-border p-5">
            <DocumentUpload
              documentos={documentos}
              onUpload={onDocumentUpload}
              onRemove={onDocumentRemove}
              onApprove={onDocumentApprove}
              onReject={onDocumentReject}
              isAdmin={isAdmin}
            />
          </div>
        </TabsContent>

        <TabsContent value="workflow" className="mt-6">
          <div className="bg-card rounded-xl border border-border p-5">
            <WorkflowTimeline
              historico={historicoAprovacao}
              onAprovar={onAprovarEtapa}
              onRejeitar={onRejeitarEtapa}
              isAdmin={isAdmin}
            />
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold text-foreground mb-4">Histórico de Alterações</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <div>
                  <p className="text-sm font-medium text-foreground">Admissão criada</p>
                  <p className="text-xs text-muted-foreground">
                    {format(dataCriacao, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} • {admissao.criadoPor}
                  </p>
                </div>
              </div>
              {historicoAprovacao
                .filter(e => e.dataAcao)
                .map(etapa => (
                  <div key={etapa.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      etapa.status === 'aprovado' ? 'bg-success' : 
                      etapa.status === 'rejeitado' ? 'bg-destructive' : 'bg-muted-foreground'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {etapa.etapa}: {etapa.status === 'aprovado' ? 'Aprovado' : 'Rejeitado'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {etapa.dataAcao && format(etapa.dataAcao, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} • {etapa.responsavel}
                      </p>
                      {etapa.observacao && (
                        <p className="text-xs text-muted-foreground mt-1 italic">"{etapa.observacao}"</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <DocumentChecklistModal 
        open={showChecklist} 
        onOpenChange={setShowChecklist} 
        admissao={admissao} 
      />
    </motion.div>
  );
}
