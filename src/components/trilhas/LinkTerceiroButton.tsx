import { useState } from "react";
import { ExternalLink, Copy, Check, Loader2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LinkTerceiroButtonProps {
  trilhaId: string;
}

export function LinkTerceiroButton({ trilhaId }: LinkTerceiroButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateLink = async () => {
    setLoading(true);
    try {
      // Check if trilha already has a token
      const { data: trilha } = await supabase
        .from("trilhas" as never)
        .select("token_publico, publico_terceiros")
        .eq("id", trilhaId)
        .single() as { data: { token_publico: string | null; publico_terceiros: boolean } | null; error: any };

      let token = trilha?.token_publico;

      if (!token) {
        // Generate new token
        token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        const { error } = await supabase
          .from("trilhas" as never)
          .update({ token_publico: token, publico_terceiros: true } as never)
          .eq("id", trilhaId);
        if (error) throw error;
      } else if (!trilha?.publico_terceiros) {
        await supabase
          .from("trilhas" as never)
          .update({ publico_terceiros: true } as never)
          .eq("id", trilhaId);
      }

      const url = `${window.location.origin}/trilha-terceiro/${token}`;
      setLink(url);
      setOpen(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar link.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={generateLink} disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
        Link Terceiros
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Link Público para Terceiros</DialogTitle>
            <DialogDescription>
              Compartilhe este link com trabalhadores terceirizados. Eles poderão acessar e completar a trilha identificando-se por nome e CPF.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex gap-2">
              <Input value={link || ""} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p>• O terceiro não precisa de conta no sistema</p>
              <p>• Identificação feita por nome e CPF</p>
              <p>• O progresso fica registrado e visível na gestão</p>
              <p>• O link permanece ativo enquanto a trilha estiver ativa</p>
            </div>

            {link && (
              <Button variant="outline" className="w-full" asChild>
                <a href={link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir link em nova aba
                </a>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
