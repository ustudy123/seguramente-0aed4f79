export interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

export interface EnderecoData {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
}

/**
 * Removes formatting from CEP, returning only digits
 */
export const cleanCep = (cep: string): string => {
  return cep.replace(/\D/g, "");
};

/**
 * Formats CEP to XXXXX-XXX pattern
 */
export const formatCep = (cep: string): string => {
  const numbers = cleanCep(cep);
  
  if (numbers.length <= 5) {
    return numbers;
  }
  
  return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
};

/**
 * Validates if CEP has correct format (8 digits)
 */
export const validateCep = (cep: string): boolean => {
  const cleaned = cleanCep(cep);
  return cleaned.length === 8;
};

/**
 * Fetches address data from ViaCEP API
 */
export const buscarEnderecoPorCep = async (cep: string): Promise<EnderecoData | null> => {
  const cleaned = cleanCep(cep);
  
  if (cleaned.length !== 8) {
    return null;
  }
  
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
    
    if (!response.ok) {
      return null;
    }
    
    const data: ViaCepResponse = await response.json();
    
    if (data.erro) {
      return null;
    }
    
    return {
      cep: data.cep,
      logradouro: data.logradouro,
      bairro: data.bairro,
      cidade: data.localidade,
      estado: data.uf,
    };
  } catch (error) {
    console.error("Erro ao buscar CEP:", error);
    return null;
  }
};
