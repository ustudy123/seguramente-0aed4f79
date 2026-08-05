import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface IncluirBancoHorasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado com a escolha do usuário: true = com banco de horas, false = somente horas extras. */
  onConfirm: (incluirBanco: boolean) => void;
  titulo?: string;
}

/**
 * Pergunta, antes de gerar/exportar, se o arquivo deve trazer o bloco de
 * banco de horas. Contabilidades que não operam banco de horas precisam do
 * relatório apenas com apuração de horas extras.
 */
export function IncluirBancoHorasDialog({
  open,
  onOpenChange,
  onConfirm,
  titulo = "Incluir banco de horas?",
}: IncluirBancoHorasDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>
            Escolha o formato do arquivo. Se a folha não utiliza banco de horas,
            gere apenas com a apuração de horas extras — os saldos de banco
            ficam de fora para facilitar o entendimento.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(false)}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            Sem banco de horas (só horas extras)
          </AlertDialogAction>
          <AlertDialogAction onClick={() => onConfirm(true)}>
            Com banco de horas
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
