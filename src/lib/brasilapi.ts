export interface BrasilApiCnpjResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  email: string;
  telefone: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  cnaes_secundarios: { codigo: number; descricao: string }[];
  porte?: string;
  natureza_juridica?: string;
}

export const cleanCnpj = (cnpj: string): string => cnpj.replace(/\D/g, "");

export const formatCnpj = (cnpj: string): string => {
  const n = cleanCnpj(cnpj);
  if (n.length <= 2) return n;
  if (n.length <= 5) return `${n.slice(0, 2)}.${n.slice(2)}`;
  if (n.length <= 8) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5)}`;
  if (n.length <= 12) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8)}`;
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12, 14)}`;
};

export const formatPhone = (phone: string): string => {
  const n = phone.replace(/\D/g, "");
  if (n.length <= 2) return n;
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7, 11)}`;
};

export const validateCnpj = (cnpj: string): boolean => cleanCnpj(cnpj).length === 14;

export const buscarCnpj = async (cnpj: string): Promise<BrasilApiCnpjResponse | null> => {
  const cleaned = cleanCnpj(cnpj);
  if (cleaned.length !== 14) return null;

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleaned}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Erro ao buscar CNPJ:", error);
    return null;
  }
};
