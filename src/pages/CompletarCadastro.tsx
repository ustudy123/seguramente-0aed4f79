import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Camera, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { DocumentUpload } from "@/components/admissao/DocumentUpload";
import { DocumentoAdmissaoExtended } from "@/components/admissao/DocumentUpload";
import { DocumentoStatus, AdmissaoStatus } from "@/types/admissao";
import { useStorageImageUrl } from "@/hooks/useStorageImageUrl";
import { buildSafeStorageFileName } from "@/utils/storagePath";

export default function CompletarCadastro() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [colaborador, setColaborador] = useState<any>(null);
  const [documentos, setDocumentos] = useState<DocumentoAdmissaoExtended[]>([]);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resolvedPhotoUrl = useStorageImageUrl(colaborador?.foto_url, "documentos");

  useEffect(() => {
    if (token) {
      fetchColaborador();
    }
  }, [token]);

  const fetchColaborador = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_admissao_by_token", {
        _token: token as string,
      });

      if (error || !data) {
        toast.error("Link inválido ou expirado.");
        navigate("/login");
        return;
      }

      setColaborador(data);
      await ensureDocumentos();
      await fetchDocumentos();
    } catch (error) {
      console.error("Erro ao buscar colaborador:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentos = async () => {
    const { data, error } = await supabase.rpc("get_admissao_documentos_by_token", {
      _token: token as string,
    });

    if (error) {
      console.error("Erro ao buscar documentos:", error);
      return;
    }

    setDocumentos((data || []).map((doc: any) => ({
      ...doc,
      status: doc.status as DocumentoStatus,
    })));
  };

  const ensureDocumentos = async () => {
    const { error } = await supabase.rpc("ensure_admissao_documentos_by_token", {
      _token: token as string,
    });

    if (error) throw error;
  };

  const handleUploadPhoto = async (file: File) => {
    if (!colaborador) return;
    setIsUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${colaborador.tenant_id}/${colaborador.id}-${Math.random()}.${fileExt}`;
      const filePath = `colaboradores/fotos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase.rpc("update_admissao_foto_by_token", {
        _token: token as string,
        _foto_url: filePath,
      });

      if (updateError) throw updateError;

      setColaborador({ ...colaborador, foto_url: filePath });
      toast.success("Foto atualizada com sucesso!");
    } catch (error) {
      console.error("Erro no upload da foto:", error);
      toast.error("Erro ao carregar foto");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleUploadDocument = async (documentoId: string, file: File) => {
    try {
      const safeFileName = buildSafeStorageFileName(documentoId, file.name);
      const filePath = `${colaborador.tenant_id}/admissoes/${colaborador.id}/${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase.rpc("update_admissao_documento_by_token", {
        _token: token as string,
        _documento_id: documentoId,
        _arquivo_url: filePath,
        _arquivo_nome: file.name,
        _arquivo_tamanho: file.size,
        _status: 'enviado',
        _data_envio: new Date().toISOString(),
      });

      if (updateError) throw updateError;

      await fetchDocumentos();

      // Validação pós-upload: confirma que o documento saiu de "pendente"
      const { data: verifyList, error: verifyErr } = await supabase.rpc(
        "get_admissao_documentos_by_token",
        { _token: token as string }
      );
      if (verifyErr) throw verifyErr;
      const persisted = (verifyList as any[] | null)?.find((d) => d.id === documentoId);
      if (!persisted || persisted.status !== 'enviado' || !persisted.arquivo_url) {
        console.error('[CompletarCadastro] Documento ainda pendente após upload:', persisted);
        toast.error("Documento enviado, mas não foi confirmado no banco. Tente novamente.");
        return;
      }

      toast.success("Documento enviado e confirmado!");
    } catch (error) {
      console.error("Erro no upload do documento:", error);
      toast.error("Erro ao enviar documento");
    }
  };

  const handleRemoveDocument = async (documentoId: string) => {
    try {
      const doc = documentos.find(d => d.id === documentoId);
      if (doc?.arquivo_url) {
        await supabase.storage.from("documentos").remove([doc.arquivo_url]);
      }

      const { error } = await supabase.rpc("update_admissao_documento_by_token", {
        _token: token as string,
        _documento_id: documentoId,
        _arquivo_url: null as any,
        _arquivo_nome: null as any,
        _arquivo_tamanho: null as any,
        _status: 'pendente',
        _data_envio: null as any,
      });

      if (error) throw error;

      await fetchDocumentos();
      toast.success("Documento removido");
    } catch (error) {
      console.error("Erro ao remover documento:", error);
      toast.error("Erro ao remover documento");
    }
  };

  const handleSubmit = async () => {
    // Refetch antes da validação para garantir estado mais recente do banco
    await fetchDocumentos();
    const { data: freshList, error: freshErr } = await supabase.rpc(
      "get_admissao_documentos_by_token",
      { _token: token as string }
    );
    if (freshErr) {
      toast.error("Não foi possível validar os documentos. Tente novamente.");
      return;
    }
    const list = (freshList as any[] | null) ?? [];
    const missingRequired = list.filter((d) => d.obrigatorio && (d.status === 'pendente' || !d.arquivo_url));
    if (missingRequired.length > 0) {
      toast.error(`Envie todos os documentos obrigatórios: ${missingRequired.map((d) => d.nome).join(", ")}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc("finalizar_admissao_by_token", {
        _token: token as string,
      });

      if (error) throw error;

      setSuccess(true);
      toast.success("Cadastro finalizado com sucesso!");
    } catch (error) {
      console.error("Erro ao finalizar cadastro:", error);
      toast.error("Erro ao finalizar cadastro");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="bg-success/10 p-3 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-success" />
              </div>
            </div>
            <CardTitle>Cadastro Enviado!</CardTitle>
            <CardDescription>
              Seus dados foram enviados para homologação pelo RH. Você receberá uma confirmação em breve.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button variant="outline" onClick={() => window.close()}>Fechar</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Finalizar Cadastro</h1>
          <p className="text-muted-foreground">Olá, {colaborador.nome_completo}. Complete seus dados para finalizar seu ingresso na empresa.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sua Foto</CardTitle>
            <CardDescription>Esta foto será usada no seu perfil e crachá.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <Avatar className="h-32 w-32 border-4 border-primary/10">
              <AvatarImage src={resolvedPhotoUrl || ""} />
              <AvatarFallback className="bg-primary/5 text-primary text-4xl">
                <User className="h-16 w-16" />
              </AvatarFallback>
            </Avatar>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
              >
                {isUploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Camera className="h-4 w-4 mr-2" />}
                {colaborador.foto_url ? "Alterar Foto" : "Adicionar Foto"}
              </Button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadPhoto(file);
                }} 
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documentos Necessários</CardTitle>
            <CardDescription>Envie fotos ou PDFs dos seus documentos originais.</CardDescription>
          </CardHeader>
          <CardContent>
            {documentos.length > 0 ? (
              <DocumentUpload 
                documentos={documentos}
                onUpload={handleUploadDocument}
                onRemove={handleRemoveDocument}
                isAdmin={false}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nenhum documento solicitado no momento.</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end border-t pt-6">
            <Button 
              size="lg" 
              className="px-8" 
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Finalizar e Enviar para RH
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
