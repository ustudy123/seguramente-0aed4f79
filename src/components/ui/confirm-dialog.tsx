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
  requiredWord?: string;
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
      requiredWord: opts.requiredWord,
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
    requiredWord: undefined,
  });

  const [inputValue, setInputValue] = useState("");

  globalSetState = setState;

  const handleClose = useCallback((result: boolean) => {
    setState((prev) => ({ ...prev, open: false }));
    setInputValue("");
    globalResolve?.(result);
    globalResolve = null;
  }, []);

  const normalize = (s: string) => (s || "").trim().toUpperCase();
  const isConfirmDisabled = !!state.requiredWord && normalize(inputValue) !== normalize(state.requiredWord);

  return (
    <AlertDialog open={state.open} onOpenChange={(open) => { if (!open) handleClose(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-wrap">{state.description}</AlertDialogDescription>
        </AlertDialogHeader>

        {state.requiredWord && (
          <div className="py-3 space-y-2">
            <Label htmlFor="confirm-word" className="text-sm font-medium">
              Digite <span className="font-bold select-all">"{state.requiredWord}"</span> para confirmar:
            </Label>
            <Input
              id="confirm-word"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={`Digite ${state.requiredWord}`}
              className="uppercase"
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handleClose(false)}>
            {state.cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isConfirmDisabled}
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
