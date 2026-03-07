import { useState } from "react";
import { useTenant } from "./useTenant";
import { useEmpresaAtiva } from "@/contexts/EmpresaAtivaContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export interface DadosPlanilha {
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
  linha: number;
  erros: string[];
}

// Mapeamento de colunas possíveis
const MAPEAMENTO_COLUNAS: Record<string, string[]> = {
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
};

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
  
  // Se for número (Excel armazena datas como números)
  if (typeof valor === "number") {
    const data = XLSX.SSF.parse_date_code(valor);
    if (data) {
      return `${data.y}-${String(data.m).padStart(2, "0")}-${String(data.d).padStart(2, "0")}`;
    }
  }
  
  // Se for string
  const texto = String(valor).trim();
  
  // Formato DD/MM/YYYY
  const matchDMY = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (matchDMY) {
    return `${matchDMY[3]}-${matchDMY[2].padStart(2, "0")}-${matchDMY[1].padStart(2, "0")}`;
  }
  
  // Formato YYYY-MM-DD
  const matchYMD = texto.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (matchYMD) {
    return `${matchYMD[1]}-${matchYMD[2].padStart(2, "0")}-${matchYMD[3].padStart(2, "0")}`;
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

export interface ResultadoImportacao {
  total: number;
  departamentosCriados: number;
  cargosCriados: number;
  colaboradoresInseridos: number;
  colaboradoresAtualizados: number;
  erros: { linha: number; mensagem: string }[];
}

export function useImportacaoPlanilha() {
  const { tenantId } = useTenant();
  const { empresaAtivaId } = useEmpresaAtiva();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const str = (val: any) => String(val || "").trim();

  const lerArquivo = async (file: File): Promise<DadosPlanilha[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array", cellDates: true });
          const primeiraAba = workbook.SheetNames[0];
          const planilha = workbook.Sheets[primeiraAba];
          const jsonData = XLSX.utils.sheet_to_json(planilha, { header: 1, raw: false, defval: "" }) as string[][];
          
          if (jsonData.length < 2) { reject(new Error("Planilha vazia ou sem dados")); return; }
          
          const headers = jsonData[0].map(h => str(h));
          
          const idx = {
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
          };
          
          if (idx.nome === -1) { reject(new Error("Coluna 'Nome' não encontrada na planilha")); return; }
          if (idx.cpf === -1) { reject(new Error("Coluna 'CPF' não encontrada na planilha")); return; }
          if (idx.cargo === -1) { reject(new Error("Coluna 'Cargo' não encontrada na planilha")); return; }
          
          const dados: DadosPlanilha[] = [];
          
          for (let i = 1; i < jsonData.length; i++) {
            const l = jsonData[i];
            const erros: string[] = [];
            const g = (i: number) => i !== -1 ? str(l[i]) : "";
            
            const nome = g(idx.nome);
            const cpfRaw = g(idx.cpf);
            const cpf = formatarCPF(cpfRaw);
            const cargo = g(idx.cargo);
            
            if (!nome) erros.push("Nome é obrigatório");
            if (!cpf) erros.push("CPF é obrigatório");
            else if (!validarCPF(cpf)) erros.push("CPF inválido");
            if (!cargo) erros.push("Cargo é obrigatório");
            if (!nome && !cpf && !cargo) continue;
            
            dados.push({
              nome,
              cpf,
              sexo: idx.sexo !== -1 ? parsarSexo(g(idx.sexo)) : "",
              dataNascimento: idx.dataNascimento !== -1 ? parsarData(l[idx.dataNascimento]) || "" : "",
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
              departamento: g(idx.departamento),
              nivel: idx.nivel !== -1 ? parsarNivel(g(idx.nivel)) || "" : "",
              tipoContrato: g(idx.tipoContrato),
              dataAdmissao: idx.dataAdmissao !== -1 ? parsarData(l[idx.dataAdmissao]) || "" : "",
              salario: g(idx.salario),
              centroCusto: g(idx.centroCusto),
              gestorImediato: g(idx.gestorImediato),
              banco: g(idx.banco),
              agencia: g(idx.agencia),
              conta: g(idx.conta),
              tipoConta: g(idx.tipoConta),
              chavePix: g(idx.chavePix),
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
      
      // Passo 1: Criar/buscar departamentos
      setProgress(10);
      const departamentosUnicos = [...new Set(dadosValidos.map(d => d.departamento).filter(Boolean))];
      const mapaDepartamentos: Record<string, string> = {};
      
      // Buscar departamentos existentes
      const { data: depsExistentes } = await supabase
        .from("departamentos")
        .select("id, nome")
        .eq("tenant_id", tenantId);
      
      depsExistentes?.forEach(dep => {
        mapaDepartamentos[dep.nome.toLowerCase()] = dep.id;
      });
      
      // Criar departamentos que não existem
      for (const depNome of departamentosUnicos) {
        if (!mapaDepartamentos[depNome.toLowerCase()]) {
          const { data: novoDep, error } = await supabase
            .from("departamentos")
            .insert({ tenant_id: tenantId, nome: depNome, ativo: true, empresa_id: empresaAtivaId || null })
            .select("id")
            .single();
          
          if (novoDep) {
            mapaDepartamentos[depNome.toLowerCase()] = novoDep.id;
            resultado.departamentosCriados++;
          }
          if (error) {
            console.error("Erro ao criar departamento:", error);
          }
        }
      }
      
      setProgress(30);
      
      // Passo 2: Criar/buscar cargos
      const cargosUnicos = dadosValidos.reduce((acc, d) => {
        const chave = `${d.cargo}|${d.departamento}|${d.nivel}`.toLowerCase();
        if (!acc.has(chave)) {
          acc.set(chave, { nome: d.cargo, departamento: d.departamento, nivel: d.nivel });
        }
        return acc;
      }, new Map<string, { nome: string; departamento: string; nivel: string }>());
      
      const mapaCargos: Record<string, string> = {};
      
      // Buscar cargos existentes
      const { data: cargosExistentes } = await supabase
        .from("cargos")
        .select("id, nome")
        .eq("tenant_id", tenantId);
      
      cargosExistentes?.forEach(cargo => {
        mapaCargos[cargo.nome.toLowerCase()] = cargo.id;
      });
      
      // Criar cargos que não existem
      for (const [, cargoInfo] of cargosUnicos) {
        if (!mapaCargos[cargoInfo.nome.toLowerCase()]) {
          const departamentoId = cargoInfo.departamento 
            ? mapaDepartamentos[cargoInfo.departamento.toLowerCase()] 
            : null;
          
          const { data: novoCargo, error } = await supabase
            .from("cargos")
            .insert({
              tenant_id: tenantId,
              nome: cargoInfo.nome,
              departamento_id: departamentoId,
              nivel: cargoInfo.nivel || null,
              ativo: true,
              empresa_id: empresaAtivaId || null,
            })
            .select("id")
            .single();
          
          if (novoCargo) {
            mapaCargos[cargoInfo.nome.toLowerCase()] = novoCargo.id;
            resultado.cargosCriados++;
          }
          if (error) {
            console.error("Erro ao criar cargo:", error);
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
        cpfsExistentes.set(adm.cpf.replace(/\D/g, ""), adm.id);
      });
      
      // Processar cada colaborador
      const totalColabs = dadosValidos.length;
      
      for (let i = 0; i < dadosValidos.length; i++) {
        const dado = dadosValidos[i];
        const cpfLimpo = dado.cpf.replace(/\D/g, "");
        
        const dadosAdmissao = {
          tenant_id: tenantId,
          empresa_id: empresaAtivaId || null,
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
          email: dado.email || `${dado.cpf}@importado.temp`,
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
          cargo: dado.cargo,
          departamento: dado.departamento || null,
          tipo_contrato: dado.tipoContrato || null,
          data_admissao: dado.dataAdmissao || null,
          salario: dado.salario ? parseFloat(dado.salario.replace(/[^\d,\.]/g, "").replace(",", ".")) || null : null,
          centro_custo: dado.centroCusto || null,
          gestor_imediato: dado.gestorImediato || null,
          banco: dado.banco || null,
          agencia: dado.agencia || null,
          conta: dado.conta || null,
          tipo_conta: dado.tipoConta || null,
          chave_pix: dado.chavePix || null,
        };
        
        try {
          if (cpfsExistentes.has(cpfLimpo)) {
            // Atualizar existente
            const { error } = await supabase
              .from("admissoes")
              .update(dadosAdmissao)
              .eq("id", cpfsExistentes.get(cpfLimpo)!);
            
            if (error) {
              resultado.erros.push({
                linha: dado.linha,
                mensagem: `Erro ao atualizar: ${error.message}`,
              });
            } else {
              resultado.colaboradoresAtualizados++;
            }
          } else {
            // Inserir novo
            const { error } = await supabase
              .from("admissoes")
              .insert(dadosAdmissao);
            
            if (error) {
              resultado.erros.push({
                linha: dado.linha,
                mensagem: `Erro ao inserir: ${error.message}`,
              });
            } else {
              resultado.colaboradoresInseridos++;
            }
          }
        } catch (err: any) {
          resultado.erros.push({
            linha: dado.linha,
            mensagem: err.message || "Erro desconhecido",
          });
        }
        
        setProgress(50 + Math.round((i / totalColabs) * 50));
      }
      
      return resultado;
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  return {
    lerArquivo,
    processarImportacao,
    isProcessing,
    progress,
  };
}
