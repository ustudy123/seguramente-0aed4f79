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
import { DocumentoStatus } from "@/types/admissao";

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

  useEffect(() => {
    if (token) {
      fetchColaborador();
    }
  }, [token]);

  const fetchColaborador = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("admissoes")
        .select("*")
        .eq("onboarding_token", token)
        .single();

      if (error || !data) {
        toast.error("Link inválido ou expirado.");
        navigate("/login");
        return;
      }

      setColaborador(data);
      fetchDocumentos(data.id);
    } catch (error) {
      console.error("Erro ao buscar colaborador:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentos = async (admissaoId: string) => {
    const { data, error } = await supabase
      .from("admissao_documentos")
      .select("*")
      .eq("admissao_id", admissaoId);

    if (error) {
      console.error("Erro ao buscar documentos:", error);
      return;
    }

    setDocumentos(data.map(doc => ({
      ...doc,
      status: doc.status as DocumentoStatus
    })));
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

      const { data: { publicUrl } } = supabase.storage
        .from("documentos")
        .getPublicUrl(filePath);

      // Force cache bust for the display
      const publicUrlWithBust = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("admissoes")
        .update({ foto_url: publicUrlWithBust })
        .eq("id", colaborador.id);

      if (updateError) throw updateError;

      setColaborador({ ...colaborador, foto_url: publicUrlWithBust });
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
      const fileExt = file.name.split('.').pop();
      const fileName = `${colaborador.tenant_id}/admissoes/${colaborador.id}/docs/${documentoId}-${Math.random()}.${fileExt}`;
      const filePath = `admissao/documentos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("admissao_documentos")
        .update({
          arquivo_url: filePath, // Store path for private access
          arquivo_nome: file.name,
          arquivo_tamanho: file.size,
          status: 'enviado',
          data_envio: new Date().toISOString()
        })
        .eq("id", documentoId);

      if (updateError) throw updateError;

      setDocumentos(prev => prev.map(doc => 
        doc.id === documentoId 
          ? { ...doc, status: 'enviado', arquivo_nome: file.name } 
          : doc
      ));
      toast.success("Documento enviado com sucesso!");
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

      const { error } = await supabase
        .from("admissao_documentos")
        .update({
          arquivo_url: null,
          arquivo_nome: null,
          arquivo_tamanho: null,
          status: 'pendente',
          data_envio: null
        })
        .eq("id", documentoId);

      if (error) throw error;

      setDocumentos(prev => prev.map(doc => 
        doc.id === documentoId 
          ? { ...doc, status: 'pendente', arquivo_nome: undefined, arquivo_url: undefined } 
          : doc
      ));
      toast.success("Documento removido");
    } catch (error) {
      console.error("Erro ao remover documento:", error);
      toast.error("Erro ao remover documento");
    }
  };

  const handleSubmit = async () => {
    const missingRequired = documentos.filter(d => d.obrigatorio && d.status === 'pendente');
    if (missingRequired.length > 0) {
      toast.error(`Por favor, envie todos os documentos obrigatórios: ${missingRequired.map(d => d.nome).join(", ")}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("admissoes")
        .update({ 
          onboarding_status: 'em_analise',
          status: 'em_analise'
        })
        .eq("id", colaborador.id);

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
              <AvatarImage src={colaborador.foto_url} />
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
