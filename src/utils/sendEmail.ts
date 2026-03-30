import { supabase } from "@/integrations/supabase/client";

export type EmailTemplate =
  | "convite-colaborador"
  | "alerta-saude"
  | "aso-vencimento"
  | "treinamento-vencimento"
  | "plano-acao"
  | "feedback"
  | "ocorrencia"
  | "generico";

interface SendEmailParams {
  templateName: EmailTemplate;
  recipientEmail: string;
  templateData?: Record<string, any>;
  from?: string;
}

export async function sendEmail({ templateName, recipientEmail, templateData, from }: SendEmailParams) {
  const { data, error } = await supabase.functions.invoke("send-email-resend", {
    body: { templateName, recipientEmail, templateData, from },
  });

  if (error) {
    console.error("Erro ao enviar email:", error);
    throw new Error(error.message || "Falha ao enviar email");
  }

  return data;
}
