import { useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus } from 'lucide-react';
import { AdmissaoStats } from '@/components/admissao/AdmissaoStats';
import { AdmissaoList } from '@/components/admissao/AdmissaoList';
import { AdmissaoForm } from '@/components/admissao/AdmissaoForm';
import { AdmissaoDetail } from '@/components/admissao/AdmissaoDetail';
import { useAdmissao } from '@/hooks/useAdmissao';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type ViewMode = 'list' | 'new' | 'edit' | 'detail';

export default function Admissao() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const {
    admissoes,
    criarAdmissao,
    atualizarAdmissao,
    atualizarDocumento,
    aprovarEtapa,
    excluirAdmissao,
    buscarAdmissao,
  } = useAdmissao();

  const selectedAdmissao = selectedId ? buscarAdmissao(selectedId) : null;

  const handleView = (id: string) => {
    setSelectedId(id);
    setViewMode('detail');
  };

  const handleEdit = (id: string) => {
    setSelectedId(id);
    setViewMode('edit');
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      excluirAdmissao(deleteId);
      toast.success('Admissão excluída com sucesso');
      setDeleteId(null);
      if (selectedId === deleteId) {
        setSelectedId(null);
        setViewMode('list');
      }
    }
  };

  const handleNew = () => {
    setSelectedId(null);
    setViewMode('new');
  };

  const handleBack = () => {
    setSelectedId(null);
    setViewMode('list');
  };

  const handleSubmitForm = (dados: Parameters<typeof criarAdmissao>[0]) => {
    if (viewMode === 'new') {
      const novaAdmissao = criarAdmissao(dados);
      toast.success('Admissão criada com sucesso!');
      setSelectedId(novaAdmissao.id);
      setViewMode('detail');
    } else if (viewMode === 'edit' && selectedId) {
      atualizarAdmissao(selectedId, dados);
      toast.success('Admissão atualizada com sucesso!');
      setViewMode('detail');
    }
  };

  const handleDocumentUpload = (documentoId: string, file: File) => {
    if (selectedId) {
      atualizarDocumento(selectedId, documentoId, {
        arquivo: file,
        status: 'enviado',
        dataEnvio: new Date(),
      });
      toast.success('Documento enviado com sucesso!');
    }
  };

  const handleDocumentRemove = (documentoId: string) => {
    if (selectedId) {
      atualizarDocumento(selectedId, documentoId, {
        arquivo: undefined,
        status: 'pendente',
        dataEnvio: undefined,
      });
      toast.info('Documento removido');
    }
  };

  const handleDocumentApprove = (documentoId: string) => {
    if (selectedId) {
      atualizarDocumento(selectedId, documentoId, { status: 'aprovado' });
      toast.success('Documento aprovado!');
    }
  };

  const handleDocumentReject = (documentoId: string, motivo: string) => {
    if (selectedId) {
      atualizarDocumento(selectedId, documentoId, { status: 'rejeitado', observacao: motivo });
      toast.error('Documento rejeitado');
    }
  };

  const handleAprovarEtapa = (etapaId: string, observacao?: string) => {
    if (selectedId) {
      aprovarEtapa(selectedId, etapaId, true, observacao);
      toast.success('Etapa aprovada com sucesso!');
    }
  };

  const handleRejeitarEtapa = (etapaId: string, observacao: string) => {
    if (selectedId) {
      aprovarEtapa(selectedId, etapaId, false, observacao);
      toast.error('Etapa rejeitada');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Page Header - only show on list view */}
      {viewMode === 'list' && (
        <>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Admissão</h1>
              <p className="text-muted-foreground">
                Gerencie o processo de admissão de novos colaboradores
              </p>
            </div>
          </div>

          {/* Stats */}
          <AdmissaoStats admissoes={admissoes} />

          {/* List */}
          <AdmissaoList
            admissoes={admissoes}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onNew={handleNew}
          />
        </>
      )}

      {/* New/Edit Form */}
      {(viewMode === 'new' || viewMode === 'edit') && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {viewMode === 'new' ? 'Nova Admissão' : 'Editar Admissão'}
              </h1>
              <p className="text-muted-foreground">
                {viewMode === 'new' 
                  ? 'Preencha os dados do novo colaborador' 
                  : 'Atualize os dados do colaborador'}
              </p>
            </div>
          </div>

          <AdmissaoForm
            onSubmit={handleSubmitForm}
            onCancel={handleBack}
            initialData={selectedAdmissao ? {
              dadosPessoais: selectedAdmissao.dadosPessoais,
              dadosContato: selectedAdmissao.dadosContato,
              dadosProfissionais: selectedAdmissao.dadosProfissionais,
              dadosBancarios: selectedAdmissao.dadosBancarios,
            } : undefined}
          />
        </div>
      )}

      {/* Detail View */}
      {viewMode === 'detail' && selectedAdmissao && (
        <AdmissaoDetail
          admissao={selectedAdmissao}
          onBack={handleBack}
          onEdit={() => setViewMode('edit')}
          onDelete={() => handleDelete(selectedAdmissao.id)}
          onDocumentUpload={handleDocumentUpload}
          onDocumentRemove={handleDocumentRemove}
          onDocumentApprove={handleDocumentApprove}
          onDocumentReject={handleDocumentReject}
          onAprovarEtapa={handleAprovarEtapa}
          onRejeitarEtapa={handleRejeitarEtapa}
          isAdmin={true}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta admissão? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
