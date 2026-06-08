import { useState } from "react";
import { useTenant } from "./useTenant";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/integrations/supabase/untypedClient";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { criarPastaColaborador } from "@/utils/criarPastaColaborador";

export interface DadosPlanilha {
  cnpjEmpresa: string;
  nome: string;
  cpf: string;
  sexo: string;
  dataNascimento: string;
  estadoCivil: string;
  naturalidade: string;
  nacionalidade: string;
  nomeMae: string;
  nomePai: string;
  rg: string;
  pis: string;
  email: string;
  telefone: string;
  celular: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  situacao: string;
  filial: string;
  cargo: string;
  departamento: string;
  nivel: string;
  tipoContrato: string;
  dataAdmissao: string;
  salario: string;
  centroCusto: string;
  gestorImediato: string;
  matriculaEsocial: string;
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
  chavePix: string;
  cbo: string;
  linha: number;
  erros: string[];
  empresaId?: string;
}

// Mapeamento de colunas possíveis
const MAPEAMENTO_COLUNAS: Record<string, string[]> = {
  cnpjEmpresa: ["cnpj", "cpf empresa", "cnpj empresa", "cnpj_empresa", "empresa cnpj", "cnpj da empresa", "cnpj/cpf", "cnpj/cpf empresa", "documento empresa", "documento da empresa"],
  nome: ["nome", "nome_completo", "nome completo", "funcionario", "funcionário", "colaborador"],
  cpf: ["cpf", "cpf funcionario", "cpf funcionário", "documento"],
  sexo: ["sexo", "genero", "gênero", "gender"],
  dataNascimento: ["data nascimento", "data_nascimento", "datanascimento", "nascimento", "dt nasc", "dt. nasc", "data de nascimento"],
  estadoCivil: ["estado civil", "estado_civil", "estadocivil", "civil"],
  naturalidade: ["naturalidade", "cidade natal", "cidade_natal"],
  nacionalidade: ["nacionalidade", "pais", "país"],
  nomeMae: ["nome mae", "nome_mae", "mae", "mãe", "nome da mãe"],
  nomePai: ["nome pai", "nome_pai", "pai", "nome do pai"],
  rg: ["rg", "identidade", "registro geral", "registro_geral"],
  pis: ["pis", "pasep", "pis/pasep", "nis", "nit"],
  email: ["email", "e-mail", "e mail", "correio eletronico", "correio eletrônico"],
  telefone: ["telefone", "fone", "tel", "telefone fixo", "telefone_fixo"],
  celular: ["celular", "whatsapp", "mobile", "cel"],
  cep: ["cep", "codigo postal", "código postal"],
  endereco: ["endereco", "endereço", "logradouro", "rua", "avenida"],
  numero: ["numero", "número", "num", "nº"],
  complemento: ["complemento", "comp", "apto", "sala"],
  bairro: ["bairro", "distrito"],
  cidade: ["cidade", "municipio", "município"],
  estado: ["estado", "uf", "estado uf"],
  situacao: ["situacao", "situação", "status", "ativo", "situaçao"],
  filial: ["filial", "unidade", "estabelecimento"],
  cargo: ["cargo", "nome cargo", "nome_cargo", "funcao", "função", "ocupacao", "ocupação"],
  departamento: ["departamento", "depto", "dept", "setor", "area", "área"],
  nivel: ["nivel", "nível", "senioridade", "level"],
  tipoContrato: ["tipo contrato", "tipo_contrato", "vinculo", "vínculo", "tipo vinculo", "regime"],
  dataAdmissao: ["data admissao", "data_admissao", "dataadmissao", "admissao", "admissão", "data de admissao", "data de admissão"],
  salario: ["salario", "salário", "remuneracao", "remuneração", "salario base", "salário base"],
  centroCusto: ["centro custo", "centro_custo", "centrocusto", "cc", "cost center"],
  gestorImediato: ["gestor", "gestor imediato", "gestor_imediato", "supervisor", "lider", "líder"],
  matriculaEsocial: ["matricula esocial", "matrícula esocial", "matricula_esocial", "esocial", "e-social", "mat esocial"],
  banco: ["banco", "banco codigo", "código banco"],
  agencia: ["agencia", "agência", "ag", "ag."],
  conta: ["conta", "numero conta", "número conta", "conta corrente", "conta_corrente"],
  tipoConta: ["tipo conta", "tipo_conta", "tipoconta"],
  chavePix: ["chave pix", "chave_pix", "pix", "chavepix"],
  cbo: ["cbo", "código cbo", "codigo cbo", "cbo ocupação", "cbo ocupacao", "ocupação cbo", "ocupacao cbo"],
};

// Tipos de contrato/vínculo válidos (mapeados para valores aceitos pelo sistema)
const TIPOS_CONTRATO_VALIDOS: Record<string, string> = {
  "clt": "CLT",
  "clt prazo indeterminado": "CLT",
  "clt - prazo indeterminado": "CLT",
  "clt experiencia": "CLT – Experiência",
  "clt - experiencia": "CLT – Experiência",
  "clt experiência": "CLT – Experiência",
  "clt – experiencia": "CLT – Experiência",
  "clt – experiência": "CLT – Experiência",
  "experiencia": "CLT – Experiência",
  "experiência": "CLT – Experiência",
  "pro-labore": "Pró-labore (Sócio)",
  "pro labore": "Pró-labore (Sócio)",
  "pró-labore": "Pró-labore (Sócio)",
  "pro-labore (socio)": "Pró-labore (Sócio)",
  "pró-labore (sócio)": "Pró-labore (Sócio)",
  "socio": "Pró-labore (Sócio)",
  "sócio": "Pró-labore (Sócio)",
  "pj": "⚠️ TERCEIRO",
  "pessoa juridica": "⚠️ TERCEIRO",
  "pessoa jurídica": "⚠️ TERCEIRO",
  "pessoa juridica (pj)": "⚠️ TERCEIRO",
  "pessoa jurídica (pj)": "⚠️ TERCEIRO",
  "estagiario": "Estagiário",
  "estagiário": "Estagiário",
  "estagio": "Estagiário",
  "estágio": "Estagiário",
  "temporario": "Temporário",
  "temporário": "Temporário",
  "autonomo": "Autônomo",
  "autônomo": "Autônomo",
  "freelancer": "Autônomo",
  "intermitente": "Intermitente",
  "clt intermitente": "Intermitente",
  "aprendiz": "Aprendiz",
  "jovem aprendiz": "Aprendiz",
};

export const TIPOS_CONTRATO_OPCOES = [
  "CLT",
  "CLT – Experiência",
  "Pró-labore (Sócio)",
  "Estagiário",
  "Temporário",
  "Autônomo",
  "Intermitente",
  "Aprendiz",
];

// Níveis válidos para mapear
const NIVEIS_VALIDOS: Record<string, string> = {
  "estagiario": "estagiario",
  "estagiário": "estagiario",
  "junior": "junior",
  "júnior": "junior",
  "jr": "junior",
  "pleno": "pleno",
  "pl": "pleno",
  "senior": "senior",
  "sênior": "senior",
  "sr": "senior",
  "especialista": "especialista",
  "esp": "especialista",
  "coordenador": "coordenador",
  "coord": "coordenador",
  "gerente": "gerente",
  "ger": "gerente",
  "diretor": "diretor",
  "dir": "diretor",
};

/**
 * Recorta o range (`!ref`) da planilha para a última linha que realmente contém
 * dados. Algumas planilhas (especialmente exportações de sistemas legados) vêm
 * com `!ref` apontando até a linha 1.048.576, o que faria `sheet_to_json`
 * gerar mais de um milhão de linhas vazias e travar o navegador.
 */
function recortarRangePlanilha(planilha: XLSX.WorkSheet): void {
  const ref = planilha["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  let ultimaLinhaComDados = range.s.r;

  for (let r = range.e.r; r >= range.s.r; r--) {
    let temDado = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = planilha[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== "") {
        temDado = true;
        break;
      }
    }
    if (temDado) {
      ultimaLinhaComDados = r;
      break;
    }
  }

  if (ultimaLinhaComDados < range.e.r) {
    range.e.r = ultimaLinhaComDados;
    planilha["!ref"] = XLSX.utils.encode_range(range);
  }
}

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function encontrarColuna(headers: string[], campo: string): number {
  const possibilidades = MAPEAMENTO_COLUNAS[campo] || [];
  for (const header of headers) {
    const headerNormalizado = normalizarTexto(header);
    for (const possibilidade of possibilidades) {
      if (headerNormalizado.includes(normalizarTexto(possibilidade))) {
        return headers.indexOf(header);
      }
    }
  }
  return -1;
}

function formatarCPF(cpf: string): string {
  // Remove tudo que não é número
  const numeros = cpf.replace(/\D/g, "");
  // Preenche com zeros à esquerda se necessário
  return numeros.padStart(11, "0");
}

function validarCPF(cpf: string): boolean {
  const numeros = cpf.replace(/\D/g, "");
  if (numeros.length !== 11) return false;
  if (/^(\d)\1+$/.test(numeros)) return false;
  
  // Validação dos dígitos verificadores
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(numeros[i]) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(numeros[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(numeros[i]) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(numeros[10])) return false;

  return true;
}

function parsarData(valor: any): string | null {
  if (!valor) return null;
  
  // Se for objeto Date (cellDates: true pode gerar Date objects)
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, "0")}-${String(valor.getDate()).padStart(2, "0")}`;
  }
  
  // Se for número (Excel armazena datas como números seriais)
  if (typeof valor === "number") {
    const data = XLSX.SSF.parse_date_code(valor);
    if (data) {
      return `${data.y}-${String(data.m).padStart(2, "0")}-${String(data.d).padStart(2, "0")}`;
    }
  }
  
  // Se for string
  const texto = String(valor).trim();
  if (!texto) return null;
  
  // Formato DD/MM/YYYY ou DD-MM-YYYY
  const matchDMY = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (matchDMY) {
    return `${matchDMY[3]}-${matchDMY[2].padStart(2, "0")}-${matchDMY[1].padStart(2, "0")}`;
  }
  
  // Formato M/D/YYYY (formato US que XLSX pode gerar com raw:false)
  const matchMDY = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (matchMDY) {
    const year = matchMDY[3].length === 2 ? `20${matchMDY[3]}` : matchMDY[3];
    // Heurística: se o primeiro número > 12, é DD/MM
    if (parseInt(matchMDY[1]) > 12) {
      return `${year}-${matchMDY[2].padStart(2, "0")}-${matchMDY[1].padStart(2, "0")}`;
    }
    // Se o segundo número > 12, é MM/DD
    if (parseInt(matchMDY[2]) > 12) {
      return `${year}-${matchMDY[1].padStart(2, "0")}-${matchMDY[2].padStart(2, "0")}`;
    }
    // Ambíguo: assume DD/MM (padrão BR)
    return `${year}-${matchMDY[2].padStart(2, "0")}-${matchMDY[1].padStart(2, "0")}`;
  }
  
  // Formato YYYY-MM-DD
  const matchYMD = texto.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (matchYMD) {
    return `${matchYMD[1]}-${matchYMD[2].padStart(2, "0")}-${matchYMD[3].padStart(2, "0")}`;
  }
  
  // Excel serial como string (5 dígitos)
  if (/^\d{5}$/.test(texto)) {
    const data = XLSX.SSF.parse_date_code(Number(texto));
    if (data) {
      return `${data.y}-${String(data.m).padStart(2, "0")}-${String(data.d).padStart(2, "0")}`;
    }
  }
  
  // Fallback: tentar new Date()
  const parsed = new Date(texto);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  }
  
  return null;
}

function parsarSexo(valor: string): string {
  const normalizado = normalizarTexto(valor);
  if (normalizado.startsWith("m") || normalizado === "masculino") return "masculino";
  if (normalizado.startsWith("f") || normalizado === "feminino") return "feminino";
  return valor;
}

function parsarSituacao(valor: any): string {
  const texto = String(valor).trim().toLowerCase();
  if (texto === "1" || texto === "ativo" || texto === "true" || texto === "sim") {
    return "concluido";
  }
  return "desligado";
}

function parsarNivel(valor: string): string | null {
  if (!valor) return null;
  const normalizado = normalizarTexto(valor);
  return NIVEIS_VALIDOS[normalizado] || null;
}

function parsarTipoContrato(valor: string): string | null {
  if (!valor) return null;
  const normalizado = normalizarTexto(valor);
  // Detect PJ — redirect to Terceiros
  const mapped = TIPOS_CONTRATO_VALIDOS[normalizado];
  if (mapped === "⚠️ TERCEIRO") return "⚠️ TERCEIRO";
  if (mapped) return mapped;
  // Partial match
  for (const [key, val] of Object.entries(TIPOS_CONTRATO_VALIDOS)) {
    if (normalizado.includes(key) || key.includes(normalizado)) {
      if (val === "⚠️ TERCEIRO") return "⚠️ TERCEIRO";
      return val;
    }
  }
  // Check if already a valid option
  const found = TIPOS_CONTRATO_OPCOES.find(o => normalizarTexto(o) === normalizado);
  if (found) return found;
  return null;
}

export interface DistribuicaoEmpresa {
  empresaId: string;
  cnpj: string;
  razaoSocial: string;
  inseridos: number;
  atualizados: number;
}

export interface ResultadoImportacao {
  total: number;
  departamentosCriados: number;
  cargosCriados: number;
  colaboradoresInseridos: number;
  colaboradoresAtualizados: number;
  erros: { linha: number; mensagem: string }[];
  distribuicaoEmpresas: DistribuicaoEmpresa[];
}

export function useImportacaoPlanilha() {
  const { tenantId } = useTenant();
  const { empresaAtivaId } = useEmpresaAtiva();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const str = (val: any) => String(val || "").trim();

  // Helper para formatar documento (CPF ou CNPJ) para exibição
  const formatarDocumento = (doc: string) => {
    const d = doc.replace(/\D/g, "");
    if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
    if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
    return doc;
  };

  // Helper to get valid empresas for the tenant (indexa por CPF ou CNPJ)
  const getEmpresasValidas = async () => {
    if (!tenantId) return { mapa: {}, info: {}, unicaEmpresaId: null as string | null };
    
    // Buscar todas as empresas do tenant para diagnóstico
    const { data } = await fromTable("empresa_cadastro")
      .select("id, cnpj, cpf, tipo_pessoa, razao_social, ativo")
      .eq("tenant_id", tenantId);

    const empresasAtivas = (data || []).filter((e: any) => e.ativo);

    const mapa: Record<string, string> = {};
    const info: Record<string, { cnpj: string; razaoSocial: string }> = {};
    
    empresasAtivas.forEach((emp: any) => {
      const doc = emp.tipo_pessoa === "pf" ? emp.cpf : emp.cnpj;
      if (!doc) return;
      const docLimpo = String(doc).replace(/\D/g, "");
      mapa[docLimpo] = emp.id;
      info[emp.id] = { cnpj: doc, razaoSocial: emp.razao_social || "Sem razão social" };
    });

    // Quando há apenas uma empresa cadastrada (típico de profissional liberal),
    // permitimos que a coluna de documento fique vazia na planilha.
    const unicaEmpresaId = empresasAtivas.length === 1 ? empresasAtivas[0].id : null;
    if (unicaEmpresaId && !info[unicaEmpresaId]) {
      const e = empresasAtivas[0];
      info[unicaEmpresaId] = { cnpj: e.cnpj || e.cpf || "", razaoSocial: e.razao_social || "Sem razão social" };
    }
    return { mapa, info, unicaEmpresaId };
  };

  // Read only headers and sample rows for mapping step
  const lerArquivoHeaders = async (file: File): Promise<{ headers: string[]; sampleRows: any[][] }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array", cellDates: false });
          const planilha = workbook.Sheets[workbook.SheetNames[0]];
          recortarRangePlanilha(planilha);
          const jsonData = XLSX.utils.sheet_to_json(planilha, { header: 1, raw: true, defval: "", blankrows: false }) as any[][];
          if (jsonData.length < 1) { reject(new Error("Planilha vazia")); return; }
          const headers = jsonData[0].map(h => str(h)).filter(h => h.length > 0);
          const sampleRows = jsonData.slice(1, 4); // up to 3 sample rows
          resolve({ headers, sampleRows });
        } catch (error) { reject(error); }
      };
      reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
      reader.readAsArrayBuffer(file);
    });
  };

  // Parse file using a custom column mapping (fieldKey -> original header name)
  const lerArquivoComMapeamento = async (file: File, mapping: Record<string, string>): Promise<DadosPlanilha[]> => {
    const { mapa: mapaEmpresas, unicaEmpresaId } = await getEmpresasValidas();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array", cellDates: false });
          const planilha = workbook.Sheets[workbook.SheetNames[0]];
          recortarRangePlanilha(planilha);
          const jsonData = XLSX.utils.sheet_to_json(planilha, { header: 1, raw: true, defval: "", blankrows: false }) as any[][];
          if (jsonData.length < 2) { reject(new Error("Planilha vazia ou sem dados")); return; }

          const headers = jsonData[0].map(h => str(h));
          // Build index from fieldKey -> column index using the user's mapping
          const idx: Record<string, number> = {};
          for (const [fieldKey, headerName] of Object.entries(mapping)) {
            const colIdx = headers.indexOf(headerName);
            idx[fieldKey] = colIdx;
          }

          const dados: DadosPlanilha[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const l = jsonData[i];
            const erros: string[] = [];
            const g = (key: string) => idx[key] != null && idx[key] !== -1 ? str(l[idx[key]]) : "";

            let cnpjEmpresa = g("cnpjEmpresa").replace(/\D/g, "");
            const nome = g("nome");
            const cpfRaw = g("cpf");
            const cpf = formatarCPF(cpfRaw);
            const cargo = g("cargo");
            const departamento = g("departamento");
            const dataNascimentoRaw = idx["dataNascimento"] != null && idx["dataNascimento"] !== -1 ? parsarData(l[idx["dataNascimento"]]) || "" : "";
            const dataAdmissaoRaw = idx["dataAdmissao"] != null && idx["dataAdmissao"] !== -1 ? parsarData(l[idx["dataAdmissao"]]) || "" : "";

            if (!cnpjEmpresa) {
              if (unicaEmpresaId) {
                // Profissional liberal / tenant com 1 única empresa: usa o documento dela
                const docUnico = Object.keys(mapaEmpresas).find(k => mapaEmpresas[k] === unicaEmpresaId);
                if (docUnico) cnpjEmpresa = docUnico;
              } else {
                erros.push("CNPJ ou CPF da empresa é obrigatório");
              }
            } else if (cnpjEmpresa.length !== 11 && cnpjEmpresa.length !== 14) {
              erros.push("Documento da empresa inválido (use CPF 11 dígitos ou CNPJ 14 dígitos)");
            } else if (!mapaEmpresas[cnpjEmpresa]) {
              const tipo = cnpjEmpresa.length === 11 ? "CPF" : "CNPJ";
              erros.push(`Empresa com ${tipo} ${formatarDocumento(cnpjEmpresa)} não encontrada no sistema`);
            }
            if (!nome) erros.push("Nome é obrigatório");
            if (!cpf) erros.push("CPF é obrigatório");
            else if (!validarCPF(cpf)) erros.push("CPF inválido");
            if (!cargo) erros.push("Cargo é obrigatório");
            if (!departamento) erros.push("Setor é obrigatório");
            if (!dataNascimentoRaw) erros.push("Data Nascimento é obrigatória");
            if (!dataAdmissaoRaw) erros.push("Data Admissão é obrigatória");
            if (!nome && !cpf && !cargo) continue;

            dados.push({
              cnpjEmpresa,
              nome,
              cpf,
              sexo: idx["sexo"] != null && idx["sexo"] !== -1 ? parsarSexo(g("sexo")) : "",
              dataNascimento: dataNascimentoRaw,
              estadoCivil: g("estadoCivil"),
              naturalidade: g("naturalidade"),
              nacionalidade: g("nacionalidade"),
              nomeMae: g("nomeMae"),
              nomePai: g("nomePai"),
              rg: g("rg"),
              pis: g("pis"),
              email: g("email"),
              telefone: g("telefone"),
              celular: g("celular"),
              cep: g("cep"),
              endereco: g("endereco"),
              numero: g("numero"),
              complemento: g("complemento"),
              bairro: g("bairro"),
              cidade: g("cidade"),
              estado: g("estado"),
              situacao: idx["situacao"] != null && idx["situacao"] !== -1 ? parsarSituacao(l[idx["situacao"]]) : "concluido",
              filial: g("filial"),
              cargo,
              departamento,
              nivel: idx["nivel"] != null && idx["nivel"] !== -1 ? parsarNivel(g("nivel")) || "" : "",
              tipoContrato: (() => {
                const raw = g("tipoContrato");
                if (!raw) return "";
                const parsed = parsarTipoContrato(raw);
                if (parsed === "⚠️ TERCEIRO") {
                  erros.push(`Tipo "PJ/Pessoa Jurídica" não é permitido em Colaboradores. Cadastre no módulo Terceiros & SST.`);
                  return raw;
                }
                if (!parsed) erros.push(`Tipo Contrato "${raw}" inválido. Use: ${TIPOS_CONTRATO_OPCOES.join(", ")}`);
                return parsed || raw;
              })(),
              dataAdmissao: dataAdmissaoRaw,
              salario: g("salario"),
              centroCusto: g("centroCusto"),
              gestorImediato: g("gestorImediato"),
              matriculaEsocial: g("matriculaEsocial"),
              banco: g("banco"),
              agencia: g("agencia"),
              conta: g("conta"),
              tipoConta: g("tipoConta"),
              chavePix: g("chavePix"),
              cbo: (() => {
                const raw = g("cbo");
                if (!raw) return "";
                const digits = raw.replace(/\D/g, "");
                if (digits.length !== 6) { erros.push(`CBO "${raw}" inválido — deve ter 6 dígitos (com ou sem traço).`); return raw; }
                return digits;
              })(),
              linha: i + 1,
              erros,
            });
          }
          resolve(dados);
        } catch (error) { reject(error); }
      };
      reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
      reader.readAsArrayBuffer(file);
    });
  };

  const lerArquivo = async (file: File): Promise<DadosPlanilha[]> => {
    const { mapa: mapaEmpresas, unicaEmpresaId } = await getEmpresasValidas();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array", cellDates: false });
          const primeiraAba = workbook.SheetNames[0];
          const planilha = workbook.Sheets[primeiraAba];
          recortarRangePlanilha(planilha);
          const jsonData = XLSX.utils.sheet_to_json(planilha, { header: 1, raw: true, defval: "", blankrows: false }) as any[][];
          
          if (jsonData.length < 2) { reject(new Error("Planilha vazia ou sem dados")); return; }
          
          const headers = jsonData[0].map(h => str(h));
          
          const idx = {
            cnpjEmpresa: encontrarColuna(headers, "cnpjEmpresa"),
            nome: encontrarColuna(headers, "nome"),
            cpf: encontrarColuna(headers, "cpf"),
            sexo: encontrarColuna(headers, "sexo"),
            dataNascimento: encontrarColuna(headers, "dataNascimento"),
            estadoCivil: encontrarColuna(headers, "estadoCivil"),
            naturalidade: encontrarColuna(headers, "naturalidade"),
            nacionalidade: encontrarColuna(headers, "nacionalidade"),
            nomeMae: encontrarColuna(headers, "nomeMae"),
            nomePai: encontrarColuna(headers, "nomePai"),
            rg: encontrarColuna(headers, "rg"),
            pis: encontrarColuna(headers, "pis"),
            email: encontrarColuna(headers, "email"),
            telefone: encontrarColuna(headers, "telefone"),
            celular: encontrarColuna(headers, "celular"),
            cep: encontrarColuna(headers, "cep"),
            endereco: encontrarColuna(headers, "endereco"),
            numero: encontrarColuna(headers, "numero"),
            complemento: encontrarColuna(headers, "complemento"),
            bairro: encontrarColuna(headers, "bairro"),
            cidade: encontrarColuna(headers, "cidade"),
            estado: encontrarColuna(headers, "estado"),
            situacao: encontrarColuna(headers, "situacao"),
            filial: encontrarColuna(headers, "filial"),
            cargo: encontrarColuna(headers, "cargo"),
            departamento: encontrarColuna(headers, "departamento"),
            nivel: encontrarColuna(headers, "nivel"),
            tipoContrato: encontrarColuna(headers, "tipoContrato"),
            dataAdmissao: encontrarColuna(headers, "dataAdmissao"),
            salario: encontrarColuna(headers, "salario"),
            centroCusto: encontrarColuna(headers, "centroCusto"),
            gestorImediato: encontrarColuna(headers, "gestorImediato"),
            matriculaEsocial: encontrarColuna(headers, "matriculaEsocial"),
            banco: encontrarColuna(headers, "banco"),
            agencia: encontrarColuna(headers, "agencia"),
            conta: encontrarColuna(headers, "conta"),
            tipoConta: encontrarColuna(headers, "tipoConta"),
            chavePix: encontrarColuna(headers, "chavePix"),
            cbo: encontrarColuna(headers, "cbo"),
          };
          
          // A coluna do documento da empresa só é obrigatória se houver mais de uma empresa cadastrada
          if (idx.cnpjEmpresa === -1 && !unicaEmpresaId) { reject(new Error("Coluna 'CNPJ/CPF Empresa' não encontrada na planilha")); return; }
          if (idx.nome === -1) { reject(new Error("Coluna 'Nome' não encontrada na planilha")); return; }
          if (idx.cpf === -1) { reject(new Error("Coluna 'CPF' não encontrada na planilha")); return; }
          if (idx.cargo === -1) { reject(new Error("Coluna 'Cargo' não encontrada na planilha")); return; }
          if (idx.departamento === -1) { reject(new Error("Coluna 'Departamento/Setor' não encontrada na planilha")); return; }
          if (idx.dataAdmissao === -1) { reject(new Error("Coluna 'Data Admissão' não encontrada na planilha")); return; }
          if (idx.dataNascimento === -1) { reject(new Error("Coluna 'Data Nascimento' não encontrada na planilha")); return; }
          
          const dados: DadosPlanilha[] = [];
          
          for (let i = 1; i < jsonData.length; i++) {
            const l = jsonData[i];
            const erros: string[] = [];
            const g = (i: number) => i !== -1 ? str(l[i]) : "";
            
            let cnpjEmpresa = g(idx.cnpjEmpresa).replace(/\D/g, "");
            const nome = g(idx.nome);
            const cpfRaw = g(idx.cpf);
            const cpf = formatarCPF(cpfRaw);
            const cargo = g(idx.cargo);
            const departamento = g(idx.departamento);
            const dataNascimentoRaw = idx.dataNascimento !== -1 ? parsarData(l[idx.dataNascimento]) || "" : "";
            const dataAdmissaoRaw = idx.dataAdmissao !== -1 ? parsarData(l[idx.dataAdmissao]) || "" : "";

            if (!cnpjEmpresa) {
              if (unicaEmpresaId) {
                const docUnico = Object.keys(mapaEmpresas).find(k => mapaEmpresas[k] === unicaEmpresaId);
                if (docUnico) cnpjEmpresa = docUnico;
              } else {
                erros.push("CNPJ ou CPF da empresa é obrigatório");
              }
            } else if (cnpjEmpresa.length !== 11 && cnpjEmpresa.length !== 14) {
              erros.push("Documento da empresa inválido (use CPF 11 dígitos ou CNPJ 14 dígitos)");
            } else if (!mapaEmpresas[cnpjEmpresa]) {
              const tipo = cnpjEmpresa.length === 11 ? "CPF" : "CNPJ";
              erros.push(`Empresa com ${tipo} ${formatarDocumento(cnpjEmpresa)} não encontrada no sistema`);
            }
            if (!nome) erros.push("Nome é obrigatório");
            if (!cpf) erros.push("CPF é obrigatório");
            else if (!validarCPF(cpf)) erros.push("CPF inválido");
            if (!cargo) erros.push("Cargo é obrigatório");
            if (!departamento) erros.push("Setor é obrigatório");
            if (!dataNascimentoRaw) erros.push("Data Nascimento é obrigatória");
            if (!dataAdmissaoRaw) erros.push("Data Admissão é obrigatória");
            if (!nome && !cpf && !cargo) continue;
            
            dados.push({
              cnpjEmpresa,
              nome,
              cpf,
              sexo: idx.sexo !== -1 ? parsarSexo(g(idx.sexo)) : "",
              dataNascimento: dataNascimentoRaw,
              estadoCivil: g(idx.estadoCivil),
              naturalidade: g(idx.naturalidade),
              nacionalidade: g(idx.nacionalidade),
              nomeMae: g(idx.nomeMae),
              nomePai: g(idx.nomePai),
              rg: g(idx.rg),
              pis: g(idx.pis),
              email: g(idx.email),
              telefone: g(idx.telefone),
              celular: g(idx.celular),
              cep: g(idx.cep),
              endereco: g(idx.endereco),
              numero: g(idx.numero),
              complemento: g(idx.complemento),
              bairro: g(idx.bairro),
              cidade: g(idx.cidade),
              estado: g(idx.estado),
              situacao: idx.situacao !== -1 ? parsarSituacao(l[idx.situacao]) : "concluido",
              filial: g(idx.filial),
              cargo,
              departamento,
              nivel: idx.nivel !== -1 ? parsarNivel(g(idx.nivel)) || "" : "",
              tipoContrato: (() => {
                const raw = g(idx.tipoContrato);
                if (!raw) return "";
                const parsed = parsarTipoContrato(raw);
                if (parsed === "⚠️ TERCEIRO") {
                  erros.push(`Tipo "PJ/Pessoa Jurídica" não é permitido em Colaboradores. Cadastre no módulo Terceiros & SST.`);
                  return raw;
                }
                if (!parsed) erros.push(`Tipo Contrato "${raw}" inválido. Use: ${TIPOS_CONTRATO_OPCOES.join(", ")}`);
                return parsed || raw;
              })(),
              dataAdmissao: dataAdmissaoRaw,
              salario: g(idx.salario),
              centroCusto: g(idx.centroCusto),
              gestorImediato: g(idx.gestorImediato),
              matriculaEsocial: g(idx.matriculaEsocial),
              banco: g(idx.banco),
              agencia: g(idx.agencia),
              conta: g(idx.conta),
              tipoConta: g(idx.tipoConta),
              chavePix: g(idx.chavePix),
              cbo: (() => {
                const raw = g(idx.cbo);
                if (!raw) return "";
                const digits = raw.replace(/\D/g, "");
                if (digits.length !== 6) { erros.push(`CBO "${raw}" inválido — deve ter 6 dígitos (com ou sem traço).`); return raw; }
                return digits;
              })(),
              linha: i + 1,
              erros,
            });
          }
          
          resolve(dados);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
      reader.readAsArrayBuffer(file);
    });
  };

  const processarImportacao = async (dados: DadosPlanilha[]): Promise<ResultadoImportacao> => {
    if (!tenantId) throw new Error("Tenant não encontrado");
    
    setIsProcessing(true);
    setProgress(0);
    
    const resultado: ResultadoImportacao = {
      total: dados.length,
      departamentosCriados: 0,
      cargosCriados: 0,
      colaboradoresInseridos: 0,
      colaboradoresAtualizados: 0,
      erros: [],
      distribuicaoEmpresas: [],
    };
    
    try {
      // Filtrar dados com erros
      const dadosValidos = dados.filter(d => d.erros.length === 0);
      const dadosComErros = dados.filter(d => d.erros.length > 0);
      
      dadosComErros.forEach(d => {
        resultado.erros.push({
          linha: d.linha,
          mensagem: d.erros.join("; "),
        });
      });
      
      if (dadosValidos.length === 0) {
        return resultado;
      }
      
      // Passo 0: Resolver empresa_id por CNPJ ou CPF (suporta tipo_pessoa = 'pf' | 'pj')
      setProgress(5);
      const cnpjsUnicos = [...new Set(dadosValidos.map(d => d.cnpjEmpresa).filter(Boolean))];
      const mapaEmpresas: Record<string, string> = {}; // doc limpo -> empresa_id
      const infoEmpresas: Record<string, { cnpj: string; razaoSocial: string }> = {}; // empresa_id -> info

      if (cnpjsUnicos.length > 0) {
        const { data: empresas } = await fromTable("empresa_cadastro")
          .select("id, cnpj, cpf, tipo_pessoa, razao_social, ativo")
          .eq("tenant_id", tenantId)
          .eq("ativo", true);

        const docDuplicados = new Set<string>();
        (empresas || []).forEach((emp: any) => {
          const doc = emp.tipo_pessoa === "pf" ? emp.cpf : emp.cnpj;
          if (!doc) return;
          const docLimpo = String(doc).replace(/\D/g, "");
          if (mapaEmpresas[docLimpo] && mapaEmpresas[docLimpo] !== emp.id) {
            docDuplicados.add(docLimpo);
          }
          mapaEmpresas[docLimpo] = emp.id;
          infoEmpresas[emp.id] = { cnpj: doc, razaoSocial: emp.razao_social || "Sem razão social" };
        });

        // Bloqueia importação quando há mais de uma empresa ATIVA com o mesmo CNPJ/CPF no tenant
        for (const doc of docDuplicados) {
          delete mapaEmpresas[doc];
          const tipo = doc.length === 11 ? "CPF" : "CNPJ";
          dadosValidos.filter(d => d.cnpjEmpresa === doc).forEach(d => {
            resultado.erros.push({
              linha: d.linha,
              mensagem: `${tipo} ${formatarDocumento(doc)} está cadastrado em mais de uma empresa ATIVA neste tenant. Desative a duplicata antes de importar.`,
            });
          });
        }

        // Validar que todos os documentos existem
        for (const doc of cnpjsUnicos) {
          if (!mapaEmpresas[doc]) {
            if (docDuplicados.has(doc)) continue; // já reportado acima
            const tipo = doc.length === 11 ? "CPF" : "CNPJ";
            dadosValidos.filter(d => d.cnpjEmpresa === doc).forEach(d => {
              resultado.erros.push({
                linha: d.linha,
                mensagem: `${tipo} ${formatarDocumento(doc)} não encontrado entre as empresas ATIVAS do cadastro`,
              });
            });
          }
        }
      }
      
      // Filter out rows with unresolved CNPJs
      const dadosComEmpresa = dadosValidos.filter(d => mapaEmpresas[d.cnpjEmpresa]);
      
      if (dadosComEmpresa.length === 0) {
        return resultado;
      }
      
      // Assign empresa_id to each row
      dadosComEmpresa.forEach(d => {
        d.empresaId = mapaEmpresas[d.cnpjEmpresa];
      });
      
      // Passo 1: Criar/buscar departamentos (por empresa)
      setProgress(10);
      const depPorEmpresa = new Map<string, Set<string>>();
      dadosComEmpresa.forEach(d => {
        if (d.departamento && d.empresaId) {
          if (!depPorEmpresa.has(d.empresaId)) depPorEmpresa.set(d.empresaId, new Set());
          depPorEmpresa.get(d.empresaId)!.add(d.departamento);
        }
      });
      
      // key: empresaId|depNome -> depId
      const mapaDepartamentos: Record<string, string> = {};
      
      for (const [empId, depNomes] of depPorEmpresa) {
        const { data: depsExistentes } = await supabase
          .from("departamentos")
          .select("id, nome")
          .eq("tenant_id", tenantId)
          .eq("empresa_id", empId);
        
        depsExistentes?.forEach(dep => {
          mapaDepartamentos[`${empId}|${dep.nome.toLowerCase()}`] = dep.id;
        });
        
        for (const depNome of depNomes) {
          const chave = `${empId}|${depNome.toLowerCase()}`;
          if (!mapaDepartamentos[chave]) {
            const { data: novoDep, error } = await supabase
              .from("departamentos")
              .insert({ tenant_id: tenantId, nome: depNome, ativo: true, empresa_id: empId })
              .select("id")
              .single();
            
            if (novoDep) {
              mapaDepartamentos[chave] = novoDep.id;
              resultado.departamentosCriados++;
            }
            if (error) console.error("Erro ao criar departamento:", error);
          }
        }
      }
      
      setProgress(30);
      
      // Passo 2: Criar/buscar cargos (por empresa)
      const cargoPorEmpresa = new Map<string, Map<string, { nome: string; departamento: string; nivel: string }>>();
      dadosComEmpresa.forEach(d => {
        if (!d.empresaId) return;
        if (!cargoPorEmpresa.has(d.empresaId)) cargoPorEmpresa.set(d.empresaId, new Map());
        const chave = `${d.cargo}|${d.departamento}|${d.nivel}`.toLowerCase();
        if (!cargoPorEmpresa.get(d.empresaId)!.has(chave)) {
          cargoPorEmpresa.get(d.empresaId)!.set(chave, { nome: d.cargo, departamento: d.departamento, nivel: d.nivel });
        }
      });
      
      const mapaCargos: Record<string, string> = {}; // empresaId|cargoNome -> cargoId
      
      for (const [empId, cargos] of cargoPorEmpresa) {
        const { data: cargosExistentes } = await supabase
          .from("cargos")
          .select("id, nome")
          .eq("tenant_id", tenantId)
          .eq("empresa_id", empId);
        
        cargosExistentes?.forEach(cargo => {
          mapaCargos[`${empId}|${cargo.nome.toLowerCase()}`] = cargo.id;
        });
        
        for (const [, cargoInfo] of cargos) {
          const chave = `${empId}|${cargoInfo.nome.toLowerCase()}`;
          if (!mapaCargos[chave]) {
            const departamentoId = cargoInfo.departamento 
              ? mapaDepartamentos[`${empId}|${cargoInfo.departamento.toLowerCase()}`] 
              : null;
            
            const { data: novoCargo, error } = await supabase
              .from("cargos")
              .insert({
                tenant_id: tenantId,
                nome: cargoInfo.nome,
                departamento_id: departamentoId,
                nivel: cargoInfo.nivel || null,
                ativo: true,
                empresa_id: empId,
              })
              .select("id")
              .single();
            
            if (novoCargo) {
              mapaCargos[chave] = novoCargo.id;
              resultado.cargosCriados++;
            }
            if (error) console.error("Erro ao criar cargo:", error);
          }
        }
      }
      
      setProgress(50);
      
      // Passo 3: Inserir/atualizar colaboradores (admissões)
      // Buscar CPFs existentes
      const { data: admissoesExistentes } = await supabase
        .from("admissoes")
        .select("id, cpf")
        .eq("tenant_id", tenantId);
      
      const cpfsExistentes = new Map<string, string>();
      admissoesExistentes?.forEach(adm => {
        if (!adm.cpf) return;
        cpfsExistentes.set(adm.cpf.replace(/\D/g, ""), adm.id);
      });
      
      // Processar cada colaborador
      const totalColabs = dadosComEmpresa.length;
      
      // Acumulador de distribuição por empresa (fora do loop)
      const distMap = new Map<string, { inseridos: number; atualizados: number }>();
      const bumpDist = (empId: string, tipo: "inseridos" | "atualizados") => {
        if (!distMap.has(empId)) distMap.set(empId, { inseridos: 0, atualizados: 0 });
        distMap.get(empId)![tipo]++;
      };
      
      for (let i = 0; i < dadosComEmpresa.length; i++) {
        const dado = dadosComEmpresa[i];
        const cpfLimpo = dado.cpf.replace(/\D/g, "");
        
        const dadosAdmissao = {
          tenant_id: tenantId,
          empresa_id: dado.empresaId || null,
          nome_completo: dado.nome,
          cpf: dado.cpf,
          genero: dado.sexo || null,
          data_nascimento: dado.dataNascimento || null,
          estado_civil: dado.estadoCivil || null,
          naturalidade: dado.naturalidade || null,
          nacionalidade: dado.nacionalidade || null,
          nome_mae: dado.nomeMae || null,
          nome_pai: dado.nomePai || null,
          rg: dado.rg || null,
          email: dado.email?.trim() || null,
          telefone: dado.telefone || null,
          celular: dado.celular || null,
          cep: dado.cep || null,
          endereco: dado.endereco || null,
          numero: dado.numero || null,
          complemento: dado.complemento || null,
          bairro: dado.bairro || null,
          cidade: dado.cidade || null,
          estado: dado.estado || null,
          status: dado.situacao as "rascunho" | "aguardando_documentos" | "em_analise" | "aprovado" | "reprovado" | "concluido",
          filial: dado.filial || null,
          cargo: dado.cargo?.trim(),
          departamento: dado.departamento?.trim() || null,
          tipo_contrato: dado.tipoContrato || null,
          data_admissao: dado.dataAdmissao || null,
          salario: dado.salario ? parseFloat(dado.salario.replace(/[^\d,\.]/g, "").replace(",", ".")) || null : null,
          centro_custo: dado.centroCusto || null,
          gestor_imediato: dado.gestorImediato || null,
          matricula_esocial: dado.matriculaEsocial || null,
          banco: dado.banco || null,
          agencia: dado.agencia || null,
          conta: dado.conta || null,
          tipo_conta: dado.tipoConta || null,
          chave_pix: dado.chavePix || null,
          cbo: dado.cbo || null,
        };

        try {
          if (cpfsExistentes.has(cpfLimpo)) {
            // Atualizar existente
            const admId = cpfsExistentes.get(cpfLimpo)!;
            const { error } = await supabase
              .from("admissoes")
              .update(dadosAdmissao)
              .eq("id", admId);
            
            if (error) {
              resultado.erros.push({
                linha: dado.linha,
                mensagem: `Erro ao atualizar: ${error.message}`,
              });
            } else {
              resultado.colaboradoresAtualizados++;
              if (dado.empresaId) bumpDist(dado.empresaId, "atualizados");
              // Create collaborator folder in Documents module
              try {
                await criarPastaColaborador({
                  tenantId,
                  colaboradorId: admId,
                  colaboradorNome: dado.nome,
                  colaboradorCpf: dado.cpf,
                  empresaId: dado.empresaId || empresaAtivaId || null,
                });
              } catch { /* non-blocking */ }
            }
          } else {
            // Inserir novo
            const { data: insertData, error } = await supabase
              .from("admissoes")
              .insert(dadosAdmissao)
              .select("id")
              .single();
            
            if (error) {
              resultado.erros.push({
                linha: dado.linha,
                mensagem: `Erro ao inserir: ${error.message}`,
              });
            } else {
              resultado.colaboradoresInseridos++;
              if (dado.empresaId) bumpDist(dado.empresaId, "inseridos");
              // Create collaborator folder in Documents module
              if (insertData?.id) {
                try {
                  await criarPastaColaborador({
                    tenantId,
                    colaboradorId: insertData.id,
                    colaboradorNome: dado.nome,
                    colaboradorCpf: dado.cpf,
                    empresaId: dado.empresaId || empresaAtivaId || null,
                  });
                } catch { /* non-blocking */ }
              }
            }
          }
        } catch (err: any) {
          resultado.erros.push({
            linha: dado.linha,
            mensagem: err.message || "Erro desconhecido",
          });
        }
        
        setProgress(50 + Math.round((i / totalColabs) * 50));

        // Na última iteração, materializar distribuição
        if (i === dadosComEmpresa.length - 1) {
          resultado.distribuicaoEmpresas = Array.from(distMap.entries()).map(([empId, counts]) => ({
            empresaId: empId,
            cnpj: infoEmpresas[empId]?.cnpj || "—",
            razaoSocial: infoEmpresas[empId]?.razaoSocial || "Empresa",
            inseridos: counts.inseridos,
            atualizados: counts.atualizados,
          })).sort((a, b) => (b.inseridos + b.atualizados) - (a.inseridos + a.atualizados));
        }
      }
      
      return resultado;
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  return {
    lerArquivo,
    lerArquivoHeaders,
    lerArquivoComMapeamento,
    processarImportacao,
    isProcessing,
    progress,
  };
}
