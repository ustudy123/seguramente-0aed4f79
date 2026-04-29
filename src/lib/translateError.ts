/**
 * Traduz mensagens de erro do Supabase e outros serviços para português.
 * Use esta função sempre que exibir error.message ao usuário.
 */
const ERROR_TRANSLATIONS: Record<string, string> = {
  // Auth
  "Invalid login credentials": "E-mail ou senha incorretos. Confira os dados digitados ou clique em \"Esqueceu a senha?\" para redefinir.",
  "Invalid login credentials.": "E-mail ou senha incorretos. Confira os dados digitados ou clique em \"Esqueceu a senha?\" para redefinir.",
  "Email not confirmed": "E-mail não confirmado. Verifique sua caixa de entrada.",
  "Email not confirmed.": "E-mail não confirmado. Verifique sua caixa de entrada.",
  "User already registered": "Este e-mail já está cadastrado. Tente fazer login ou recuperar sua senha.",
  "User already registered.": "Este e-mail já está cadastrado. Tente fazer login ou recuperar sua senha.",
  "User not found": "Usuário não encontrado.",
  "User not found.": "Usuário não encontrado.",
  "Password should be at least 6 characters": "A senha deve ter pelo menos 6 caracteres.",
  "Password should be at least 6 characters.": "A senha deve ter pelo menos 6 caracteres.",
  "Signup requires a valid password": "É necessário informar uma senha válida.",
  "Invalid email": "E-mail inválido.",
  "Invalid email.": "E-mail inválido.",
  "Email rate limit exceeded": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  "Email rate limit exceeded.": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  "For security purposes, you can only request this once every 60 seconds": "Por segurança, você só pode solicitar uma vez a cada 60 segundos.",
  "For security purposes, you can only request this after 60 seconds": "Por segurança, aguarde 60 segundos antes de tentar novamente.",
  "Token has expired or is invalid": "Link expirado ou inválido. Solicite um novo.",
  "Token has expired or is invalid.": "Link expirado ou inválido. Solicite um novo.",
  "New password should be different from the old password": "A nova senha deve ser diferente da senha anterior.",
  "New password should be different from the old password.": "A nova senha deve ser diferente da senha anterior.",
  "Auth session missing!": "Sessão expirada. Faça login novamente.",
  "JWT expired": "Sessão expirada. Faça login novamente.",
  "Refresh Token Not Found": "Sessão expirada. Faça login novamente.",
  "Invalid Refresh Token": "Sessão expirada. Faça login novamente.",
  "invalid claim: missing sub claim": "Sessão inválida. Faça login novamente.",
  "User banned": "Usuário bloqueado. Entre em contato com o administrador.",
  "Too many requests": "Muitas tentativas. Aguarde alguns minutos.",

  // Database / RLS
  "new row violates row-level security policy": "Você não tem permissão para realizar esta ação.",
  "Row level security policy violation": "Você não tem permissão para realizar esta ação.",
  "permission denied": "Permissão negada.",
  "insufficient_privilege": "Privilégio insuficiente.",

  // Storage
  "The resource already exists": "Este arquivo já existe.",
  "Bucket not found": "Armazenamento não encontrado.",
  "Object not found": "Arquivo não encontrado.",

  // Network
  "Failed to fetch": "Erro de conexão. Verifique sua internet.",
  "NetworkError when attempting to fetch resource": "Erro de rede. Verifique sua conexão.",
  "Load failed": "Falha ao carregar. Verifique sua conexão.",
  "Network request failed": "Falha na requisição de rede.",
  "TypeError: Failed to fetch": "Erro de conexão. Verifique sua internet.",

  // Generic
  "Internal Server Error": "Erro interno do servidor. Tente novamente mais tarde.",
  "Bad Request": "Requisição inválida.",
  "Not Found": "Não encontrado.",
  "Unauthorized": "Não autorizado. Faça login novamente.",
  "Forbidden": "Acesso negado.",
  "Service Unavailable": "Serviço indisponível. Tente novamente mais tarde.",
  "Gateway Timeout": "Tempo de resposta excedido. Tente novamente.",
  "Request Timeout": "Tempo de requisição excedido.",
  "Conflict": "Conflito ao processar a requisição.",
  "Method Not Allowed": "Método não permitido.",
  "Unprocessable Entity": "Dados inválidos.",
  "Payload Too Large": "Arquivo muito grande.",
  "Too Many Requests": "Muitas requisições. Aguarde alguns minutos.",

  // Edge functions
  "Edge Function returned a non-2xx status code": "Erro ao processar requisição no servidor.",
  "Edge Function invocation failed": "Falha ao executar a função no servidor.",
  "FunctionsHttpError": "Erro na função do servidor.",
  "FunctionsRelayError": "Erro de comunicação com o servidor.",
  "FunctionsFetchError": "Não foi possível conectar ao servidor.",
};

/**
 * Traduz uma mensagem de erro para português.
 * Tenta match exato e depois match parcial (contains).
 */
export function translateError(message: string | undefined | null): string {
  if (!message) return "Ocorreu um erro inesperado. Tente novamente.";

  // Exact match
  if (ERROR_TRANSLATIONS[message]) {
    return ERROR_TRANSLATIONS[message];
  }

  // Partial match (case-insensitive)
  const lowerMessage = message.toLowerCase();
  for (const [key, translation] of Object.entries(ERROR_TRANSLATIONS)) {
    if (lowerMessage.includes(key.toLowerCase())) {
      return translation;
    }
  }

  // If the message is already in Portuguese (contains common PT words), return as-is
  const ptIndicators = ["não", "erro", "falha", "inválid", "obrigatóri", "já existe", "permissão", "usuário", "senha", "campo"];
  if (ptIndicators.some(w => lowerMessage.includes(w))) {
    return message;
  }

  // Return original with a hint that it may be untranslated
  return message;
}
