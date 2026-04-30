import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export interface ImportRow {
  nome_completo: string;
  cpf: string;
  email?: string;
  telefone?: string;
  data_nascimento?: string;
  cargo?: string;
  departamento?: string;
  data_admissao?: string;
  salario?: number;
  centro_custo?: string;
  gestor_imediato?: string;
}

export interface ImportResult {
  total: number;
  departamentos_criados: number;
  cargos_criados: number;
  colaboradores_criados: number;
  erros: string[];
}

// Map common header names to standardized keys
const HEADER_MAP: Record<string, keyof ImportRow> = {
  'nome completo': 'nome_completo',
  'nome': 'nome_completo',
  'cpf': 'cpf',
  'e-mail': 'email',
  'email': 'email',
  'telefone': 'telefone',
  'celular': 'telefone',
  'data nascimento': 'data_nascimento',
  'data de nascimento': 'data_nascimento',
  'cargo/função': 'cargo',
  'cargo': 'cargo',
  'função': 'cargo',
  'funcao': 'cargo',
  'departamento': 'departamento',
  'setor': 'departamento',
  'data admissão': 'data_admissao',
  'data de admissão': 'data_admissao',
  'data admissao': 'data_admissao',
  'salário': 'salario',
  'salario': 'salario',
  'centro de custo': 'centro_custo',
  'centro custo': 'centro_custo',
  'gestor imediato': 'gestor_imediato',
  'gestor': 'gestor_imediato',
};

function normalizeHeader(header: string): keyof ImportRow | null {
  const normalized = header.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Try exact match first
  for (const [key, value] of Object.entries(HEADER_MAP)) {
    const normalizedKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalized === normalizedKey) return value;
  }
  return null;
}

function parseDateBR(value: any): string | null {
  if (!value) return null;
  const str = String(value).trim();
  // DD/MM/YYYY
  const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Excel serial number
  if (/^\d{5}$/.test(str)) {
    const date = new Date((Number(str) - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  return null;
}

function normalizeCPF(value: any): string {
  return String(value).replace(/\D/g, '').padStart(11, '0');
}

function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '').padStart(11, '0');
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function parseSpreadsheet(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames.find(
          n => n.toLowerCase() !== 'instruções' && n.toLowerCase() !== 'instrucoes'
        ) || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rawRows.length === 0) {
          reject(new Error('Planilha vazia'));
          return;
        }

        // Map headers
        const headers = Object.keys(rawRows[0]);
        const headerMapping: Record<string, keyof ImportRow> = {};
        for (const h of headers) {
          const mapped = normalizeHeader(h);
          if (mapped) headerMapping[h] = mapped;
        }

        const rows: ImportRow[] = rawRows
          .map(raw => {
            const row: Partial<ImportRow> = {};
            for (const [originalKey, mappedKey] of Object.entries(headerMapping)) {
              const val = raw[originalKey];
              if (val === '' || val === null || val === undefined) continue;
              if (mappedKey === 'salario') {
                row.salario = parseFloat(String(val).replace(/[^\d.,]/g, '').replace(',', '.')) || undefined;
              } else {
                (row as any)[mappedKey] = String(val).trim();
              }
            }
            return row as ImportRow;
          })
          .filter(r => r.nome_completo && r.cpf);

        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
}

export async function importCollaborators(
  rows: ImportRow[],
  tenantId: string,
  empresaId?: string | null
): Promise<ImportResult> {
  const result: ImportResult = {
    total: rows.length,
    departamentos_criados: 0,
    cargos_criados: 0,
    colaboradores_criados: 0,
    erros: [],
  };

  // If no empresaId, try to find the first empresa for this tenant
  if (!empresaId) {
    const { data: empresa } = await supabase
      .from('empresa_cadastro')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();
    empresaId = empresa?.id || null;
  }

  // 1. Collect unique departments and cargos
  const uniqueDepts = new Set<string>();
  const uniqueCargos = new Set<string>();
  for (const row of rows) {
    if (row.departamento) uniqueDepts.add(row.departamento.trim());
    if (row.cargo) uniqueCargos.add(row.cargo.trim());
  }

  // 2. Create departments (upsert by name)
  const deptMap: Record<string, string> = {}; // name -> id
  if (uniqueDepts.size > 0) {
    // Fetch existing
    const { data: existingDepts } = await supabase
      .from('departamentos')
      .select('id, nome')
      .eq('tenant_id', tenantId);

    for (const d of existingDepts || []) {
      deptMap[d.nome.toLowerCase()] = d.id;
    }

    for (const nome of uniqueDepts) {
      if (!deptMap[nome.toLowerCase()]) {
        const { data, error } = await supabase
          .from('departamentos')
          .insert({
            tenant_id: tenantId,
            nome,
            empresa_id: empresaId,
            ativo: true,
          })
          .select('id')
          .single();

        if (data) {
          deptMap[nome.toLowerCase()] = data.id;
          result.departamentos_criados++;
        } else if (error) {
          result.erros.push(`Departamento "${nome}": ${error.message}`);
        }
      }
    }
  }

  // 3. Create cargos (upsert by name)
  const cargoMap: Record<string, string> = {}; // name -> id
  if (uniqueCargos.size > 0) {
    const { data: existingCargos } = await supabase
      .from('cargos')
      .select('id, nome')
      .eq('tenant_id', tenantId);

    for (const c of existingCargos || []) {
      cargoMap[c.nome.toLowerCase()] = c.id;
    }

    for (const nome of uniqueCargos) {
      if (!cargoMap[nome.toLowerCase()]) {
        const deptId = null; // Can be linked later
        const { data, error } = await supabase
          .from('cargos')
          .insert({
            tenant_id: tenantId,
            nome,
            empresa_id: empresaId,
            ativo: true,
          })
          .select('id')
          .single();

        if (data) {
          cargoMap[nome.toLowerCase()] = data.id;
          result.cargos_criados++;
        } else if (error) {
          result.erros.push(`Cargo "${nome}": ${error.message}`);
        }
      }
    }
  }

  // 4. Create admissões (collaborators)
  for (const row of rows) {
    const cpfFormatted = formatCPF(normalizeCPF(row.cpf));

    const admissaoData: any = {
      tenant_id: tenantId,
      empresa_id: empresaId,
      nome_completo: row.nome_completo,
      cpf: cpfFormatted,
      email: row.email?.trim() || null,
      cargo: row.cargo || 'Não informado',
      departamento: row.departamento || null,
      celular: row.telefone || null,
      data_nascimento: parseDateBR(row.data_nascimento),
      data_admissao: parseDateBR(row.data_admissao),
      salario: row.salario || null,
      centro_custo: row.centro_custo || null,
      gestor_imediato: row.gestor_imediato || null,
      status: 'concluido', // Already active
    };

    const { error } = await supabase
      .from('admissoes')
      .insert(admissaoData);

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        result.erros.push(`${row.nome_completo} (CPF duplicado)`);
      } else {
        result.erros.push(`${row.nome_completo}: ${error.message}`);
      }
    } else {
      result.colaboradores_criados++;
    }
  }

  return result;
}
