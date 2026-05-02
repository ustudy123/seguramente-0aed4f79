import { useState, useCallback } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
}

let globalResolve: ((value: boolean) => void) | null = null;
let globalSetState: ((state: ConfirmOptions & { open: boolean }) => void) | null = null;

export function confirm(options: ConfirmOptions | string = {}): Promise<boolean> {
  const opts = typeof options === "string" ? { description: options } : options;
  return new Promise((resolve) => {
    globalResolve = resolve;
    globalSetState?.({
      open: true,
      title: opts.title || "Confirmar ação",
      description: opts.description || "Tem certeza que deseja continuar?",
      confirmLabel: opts.confirmLabel || "Confirmar",
      cancelLabel: opts.cancelLabel || "Cancelar",
      variant: opts.variant || "destructive",
    });
  });
}

export function ConfirmDialogProvider() {
  const [state, setState] = useState<ConfirmOptions & { open: boolean }>({
    open: false,
    title: "Confirmar ação",
    description: "Tem certeza que deseja continuar?",
    confirmLabel: "Confirmar",
    cancelLabel: "Cancelar",
    variant: "destructive",
  });

  globalSetState = setState;

  const handleClose = useCallback((result: boolean) => {
    setState((prev) => ({ ...prev, open: false }));
    globalResolve?.(result);
    globalResolve = null;
  }, []);

  return (
    <AlertDialog open={state.open} onOpenChange={(open) => { if (!open) handleClose(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          <AlertDialogDescription>{state.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handleClose(false)}>
            {state.cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handleClose(true)}
            className={state.variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {state.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
