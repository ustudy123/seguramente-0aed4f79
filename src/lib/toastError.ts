/**
 * Wrapper inteligente do toast que traduz automaticamente mensagens de erro.
 * Use no lugar de toast.error(error.message) para garantir mensagens em PT-BR.
 */
import { toast } from "sonner";
import { translateError } from "@/lib/translateError";

type ToastOptions = Parameters<typeof toast.error>[1];

/**
 * Exibe um toast de erro com mensagem traduzida automaticamente.
 * Aceita string ou Error.
 */
export function toastError(messageOrError: string | Error | unknown, options?: ToastOptions) {
  let msg: string;
  if (messageOrError instanceof Error) {
    msg = messageOrError.message;
  } else if (typeof messageOrError === "string") {
    msg = messageOrError;
  } else {
    msg = "Ocorreu um erro inesperado.";
  }
  toast.error(translateError(msg), options);
}

/**
 * Handler padrão para onError em mutations do React Query.
 * Uso: onError: handleMutationError
 */
export function handleMutationError(error: Error) {
  toastError(error);
}
