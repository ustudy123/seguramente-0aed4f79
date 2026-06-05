import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Crown, Loader2 } from "lucide-react";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  empresaNome: string;
  tenantId: string;
  tenantNome: string;
  onSuccess?: () => void;
}

export function DefinirPrincipalModal({
  open,
  onOpenChange,
  empresaId,
  empresaNome,
  tenantId,
  tenantNome,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const { setPrincipalEmpresa } = useSuperAdmin();

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await setPrincipalEmpresa({ empresaId, tenantId });
      toast.success(`${empresaNome} agora é a unidade principal.`);
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao definir unidade principal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            Definir como Unidade Principal
          </DialogTitle>
          <DialogDescription>
            Alterar a hierarquia do tenant <strong>{tenantNome}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm">
            Você está promovendo <strong>{empresaNome}</strong> a unidade <strong>Matriz (Principal)</strong> deste tenant.
          </p>

          <Alert variant="destructive" className="bg-amber-500/10 border-amber-500/20 text-amber-600">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-xs">
              <strong>Impactos desta ação:</strong>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>A unidade que era Matriz será rebaixada a Filial automaticamente.</li>
                <li>Esta será a unidade exibida primeiro em seletores e relatórios consolidados.</li>
                <li>Não há perda de dados, apenas alteração na hierarquia visual e lógica.</li>
              </ul>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading} className="bg-amber-500 hover:bg-amber-600">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar Promoção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
