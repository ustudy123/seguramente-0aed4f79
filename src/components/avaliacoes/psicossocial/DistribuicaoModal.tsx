import { useState, useEffect } from "react";
import { 
  Link as LinkIcon, 
  QrCode, 
  Copy, 
  Download, 
  Users, 
  CheckCircle2,
  ExternalLink,
  Plus,
  Trash2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { usePsicossocial } from "@/hooks/usePsicossocial";
import { useColaboradores } from "@/hooks/useColaboradores";
import { toast } from "sonner";
import QRCode from "qrcode";
import type { CampanhaPsicossocial, ConvitePsicossocial } from "@/types/psicossocial";

interface DistribuicaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campanha: CampanhaPsicossocial;
}

export function DistribuicaoModal({ open, onOpenChange, campanha }: DistribuicaoModalProps) {
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [selectedColaboradores, setSelectedColaboradores] = useState<string[]>([]);
  
  const { useConvitesCampanha, gerarConvites } = usePsicossocial();
  const { data: convites = [], refetch: refetchConvites } = useConvitesCampanha(campanha.id);
  const { colaboradores } = useColaboradores();

  const baseUrl = window.location.origin;

  // Gerar QR codes para convites existentes
  useEffect(() => {
    const generateQRCodes = async () => {
      const codes: Record<string, string> = {};
      for (const convite of convites) {
        const url = `${baseUrl}/questionario/${convite.token}`;
        try {
          codes[convite.id] = await QRCode.toDataURL(url, { width: 200 });
        } catch (err) {
          console.error("Erro ao gerar QR Code:", err);
        }
      }
      setQrCodes(codes);
    };
    
    if (convites.length > 0) {
      generateQRCodes();
    }
  }, [convites, baseUrl]);

  const handleGerarConvites = async () => {
    if (selectedColaboradores.length === 0) {
      toast.error("Selecione pelo menos um colaborador");
      return;
    }

    const colabsParaConvidar = colaboradores
      .filter(c => selectedColaboradores.includes(c.id))
      .map(c => ({
        id: c.id,
        nome: c.nome_completo,
        cpf: c.cpf,
        cargo: c.cargo,
        departamento: c.departamento || undefined,
      }));

    await gerarConvites.mutateAsync({
      campanha_id: campanha.id,
      colaboradores: colabsParaConvidar,
      enviado_via: 'link',
    });

    setSelectedColaboradores([]);
    refetchConvites();
  };

  const copyLink = (token: string) => {
    const url = `${baseUrl}/questionario/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const copyAllLinks = () => {
    const links = convites
      .map(c => `${c.colaborador_nome}: ${baseUrl}/questionario/${c.token}`)
      .join("\n");
    navigator.clipboard.writeText(links);
    toast.success("Todos os links copiados!");
  };

  const downloadQR = (convite: ConvitePsicossocial) => {
    const qr = qrCodes[convite.id];
    if (!qr) return;
    
    const link = document.createElement("a");
    link.download = `qr-${convite.colaborador_nome.replace(/\s+/g, "-")}.png`;
    link.href = qr;
    link.click();
  };

  const downloadAllQRs = async () => {
    for (const convite of convites) {
      const qr = qrCodes[convite.id];
      if (qr) {
        const link = document.createElement("a");
        link.download = `qr-${convite.colaborador_nome.replace(/\s+/g, "-")}.png`;
        link.href = qr;
        link.click();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    toast.success("QR Codes baixados!");
  };

  const getStatusBadge = (status: ConvitePsicossocial['status']) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="secondary">Pendente</Badge>;
      case 'iniciado':
        return <Badge className="bg-amber-500">Em andamento</Badge>;
      case 'concluido':
        return <Badge className="bg-emerald-500">Concluído</Badge>;
      case 'expirado':
        return <Badge variant="destructive">Expirado</Badge>;
    }
  };

  // Colaboradores que ainda não têm convite
  const colaboradoresSemConvite = colaboradores.filter(
    c => !convites.some(conv => conv.colaborador_cpf === c.cpf)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-blue-600" />
            Distribuir Questionário
          </DialogTitle>
          <DialogDescription>
            Gere links e QR codes para enviar aos colaboradores - Campanha: {campanha.nome}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="convites" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="convites">
              Convites Enviados ({convites.length})
            </TabsTrigger>
            <TabsTrigger value="adicionar">
              Adicionar Colaboradores
            </TabsTrigger>
          </TabsList>

          <TabsContent value="convites" className="space-y-4">
            {convites.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum convite gerado ainda</p>
                <p className="text-sm">Adicione colaboradores na aba ao lado</p>
              </div>
            ) : (
              <>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={copyAllLinks}>
                    <Copy className="h-4 w-4 mr-1" />
                    Copiar Todos
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadAllQRs}>
                    <Download className="h-4 w-4 mr-1" />
                    Baixar QR Codes
                  </Button>
                </div>
                
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {convites.map((convite) => (
                      <div 
                        key={convite.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {qrCodes[convite.id] && (
                            <img 
                              src={qrCodes[convite.id]} 
                              alt="QR Code" 
                              className="h-12 w-12 rounded"
                            />
                          )}
                          <div>
                            <p className="font-medium">{convite.colaborador_nome}</p>
                            <p className="text-sm text-muted-foreground">
                              {convite.colaborador_cargo} • {convite.colaborador_departamento}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {getStatusBadge(convite.status)}
                          
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => copyLink(convite.token)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => downloadQR(convite)}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                          
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => window.open(`${baseUrl}/questionario/${convite.token}`, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </TabsContent>

          <TabsContent value="adicionar" className="space-y-4">
            {colaboradoresSemConvite.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-emerald-500" />
                <p>Todos os colaboradores já foram convidados!</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {selectedColaboradores.length} selecionado(s) de {colaboradoresSemConvite.length}
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedColaboradores(colaboradoresSemConvite.map(c => c.id))}
                    >
                      Selecionar Todos
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedColaboradores([])}
                    >
                      Limpar
                    </Button>
                  </div>
                </div>
                
                <ScrollArea className="h-[350px]">
                  <div className="space-y-2">
                    {colaboradoresSemConvite.map((colab) => (
                      <div 
                        key={colab.id}
                        className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedColaboradores.includes(colab.id) 
                            ? 'border-primary bg-primary/5' 
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => {
                          if (selectedColaboradores.includes(colab.id)) {
                            setSelectedColaboradores(prev => prev.filter(id => id !== colab.id));
                          } else {
                            setSelectedColaboradores(prev => [...prev, colab.id]);
                          }
                        }}
                      >
                        <div>
                          <p className="font-medium">{colab.nome_completo}</p>
                          <p className="text-sm text-muted-foreground">
                            {colab.cargo} • {colab.departamento}
                          </p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={selectedColaboradores.includes(colab.id)}
                          onChange={() => {}}
                          className="h-4 w-4"
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <Button 
                  className="w-full"
                  onClick={handleGerarConvites}
                  disabled={selectedColaboradores.length === 0 || gerarConvites.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {gerarConvites.isPending 
                    ? "Gerando..." 
                    : `Gerar ${selectedColaboradores.length} Convite(s)`
                  }
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
